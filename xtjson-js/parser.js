/**
 * XTJSON parser: `Parser`, `ParserError`, `Options` and `parse()`.
 *
 * Implements the XTJSON specification, draft 0.7 (docs/xtjson-spec-en.md).
 *
 * Design notes:
 * - Single-pass recursive descent parser working directly on UTF-16 code
 *   units of the input; no token array is built.
 * - Errors in the document throw `ParserError` (a `SyntaxError`) with line and
 *   column. Errors of the application (invalid options or arguments) throw
 *   `TypeError`.
 * - The configuration and the state of a run are private. A `Parser` can be
 *   reused for many documents.
 * - The module has no side effects when it is imported; tables are built on
 *   first use.
 */

// ---------------------------------------------------------------------------
// Limits (section 11). Hitting a limit is reported as an error.

/** Default for the option `maxDepth`: maximum nesting depth of objects and arrays. */
const DEFAULT_MAX_DEPTH = 1000;

// ---------------------------------------------------------------------------
// Characters

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

/** 10^0 to 10^22, the powers of ten that a JavaScript number holds exactly. */
const POWERS_OF_TEN = [
  1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11,
  1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22,
];

const RADIX_NAMES = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' };
const BITS_PER_DIGIT = { 2: 1, 8: 3, 16: 4 };
const RADIX_PREFIX = { 2: '0b', 8: '0o', 16: '0x' };

const SUFFIX_LIST = 'k, kb, m, mb, ms, s, min, h, pct and n';

/**
 * The suffixes of 9.5 (rules `suffix` and `int-suffix`), ordered so that the
 * first one that matches is the longest match.
 */
const SUFFIX_NAMES = ['min', 'ms', 'mb', 'm', 'kb', 'k', 's', 'h', 'pct', 'n'];

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;


// Flags for ASCII characters in the table `flags` of `characterTables()`
const ID_START = 1; // ALPHA / "_" / "$"                       (7.2)
const ID_PART = 2; // ALPHA / DIGIT / "_" / "$"                (7.2)

/** @type {{flags: Uint8Array, hex: Int8Array} | undefined} */
let tables;

/**
 * Lookup tables for ASCII characters, built on first use and shared by all
 * parsers. `flags`: the flags `ID_START` and `ID_PART` of
 * each ASCII character. `hex`: the value of a hexadecimal digit, or -1.
 * @returns {{flags: Uint8Array, hex: Int8Array}}
 */
function characterTables() {
  if (tables === undefined) {
    const flags = new Uint8Array(128);
    const hex = new Int8Array(128).fill(-1);
    for (let c = 0; c < 128; c++) {
      const ch = String.fromCharCode(c);
      let f = 0;
      if (/[A-Za-z_$]/.test(ch)) f |= ID_START | ID_PART;
      if (/[0-9]/.test(ch)) f |= ID_PART;
      flags[c] = f;
      if (/[0-9A-Fa-f]/.test(ch)) hex[c] = parseInt(ch, 16);
    }
    tables = { flags, hex };
  }
  return tables;
}

function isDigit(c) {
  return c >= DIGIT_0 && c <= DIGIT_9;
}

/** `U+XXXX` for a code point, for messages. */
function hex4(c) {
  return 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
}

/** A value for messages: strings in quotation marks. */
function quote(x) {
  return typeof x === 'string' ? JSON.stringify(x) : String(x);
}

/** True for the literals `true`, `false`, `null` and `nil` (6.4). */
function isLiteral(id) {
  return id === 'true' || id === 'false' || id === 'null' || id === 'nil';
}

/**
 * Why a name or string value is not permitted in strict mode (12): it
 * contains an unpaired surrogate or a noncharacter. Returns undefined if it
 * is permitted.
 */
