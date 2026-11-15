/**
 * XTJSON parser and generator for JavaScript.
 *
 * Implements the XTJSON specification, draft 0.3 (docs/xtjson-spec-en.md).
 * The API follows the global `JSON` object:
 *
 *     import XTJSON from '@cwkr/xtjson';
 *     const value = XTJSON.parse(text, reviver, options);
 *     const value = XTJSON.parse(text, options);
 *     const text = XTJSON.stringify(value, replacer, space, options);
 *     const text = XTJSON.stringify(value, space, options);
 *     const text = XTJSON.stringify(value, options);
 *
 * Design notes:
 * - Single-pass recursive descent parser working directly on UTF-16 code
 *   units of the input; no token array is built.
 * - Errors in the document throw `XTJSONError` (a `SyntaxError`) with line and
 *   column. Errors of the application (invalid options or arguments, values
 *   that cannot be written) throw `TypeError`.
 * - Custom named values, number suffixes (sections 6.4 and 9.5) and the
 *   I-JSON mode (section 12) are passed as options. `XTJSONOptions`
 *   validates them once and can be reused for many calls.
 */

// ---------------------------------------------------------------------------
// Limits (section 11). Hitting a limit is reported as an error.

/** Maximum nesting depth of objects and arrays. */
const MAX_DEPTH = 1000;

// ---------------------------------------------------------------------------
// Character codes

const EOF = -1;
const TAB = 0x09;
const LF = 0x0a;
const VT = 0x0b;
const FF = 0x0c;
const CR = 0x0d;
const SPACE = 0x20;
const DQUOTE = 0x22;
const HASH = 0x23;
const DOLLAR = 0x24;
const PERCENT = 0x25;
const SQUOTE = 0x27;
const STAR = 0x2a;
const PLUS = 0x2b;
const COMMA = 0x2c;
const MINUS = 0x2d;
const DOT = 0x2e;
const SLASH = 0x2f;
const DIGIT_0 = 0x30;
const DIGIT_9 = 0x39;
const COLON = 0x3a;
const LBRACKET = 0x5b;
const BACKSLASH = 0x5c;
const RBRACKET = 0x5d;
const UNDERSCORE = 0x5f;
const LBRACE = 0x7b;
const RBRACE = 0x7d;

// Flags for ASCII characters
const ID_START = 1; // ALPHA / "_" / "$"                       (7.2)
const ID_PART = 2; // ALPHA / DIGIT / "_" / "$"                (7.2)
const SUFFIX_FIRST = 4; // g-n p-w y z G-N P-W Y Z % $          (9.5)
const SUFFIX_NEXT = 8; // a-z A-Z % $                           (9.5)
const DIGIT = 16;

const CHAR_FLAGS = new Uint8Array(128);
/** Value of a hexadecimal digit, or -1. */
const HEX_VALUE = new Int8Array(128).fill(-1);

for (let c = 0; c < 128; c++) {
  const ch = String.fromCharCode(c);
  let flags = 0;
  if (/[A-Za-z_$]/.test(ch)) flags |= ID_START | ID_PART;
  if (/[0-9]/.test(ch)) flags |= ID_PART | DIGIT;
  if (/[g-np-wyzG-NP-WYZ%$]/.test(ch)) flags |= SUFFIX_FIRST;
  if (/[a-zA-Z%$]/.test(ch)) flags |= SUFFIX_NEXT;
  CHAR_FLAGS[c] = flags;
  if (/[0-9A-Fa-f]/.test(ch)) HEX_VALUE[c] = parseInt(ch, 16);
}

/** True for `c` (a code unit, NaN or EOF) with one of the given flags. */
function hasFlag(c, flag) {
  return c >= 0 && c < 128 && (CHAR_FLAGS[c] & flag) !== 0;
}

/** Value of the hexadecimal digit `c`, or -1. */
function hexValue(c) {
  return c >= 0 && c < 128 ? HEX_VALUE[c] : -1;
}

function isDigit(c) {
  return c >= DIGIT_0 && c <= DIGIT_9;
}

/** White space characters other than line breaks (5.1, rule `blank`). */
function isBlank(c) {
  if (c < 0x80) return c === SPACE || c === TAB || c === VT || c === FF;
  return (
    c === 0xa0 ||
    c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) ||
    c === 0x2028 ||
    c === 0x2029 ||
    c === 0x202f ||
    c === 0x205f ||
    c === 0x3000 ||
    c === 0xfeff
  );
}

// Written with fromCharCode so that no tool turns them into real characters.
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const SUFFIX = /^[g-np-wyzG-NP-WYZ%$][a-zA-Z%$]?$/;
const PREDEFINED_VALUES = new Set(['true', 'false', 'null']);

/** Predefined number suffixes and their factors (9.5). */
const PREDEFINED_SUFFIXES = new Map([
  ['k', 1000], ['K', 1000],
  ['kb', 1024], ['Kb', 1024], ['kB', 1024], ['KB', 1024],
  ['mb', 1048576], ['Mb', 1048576], ['mB', 1048576], ['MB', 1048576],
]);

const RADIX_NAMES = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' };
const BITS_PER_DIGIT = { 2: 1, 8: 3, 16: 4 };
const RADIX_PREFIX = { 2: '0b', 8: '0o', 16: '0x' };

// ---------------------------------------------------------------------------
// Errors

/**
 * Error in an XTJSON document. Extends `SyntaxError`, like the errors of
 * `JSON.parse`.
 */
export class XTJSONError extends SyntaxError {
  /**
   * @param {string} reason description of the violated rule
   * @param {number} line 1-based line number
   * @param {number} column 1-based column, counted in Unicode code points
   * @param {number} offset 0-based offset in UTF-16 code units
   * @param {{cause?: unknown}} [options]
   */
  constructor(reason, line, column, offset, options) {
    super(`${reason} (line ${line}, column ${column})`, options);
    this.name = 'XTJSONError';
    this.reason = reason;
    this.line = line;
    this.column = column;
    this.offset = offset;
  }
}

/** Line and column of `offset`; CR LF counts as one line break (5.2). */
function locate(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset; i++) {
    const c = text.charCodeAt(i);
    if (c === LF || c === CR) {
      if (c === CR && text.charCodeAt(i + 1) === LF) i++;
      line++;
      lineStart = i + 1;
    }
  }
  let column = 1;
  for (let i = lineStart; i < offset; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < offset) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) i++;
    }
    column++;
  }
  return { line, column };
}

function hex4(c) {
  return 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
}

/** Readable description of the character at `offset`, for messages. */
function describeAt(text, offset) {
  if (offset >= text.length) return 'end of document';
  const cp = text.codePointAt(offset);
  const ch = String.fromCodePoint(cp);
  if (cp < 0x80 && cp > 0x20 && cp !== 0x7f) return `'${ch}'`;
  if (/^[\p{L}\p{N}\p{P}\p{S}]$/u.test(ch)) return `'${ch}' (${hex4(cp)})`;
  let description = hex4(cp);
  if (cp === LF || cp === CR) description = 'line break';
  else if (/^[\p{White_Space}\p{Cf}]$/u.test(ch)) {
    description += ', which is not a white space character in XTJSON';
  }
  return description;
}

// ---------------------------------------------------------------------------
// Options: definitions (6.4, 9.5) and I-JSON mode (12)

/** Internal state of `XTJSONOptions` instances. */
const OPTIONS = new WeakMap();