function strictStringIssue(s) {
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

/** True for `c` (a code unit, NaN or EOF) with one of the given flags in `flags`. */
function hasFlag(flags, c, flag) {
  return c >= 0 && c < 128 && (flags[c] & flag) !== 0;
}

/** Value of the hexadecimal digit `c` according to the table `hex`, or -1. */
function hexValue(hex, c) {
  return c >= 0 && c < 128 ? hex[c] : -1;
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

// ---------------------------------------------------------------------------
// Errors

/**
 * Error in an XTJSON document. Extends `SyntaxError`, like the errors of
 * `JSON.parse`.
 */
export class ParserError extends SyntaxError {
  /**
   * @param {string} reason description of the violated rule
   * @param {number} line 1-based line number
   * @param {number} column 1-based column, counted in Unicode code points
   * @param {number} offset 0-based offset in UTF-16 code units
   * @param {{cause?: unknown}} [options]
   */
  constructor(reason, line, column, offset, options) {
    super(`${reason} (line ${line}, column ${column})`, options);
    this.name = 'ParserError';
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

/** Creates an own data property, also for the name "__proto__". */
function setMember(obj, name, value) {
  if (name === '__proto__') {
    Object.defineProperty(obj, name, { value, writable: true, enumerable: true, configurable: true });
  } else {
    obj[name] = value;
  }
}

// ---------------------------------------------------------------------------
// Options: strict mode (12) and limits (11)

const OPTION_NAMES = ['maxDepth', 'strict'];
const OPTION_LIST = '"maxDepth" and "strict"';

/**
 * Internal state of an `Options` instance, read by the parser.
 * @typedef {object} OptionsState
 * @property {number} maxDepth
 * @property {boolean} strict
 */

/** Set in the static block of `Options`; see `resolveOptions`. */
let resolve;

/**
 * Validated, immutable options for `parse()`: strict mode (12) and limits
 * (11).
 *
 * The literals, the directive `%strict` and the number suffixes are fixed by
 * sections 6.4, 6.5 and 9.5; the application can define none of them.
 * Validate once and reuse the instance for many calls.
 */
export class Options {
  /** @type {OptionsState} */
  #state;

  /** @type {OptionsState | undefined} State without options, created on first use. */
  static #defaultState;

  static {
    resolve = (options) => {
      if (options === undefined || options === null) {
        return (Options.#defaultState ??= new Options().#state);
      }
      if (typeof options === 'object' && #state in options) return options.#state;
      return new Options(options).#state;
    };
  }

  /**
   * @param {{maxDepth?: number, strict?: boolean} | Options} [init]
   *   `maxDepth`: maximum nesting depth of objects and arrays (default 1000).
   *   `strict`: true for strict mode (default false).
   * @throws {TypeError} if an option is unknown or invalid
   */
  constructor(init) {
    if (init !== undefined && init !== null) {
      if (typeof init !== 'object' || Array.isArray(init)) {
        throw new TypeError(`XTJSON options must be an object with the properties ${OPTION_LIST}`);
      }
      if (#state in init) {
        this.#state = init.#state; // immutable, so it can be shared
        Object.freeze(this);
        return;
      }
      for (const key of Object.keys(init)) {
        if (!OPTION_NAMES.includes(key)) {
          const hint = key === 'namedValues'
            ? '; there are no named values, only the literals true, false, null and nil'
            : key === 'maxExpansion' ? '; there are no named values whose replacement could be limited'
              : key === 'ijson' ? '; the I-JSON mode is strict mode, option "strict"' : '';
          throw new TypeError(`Unknown XTJSON option ${quote(key)}${hint}. The options are ${OPTION_LIST}`);
        }
      }
    }
    const strict = init?.strict ?? false;
    if (typeof strict !== 'boolean') {
      throw new TypeError(`Invalid XTJSON option: "strict" must be true or false, not ${quote(strict)}`);
    }
    const maxDepth = Options.#limitOption(init, 'maxDepth', DEFAULT_MAX_DEPTH);
    this.#state = { maxDepth, strict };
    Object.freeze(this);
  }

  /**
   * Maximum nesting depth of objects and arrays. An implicit root object
   * counts as a level.
   * @returns {number}
   */
  get maxDepth() {
    return this.#state.maxDepth;
  }

  /**
   * True for strict mode (section 12): duplicate names, unpaired surrogates
   * and noncharacters in names and strings, and a root value that is not an
   * object or an array are errors. A document can also request strict mode
   * with `%strict: true`; with this option, `%strict: false` is an error.
   * @returns {boolean}
   */
  get strict() {
    return this.#state.strict;
  }

  get [Symbol.toStringTag]() {
    return 'Options';
  }

  /** A limit: a positive safe integer; `fallback` if not given. */
  static #limitOption(init, name, fallback) {
    const value = init?.[name] ?? fallback;
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`Invalid XTJSON option: "${name}" must be a positive integer, not ${quote(value)}`);
    }
    return value;
  }
}

/**
 * The internal state for an `options` argument: an `Options` instance, a
 * plain object (validated now) or null/undefined for the defaults.
 * @returns {OptionsState}
 * @throws {TypeError} if the options are invalid
 */
function resolveOptions(options) {
  return resolve(options);
}

// ---------------------------------------------------------------------------
// Parser

/**
 * Parser for XTJSON documents with fixed options. Validates the options once;
 * reuse the instance for many documents.
 *
 *     const parser = new Parser({ strict: true });
 *     const value = parser.parse(text);
 */
export class Parser {
  // Configuration, fixed when the parser is created
  /** Strict mode requested by the application (12). */
  #strict = false;
  #maxDepth = 0;
  /** @type {Uint8Array} */
  #flags;
  /** @type {Int8Array} */
  #hex;
  /** @type {Map<string, number[]>} */
  #suffixes;

  // State of the current run
  #text = '';
  #len = 0;
  #pos = 0;
  #depth = 0;
  /** True if the content is read in strict mode (12). */
  #check = false;

  /**
   * The number suffixes of 9.5, built on first use; the table is exhaustive.
   * Each suffix converts a value v to v * factor * 10^scale (the divisors
   * 1000 and 100 are powers of ten, so the result can be computed exactly
   * from the decimal digits).
   * @type {Map<string, number[]> | undefined}
   */
  static #suffixTable;

  /**
   * @param {Options | object | null} [options] strict mode and the limits
   * @throws {TypeError} if the options are invalid
   */
  constructor(options) {
    const state = resolveOptions(options);
    this.#strict = state.strict;
    this.#maxDepth = state.maxDepth;
    const tables = characterTables();
    this.#flags = tables.flags;
    this.#hex = tables.hex;
    this.#suffixes = (Parser.#suffixTable ??= new Map([
      ['k', [1000, 0]], ['kb', [1024, 0]], ['m', [1000000, 0]], ['mb', [1048576, 0]],
      ['ms', [1, -3]], ['s', [1, 0]], ['min', [60, 0]], ['h', [3600, 0]],
      ['pct', [1, -2]], ['n', [1, 0]],
    ]));
  }

  /**
   * Parses an XTJSON document and returns its value.
   *
   * @param {string} text the document; converted to a string as in
   *   `JSON.parse`
   * @returns {any} the value; an integer with the suffix `n` becomes a BigInt
   * @throws {ParserError} if the text is not a valid XTJSON document
   */
  parse(text) {
    const source = String(text);
    let value;
    this.#text = source;
    this.#len = source.length;
    this.#pos = 0;
    this.#depth = 0;
    this.#check = false;
    try {
      if (typeof source.isWellFormed === 'function' ? !source.isWellFormed() : LONE_SURROGATE.test(source)) {
        const offset = source.search(LONE_SURROGATE);
        this.#fail(`Unpaired surrogate ${hex4(source.charCodeAt(offset))}; the text is not valid Unicode and cannot be encoded as UTF-8`, offset);
      }
      value = this.#parseDocument();
    } catch (error) {
      // A large maxDepth can exceed the call stack of the engine (RangeError
      // in V8 and JavaScriptCore, InternalError in SpiderMonkey).
      if (!(error instanceof ParserError) && this.#depth > 0 &&
          (error instanceof RangeError || error?.name === 'InternalError')) {
        this.#fail(`Nesting depth ${this.#depth} exceeds the call stack of the JavaScript engine; use a smaller maxDepth`, this.#pos, error);
      }
      throw error;
    } finally {
      this.#text = '';
      this.#len = 0;
    }
    return value;
  }

  // ----- Messages ---------------------------------------------------------

  /**
   * Reports the identifier characters `word` directly after a number at
   * `offset` that are not a suffix of 9.5. `suffix` is the longest suffix
   * that `word` begins with, if any; the rest of `word` would need a
   * separator (7.3).
   */
  #failSuffix(word, suffix, offset) {
    const lower = word.toLowerCase();
    if (lower !== word && this.#suffixes.has(lower)) {
      this.#fail(`Unknown number suffix '${word}'; did you mean '${lower}'? Suffixes are written in lower case`, offset);
    }
    if (suffix !== undefined) {
      this.#fail(`Unexpected '${word.charAt(suffix.length)}' after the number suffix '${suffix}'. The suffixes are ${SUFFIX_LIST}`, offset + suffix.length);
    }
    this.#fail(`Unknown number suffix '${word}'. The suffixes are ${SUFFIX_LIST}`, offset);
  }

  // ----- Errors -----------------------------------------------------------

  #fail(reason, offset = this.#pos, cause) {
    const { line, column } = locate(this.#text, offset);
    throw new ParserError(reason, line, column, offset, cause === undefined ? undefined : { cause });
  }

  #failUnexpected(expected, offset = this.#pos) {
    this.#fail(`Unexpected ${describeAt(this.#text, offset)}, expected ${expected}`, offset);
  }

  // ----- White space, line breaks, comments (5) ---------------------------

  /** Code unit at the current position, or EOF. */
  #peek() {
    return this.#pos < this.#len ? this.#text.charCodeAt(this.#pos) : EOF;
  }

  /**
   * Skips white space and comments (rule `S`). Returns true if a line break
   * occurred outside block comments, which makes it a separator (7.3).
   */
  #skipSpace() {
    const text = this.#text;
    const len = this.#len;
    let pos = this.#pos;
    let newline = false;
    // The tests are ordered by the frequency of the characters: a space,
    // then the first character of a token, then a line break.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === SPACE) {
        pos++;
      } else if (c > SPACE) {
        if (c === SLASH) {
          const d = text.charCodeAt(pos + 1);
          if (d === SLASH) {
            pos = this.#skipLineComment(pos + 2);
          } else if (d === STAR) {
            const end = text.indexOf('*/', pos + 2);
            if (end < 0) this.#fail('Unterminated block comment', pos);
            pos = end + 2;
          } else {
            break;
          }
        } else if (c === HASH) {
          pos = this.#skipLineComment(pos + 1);
        } else if (c >= 0x80 && isBlank(c)) {
          pos++;
        } else {
          break;
        }
      } else if (c === LF || c === CR) {
        newline = true;
        pos++;
      } else if (c === TAB || c === VT || c === FF) {
        pos++;
      } else {
        break;
      }
    }
    this.#pos = pos;
    return newline;
  }

  /** Returns the offset of the line break that ends the comment, or EOF. */
  #skipLineComment(pos) {
    const text = this.#text;
    const len = this.#len;
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === LF || c === CR) break;
      pos++;
    }
    return pos;
  }

  // ----- Document (6.1, 6.2) ----------------------------------------------

  #parseDocument() {
    this.#skipSpace();
    if (this.#peek() === EOF) {
      this.#fail('The document is empty; expected a value or at least one member');
    }
    // The content is checked in strict mode (12), requested by the
    // application or by %strict: true (6.5).
    this.#check = this.#strict;
    if (this.#peek() === PERCENT) this.#parseDirective();
    const start = this.#pos;
    const c = this.#peek();

    let value;
    if (c === DQUOTE || c === SQUOTE || hasFlag(this.#flags, c, ID_START)) {
      // 6.2: a string or an identifier followed by ':' starts an implicit
      // root object.
      const isIdentifier = c !== DQUOTE && c !== SQUOTE;
      const token = isIdentifier ? this.#readIdentifier() : this.#readString(c);
      this.#skipSpace();
      if (this.#peek() === COLON) {
        value = {};
        this.#enter(start); // the implicit root object is a level as well
        this.#parseMembers(value, EOF, start, token);
        this.#depth--;
      } else {
        value = isIdentifier ? this.#literal(token, start) : token;
      }
    } else {
      value = this.#parseValue();
    }

    if (this.#check && (value === null || typeof value !== 'object')) {
      this.#fail('In strict mode the root value must be an object or an array', start);
    }
    const end = this.#pos;
    this.#skipSpace();
    if (this.#pos < this.#len) {
      // '%' directly after a number is not a suffix ('50%').
      if (this.#peek() === PERCENT && this.#pos > end) this.#failDirectivePosition();
      this.#fail(`Unexpected ${describeAt(this.#text, this.#pos)} after the root value; a document contains exactly one value`);
    }
    return value;
  }

  // ----- Directive (6.5) -------------------------------------------------

  /**
   * The directive `%strict` at the start of the document, with the separator
   * after it. Its value is the literal `true` or `false`.
   */
  #parseDirective() {
    const start = this.#pos;
    const text = this.#text;
    this.#pos++; // '%'
    if (!hasFlag(this.#flags, this.#peek(), ID_START)) {
      this.#fail("'strict' must follow '%' directly, without white space or comments; the only directive is %strict");
    }
    const name = this.#readIdentifier();
    if (name !== 'strict') {
      const hint = name.toLowerCase() === 'strict' ? "; did you mean '%strict'? Directives are case-sensitive" : '';
      this.#fail(`Unknown directive '%${name}'${hint}. The only directive is %strict`, start);
    }
    this.#skipSpace();
    if (this.#peek() !== COLON) this.#failUnexpected("':' after '%strict'");
    this.#pos++;
    this.#skipSpace();
    const valueStart = this.#pos;
    const word = hasFlag(this.#flags, this.#peek(), ID_START) ? this.#readIdentifier() : undefined;
    if (word !== 'true' && word !== 'false') {
      this.#fail("The value of %strict must be the literal true or false", valueStart);
    }
    if (word === 'false' && this.#strict) {
      this.#fail('%strict: false contradicts strict mode, which the application requests with the option strict', start);
    }
    if (word === 'true') this.#check = true;

    const before = this.#pos;
    const newline = this.#skipSpace();
    const c = this.#peek();
    if (c === COMMA) {
      this.#pos++;
      this.#skipSpace();
    } else if (!newline && c !== EOF) {
      let reason = `Expected a comma or a line break after the directive, found ${describeAt(text, this.#pos)}`;
      const gap = text.slice(before, this.#pos);
      if (/[\u2028\u2029]/.test(gap)) {
        reason += '; U+2028 and U+2029 are not line breaks';
      } else if (/\/\*[^]*[\r\n]/.test(gap)) {
        reason += '; a line break inside a block comment does not separate items';
      }
      this.#fail(reason);
    }
    if (this.#peek() === EOF) {
      this.#fail('The document contains only the directive; expected a value or at least one member after it');
    }
    if (this.#peek() === PERCENT) {
      this.#fail('%strict may occur only once, and there are no other directives');
    }
  }

  #failDirectivePosition(offset = this.#pos) {
    this.#fail('The directive %strict is permitted only at the top level, before the content of the document', offset);
  }

  // ----- Values (6.3) -----------------------------------------------------

  #parseValue() {
    const c = this.#peek();
    switch (c) {
      case LBRACE:
        return this.#parseObject();
      case LBRACKET:
        return this.#parseArray();
      case DQUOTE:
      case SQUOTE:
        return this.#readString(c);
      case MINUS:
        return this.#parseNumber();
      case PERCENT:
        return this.#failDirectivePosition();
      default:
        if (isDigit(c)) return this.#parseNumber();
        if (hasFlag(this.#flags, c, ID_START)) {
          const start = this.#pos;
          return this.#literal(this.#readIdentifier(), start);
        }
        if (c === PLUS || c === DOT) {
          this.#fail(`A number must not begin with '${String.fromCharCode(c)}'`);
        }
        return this.#failUnexpected('a value');
    }
  }

  /** Value of a literal (6.4); `start` is the offset of the identifier. */
  #literal(id, start) {
    switch (id) {
      case 'true':
        return true;
      case 'false':
        return false;
      case 'null':
      case 'nil':
        return null;
    }
    let hint;
    const lower = id.toLowerCase();
    if (isLiteral(lower)) {
      hint = `; did you mean '${lower}'? Literals are case-sensitive`;
    } else if (id === 'NaN' || id === 'Infinity' || id === 'undefined') {
      hint = `; ${id} is not a JSON value`;
    } else {
      hint = `; text without quotation marks is not a string, write "${id}" for a string`;
    }
    return this.#fail(`Unexpected identifier '${id}'; the values without quotation marks are true, false, null and nil${hint}`, start);
  }

  // ----- Objects and arrays (7) -------------------------------------------

  #enter(start) {
    if (++this.#depth > this.#maxDepth) {
      this.#fail(`Nesting depth exceeds the limit of ${this.#maxDepth} (option maxDepth)`, start);
    }
  }

  #parseObject() {
    const start = this.#pos;
    this.#enter(start);
    this.#pos++;
    const obj = {};
    this.#skipSpace();
    if (this.#peek() !== RBRACE) this.#parseMembers(obj, RBRACE, start);
    this.#pos++; // '}'
    this.#depth--;
    return obj;
  }

  #parseArray() {
    const start = this.#pos;
    this.#enter(start);
    this.#pos++;
    const arr = [];
    this.#skipSpace();
    if (this.#peek() !== RBRACKET) {
      do {
        arr.push(this.#parseValue());
      } while (this.#separator(RBRACKET, start));
    }
    this.#pos++; // ']'
    this.#depth--;
    return arr;
  }

  /**
   * Reads members up to `closer` (`}` or EOF for the implicit root object)
   * and leaves the position on the closer. If `name` is given, the first
   * name has already been read and the position is on the ':'.
   */
  #parseMembers(obj, closer, start, name) {
    // Offset of each name, to report duplicates in strict mode (12).
    const seen = this.#check ? new Map() : undefined;
    let nameStart = start;
    for (;;) {
      if (name === undefined) {
        nameStart = this.#pos;
        name = this.#readName();
      }
      if (seen !== undefined) {
        const first = seen.get(name);
        if (first === undefined) {
          seen.set(name, nameStart);
        } else {
          const { line, column } = locate(this.#text, first);
          this.#fail(`Duplicate name ${JSON.stringify(name)}; names must be unique in strict mode (first occurrence at line ${line}, column ${column})`, nameStart);
        }
      }
      this.#skipSpace();
      if (this.#peek() !== COLON) this.#failUnexpected(`':' after the name ${JSON.stringify(name)}`);
      this.#pos++;
      this.#skipSpace();
      // Duplicate names outside strict mode: the last member applies (7.2).
      setMember(obj, name, this.#parseValue());
      if (!this.#separator(closer, start)) return;
      name = undefined;
    }
  }

  /** Name of a member (7.2): string or identifier. */
  #readName() {
    const c = this.#peek();
    if (c === DQUOTE || c === SQUOTE) return this.#readString(c);
    if (hasFlag(this.#flags, c, ID_START)) return this.#readIdentifier();
    if (c === PERCENT) this.#failDirectivePosition();
    if (isDigit(c) || c === MINUS) {
      this.#fail('A name without quotation marks must begin with a letter, "_" or "$"; write this name in quotation marks');
    }
    return this.#failUnexpected('a name');
  }

  /**
   * Separator after an item (7.3, 7.4). Returns true if a further item
   * follows; then the position is on it. Returns false at the closer.
   */
  #separator(closer, start) {
    const before = this.#pos;
    let newline = false;
    let c = this.#text.charCodeAt(before);
    if (c !== COMMA) {
      newline = this.#skipSpace();
      c = this.#peek();
    }
    if (c === COMMA) {
      this.#pos++;
      this.#skipSpace();
      const d = this.#peek();
      return d !== closer; // trailing comma (7.4)
    }
    if (c === closer) return false;
    if (c === EOF) {
      const { line, column } = locate(this.#text, start);
      const what = closer === RBRACE ? 'object' : 'array';
      this.#fail(`Unterminated ${what}: expected '${String.fromCharCode(closer)}' for the ${what} opened at line ${line}, column ${column}`);
    }
    if (newline) return true;

    if (closer === EOF && c === RBRACE) {
      this.#fail("Unexpected '}': the implicit root object is not closed with '}'");
    }
    let reason = closer === EOF
      ? 'Expected a comma or a line break between two members'
      : `Expected ',', a line break or '${String.fromCharCode(closer)}'`;
    reason += `, found ${describeAt(this.#text, this.#pos)}`;
    const gap = this.#text.slice(before, this.#pos);
    if (/[\u2028\u2029]/.test(gap)) {
      reason += '; U+2028 and U+2029 are not line breaks';
    } else if (/\/\*[^]*[\r\n]/.test(gap)) {
      reason += '; a line break inside a block comment does not separate items';
    }
    return this.#fail(reason);
  }

  // ----- Identifiers (7.2) ------------------------------------------------

  #readIdentifier() {
    const text = this.#text;
    const start = this.#pos;
    let pos = start + 1;
    const flags = this.#flags;
    let c;
    // At the end of the text `c` is NaN, which ends the loop.
    while ((c = text.charCodeAt(pos)) < 128 && (flags[c] & ID_PART) !== 0) pos++;
    this.#pos = pos;
    if (c === MINUS || c === DOT || (c >= 0x80 && !isBlank(c))) {
      this.#fail(`Unexpected ${describeAt(text, pos)} in an identifier; identifiers consist of ASCII letters, digits, "_" and "$", other names must be written in quotation marks`);
    }
    return text.slice(start, pos);
  }

  // ----- Strings (8) ------------------------------------------------------

  /**
   * String (8) delimited by `q`. A string without a line break, a tab and a
   * line continuation is its own value (8.3) and is read on a fast path;
   * every other string is read by #readStringLines.
   */
  #readString(q) {
    const text = this.#text;
    const len = this.#len;
    const start = this.#pos;
    let pos = start + 1;
    let chunk = pos;
    let out = '';
    for (;;) {
      let c;
      // Ordinary characters. At the end of the text `c` is NaN, which ends
      // the loop as well.
      while ((c = text.charCodeAt(pos)) >= SPACE && c !== q && c !== BACKSLASH) pos++;
      if (c === q) {
        if (pos === start + 1 && text.charCodeAt(pos + 1) === q) {
          // An empty string directly followed by another string is always an
          // error (7.3); name the likely intent.
          this.#fail(`Three quotation marks in a row do not delimit a string; a string in ${String.fromCharCode(q)} may extend across several lines`, start);
        }
        this.#pos = pos + 1;
        const value = chunk === start + 1 ? text.slice(chunk, pos) : out + text.slice(chunk, pos);
        if (this.#check) this.#checkStrictString(value, start);
        return value;
      }
      if (c === BACKSLASH) {
        const d = text.charCodeAt(pos + 1);
        if (d === LF || d === CR) return this.#readStringLines(q, start);
        out += text.slice(chunk, pos);
        this.#pos = pos;
        out += this.#readEscape();
        pos = chunk = this.#pos;
      } else if (c === LF || c === CR || c === TAB) {
        return this.#readStringLines(q, start);
      } else if (pos >= len) {
        this.#fail('Unterminated string', start);
      } else {
        this.#fail(`Control character ${hex4(c)} must be escaped in a string`, pos);
      }
    }
  }

  /**
   * Escape sequence (8.2) at the current position (on the backslash).
   * Returns the decoded text and moves behind the sequence.
   */
  #readEscape() {
    const text = this.#text;
    const at = this.#pos;
    const c = at + 1 < this.#len ? text.charCodeAt(at + 1) : EOF;
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
          this.#fail("'\\0' must not be followed by a digit; there are no octal escape sequences", at);
        }
        result = '\0';
        break;
      case 0x78: { // \xHH
        const h1 = hexValue(this.#hex, text.charCodeAt(at + 2));
        const h2 = hexValue(this.#hex, text.charCodeAt(at + 3));
        if (h1 < 0 || h2 < 0) this.#fail("'\\x' must be followed by exactly two hexadecimal digits", at);
        this.#pos = at + 4;
        return String.fromCharCode(h1 * 16 + h2);
      }
      case 0x75: { // \uXXXX or \u{...}
        if (text.charCodeAt(at + 2) === LBRACE) return this.#readCodePointEscape(at);
        let unit = 0;
        for (let i = at + 2; i < at + 6; i++) {
          const h = hexValue(this.#hex, text.charCodeAt(i));
          if (h < 0) this.#fail("'\\u' must be followed by exactly four hexadecimal digits or by '{'", at);
          unit = unit * 16 + h;
        }
        this.#pos = at + 6;
        return String.fromCharCode(unit);
      }
      case SPACE:
      case TAB: {
        let i = at + 2;
        while (text.charCodeAt(i) === SPACE || text.charCodeAt(i) === TAB) i++;
        const e = text.charCodeAt(i);
        if (e === LF || e === CR) {
          return this.#fail('White space between a backslash and a line break is not permitted; in a line continuation the line break must follow the backslash directly', at);
        }
        return this.#fail(`Unknown escape sequence '\\${String.fromCharCode(c)}'`, at);
      }
      case EOF:
        return this.#fail('Unterminated escape sequence', at);
      default:
        if (isDigit(c)) {
          return this.#fail(`Unknown escape sequence '\\${String.fromCharCode(c)}'; there are no octal escape sequences`, at);
        }
        return this.#fail(`Unknown escape sequence '\\${String.fromCodePoint(text.codePointAt(at + 1))}'`, at);
    }
    this.#pos = at + 2;
    return result;
  }

  /** `\u{...}` (8.2); `at` is the offset of the backslash. */
  #readCodePointEscape(at) {
    const text = this.#text;
    let pos = at + 3;
    let value = 0;
    let digits = 0;
    for (let h; (h = hexValue(this.#hex, text.charCodeAt(pos))) >= 0; pos++) {
      // Saturate above the maximum to avoid precision loss on long input.
      value = Math.min(value * 16 + h, 0x110000);
      digits++;
    }
    if (digits === 0) this.#fail("'\\u{' must be followed by at least one hexadecimal digit", at);
    if (text.charCodeAt(pos) !== RBRACE) {
      this.#fail("'\\u{' must be closed with '}'; only hexadecimal digits are permitted between the braces", at);
    }
    if (value > 0x10ffff) this.#fail('The code point in \\u{...} is greater than 10FFFF', at);
    if (value >= 0xd800 && value <= 0xdfff) {
      this.#fail('\\u{...} must not denote a surrogate (D800 to DFFF); write single surrogates as \\uXXXX', at);
    }
    this.#pos = pos + 1;
    return String.fromCodePoint(value);
  }

  /** String with a line break, a tab or a line continuation (8.3); `start` is the offset of its delimiter. */
  #readStringLines(q, start) {
    const value = this.#stringLinesValue(q, start);
    if (this.#check) this.#checkStrictString(value, start);
    return value;
  }

  /** Strict mode (12): no unpaired surrogates and no noncharacters in strings. */
  #checkStrictString(value, start) {
    const issue = strictStringIssue(value);
    if (issue !== undefined) {
      this.#fail(`The string contains ${issue}, which is not permitted in strict mode`, start);
    }
  }

  /** Value of the string at `start` according to the four steps of 8.3. */
  #stringLinesValue(q, start) {
    const text = this.#text;
    const len = this.#len;
    let pos = start + 1;

    // Step 1: form lines. For each line we keep its decoded text, the number
    // of unescaped spaces and tabs at its beginning (`lead`), whether it
    // ends with a line continuation (`conts`) and its offset for error
    // messages. `trail` counts the unescaped spaces and tabs at the end of
    // the current line.
    //
    // Step 2 is done on the way: unescaped white space at the end of every
    // line but the last is removed. It always lies at the end of the current
    // chunk of raw text, because an escape sequence resets `trail`. A line
    // that ends with a line continuation keeps it: the backslash belongs to
    // the line until step 4, so the white space is not at its end.
    const lines = [];
    const leads = [];
    const conts = [];
    const offsets = [];
    let line = '';
    let chunk = pos;
    let lead = 0;
    let trail = 0;
    let leading = true;
    offsets.push(pos);

    for (;;) {
      if (pos >= len) this.#fail('Unterminated string', start);
      const c = text.charCodeAt(pos);
      if (c === q) {
        lines.push(chunk === pos ? line : line + text.slice(chunk, pos)); // the last line keeps its white space
        leads.push(lead);
        conts.push(false);
        this.#pos = pos + 1;
        break;
      }
      if (c === SPACE || c === TAB) {
        if (leading) lead++;
        trail++;
        pos++;
      } else if (c === LF || c === CR) {
        lines.push(chunk === pos - trail ? line : line + text.slice(chunk, pos - trail));
        leads.push(leading ? 0 : lead); // a line of white space only is empty now
        conts.push(false);
        pos += c === CR && text.charCodeAt(pos + 1) === LF ? 2 : 1;
        offsets.push(pos);
        line = '';
        chunk = pos;
        lead = trail = 0;
        leading = true;
      } else if (c === BACKSLASH) {
        const d = text.charCodeAt(pos + 1);
        if (d === LF || d === CR) {
          // Line continuation (8.2): the line ends here, keeps its white
          // space and is not empty.
          lines.push(line + text.slice(chunk, pos));
          leads.push(lead);
          conts.push(true);
          pos += d === CR && text.charCodeAt(pos + 2) === LF ? 3 : 2;
          offsets.push(pos);
          line = '';
          chunk = pos;
          lead = trail = 0;
          leading = true;
        } else {
          line += text.slice(chunk, pos);
          this.#pos = pos;
          line += this.#readEscape();
          pos = chunk = this.#pos;
          leading = false;
          trail = 0;
        }
      } else if (c < SPACE) {
        this.#fail(`Control character ${hex4(c)} must be escaped in a string`, pos);
      } else {
        leading = false;
        trail = 0;
        pos++;
      }
    }

    const last = lines.length - 1;
    if (last === 0) return lines[0];

    // Step 3: remove indentation, only if the string begins with an empty
    // line. A line with a line continuation is never empty.
    let first = 0;
    let indent = 0;
    if (lines[0] === '' && !conts[0]) {
      first = 1;
      indent = Infinity;
      for (let k = 1; k <= last; k++) {
        if (lines[k] !== '' || conts[k] || k === last) indent = Math.min(indent, leads[k]);
      }
    }

    // Step 4: join the lines with LF; a line continuation joins them without.
    let prefix;
    let value = '';
    for (let k = first; k <= last; k++) {
      let content = lines[k];
      // Empty lines stay empty. (An empty last line would make indent 0.)
      if (indent > 0 && content !== '') {
        if (prefix === undefined) prefix = content.slice(0, indent);
        else if (!content.startsWith(prefix)) {
          this.#fail('Inconsistent indentation in a string: the removed indentation must consist of the same characters in all lines (do not mix tabs and spaces)', offsets[k]);
        }
        content = content.slice(indent);
      }
      value = k === first ? content : value + (conts[k - 1] ? '' : '\n') + content;
    }
    return value;
  }

  // ----- Numbers (9) ------------------------------------------------------

  #parseNumber() {
    const text = this.#text;
    const start = this.#pos;
    let pos = start;

    // Fast path for the common notations: a decimal integer or a decimal
    // fraction with at most 15 digits, without `_`, exponent or suffix. The
    // digits then form an exact integer, and dividing it by an exact power
    // of ten gives the correctly rounded value. Everything else, including
    // every error, is left to the general path below.
    {
      const negative = text.charCodeAt(pos) === MINUS;
      if (negative) pos++;
      const first = pos;
      let c = text.charCodeAt(pos);
      if (c >= DIGIT_0 && c <= DIGIT_9) {
        let n = c - DIGIT_0;
        c = text.charCodeAt(++pos);
        if (n !== 0) {
          while (c >= DIGIT_0 && c <= DIGIT_9) {
            n = n * 10 + (c - DIGIT_0);
            c = text.charCodeAt(++pos);
          }
        }
        let digits = pos - first;
        let fraction = 0;
        if (c === DOT) {
          const fractionStart = pos + 1;
          c = text.charCodeAt(++pos);
          while (c >= DIGIT_0 && c <= DIGIT_9) {
            n = n * 10 + (c - DIGIT_0);
            c = text.charCodeAt(++pos);
          }
          fraction = pos - fractionStart;
          digits += fraction;
          if (fraction === 0) digits = Infinity; // an error, reported below
        }
        // The number ends here unless the next character continues it or is
        // an error after a number.
        if (digits <= 15 && (!(c < 128) || (c !== DOT && (this.#flags[c] & ID_PART) === 0))) {
          this.#pos = pos;
          if (fraction !== 0) n /= POWERS_OF_TEN[fraction];
          return negative ? -n : n;
        }
      }
      pos = start;
    }

    if (text.charCodeAt(pos) === MINUS) {
      pos++;
      const c = text.charCodeAt(pos);
      if (!isDigit(c)) {
        if (isBlank(c) || c === LF || c === CR || c === SLASH || c === HASH) {
          this.#fail("No white space or comment is permitted between '-' and the digits", pos);
        }
        this.#fail("Expected a digit after '-'", pos);
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
      pos = this.#scanDigits(digitsStart, radix, `after '${text.slice(pos, pos + 2)}'`);
      const digits = text.slice(digitsStart, pos);
      if (this.#atSuffixN(pos)) {
        // With the suffix n the integer becomes a BigInt, so it is exact at
        // any size.
        value = BigInt(RADIX_PREFIX[radix] + digits.replaceAll('_', ''));
      } else {
        value = this.#radixValue(digits, radix, start);
      }
      if (text.charCodeAt(start) === MINUS) value = -value;
    } else {
      // 9.1: decimal
      if (text.charCodeAt(pos) === DIGIT_0) {
        pos++;
        const c = text.charCodeAt(pos);
        if (isDigit(c)) {
          this.#fail('A number must not have leading zeros; octal numbers are written with the prefix 0o', start);
        }
        if (c === UNDERSCORE) this.#fail("'_' is only permitted between two digits", pos);
      } else {
        pos = this.#scanDigits(pos, 10, '');
      }
      if (text.charCodeAt(pos) === DOT) {
        isInteger = false;
        pos = this.#scanDigits(pos + 1, 10, "after '.'");
      }
      if ((text.charCodeAt(pos) | 0x20) === 0x65) { // e E
        isInteger = false;
        pos++;
        const c = text.charCodeAt(pos);
        if (c === PLUS || c === MINUS) pos++;
        pos = this.#scanDigits(pos, 10, 'in the exponent');
      }
      // With the suffix n an integer becomes a BigInt, so it is exact at any
      // size. After a fraction part or an exponent, n is an error (below).
      if (isInteger && this.#atSuffixN(pos)) value = BigInt(this.#withoutUnderscores(start, pos));
      // May be Infinity; the range is checked below, after the suffix
      // (9.4: `4.4e308pct` is 4.4e306).
      value ??= Number(this.#withoutUnderscores(start, pos));
    }

    // 9.5: suffix. The suffixes are a fixed list (longest match); any other
    // identifier character directly after the number or its suffix would
    // begin a new token without a separator (7.3).
    let c = text.charCodeAt(pos);
    if (c === DOT) {
      this.#fail(radix === 10
        ? "Unexpected '.' in a number"
        : `A ${RADIX_NAMES[radix]} number cannot have a fraction part`, pos);
    }
    if (hasFlag(this.#flags, c, ID_PART)) {
      if (isDigit(c)) {
        this.#fail(`'${String.fromCharCode(c)}' is not a valid ${RADIX_NAMES[radix]} digit`, pos);
      }
      if (c === UNDERSCORE) this.#fail("'_' is only permitted between two digits", pos);
      const suffixStart = pos;
      const suffix = SUFFIX_NAMES.find((name) => text.startsWith(name, suffixStart));
      pos++;
      while (hasFlag(this.#flags, text.charCodeAt(pos), ID_PART)) pos++;
      if (suffix === undefined || suffixStart + suffix.length !== pos) {
        this.#failSuffix(text.slice(suffixStart, pos), suffix, suffixStart);
      }
      if (text.charCodeAt(pos) === DOT) {
        this.#fail(`Unexpected '.' after the number suffix '${suffix}'`, pos);
      }
      if (suffix === 'n') {
        if (!isInteger) {
          this.#fail("The suffix 'n' is only permitted after an integer, not after a number with a fraction part or an exponent", suffixStart);
        }
      } else {
        // `value` is exact for non-decimal numbers (checked in radixValue) and
        // for decimal integers within the safe range; otherwise it may be rounded.
        const exact = radix !== 10 || (isInteger && Math.abs(value) <= Number.MAX_SAFE_INTEGER);
        value = this.#applySuffix(suffix, value, exact, start, suffixStart);
      }
    }
    if (typeof value === 'number' && !Number.isFinite(value)) this.#fail('The number is out of range', start);

    this.#pos = pos;
    return value;
  }

  /** True if the suffix `n` (and nothing longer) begins at `pos`. */
  #atSuffixN(pos) {
    return this.#text.charCodeAt(pos) === 0x6e && !hasFlag(this.#flags, this.#text.charCodeAt(pos + 1), ID_PART);
  }

  /**
   * Scans a digit sequence of the given radix with single `_` between
   * digits (9.3). Returns the offset behind it.
   */
  #scanDigits(pos, radix, context) {
    const text = this.#text;
    const first = text.charCodeAt(pos);
    if (!(hexValue(this.#hex, first) >= 0 && hexValue(this.#hex, first) < radix)) {
      if (first === UNDERSCORE) this.#fail("'_' is only permitted between two digits", pos);
      this.#fail(`Expected a ${RADIX_NAMES[radix]} digit${context ? ' ' + context : ''}`, pos);
    }
    pos++;
    for (;;) {
      const c = text.charCodeAt(pos);
      const d = hexValue(this.#hex, c);
      if (d >= 0 && d < radix) {
        pos++;
      } else if (c === UNDERSCORE) {
        const n = hexValue(this.#hex, text.charCodeAt(pos + 1));
        if (!(n >= 0 && n < radix)) this.#fail("'_' is only permitted between two digits", pos);
        pos += 2;
      } else {
        return pos;
      }
    }
  }

  #withoutUnderscores(start, end) {
    const raw = this.#text.slice(start, end);
    return raw.includes('_') ? raw.replaceAll('_', '') : raw;
  }

  /**
   * Exact value of hexadecimal, octal or binary digits (9.2, 9.4): numbers
   * that a double cannot represent exactly are an error, never rounded.
   */
  #radixValue(digits, radix, start) {
    if (digits.includes('_')) digits = digits.replaceAll('_', '');
    let i = 0;
    while (i < digits.length - 1 && digits.charCodeAt(i) === DIGIT_0) i++;
    if ((digits.length - i) * BITS_PER_DIGIT[radix] <= 53) return parseInt(digits.slice(i), radix);
    const big = BigInt(RADIX_PREFIX[radix] + digits.slice(i));
    const value = Number(big);
    if (!Number.isFinite(value) || BigInt(value) !== big) {
      this.#fail(`The ${RADIX_NAMES[radix]} number cannot be represented exactly as a JavaScript number`, start);
    }
    return value;
  }

  /**
   * Applies a number suffix (9.5). The result is the exact product or
   * quotient, rounded once to the nearest double. `exact` tells whether
   * `value` is exactly the number written between `start` and `suffixStart`.
   */
  #applySuffix(suffix, value, exact, start, suffixStart) {
    const conversion = this.#suffixes.get(suffix);
    const factor = conversion[0];
    const scale = conversion[1];
    if (factor === 1 && scale === 0) return value; // s
    let result;
    if (exact && scale === 0) {
      result = value * factor; // both operands exact: the product is correctly rounded
    } else if (exact) {
      // An exact value is an integer here, and the factor is 1 (ms, pct):
      // the quotient of two exact numbers is correctly rounded.
      result = value / POWERS_OF_TEN[-scale];
    } else {
      const number = this.#withoutUnderscores(start, suffixStart);
      // Fast path for a decimal fraction with at most 15 digits and without
      // an exponent: if digits x factor is a safe integer, dividing it by an
      // exact power of ten gives the correctly rounded result.
      if (number.length <= 17) {
        const negative = number.charCodeAt(0) === MINUS;
        let mantissa = 0;
        let fraction = -1; // number of digits after the '.', -1 before it
        let i = negative ? 1 : 0;
        for (; i < number.length; i++) {
          const c = number.charCodeAt(i);
          if (c >= DIGIT_0 && c <= DIGIT_9) {
            mantissa = mantissa * 10 + (c - DIGIT_0);
            if (fraction >= 0) fraction++;
          } else if (c === DOT && fraction < 0) {
            fraction = 0;
          } else {
            break; // an exponent
          }
        }
        const product = mantissa * factor;
        if (i === number.length && fraction > 0 && product <= Number.MAX_SAFE_INTEGER) {
          result = product / POWERS_OF_TEN[fraction - scale];
          return negative ? -result : result;
        }
      }
      const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(number);
      const fraction = m[3] ?? '';
      const exponent = (m[4] === undefined ? 0 : Number(m[4])) - fraction.length;
      result = scaledDecimal(m[1], BigInt(m[2] + fraction) * BigInt(factor), exponent + scale);
    }
    return result;
  }
}

/**
 * The double nearest to sign digits × 10^exponent (9.5: `0.1kb` is 102.4,
 * `100ms` is 0.1). The sign is kept for zero (`-0ms` is -0).
 */
function scaledDecimal(sign, digits, exponent) {
  // Keep the exponent in a range that Number() parses; beyond it the result
  // is 0 or out of range anyway.
  exponent = Math.max(-1e7, Math.min(1e7, exponent));
  return Number(`${sign}${digits}e${exponent}`);
}

// ---------------------------------------------------------------------------
// parse()

/** Parser without options, created on first use. */
let defaultParser;

/** The parser for the options of parse(). */
function parserFor(options) {
  return options === undefined || options === null ? (defaultParser ??= new Parser()) : new Parser(options);
}

/**
 * Parses an XTJSON document and returns its value.
 *
 * @param {string} text the document
 * @param {Options | object | null} [options] strict mode and the limits
 * @returns {any} the value; an integer with the suffix `n` becomes a BigInt
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the options are invalid
 */
export function parse(text, options) {
  return parserFor(options).parse(text);
}