/**
 * Validated, immutable options for `XTJSON.parse()` and `XTJSON.stringify()`:
 * custom named values (6.4), custom number suffixes (9.5) and the I-JSON
 * mode (12).
 *
 * Named values keep the order in which they are given. When several named
 * values have the same primitive value, `stringify` writes the one defined
 * last. Validate once and reuse the instance for many calls.
 */
export class XTJSONOptions {
  /**
   * @param {{values?: object, suffixes?: object, ijson?: boolean}} [init]
   *   `values`: identifier -> JSON value; `suffixes`: suffix -> conversion
   *   function. Each as a plain object, a `Map` or an iterable of
   *   `[key, value]` pairs. `ijson`: true for the I-JSON mode.
   * @throws {TypeError} if a definition violates 6.4 or 9.5
   */
  constructor(init) {
    if (init !== undefined && init !== null && (typeof init !== 'object' || Array.isArray(init))) {
      throw new TypeError('XTJSON options must be an object with the properties "values", "suffixes" and "ijson"');
    }
    const ijson = init?.ijson ?? false;
    if (typeof ijson !== 'boolean') {
      throw new TypeError(`Invalid XTJSON option: "ijson" must be true or false, not ${quote(ijson)}`);
    }
    const values = new Map();
    // Named values whose JSON value is not I-JSON conforming, with the reason.
    const ijsonIssues = new Map();
    // For stringify: primitive value -> identifier; the last definition wins.
    const names = new Map();
    for (const [id, value] of entries(init?.values, 'values')) {
      if (typeof id !== 'string' || !IDENTIFIER.test(id)) {
        throw new TypeError(`Invalid XTJSON definition: ${quote(id)} is not an identifier (ASCII letters, digits, "_" and "$", not beginning with a digit)`);
      }
      if (PREDEFINED_VALUES.has(id)) {
        throw new TypeError(`Invalid XTJSON definition: the named value '${id}' is predefined and cannot be redefined`);
      }
      if (values.has(id)) {
        throw new TypeError(`Invalid XTJSON definition: the named value '${id}' is defined more than once`);
      }
      const frozen = freezeJSONValue(value, `named value '${id}'`, 0, []);
      values.set(id, frozen);
      const issue = ijsonValueIssue(frozen);
      if (issue !== undefined) ijsonIssues.set(id, issue);
      if (frozen === null || typeof frozen !== 'object') names.set(frozen, id);
    }
    const suffixes = new Map();
    for (const [suffix, fn] of entries(init?.suffixes, 'suffixes')) {
      if (typeof suffix !== 'string' || !SUFFIX.test(suffix)) {
        throw new TypeError(`Invalid XTJSON definition: ${quote(suffix)} is not a valid number suffix (one or two characters; first g-z or G-Z except o, O, x, X, or % or $; then an ASCII letter, % or $)`);
      }
      if (PREDEFINED_SUFFIXES.has(suffix)) {
        throw new TypeError(`Invalid XTJSON definition: the suffix '${suffix}' is predefined and cannot be redefined`);
      }
      if (suffixes.has(suffix)) {
        throw new TypeError(`Invalid XTJSON definition: the suffix '${suffix}' is defined more than once`);
      }
      if (typeof fn !== 'function') {
        throw new TypeError(`Invalid XTJSON definition: the suffix '${suffix}' needs a conversion function`);
      }
      suffixes.set(suffix, fn);
    }
    OPTIONS.set(this, { values, suffixes, ijson, ijsonIssues, names });
    Object.freeze(this);
  }

  /**
   * True for the I-JSON mode (section 12): duplicate names, unpaired
   * surrogates and noncharacters in names and strings are errors.
   * @returns {boolean}
   */
  get ijson() {
    return OPTIONS.get(this).ijson;
  }

  /**
   * The custom named values in their defined order. Returns a new `Map`;
   * the values are deeply frozen.
   * @returns {Map<string, unknown>}
   */
  get values() {
    return new Map(OPTIONS.get(this).values);
  }

  /**
   * The custom number suffixes. Returns a new `Map`.
   * @returns {Map<string, (value: number) => number>}
   */
  get suffixes() {
    return new Map(OPTIONS.get(this).suffixes);
  }

  get [Symbol.toStringTag]() {
    return 'XTJSONOptions';
  }
}

const DEFAULT_OPTIONS = {
  values: new Map(), suffixes: new Map(), ijson: false, ijsonIssues: new Map(), names: new Map(),
};

// ---------------------------------------------------------------------------
// I-JSON (12)

/**
 * Why a name or string value is not permitted in I-JSON: it contains an
 * unpaired surrogate or a noncharacter. Returns undefined if it is permitted.
 */
function ijsonStringIssue(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0xd800) continue;
    if (c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (!(d >= 0xdc00 && d <= 0xdfff)) return `the unpaired surrogate ${hex4(c)}`;
      const cp = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
      if ((cp & 0xfffe) === 0xfffe) return `the noncharacter ${hex4(cp)}`;
      i++;
    } else if (c <= 0xdfff) {
      return `the unpaired surrogate ${hex4(c)}`;
    } else if ((c >= 0xfdd0 && c <= 0xfdef) || c >= 0xfffe) {
      return `the noncharacter ${hex4(c)}`;
    }
  }
  return undefined;
}

/** `ijsonStringIssue` for all names and strings in a JSON value. */
function ijsonValueIssue(value) {
  if (typeof value === 'string') return ijsonStringIssue(value);
  if (value === null || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const issue = ijsonValueIssue(item);
      if (issue !== undefined) return issue;
    }
    return undefined;
  }
  for (const key of Object.keys(value)) {
    const issue = ijsonStringIssue(key) ?? ijsonValueIssue(value[key]);
    if (issue !== undefined) return issue;
  }
  return undefined;
}

/** Internal state for the `options` argument of `parse` and `stringify`. */
function resolveOptions(options) {
  if (options === undefined || options === null) return DEFAULT_OPTIONS;
  const state = OPTIONS.get(options);
  if (state !== undefined) return state;
  return OPTIONS.get(new XTJSONOptions(options));
}

/** Entries of a plain object, a Map or an iterable of pairs. */
function entries(source, what) {
  if (source === undefined || source === null) return [];
  if (typeof source !== 'object') {
    throw new TypeError(`Invalid XTJSON definition: "${what}" must be an object, a Map or an iterable of [key, value] pairs`);
  }
  if (typeof source[Symbol.iterator] !== 'function') return Object.entries(source);
  const result = [];
  for (const entry of source) {
    if (entry === null || typeof entry !== 'object' || typeof entry[Symbol.iterator] !== 'function') {
      throw new TypeError(`Invalid XTJSON definition: the entries of "${what}" must be [key, value] pairs`);
    }
    const [key, value] = entry;
    result.push([key, value]);
  }
  return result;
}

function quote(x) {
  return typeof x === 'string' ? JSON.stringify(x) : String(x);
}

/**
 * Validates that `value` is a JSON value (6.4) and returns a deeply frozen
 * copy of it.
 */
function freezeJSONValue(value, where, depth, ancestors) {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      if (Number.isFinite(value)) return value;
      throw new TypeError(`Invalid XTJSON definition: ${where} is ${value}, which is not a JSON number`);
    case 'object': {
      if (value === null) return null;
      if (depth >= MAX_DEPTH) {
        throw new TypeError(`Invalid XTJSON definition: ${where} is nested deeper than ${MAX_DEPTH} levels`);
      }
      if (ancestors.includes(value)) {
        throw new TypeError(`Invalid XTJSON definition: ${where} contains a circular reference`);
      }
      ancestors.push(value);
      let copy;
      if (Array.isArray(value)) {
        copy = [];
        for (let i = 0; i < value.length; i++) {
          if (!(i in value)) {
            throw new TypeError(`Invalid XTJSON definition: ${where} is a sparse array`);
          }
          copy.push(freezeJSONValue(value[i], where, depth + 1, ancestors));
        }
      } else {
        const proto = Object.getPrototypeOf(value);
        if (proto !== Object.prototype && proto !== null) {
          throw new TypeError(`Invalid XTJSON definition: ${where} contains an object that is neither a plain object nor an array`);
        }
        copy = {};
        for (const key of Object.keys(value)) {
          setMember(copy, key, freezeJSONValue(value[key], where, depth + 1, ancestors));
        }
      }
      ancestors.pop();
      return Object.freeze(copy);
    }
    default:
      throw new TypeError(`Invalid XTJSON definition: ${where} contains ${typeof value === 'undefined' ? 'undefined' : 'a ' + typeof value}, which is not a JSON value`);
  }
}

/** Mutable deep copy of a validated (frozen) JSON value. */
function cloneJSONValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneJSONValue);
  const copy = {};
  for (const key of Object.keys(value)) setMember(copy, key, cloneJSONValue(value[key]));
  return copy;
}

/** Creates an own data property, also for the name "__proto__". */
function setMember(obj, name, value) {
  if (name === '__proto__') {
    Object.defineProperty(obj, name, { value, writable: true, enumerable: true, configurable: true });
  } else {
    obj[name] = value;
  }
}

// ---------------------------------------------------------------------------
// Parser

class Parser {
  /**
   * @param {string} text
   * @param {{values: Map<string, unknown>, suffixes: Map<string, Function>, ijson: boolean, ijsonIssues: Map<string, string>}} options
   */
  constructor(text, options) {
    this.text = text;
    this.len = text.length;
    this.pos = 0;
    this.depth = 0;
    this.values = options.values;
    this.suffixes = options.suffixes;
    this.ijson = options.ijson;
    this.ijsonIssues = options.ijsonIssues;
  }

  // ----- Errors -----------------------------------------------------------

  fail(reason, offset = this.pos, cause) {
    const { line, column } = locate(this.text, offset);
    throw new XTJSONError(reason, line, column, offset, cause === undefined ? undefined : { cause });
  }

  failUnexpected(expected, offset = this.pos) {
    this.fail(`Unexpected ${describeAt(this.text, offset)}, expected ${expected}`, offset);
  }

  // ----- White space, line breaks, comments (5) ---------------------------

  /** Code unit at the current position, or EOF. */
  peek() {
    return this.pos < this.len ? this.text.charCodeAt(this.pos) : EOF;
  }

  /**
   * Skips white space and comments (rule `S`). Returns true if a line break
   * occurred outside block comments, which makes it a separator (7.3).
   */
  skipSpace() {
    const text = this.text;
    const len = this.len;
    let pos = this.pos;
    let newline = false;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === SPACE || c === TAB) {
        pos++;
      } else if (c === LF || c === CR) {
        newline = true;
        pos++;
      } else if (c === SLASH) {
        const d = text.charCodeAt(pos + 1);
        if (d === SLASH) {
          pos = this.skipLineComment(pos + 2);
        } else if (d === STAR) {
          const end = text.indexOf('*/', pos + 2);
          if (end < 0) this.fail('Unterminated block comment', pos);
          pos = end + 2;
        } else {
          break;
        }
      } else if (c === HASH) {
        pos = this.skipLineComment(pos + 1);
      } else if (isBlank(c)) {
        pos++;
      } else {
        break;
      }
    }
    this.pos = pos;
    return newline;
  }

  /** Returns the offset of the line break that ends the comment, or EOF. */
  skipLineComment(pos) {
    const text = this.text;
    const len = this.len;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF || c === CR) break;
      pos++;
    }
    return pos;
  }

  // ----- Document (6.1, 6.2) ----------------------------------------------

  parseDocument() {
    this.skipSpace();
    const start = this.pos;
    const c = this.peek();
    if (c === EOF) {
      this.fail('The document is empty; expected a value or at least one member');
    }

    let value;
    if (((c === DQUOTE || c === SQUOTE) && !this.atTripleQuote(c)) || hasFlag(c, ID_START)) {
      // 6.2: a single-line string or an identifier followed by ':' starts an
      // implicit root object.
      const isIdentifier = c !== DQUOTE && c !== SQUOTE;
      const token = isIdentifier ? this.readIdentifier() : this.readSingleLineString(c);
      this.skipSpace();
      if (this.peek() === COLON) {
        value = {};
        this.parseMembers(value, EOF, start, token);
      } else {
        value = isIdentifier ? this.resolveNamedValue(token, start) : token;
      }
    } else {
      value = this.parseValue();
    }

    this.skipSpace();
    if (this.pos < this.len) {
      if (this.peek() === COLON && (c === DQUOTE || c === SQUOTE) && this.atTripleQuote(c, start)) {
        this.fail('A multi-line string is not permitted as a name', start);
      }
      this.fail(`Unexpected ${describeAt(this.text, this.pos)} after the root value; a document contains exactly one value`);
    }
    return value;
  }

  /** True if the code units at `pos` are three quotation marks `q`. */
  atTripleQuote(q, pos = this.pos) {
    const text = this.text;
    return text.charCodeAt(pos) === q && text.charCodeAt(pos + 1) === q && text.charCodeAt(pos + 2) === q;
  }

  // ----- Values (6.3) -----------------------------------------------------

  parseValue() {
    const c = this.peek();
    switch (c) {
      case LBRACE:
        return this.parseObject();
      case LBRACKET:
        return this.parseArray();
      case DQUOTE:
      case SQUOTE:
        return this.atTripleQuote(c) ? this.readMultiLineString(c) : this.readSingleLineString(c);
      case MINUS:
        return this.parseNumber();
      default:
        if (isDigit(c)) return this.parseNumber();
        if (hasFlag(c, ID_START)) {
          const start = this.pos;
          return this.resolveNamedValue(this.readIdentifier(), start);
        }
        if (c === PLUS || c === DOT) {
          this.fail(`A number must not begin with '${String.fromCharCode(c)}'`);
        }
        return this.failUnexpected('a value');
    }
  }

  /** Value of a named value (6.4); `start` is the offset of the identifier. */
  resolveNamedValue(id, start) {
    switch (id) {
      case 'true':
        return true;
      case 'false':
        return false;
      case 'null':
        return null;
    }
    const value = this.values.get(id);
    if (value !== undefined) {
      if (this.ijson) {
        // 12: the values that result from named values count as well.
        const issue = this.ijsonIssues.get(id);
        if (issue !== undefined) {
          this.fail(`The value of the named value '${id}' contains ${issue}, which is not permitted in I-JSON mode`, start);
        }
      }
      return cloneJSONValue(value);
    }

    let hint;
    const lower = id.toLowerCase();
    if (PREDEFINED_VALUES.has(lower)) {
      hint = `; did you mean '${lower}'? Named values are case-sensitive`;
    } else if (id === 'NaN' || id === 'Infinity' || id === 'undefined') {
      hint = `; ${id} is not a JSON value`;
    } else {
      hint = `; text without quotation marks is not a string, write "${id}" for a string`;
    }
    return this.fail(`Undefined named value '${id}'${hint}`, start);
  }

  // ----- Objects and arrays (7) -------------------------------------------

  enter(start) {
    if (++this.depth > MAX_DEPTH) {
      this.fail(`Nesting depth exceeds the limit of ${MAX_DEPTH}`, start);
    }
  }

  parseObject() {
    const start = this.pos;
    this.enter(start);
    this.pos++;
    const obj = {};
    this.skipSpace();
    if (this.peek() !== RBRACE) this.parseMembers(obj, RBRACE, start);
    this.pos++; // '}'
    this.depth--;
    return obj;
  }

  parseArray() {
    const start = this.pos;
    this.enter(start);
    this.pos++;
    const arr = [];
    this.skipSpace();
    if (this.peek() !== RBRACKET) {
      do {
        arr.push(this.parseValue());
      } while (this.separator(RBRACKET, start));
    }
    this.pos++; // ']'
    this.depth--;
    return arr;
  }

  /**
   * Reads members up to `closer` (`}` or EOF for the implicit root object)
   * and leaves the position on the closer. If `name` is given, the first
   * name has already been read and the position is on the ':'.
   */
  parseMembers(obj, closer, start, name) {
    // I-JSON mode: offset of each name, to report duplicates (12).
    const seen = this.ijson ? new Map() : undefined;
    let nameStart = start;
    for (;;) {
      if (name === undefined) {
        nameStart = this.pos;
        name = this.readName();
      }
      if (seen !== undefined) {
        const first = seen.get(name);
        if (first !== undefined) {
          const { line, column } = locate(this.text, first);
          this.fail(`Duplicate name ${JSON.stringify(name)}; names must be unique in I-JSON mode (first occurrence at line ${line}, column ${column})`, nameStart);
        }
        seen.set(name, nameStart);
      }
      this.skipSpace();
      if (this.peek() !== COLON) this.failUnexpected(`':' after the name ${JSON.stringify(name)}`);
      this.pos++;
      this.skipSpace();
      // Duplicate names outside the I-JSON mode: the last member applies (7.2).
      setMember(obj, name, this.parseValue());
      if (!this.separator(closer, start)) return;
      name = undefined;
    }
  }

  /** Name of a member (7.2): single-line string or identifier. */
  readName() {
    const c = this.peek();
    if (c === DQUOTE || c === SQUOTE) {
      if (this.atTripleQuote(c)) this.fail('A multi-line string is not permitted as a name');
      return this.readSingleLineString(c);
    }
    if (hasFlag(c, ID_START)) return this.readIdentifier();
    if (isDigit(c) || c === MINUS) {
      this.fail('A name without quotation marks must begin with a letter, "_" or "$"; write this name in quotation marks');
    }
    return this.failUnexpected('a name');
  }

  /**
   * Separator after an item (7.3, 7.4). Returns true if a further item
   * follows; then the position is on it. Returns false at the closer.
   */
  separator(closer, start) {
    const before = this.pos;
    const newline = this.skipSpace();
    const c = this.peek();
    if (c === COMMA) {
      this.pos++;
      this.skipSpace();
      const d = this.peek();
      return d !== closer; // trailing comma (7.4)
    }
    if (c === closer) return false;
    if (c === EOF) {
      const { line, column } = locate(this.text, start);
      const what = closer === RBRACE ? 'object' : 'array';
      this.fail(`Unterminated ${what}: expected '${String.fromCharCode(closer)}' for the ${what} opened at line ${line}, column ${column}`);
    }
    if (newline) return true;

    if (closer === EOF && c === RBRACE) {
      this.fail("Unexpected '}': the implicit root object is not closed with '}'");
    }
    let reason = closer === EOF
      ? 'Expected a comma or a line break between two members'
      : `Expected ',', a line break or '${String.fromCharCode(closer)}'`;
    reason += `, found ${describeAt(this.text, this.pos)}`;
    const gap = this.text.slice(before, this.pos);
    if (gap.includes(LINE_SEPARATOR) || gap.includes(PARAGRAPH_SEPARATOR)) {
      reason += '; U+2028 and U+2029 are not line breaks';
    } else if (/\/\*[^]*[\r\n]/.test(gap)) {
      reason += '; a line break inside a block comment does not separate items';
    }
    return this.fail(reason);
  }

  // ----- Identifiers (7.2) ------------------------------------------------

  readIdentifier() {
    const text = this.text;
    const start = this.pos;
    let pos = start + 1;
    while (hasFlag(text.charCodeAt(pos), ID_PART)) pos++;
    this.pos = pos;
    const c = pos < this.len ? text.charCodeAt(pos) : EOF;
    if (c === MINUS || c === DOT || (c >= 0x80 && !isBlank(c))) {
      this.fail(`Unexpected ${describeAt(text, pos)} in an identifier; identifiers consist of ASCII letters, digits, "_" and "$", other names must be written in quotation marks`);
    }
    return text.slice(start, pos);
  }

  // ----- Strings (8) ------------------------------------------------------

  /** Single-line string (8.1) delimited by `q`. */
  readSingleLineString(q) {
    const text = this.text;
    const len = this.len;
    const start = this.pos;
    let pos = start + 1;
    let chunk = pos;
    let out = '';
    for (;;) {
      if (pos >= len) this.fail('Unterminated string', start);
      const c = text.charCodeAt(pos);
      if (c === q) {
        this.pos = pos + 1;
        const value = out + text.slice(chunk, pos);
        if (this.ijson) this.checkIJSONString(value, start);
        return value;
      }
      if (c === BACKSLASH) {
        out += text.slice(chunk, pos);
        this.pos = pos;
        out += this.readEscape();
        pos = chunk = this.pos;
      } else if (c < SPACE) {
        if (c === LF || c === CR) {
          this.fail('Line break in a single-line string; write \\n or use a multi-line string (""" or \'\'\')', pos);
        }
        this.fail(`Control character ${hex4(c)} must be escaped in a string`, pos);
      } else {
        pos++;
      }
    }
  }

  /**
   * Escape sequence (8.2) at the current position (on the backslash).
   * Returns the decoded text and moves behind the sequence.
   */
  readEscape() {
    const text = this.text;
    const at = this.pos;
    const c = at + 1 < this.len ? text.charCodeAt(at + 1) : EOF;
    let result;
    switch (c) {
      case DQUOTE: result = '"'; break;
      case SQUOTE: result = "'"; break;
      case BACKSLASH: result = '\\'; break;
      case SLASH: result = '/'; break;
      case 0x62: result = '\b'; break; // b
      case 0x66: result = '\f'; break; // f
      case 0x6e: result = '\n'; break; // n
      case 0x72: result = '\r'; break; // r
      case 0x74: result = '\t'; break; // t
      case 0x76: result = '\v'; break; // v
      case DIGIT_0:
        if (isDigit(text.charCodeAt(at + 2))) {
          this.fail("'\\0' must not be followed by a digit; there are no octal escape sequences", at);
        }
        result = '\0';
        break;
      case 0x78: { // \xHH
        const h1 = hexValue(text.charCodeAt(at + 2));
        const h2 = hexValue(text.charCodeAt(at + 3));
        if (h1 < 0 || h2 < 0) this.fail("'\\x' must be followed by exactly two hexadecimal digits", at);
        this.pos = at + 4;
        return String.fromCharCode(h1 * 16 + h2);
      }
      case 0x75: { // \uXXXX or \u{...}
        if (text.charCodeAt(at + 2) === LBRACE) return this.readCodePointEscape(at);
        let unit = 0;
        for (let i = at + 2; i < at + 6; i++) {
          const h = hexValue(text.charCodeAt(i));
          if (h < 0) this.fail("'\\u' must be followed by exactly four hexadecimal digits or by '{'", at);
          unit = unit * 16 + h;
        }
        this.pos = at + 6;
        return String.fromCharCode(unit);
      }
      case LF:
      case CR:
        return this.fail('A backslash before a line break is not permitted; there is no line continuation', at);
      case EOF:
        return this.fail('Unterminated escape sequence', at);
      default:
        if (isDigit(c)) {
          return this.fail(`Unknown escape sequence '\\${String.fromCharCode(c)}'; there are no octal escape sequences`, at);
        }
        return this.fail(`Unknown escape sequence '\\${String.fromCodePoint(text.codePointAt(at + 1))}'`, at);
    }
    this.pos = at + 2;
    return result;
  }

  /** `\u{...}` (8.2); `at` is the offset of the backslash. */
  readCodePointEscape(at) {
    const text = this.text;
    let pos = at + 3;
    let value = 0;
    let digits = 0;
    for (let h; (h = hexValue(text.charCodeAt(pos))) >= 0; pos++) {
      // Saturate above the maximum to avoid precision loss on long input.
      value = Math.min(value * 16 + h, 0x110000);
      digits++;
    }
    if (digits === 0) this.fail("'\\u{' must be followed by at least one hexadecimal digit", at);
    if (text.charCodeAt(pos) !== RBRACE) {
      this.fail("'\\u{' must be closed with '}'; only hexadecimal digits are permitted between the braces", at);
    }
    if (value > 0x10ffff) this.fail('The code point in \\u{...} is greater than 10FFFF', at);
    if (value >= 0xd800 && value <= 0xdfff) {
      this.fail('\\u{...} must not denote a surrogate (D800 to DFFF); write single surrogates as \\uXXXX', at);
    }
    this.pos = pos + 1;
    return String.fromCodePoint(value);
  }

  /** Multi-line string (8.3) delimited by three `q`. */
  readMultiLineString(q) {
    const start = this.pos;
    const value = this.multiLineValue(q);
    if (this.ijson) this.checkIJSONString(value, start);
    return value;
  }

  /** I-JSON (12): no unpaired surrogates and no noncharacters in strings. */
  checkIJSONString(value, start) {
    const issue = ijsonStringIssue(value);
    if (issue !== undefined) {
      this.fail(`The string contains ${issue}, which is not permitted in I-JSON mode`, start);
    }
  }

  /** Value of a multi-line string according to the four steps of 8.3. */
  multiLineValue(q) {
    const text = this.text;
    const len = this.len;
    const start = this.pos;
    let pos = start + 3;

    // Step 1: form lines. For each line we keep its decoded text, the number
    // of unescaped spaces and tabs at its beginning (`lead`) and at its end
    // (`trail`), and its offset for error messages.
    const lines = [];
    const leads = [];
    const trails = [];
    const offsets = [];
    let line = '';
    let chunk = pos;
    let lead = 0;
    let trail = 0;
    let leading = true;
    offsets.push(pos);

    for (;;) {
      if (pos >= len) this.fail('Unterminated multi-line string', start);
      const c = text.charCodeAt(pos);
      if (c === q && text.charCodeAt(pos + 1) === q && text.charCodeAt(pos + 2) === q) {
        lines.push(line + text.slice(chunk, pos));
        leads.push(lead);
        trails.push(trail);
        this.pos = pos + 3;
        break;
      }
      if (c === SPACE || c === TAB) {
        if (leading) lead++;
        trail++;
        pos++;
      } else if (c === LF || c === CR) {
        lines.push(line + text.slice(chunk, pos));
        leads.push(lead);
        trails.push(trail);
        pos += c === CR && text.charCodeAt(pos + 1) === LF ? 2 : 1;
        offsets.push(pos);
        line = '';
        chunk = pos;
        lead = trail = 0;
        leading = true;
      } else if (c === BACKSLASH) {
        line += text.slice(chunk, pos);
        this.pos = pos;
        line += this.readEscape();
        pos = chunk = this.pos;
        leading = false;
        trail = 0;
      } else if (c < SPACE) {
        this.fail(`Control character ${hex4(c)} must be escaped in a string`, pos);
      } else {
        leading = false;
        trail = 0;
        pos++;
      }
    }

    const last = lines.length - 1;
    if (last === 0) return lines[0];

    // Step 2: remove unescaped white space at the end of every line but the last.
    for (let k = 0; k < last; k++) {
      if (trails[k] > 0) {
        lines[k] = lines[k].slice(0, lines[k].length - trails[k]);
        if (leads[k] > lines[k].length) leads[k] = lines[k].length;
      }
    }

    // Step 3: remove indentation, only if the string begins with an empty line.
    if (lines[0] !== '') return lines.join('\n');
    let indent = Infinity;
    for (let k = 1; k <= last; k++) {
      if (lines[k] !== '' || k === last) indent = Math.min(indent, leads[k]);
    }
    if (indent > 0) {
      let prefix;
      for (let k = 1; k <= last; k++) {
        // Empty lines stay empty. (An empty last line would make indent 0.)
        if (lines[k] === '') continue;
        const p = lines[k].slice(0, indent);
        if (prefix === undefined) prefix = p;
        else if (p !== prefix) {
          this.fail('Inconsistent indentation in a multi-line string: the removed indentation must consist of the same characters in all lines (do not mix tabs and spaces)', offsets[k]);
        }
        lines[k] = lines[k].slice(indent);
      }
    }

    // Step 4: join the lines with LF.
    lines.shift();
    return lines.join('\n');
  }

  // ----- Numbers (9) ------------------------------------------------------

  parseNumber() {
    const text = this.text;
    const start = this.pos;
    let pos = start;
    if (text.charCodeAt(pos) === MINUS) {
      pos++;
      const c = text.charCodeAt(pos);
      if (!isDigit(c)) {
        if (isBlank(c) || c === LF || c === CR || c === SLASH || c === HASH) {
          this.fail("No white space or comment is permitted between '-' and the digits", pos);
        }
        this.fail("Expected a digit after '-'", pos);
      }
    }

    let radix = 10;
    if (text.charCodeAt(pos) === DIGIT_0) {
      switch (text.charCodeAt(pos + 1) | 0x20) { // lower case
        case 0x78: radix = 16; break; // x
        case 0x6f: radix = 8; break; // o
        case 0x62: radix = 2; break; // b
      }
    }

    let value;
    let isInteger = true;
    if (radix !== 10) {
      // 9.2: hexadecimal, octal, binary
      const digitsStart = pos + 2;
      pos = this.scanDigits(digitsStart, radix, `after '${text.slice(pos, pos + 2)}'`);
      value = this.radixValue(text.slice(digitsStart, pos), radix, start);
      if (text.charCodeAt(start) === MINUS) value = -value;
    } else {
      // 9.1: decimal
      if (text.charCodeAt(pos) === DIGIT_0) {
        pos++;
        const c = text.charCodeAt(pos);
        if (isDigit(c)) {
          this.fail('A number must not have leading zeros; octal numbers are written with the prefix 0o', start);
        }
        if (c === UNDERSCORE) this.fail("'_' is only permitted between two digits", pos);
      } else {
        pos = this.scanDigits(pos, 10, '');
      }
      if (text.charCodeAt(pos) === DOT) {
        isInteger = false;
        pos = this.scanDigits(pos + 1, 10, "after '.'");
      }
      if ((text.charCodeAt(pos) | 0x20) === 0x65) { // e E
        isInteger = false;
        pos++;
        const c = text.charCodeAt(pos);
        if (c === PLUS || c === MINUS) pos++;
        pos = this.scanDigits(pos, 10, 'in the exponent');
      }
      value = Number(this.withoutUnderscores(start, pos));
      if (!Number.isFinite(value)) this.fail('The number is out of range', start);
    }

    // 9.5: suffix
    let c = text.charCodeAt(pos);
    if (hasFlag(c, SUFFIX_FIRST)) {
      const suffixStart = pos;
      pos++;
      if (hasFlag(text.charCodeAt(pos), SUFFIX_NEXT)) pos++;
      const suffix = text.slice(suffixStart, pos);
      c = text.charCodeAt(pos);
      if (hasFlag(c, ID_PART) || c === PERCENT || c === DOT) {
        this.fail(`Unexpected ${describeAt(text, pos)} after the number suffix '${suffix}'; a suffix has at most two characters`, pos);
      }
      // `value` is exact for non-decimal numbers (checked in radixValue) and
      // for decimal integers within the safe range; otherwise it may be rounded.
      const exact = radix !== 10 || (isInteger && Math.abs(value) <= Number.MAX_SAFE_INTEGER);
      value = this.applySuffix(suffix, value, exact, start, suffixStart, pos);
    } else if (c === DOT) {
      this.fail(radix === 10
        ? "Unexpected '.' in a number"
        : `A ${RADIX_NAMES[radix]} number cannot have a fraction part`, pos);
    } else if (hasFlag(c, ID_PART)) {
      if (isDigit(c)) {
        this.fail(`'${String.fromCharCode(c)}' is not a valid ${RADIX_NAMES[radix]} digit`, pos);
      }
      if (c === UNDERSCORE) this.fail("'_' is only permitted between two digits", pos);
      this.fail(`Unexpected '${String.fromCharCode(c)}' after a number; a number suffix cannot begin with a to f, o or x`, pos);
    }

    this.pos = pos;
    return value;
  }

  /**
   * Scans a digit sequence of the given radix with single `_` between
   * digits (9.3). Returns the offset behind it.
   */
  scanDigits(pos, radix, context) {
    const text = this.text;
    const first = text.charCodeAt(pos);
    if (!(hexValue(first) >= 0 && hexValue(first) < radix)) {
      if (first === UNDERSCORE) this.fail("'_' is only permitted between two digits", pos);
      this.fail(`Expected a ${RADIX_NAMES[radix]} digit${context ? ' ' + context : ''}`, pos);
    }
    pos++;
    for (;;) {
      const c = text.charCodeAt(pos);
      const d = hexValue(c);
      if (d >= 0 && d < radix) {
        pos++;
      } else if (c === UNDERSCORE) {
        const n = hexValue(text.charCodeAt(pos + 1));
        if (!(n >= 0 && n < radix)) this.fail("'_' is only permitted between two digits", pos);
        pos += 2;
      } else {
        return pos;
      }
    }
  }

  withoutUnderscores(start, end) {
    const raw = this.text.slice(start, end);
    return raw.includes('_') ? raw.replaceAll('_', '') : raw;
  }

  /**
   * Exact value of hexadecimal, octal or binary digits (9.2, 9.4): numbers
   * that a double cannot represent exactly are an error, never rounded.
   */
  radixValue(digits, radix, start) {
    if (digits.includes('_')) digits = digits.replaceAll('_', '');
    let i = 0;
    while (i < digits.length - 1 && digits.charCodeAt(i) === DIGIT_0) i++;
    if ((digits.length - i) * BITS_PER_DIGIT[radix] <= 53) return parseInt(digits.slice(i), radix);
    const big = BigInt(RADIX_PREFIX[radix] + digits.slice(i));
    const value = Number(big);
    if (!Number.isFinite(value) || BigInt(value) !== big) {
      this.fail(`The ${RADIX_NAMES[radix]} number cannot be represented exactly as a JavaScript number`, start);
    }
    return value;
  }

  /**
   * Applies a number suffix (9.5). `exact` tells whether `value` is exactly
   * the number written between `start` and `suffixStart`.
   */
  applySuffix(suffix, value, exact, start, suffixStart, end) {
    const factor = PREDEFINED_SUFFIXES.get(suffix);
    let result;
    if (factor !== undefined) {
      result = exact
        ? value * factor // both operands exact: the product is correctly rounded
        : exactDecimalProduct(this.withoutUnderscores(start, suffixStart), factor);
    } else {
      const fn = this.suffixes.get(suffix);
      if (fn === undefined) {
        this.fail(`Undefined number suffix '${suffix}'`, suffixStart);
      }
      try {
        result = fn(value);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.fail(`The conversion of '${this.text.slice(start, end)}' failed: ${detail}`, start, error);
      }
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        this.fail(`The conversion function of the suffix '${suffix}' did not return a finite number`, suffixStart);
      }
    }
    if (!Number.isFinite(result)) this.fail('The number is out of range', start);
    return result;
  }
}

/**
 * Exact product of a decimal number written as text and an integer factor,
 * rounded once to the nearest double (9.5: `0.1kb` is 102.4).
 */
function exactDecimalProduct(digits, factor) {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(digits);
  const fraction = m[3] ?? '';
  let exponent = (m[4] === undefined ? 0 : Number(m[4])) - fraction.length;
  // Keep the exponent in a range that Number() parses; beyond it the result
  // is 0 or out of range anyway.
  exponent = Math.max(-1e7, Math.min(1e7, exponent));
  const product = BigInt(m[2] + fraction) * BigInt(factor);
  return Number(`${m[1]}${product}e${exponent}`);
}

// ---------------------------------------------------------------------------
// Reviver (as in JSON.parse, ECMA-262 InternalizeJSONProperty)

function internalize(holder, key, reviver) {
  const value = holder[key];
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value)) {
      const length = value.length;
      for (let i = 0; i < length; i++) reviveMember(value, String(i), reviver);
    } else {
      for (const k of Object.keys(value)) reviveMember(value, k, reviver);
    }
  }
  return reviver.call(holder, key, value);
}

function reviveMember(obj, key, reviver) {
  const value = internalize(obj, key, reviver);
  // Like JSON.parse: failures (e.g. a frozen object) are ignored.
  if (value === undefined) Reflect.deleteProperty(obj, key);
  else Reflect.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
}

// ---------------------------------------------------------------------------
// Generator

/** Suffixes that stringify writes, in the order of priority (9.5). */
const OUTPUT_SUFFIXES = [['mb', 1048576], ['kb', 1024], ['k', 1000]];

/** Maximum length of the indentation, as in JSON.stringify. */
const MAX_GAP = 10;

const IS_RAW_JSON = typeof JSON.isRawJSON === 'function' ? JSON.isRawJSON : () => false;

const LINE_SEPARATORS = new RegExp(`[${LINE_SEPARATOR}${PARAGRAPH_SEPARATOR}]`, 'g');

/**
 * A string in double quotation marks (8.1). Uses the escapes of
 * JSON.stringify and in addition escapes U+2028 and U+2029, which some
 * editors display as a line break (section 13).
 */
function quoteString(s) {
  const json = JSON.stringify(s);
  return json.includes(LINE_SEPARATOR) || json.includes(PARAGRAPH_SEPARATOR)
    ? json.replace(LINE_SEPARATORS, (c) => (c === LINE_SEPARATOR ? '\\u2028' : '\\u2029'))
    : json;
}

/**
 * A number as a decimal with `_` between groups of three digits of the
 * integer part (9.3). Integers that are multiples of 1048576, 1024 or 1000
 * get the suffix `mb`, `kb` or `k` (in this order of priority), as long as
 * the remaining factor is a safe integer so that the text reads back as
 * exactly the same number.
 */
function formatNumber(n) {
  if (n !== 0 && Number.isInteger(n)) {
    for (const [suffix, factor] of OUTPUT_SUFFIXES) {
      if (n % factor === 0 && Math.abs(n / factor) <= Number.MAX_SAFE_INTEGER) {
        return groupDigits(String(n / factor)) + suffix;
      }
    }
  }
  return groupDigits(String(n)); // String(-0) is "0", as in JSON.stringify
}

function groupDigits(text) {
  const m = /^(-?)(\d+)(.*)$/.exec(text);
  if (m[2].length <= 3) return text;
  return m[1] + m[2].replace(/\B(?=(\d{3})+$)/g, '_') + m[3];
}

function isBlankCode(c) {
  return c === SPACE || c === TAB;
}

/** Escape sequence for a single character in a multi-line string. */
function escapeCode(c) {
  switch (c) {
    case SPACE: return '\\x20';
    case TAB: return '\\t';
    case 0x08: return '\\b';
    case FF: return '\\f';
    case CR: return '\\r';
    case BACKSLASH: return '\\\\';
    case DQUOTE: return '\\"';
    default: return '\\u' + c.toString(16).toUpperCase().padStart(4, '0');
  }
}

/**
 * Text of one line of a multi-line string (8.3). Escapes what would end the
 * string or change its value: backslashes, control characters except tab,
 * unpaired surrogates, U+2028 and U+2029, the third of three quotation
 * marks in a row, a quotation mark directly before the closing delimiter
 * (`beforeDelimiter`) and a space or tab at the end of a line that step 2
 * would remove (`trailingBlank`).
 */
function escapeMultiLineText(text, trailingBlank, beforeDelimiter) {
  const n = text.length;
  let out = '';
  let quotes = 0; // unescaped quotation marks in a row
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    if (c === DQUOTE) {
      if (quotes === 2 || (beforeDelimiter && i === n - 1)) {
        out += '\\"';
        quotes = 0;
      } else {
        out += '"';
        quotes++;
      }
      continue;
    }
    quotes = 0;
    if (isBlankCode(c)) {
      out += trailingBlank && i === n - 1 ? escapeCode(c) : text[i];
    } else if (c < SPACE || c === BACKSLASH || c === 0x2028 || c === 0x2029) {
      out += escapeCode(c);
    } else if (c >= 0xd800 && c <= 0xdfff) {
      const d = text.charCodeAt(i + 1);
      if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) {
        out += text[i] + text[i + 1];
        i++;
      } else {
        out += escapeCode(c);
      }
    } else {
      out += text[i];
    }
  }
  return out;
}

/**
 * A multi-line string (8.3) whose lines are indented with `indent`. The
 * text begins with an empty line, so that exactly `indent` is removed again
 * when it is read.
 */
function multiLineString(value, indent) {
  const parts = value.split('\n');
  const last = parts.length - 1;
  const lines = [];
  for (let i = 0; i < last; i++) {
    lines.push(parts[i] === '' ? '' : indent + escapeMultiLineText(parts[i], true, false));
  }
  if (parts[last] === '') {
    // The value ends with a line break: the closing delimiter gets its own line.
    lines.push(indent + '"""');
  } else {
    let text = escapeMultiLineText(parts[last], false, true);
    // The last line counts towards the smallest indentation. If it and all
    // other lines begin with white space, more than `indent` would be
    // removed; escaping its first character prevents that.
    if (isBlankCode(text.charCodeAt(0)) &&
        lines.every((line) => line === '' || isBlankCode(line.charCodeAt(indent.length)))) {
      text = escapeCode(text.charCodeAt(0)) + text.slice(1);
    }
    lines.push(indent + text + '"""');
  }
  return '"""\n' + lines.join('\n');
}

/** Serialization as in JSON.stringify (ECMA-262 SerializeJSONProperty). */
class Generator {
  /**
   * @param {Function | undefined} replacer replacer function
   * @param {string[] | undefined} propertyList names from a replacer array
   * @param {string} gap indentation of one level ('' for compact output)
   * @param {{names: Map<unknown, string>, ijson: boolean}} options
   */
  constructor(replacer, propertyList, gap, options) {
    this.replacer = replacer;
    this.propertyList = propertyList;
    this.gap = gap;
    this.names = options.names;
    this.ijson = options.ijson;
    this.stack = [];
  }

  /** The document, or undefined if the value cannot be written. */
  document(value) {
    const root = this.prepare({ '': value }, '');
    if (root !== null && typeof root === 'object' && !Array.isArray(root) && !IS_RAW_JSON(root)) {
      // 6.2: an object at the top level is written without braces, unless
      // it is empty.
      this.enter(root);
      const members = this.members(root, '');
      this.leave();
      if (members.length === 0) return '{}';
      return members.join(this.gap === '' ? ',' : '\n');
    }
    return this.write(root, '');
  }

  /** Value of `holder[key]` after toJSON, the replacer and unwrapping. */
  prepare(holder, key) {
    let value = holder[key];
    if ((value !== null && typeof value === 'object') || typeof value === 'bigint') {
      const toJSON = value.toJSON;
      if (typeof toJSON === 'function') value = toJSON.call(value, key);
    }
    if (this.replacer !== undefined) value = this.replacer.call(holder, key, value);
    if (value !== null && typeof value === 'object') {
      if (value instanceof Number) value = Number(value);
      else if (value instanceof String) value = String(value);
      else if (value instanceof Boolean || value instanceof BigInt) value = value.valueOf();
    }
    return value;
  }

  /**
   * Text of a prepared value; `indent` is the indentation of the line on
   * which it begins. Undefined for values that JSON omits.
   */
  write(value, indent) {
    switch (typeof value) {
      case 'string':
        return this.string(value, indent);
      case 'number':
        if (!Number.isFinite(value)) return this.literal(null); // as JSON
        return this.names.get(value) ?? formatNumber(value);
      case 'boolean':
        return this.literal(value);
      case 'bigint':
        throw new TypeError('XTJSON.stringify: a BigInt cannot be written; convert it with toJSON or a replacer');
      case 'object':
        if (value === null) return this.literal(null);
        if (IS_RAW_JSON(value)) return value.rawJSON;
        return Array.isArray(value) ? this.array(value, indent) : this.object(value, indent);
      default:
        return undefined; // undefined, functions and symbols
    }
  }

  /** `true`, `false` or `null`, or a custom named value for it. */
  literal(value) {
    return this.names.get(value) ?? String(value);
  }

  string(value, indent) {
    if (this.ijson) this.checkIJSON(value, 'a string');
    const name = this.names.get(value);
    if (name !== undefined) return name;
    if (this.gap !== '' && value.includes('\n')) return multiLineString(value, indent + this.gap);
    return quoteString(value);
  }

  /** A name (7.2): an identifier if possible, otherwise a string. */
  name(key) {
    if (this.ijson) this.checkIJSON(key, 'the name');
    return IDENTIFIER.test(key) ? key : quoteString(key);
  }

  checkIJSON(value, what) {
    const issue = ijsonStringIssue(value);
    if (issue !== undefined) {
      throw new TypeError(`XTJSON.stringify: ${what} ${quoteString(value)} contains ${issue}, which is not permitted in I-JSON mode`);
    }
  }

  enter(value) {
    if (this.stack.includes(value)) {
      throw new TypeError('XTJSON.stringify: the value contains a circular reference');
    }
    this.stack.push(value);
  }

  leave() {
    this.stack.pop();
  }

  /** Members of an object, each written as `name: value`. */
  members(value, indent) {
    const keys = this.propertyList ?? Object.keys(value);
    const separator = this.gap === '' ? ':' : ': ';
    const members = [];
    for (const key of keys) {
      const text = this.write(this.prepare(value, key), indent);
      if (text !== undefined) members.push(this.name(key) + separator + text);
    }
    return members;
  }

  object(value, indent) {
    this.enter(value);
    const inner = indent + this.gap;
    const members = this.members(value, inner);
    this.leave();
    return this.block('{', members, '}', indent, inner);
  }

  array(value, indent) {
    this.enter(value);
    const inner = indent + this.gap;
    const items = [];
    const length = value.length;
    for (let i = 0; i < length; i++) {
      items.push(this.write(this.prepare(value, String(i)), inner) ?? this.literal(null));
    }
    this.leave();
    return this.block('[', items, ']', indent, inner);
  }

  /** Items in brackets: compact with commas, or one per line without (7.3). */
  block(open, items, close, indent, inner) {
    if (items.length === 0) return open + close;
    if (this.gap === '') return open + items.join(',') + close;
    return `${open}\n${inner}${items.join('\n' + inner)}\n${indent}${close}`;
  }
}

/** Indentation from the `space` argument, as in JSON.stringify. */
function indentation(space) {
  if (space instanceof Number) space = Number(space);
  else if (space instanceof String) space = String(space);
  if (typeof space === 'number') {
    const n = Math.min(MAX_GAP, Math.trunc(space) || 0);
    return n >= 1 ? ' '.repeat(n) : '';
  }
  if (typeof space === 'string') {
    const gap = space.slice(0, MAX_GAP);
    if (!/^[ \t]*$/.test(gap)) {
      throw new TypeError('XTJSON.stringify: "space" may only contain spaces and tabs; other characters would make the indentation invalid');
    }
    return gap;
  }
  return '';
}

/** Names from a replacer array, as in JSON.stringify. */
function propertyList(replacer) {
  const seen = new Set();
  for (const item of replacer) {
    if (typeof item === 'string') seen.add(item);
    else if (typeof item === 'number' || item instanceof Number || item instanceof String) seen.add(String(item));
  }
  return [...seen];
}

// ---------------------------------------------------------------------------
// Arguments

const isFunction = (x) => typeof x === 'function';
const isReplacer = (x) => typeof x === 'function' || Array.isArray(x);
const isSpace = (x) => typeof x === 'number' || typeof x === 'string' || x instanceof Number || x instanceof String;
const isOptions = (x) => typeof x === 'object' && !Array.isArray(x) && !(x instanceof Number) && !(x instanceof String);

const PARSE_ARGUMENTS = [
  { name: 'reviver', description: 'a reviver (a function)', test: isFunction },
  { name: 'options', description: 'options (an object)', test: isOptions },
];

const STRINGIFY_ARGUMENTS = [
  { name: 'replacer', description: 'a replacer (a function or an array)', test: isReplacer },
  { name: 'space', description: 'space (a number or a string)', test: isSpace },
  { name: 'options', description: 'options (an object)', test: isOptions },
];

/**
 * Assigns the optional arguments by their type. Each kind may occur once,
 * in the order of `kinds`; null and undefined are skipped.
 */
function readArguments(caller, args, kinds) {
  const result = kinds.map(() => undefined);
  const expected = kinds.map((kind) => kind.description).join(', ');
  let next = 0;
  for (const arg of args) {
    if (arg === undefined || arg === null) continue;
    const k = kinds.findIndex((kind) => kind.test(arg));
    if (k < 0) {
      throw new TypeError(`${caller}: unexpected argument of type ${typeof arg}; expected ${expected}, in this order`);
    }
    if (k < next) {
      const problem = result[k] !== undefined ? 'given twice' : 'in the wrong position';
      throw new TypeError(`${caller}: the ${kinds[k].name} is ${problem}; expected ${expected}, in this order`);
    }
    result[k] = arg;
    next = k + 1;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Parses an XTJSON document and returns its value.
 *
 * The optional arguments are told apart by their type:
 *
 *     parse(text)
 *     parse(text, reviver)            // a function
 *     parse(text, reviver, options)
 *     parse(text, null, options)
 *     parse(text, options)            // an object
 *
 * @param {string} text the document
 * @param {Function | XTJSONOptions | object | null} [reviver]
 *   a function transforms the result, as in `JSON.parse`; an object are the
 *   options
 * @param {XTJSONOptions | object | null} [options] custom named values,
 *   number suffixes and the I-JSON mode
 * @returns {any}
 * @throws {XTJSONError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
function parse(text, reviver, options) {
  [reviver, options] = readArguments('XTJSON.parse', [reviver, options], PARSE_ARGUMENTS);
  const resolved = resolveOptions(options);
  const source = String(text);
  if (typeof source.isWellFormed === 'function' ? !source.isWellFormed() : LONE_SURROGATE.test(source)) {
    const offset = source.search(LONE_SURROGATE);
    const { line, column } = locate(source, offset);
    throw new XTJSONError(
      `Unpaired surrogate ${hex4(source.charCodeAt(offset))}; the text is not valid Unicode and cannot be encoded as UTF-8`,
      line, column, offset);
  }
  const value = new Parser(source, resolved).parseDocument();
  return reviver === undefined ? value : internalize({ '': value }, '', reviver);
}

/**
 * Writes a value as an XTJSON document.
 *
 * Works like `JSON.stringify`, with these differences in the output:
 * an object at the top level is written without braces; names that are
 * identifiers are written without quotation marks; with `space`, items are
 * separated by line breaks instead of commas and strings that contain a
 * line break are written as multi-line strings; numbers are grouped with
 * `_` and multiples of 1048576, 1024 and 1000 get the suffix `mb`, `kb` or
 * `k`; primitive values for which a named value is defined are written as
 * that named value.
 *
 * The optional arguments are told apart by their type:
 *
 *     stringify(value)
 *     stringify(value, replacer, space, options)   // replacer: function or array
 *     stringify(value, null, space, options)
 *     stringify(value, space, options)             // space: number or string
 *     stringify(value, options)                    // options: object
 *
 * @param {any} value
 * @param {Function | Array<string | number> | number | string | XTJSONOptions | object | null} [replacer]
 * @param {number | string | XTJSONOptions | object | null} [space]
 *   indentation: a number of spaces (at most 10) or a string of spaces and
 *   tabs
 * @param {XTJSONOptions | object | null} [options] named values and the
 *   I-JSON mode; custom suffixes are not used for output
 * @returns {string | undefined} undefined if the value cannot be written
 *   (undefined, a function or a symbol), as in `JSON.stringify`
 * @throws {TypeError} for circular references, BigInt values, invalid
 *   arguments or options, and strings not permitted in I-JSON mode
 */
function stringify(value, replacer, space, options) {
  [replacer, space, options] = readArguments('XTJSON.stringify', [replacer, space, options], STRINGIFY_ARGUMENTS);
  const resolved = resolveOptions(options);
  const generator = new Generator(
    typeof replacer === 'function' ? replacer : undefined,
    Array.isArray(replacer) ? propertyList(replacer) : undefined,
    indentation(space),
    resolved,
  );
  return generator.document(value);
}

/** The XTJSON object, modelled on the global `JSON` object. */
const XTJSON = Object.freeze(Object.create(Object.prototype, {
  parse: { value: parse, enumerable: false },
  stringify: { value: stringify, enumerable: false },
  [Symbol.toStringTag]: { value: 'XTJSON' },
}));

export { parse, stringify };
export default XTJSON;
