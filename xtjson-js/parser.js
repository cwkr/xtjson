/**
 * XTJSON parser: `Parser`, `ParserError` and `parse()`.
 *
 * Implements the XTJSON specification, draft 0.6 (docs/xtjson-spec-en.md).
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

import {
  CharacterTables, hex4, ID_PART, ID_START, strictStringIssue, isDigit, isFunction, isOptions,
  isPredefined, readArguments, resolveOptions, SUFFIX_FIRST,
} from './shared.js';

// Character codes. Declared in this module rather than imported: V8 folds
// module-local constants, but reads imported bindings at run time.
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
const EQUALS = 0x3d;
const LBRACKET = 0x5b;
const BACKSLASH = 0x5c;
const RBRACKET = 0x5d;
const UNDERSCORE = 0x5f;
const LBRACE = 0x7b;
const RBRACE = 0x7d;

/**
 * Largest exponent of a number that becomes a BigInt (suffix n); limits the
 * size of the BigInt that a short text such as `1e999999999n` could demand.
 */
const MAX_BIGINT_EXPONENT = 10000;

/** 10^0 to 10^22, the powers of ten that a JavaScript number holds exactly. */
const POWERS_OF_TEN = [
  1e0, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11,
  1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22,
];

const RADIX_NAMES = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' };
const BITS_PER_DIGIT = { 2: 1, 8: 3, 16: 4 };
const RADIX_PREFIX = { 2: '0b', 8: '0o', 16: '0x' };

const SUFFIX_LIST = 'k, K, kb, Kb, kB, KB, mb, Mb, mB, MB, ms, s, min, h, pct, px, L and n';

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** The first character of a number suffix (9.5); none occurs in a number without suffix. */

const DIRECTIVE_LIST = '%define, %version and %strict';

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

/**
 * Size and depth of a value read by the parser: the number of JSON values
 * in it (every object, array and other value counts as one) and the
 * nesting depth of its objects and arrays (0 for other values).
 * @returns {[number, number]}
 */
function measure(value) {
  if (value === null || typeof value !== 'object') return [1, 0];
  let size = 1;
  let depth = 0;
  for (const item of Array.isArray(value) ? value : Object.values(value)) {
    const [s, d] = measure(item);
    size += s;
    if (d > depth) depth = d;
  }
  return [size, depth + 1];
}

/** A copy of a value read by the parser; every position of a named value gets its own (6.4). */
function copyValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(copyValue);
  const obj = {};
  for (const name of Object.keys(value)) setMember(obj, name, copyValue(value[name]));
  return obj;
}

// ---------------------------------------------------------------------------
// Parser

/**
 * Parser for XTJSON documents with fixed options. Validates the options once;
 * reuse the instance for many documents.
 *
 *     const parser = new Parser({ strict: true });
 *     const value = parser.parse(text);
 *     const { value, versions } = parser.parseDocument(text);
 */
export class Parser {
  // Configuration, fixed when the parser is created
  /** @type {import('./shared.js').OptionsState} */
  #state;
  /** Strict mode requested by the application (12). */
  #strict = false;
  #maxDepth = 0;
  #maxExpansion = 0;
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
  #busy = false;
  /**
   * Named values defined by `%define` (6.6): value, size and depth as by
   * `measure`, and the offset of the identifier.
   * @type {Map<string, {value: unknown, size: number, depth: number, offset: number}>}
   */
  #defined = new Map();
  /** @type {Map<string, string | number | bigint>} version statements of `%version` (6.7) */
  #versions = new Map();
  /** Number of JSON values produced so far by replacing named values. */
  #expanded = 0;
  /**
   * True while the prohibitions of section 12 on names, strings and
   * duplicate names are checked: always in the values of directives (6.5),
   * in the content only in strict mode.
   */
  #check = false;
  /** True while the directives are read. */
  #inDirectives = false;
  /** @type {boolean | undefined} the value of `%strict` (6.8) */
  #docStrict;
  /** Offset of the `%strict` directive. */
  #docStrictOffset = 0;

  /**
   * The number suffixes of 9.5, built on first use; the table is exhaustive.
   * Each suffix converts a value v to v * factor * 10^scale (the divisors
   * 1000 and 100 are powers of ten, so the result can be computed exactly
   * from the decimal digits).
   * @type {Map<string, number[]> | undefined}
   */
  static #suffixTable;

  /**
   * @param {import('./shared.js').Options | object | null} [options] strict
   *   mode and the limits
   * @throws {TypeError} if the options are invalid
   */
  constructor(options) {
    this.#configure(resolveOptions(options));
    const tables = CharacterTables.get();
    this.#flags = tables.flags;
    this.#hex = tables.hex;
    this.#suffixes = (Parser.#suffixTable ??= new Map([
      ['k', [1000, 0]], ['K', [1000, 0]],
      ['kb', [1024, 0]], ['Kb', [1024, 0]], ['kB', [1024, 0]], ['KB', [1024, 0]],
      ['mb', [1048576, 0]], ['Mb', [1048576, 0]], ['mB', [1048576, 0]], ['MB', [1048576, 0]],
      ['ms', [1, -3]], ['s', [1, 0]], ['min', [60, 0]], ['h', [3600, 0]],
      ['pct', [1, -2]], ['px', [1, 0]], ['L', [1, 0]], ['n', [1, 0]],
    ]));
  }

  #configure(state) {
    this.#state = state;
    this.#strict = state.strict;
    this.#maxDepth = state.maxDepth;
    this.#maxExpansion = state.maxExpansion;
  }

  /**
   * Parses an XTJSON document and returns its value.
   *
   * @param {string} text the document; converted to a string as in
   *   `JSON.parse`
   * @param {Function | null} [reviver] transforms the result, as in `JSON.parse`
   * @returns {any} the value; a number with the suffix `n` and without a
   *   fraction part becomes a BigInt if its value is an integer
   * @throws {ParserError} if the text is not a valid XTJSON document
   * @throws {TypeError} if the reviver is not a function
   */
  parse(text, reviver) {
    return this.#run('parse', text, reviver).value;
  }

  /**
   * Parses an XTJSON document and returns its value together with the
   * version statements of its `%version` directives (6.7). The version of
   * the specification is stored under `xtjson`. The versions are not
   * checked; that is left to the application.
   *
   * @param {string} text the document; converted to a string as in
   *   `JSON.parse`
   * @param {Function | null} [reviver] transforms the value, as in `JSON.parse`
   * @returns {{value: any, versions: Map<string, string | number | bigint>}}
   * @throws {ParserError} if the text is not a valid XTJSON document
   * @throws {TypeError} if the reviver is not a function
   */
  parseDocument(text, reviver) {
    return this.#run('parseDocument', text, reviver);
  }

  #run(caller, text, reviver) {
    if (reviver !== undefined && reviver !== null && typeof reviver !== 'function') {
      throw new TypeError(`Parser.${caller}: the reviver must be a function, not ${typeof reviver}`);
    }
    const source = String(text);
    if (this.#busy) {
      // Called again during a run: use a parser of its own.
      const parser = new Parser();
      parser.#configure(this.#state);
      return parser.#run(caller, source, reviver);
    }
    let value;
    const versions = new Map();
    this.#busy = true;
    this.#text = source;
    this.#len = source.length;
    this.#pos = 0;
    this.#depth = 0;
    this.#expanded = 0;
    this.#versions = versions;
    this.#check = true;
    this.#inDirectives = true;
    this.#docStrict = undefined;
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
      this.#busy = false;
      this.#text = '';
      this.#len = 0;
      this.#defined.clear();
      this.#versions = new Map();
    }
    if (reviver !== undefined && reviver !== null) value = internalize({ '': value }, '', reviver);
    return { value, versions };
  }

  // ----- Messages ---------------------------------------------------------

  /** Message for a suffix that is not in the table of 9.5, with a hint. */
  #unknownSuffixMessage(suffix) {
    const suffixes = [...this.#suffixes.keys()];
    let hint = '';
    const lower = suffix.toLowerCase();
    const sameLetters = suffixes.filter((s) => s.toLowerCase() === lower);
    if (sameLetters.length > 0) {
      hint = `; did you mean ${sameLetters.map((s) => `'${s}'`).join(' or ')}? Suffixes are case-sensitive`;
    } else {
      const prefix = suffixes.filter((s) => suffix.startsWith(s)).sort((a, b) => b.length - a.length)[0];
      if (prefix !== undefined) {
        hint = `; '${suffix}' is read as one suffix, not as '${prefix}' followed by '${suffix.slice(prefix.length)}'`;
      }
    }
    return `Unknown number suffix '${suffix}'${hint}. The suffixes are ${SUFFIX_LIST}`;
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
    this.#parseDirectives();
    // The content is checked in strict mode (12), requested by the
    // application or by %strict: true (6.8).
    this.#inDirectives = false;
    this.#check = this.#strict || this.#docStrict === true;
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
        value = isIdentifier ? this.#resolveNamedValue(token, start) : token;
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
      // '%' directly after a number is a suffix that does not exist ('50%').
      if (this.#peek() === PERCENT && this.#pos > end) this.#failDirectivePosition();
      this.#fail(`Unexpected ${describeAt(this.#text, this.#pos)} after the root value; a document contains exactly one value`);
    }
    return value;
  }

  // ----- Directives (6.5 to 6.8) ------------------------------------------

  /** Reads the directives at the start of the document, each with the separator after it. */
  #parseDirectives() {
    while (this.#peek() === PERCENT) {
      this.#parseDirective();
      const before = this.#pos;
      const newline = this.#skipSpace();
      const c = this.#peek();
      if (c === COMMA) {
        this.#pos++;
        this.#skipSpace();
      } else if (!newline && c !== EOF) {
        let reason = `Expected a comma or a line break after the directive, found ${describeAt(this.#text, this.#pos)}`;
        const gap = this.#text.slice(before, this.#pos);
        if (/[\u2028\u2029]/.test(gap)) {
          reason += '; U+2028 and U+2029 are not line breaks';
        } else if (/\/\*[^]*[\r\n]/.test(gap)) {
          reason += '; a line break inside a block comment does not separate items';
        }
        this.#fail(reason);
      }
      if (this.#peek() === EOF) {
        this.#fail('The document contains only directives; expected a value or at least one member after them');
      }
    }
  }

  /** A directive (6.5), from the '%' to the end of its value. */
  #parseDirective() {
    const start = this.#pos;
    this.#pos++; // '%'
    if (!hasFlag(this.#flags, this.#peek(), ID_START)) {
      this.#fail(`The name of a directive must follow '%' directly, without white space or comments; the directives are ${DIRECTIVE_LIST}`);
    }
    const name = this.#readIdentifier();
    if (name !== 'define' && name !== 'version' && name !== 'strict') {
      const lower = name.toLowerCase();
      const hint = lower === 'define' || lower === 'version' || lower === 'strict'
        ? `; did you mean '%${lower}'? Directives are case-sensitive`
        : '';
      this.#fail(`Unknown directive '%${name}'${hint}. The directives are ${DIRECTIVE_LIST}`, start);
    }
    this.#skipSpace();
    if (this.#peek() !== COLON) this.#failUnexpected(`':' after '%${name}'`);
    this.#pos++;
    this.#skipSpace();
    // An identifier followed by '=' (one token of lookahead), or the value alone.
    const idStart = this.#pos;
    let id;
    if (hasFlag(this.#flags, this.#peek(), ID_START)) {
      const identifier = this.#readIdentifier();
      this.#skipSpace();
      if (this.#peek() === EQUALS) {
        id = identifier;
        this.#pos++;
        this.#skipSpace();
      } else {
        this.#pos = idStart;
      }
    }
    if (name === 'define') this.#define(id, idStart);
    else if (name === 'version') this.#version(id, idStart);
    else this.#strictDirective(id, idStart, start);
  }

  /** `%define` (6.6): defines the named value `id`. */
  #define(id, idStart) {
    if (id === undefined) {
      this.#fail("%define needs an identifier and '=' before the value, as in '%define: nil = null'", idStart);
    }
    if (isPredefined(id)) {
      this.#fail(`The named value '${id}' is predefined and cannot be redefined`, idStart);
    }
    const earlier = this.#defined.get(id);
    if (earlier !== undefined) {
      const { line, column } = locate(this.#text, earlier.offset);
      this.#fail(`The named value '${id}' is already defined at line ${line}, column ${column}; a named value can be defined only once`, idStart);
    }
    const value = this.#parseValue(); // `id` is not yet defined in its own value
    const [size, depth] = measure(value);
    this.#defined.set(id, { value, size, depth, offset: idStart });
  }

  /** `%version` (6.7): records the version statement for `id`, or for the specification. */
  #version(id, idStart) {
    const key = id ?? 'xtjson';
    if (this.#versions.has(key)) {
      const which = key === 'xtjson' ? 'of the specification' : `'${key}'`;
      const forms = key === 'xtjson' ? " (%version: v and %version: xtjson = v are the same)" : '';
      this.#fail(`The version ${which} is already stated${forms}; each version may be stated only once`, idStart);
    }
    const valueStart = this.#pos;
    const value = this.#parseValue();
    const type = typeof value;
    if (type !== 'string' && type !== 'number' && type !== 'bigint') {
      this.#fail('The value of %version must be a string or a number, or a named value whose value is a string or a number', valueStart);
    }
    this.#versions.set(key, value);
  }

  /** `%strict` (6.8): strict mode for the document; `start` is the offset of the '%'. */
  #strictDirective(id, idStart, start) {
    if (id !== undefined) {
      this.#fail("%strict has no identifier; write '%strict: true' or '%strict: false'", idStart);
    }
    if (this.#docStrict !== undefined) {
      const { line, column } = locate(this.#text, this.#docStrictOffset);
      this.#fail(`%strict is already stated at line ${line}, column ${column}; %strict may occur only once`, start);
    }
    const valueStart = this.#pos;
    const value = this.#parseValue();
    if (typeof value !== 'boolean') {
      this.#fail('The value of %strict must be true or false, or a named value whose value is true or false', valueStart);
    }
    if (!value && this.#strict) {
      this.#fail('%strict: false contradicts strict mode, which the application requests with the option strict', start);
    }
    this.#docStrict = value;
    this.#docStrictOffset = start;
  }

  /** Where the prohibitions of section 12 are checked, for messages. */
  #checkedIn() {
    return this.#inDirectives ? 'in the value of a directive' : 'in strict mode';
  }

  #failDirectivePosition(offset = this.#pos) {
    this.#fail('A directive is permitted only at the top level, before the content of the document', offset);
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
          return this.#resolveNamedValue(this.#readIdentifier(), start);
        }
        if (c === PLUS || c === DOT) {
          this.#fail(`A number must not begin with '${String.fromCharCode(c)}'`);
        }
        return this.#failUnexpected('a value');
    }
  }

  /** Value of a named value (6.4); `start` is the offset of the identifier. */
  #resolveNamedValue(id, start) {
    switch (id) {
      case 'true':
        return true;
      case 'false':
        return false;
      case 'null':
        return null;
    }
    // Named values defined by %define (6.6). Their strings and names were
    // checked when the definition was read (6.5).
    const definition = this.#defined.get(id);
    if (definition !== undefined) {
      if (this.#depth + definition.depth > this.#maxDepth) {
        this.#fail(`Nesting depth exceeds the limit of ${this.#maxDepth} (option maxDepth) when the named value '${id}' is replaced`, start);
      }
      this.#expanded += definition.size;
      if (this.#expanded > this.#maxExpansion) {
        this.#fail(`Replacing named values produces more than ${this.#maxExpansion} values (option maxExpansion); definitions that use one another multiply the size of the value`, start);
      }
      return definition.depth === 0 ? definition.value : copyValue(definition.value);
    }

    let hint;
    const lower = id.toLowerCase();
    if (isPredefined(lower)) {
      hint = `; did you mean '${lower}'? Named values are case-sensitive`;
    } else if (id === 'NaN' || id === 'Infinity' || id === 'undefined') {
      hint = `; ${id} is not a JSON value`;
    } else {
      hint = `; text without quotation marks is not a string, write "${id}" for a string or define '${id}' with %define before it is used`;
    }
    return this.#fail(`Undefined named value '${id}'${hint}`, start);
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
    // Offset of each name, to report duplicates (6.5, 12).
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
          this.#fail(`Duplicate name ${JSON.stringify(name)}; names must be unique ${this.#checkedIn()} (first occurrence at line ${line}, column ${column})`, nameStart);
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
      this.#fail(`The string contains ${issue}, which is not permitted ${this.#checkedIn()}`, start);
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
      let hasFraction = false;
      if (text.charCodeAt(pos) === DOT) {
        isInteger = false;
        hasFraction = true;
        pos = this.#scanDigits(pos + 1, 10, "after '.'");
      }
      let exponentStart = -1;
      if ((text.charCodeAt(pos) | 0x20) === 0x65) { // e E
        isInteger = false;
        exponentStart = pos;
        pos++;
        const c = text.charCodeAt(pos);
        if (c === PLUS || c === MINUS) pos++;
        pos = this.#scanDigits(pos, 10, 'in the exponent');
      }
      // With the suffix n a number without a fraction part becomes a BigInt
      // if its value is an integer.
      if (!hasFraction && this.#atSuffixN(pos)) value = this.#bigIntValue(start, exponentStart, pos);
      // May be Infinity; the range is checked below, after the suffix
      // (9.4: `4.4e308pct` is 4.4e306).
      value ??= Number(this.#withoutUnderscores(start, pos));
    }

    // 9.5: suffix
    let c = text.charCodeAt(pos);
    if (hasFlag(this.#flags, c, SUFFIX_FIRST)) {
      // Longest match: all identifier characters belong to the suffix.
      const suffixStart = pos;
      pos++;
      while (hasFlag(this.#flags, text.charCodeAt(pos), ID_PART)) pos++;
      const suffix = text.slice(suffixStart, pos);
      c = text.charCodeAt(pos);
      if (c === DOT) {
        this.#fail(`Unexpected '.' after the number suffix '${suffix}'`, pos);
      }
      if (typeof value !== 'bigint') {
        // `value` is exact for non-decimal numbers (checked in radixValue) and
        // for decimal integers within the safe range; otherwise it may be rounded.
        const exact = radix !== 10 || (isInteger && Math.abs(value) <= Number.MAX_SAFE_INTEGER);
        value = this.#applySuffix(suffix, value, exact, start, suffixStart);
      }
    } else if (c === DOT) {
      this.#fail(radix === 10
        ? "Unexpected '.' in a number"
        : `A ${RADIX_NAMES[radix]} number cannot have a fraction part`, pos);
    } else if (hasFlag(this.#flags, c, ID_PART)) {
      if (isDigit(c)) {
        this.#fail(`'${String.fromCharCode(c)}' is not a valid ${RADIX_NAMES[radix]} digit`, pos);
      }
      if (c === UNDERSCORE) this.#fail("'_' is only permitted between two digits", pos);
      this.#fail(`Unexpected '${String.fromCharCode(c)}' after a number; a number suffix cannot begin with a to f, o or x`, pos);
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
   * Value of a decimal number without a fraction part as a BigInt, or
   * undefined if it is not an integer (`12e-1`). `exponentStart` is the
   * offset of the `e`, or -1.
   */
  #bigIntValue(start, exponentStart, end) {
    let digits = this.#withoutUnderscores(start, exponentStart < 0 ? end : exponentStart);
    const negative = digits.charCodeAt(0) === MINUS;
    if (negative) digits = digits.slice(1);
    let exponent = exponentStart < 0 ? 0 : Number(this.#withoutUnderscores(exponentStart + 1, end));
    const significant = digits.replace(/0+$/, '');
    if (significant === '') return 0n;
    if (exponent < 0) {
      if (digits.length - significant.length < -exponent) return undefined;
      digits = digits.slice(0, digits.length + exponent);
      exponent = 0;
    }
    if (exponent > MAX_BIGINT_EXPONENT) {
      this.#fail(`The exponent of a BigInt number (suffix n) exceeds the limit of ${MAX_BIGINT_EXPONENT}`, start);
    }
    let value = BigInt(digits);
    if (exponent > 0) value *= 10n ** BigInt(exponent);
    return negative ? -value : value;
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
    if (conversion === undefined) this.#fail(this.#unknownSuffixMessage(suffix), suffixStart);
    const factor = conversion[0];
    const scale = conversion[1];
    if (factor === 1 && scale === 0) return value; // s, px, L, n
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
// parse()

const PARSE_ARGUMENTS = [
  { name: 'reviver', description: 'a reviver (a function)', test: isFunction },
  { name: 'options', description: 'options (an object)', test: isOptions },
];

/** Parser without options, created on first use. */
let defaultParser;

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
 * @param {Function | import('./shared.js').Options | object | null} [reviver]
 *   a function transforms the result, as in `JSON.parse`; an object are the
 *   options
 * @param {import('./shared.js').Options | object | null} [options] the
 *   strict mode and the limits
 * @returns {any} the value; a number with the suffix `n` and without a
 *   fraction part becomes a BigInt if its value is an integer
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
export function parse(text, reviver, options) {
  const [parser, fn] = parserFor('parse', reviver, options);
  return parser.parse(text, fn);
}

/**
 * Parses an XTJSON document and returns its value together with the version
 * statements of its `%version` directives (6.7), as a `Map` from identifier
 * to value; the version of the specification is stored under `xtjson`. The
 * arguments are the same as for `parse`.
 *
 *     parseDocument('%version: "0.6"\nport: 8080')
 *     // { value: { port: 8080 }, versions: Map { 'xtjson' => '0.6' } }
 *
 * @param {string} text the document
 * @param {Function | import('./shared.js').Options | object | null} [reviver]
 * @param {import('./shared.js').Options | object | null} [options]
 * @returns {{value: any, versions: Map<string, string | number | bigint>}}
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
export function parseDocument(text, reviver, options) {
  const [parser, fn] = parserFor('parseDocument', reviver, options);
  return parser.parseDocument(text, fn);
}

/**
 * Assigns the optional arguments of parse() or parseDocument() and returns
 * the parser for the options together with the reviver.
 */
function parserFor(caller, reviver, options) {
  if (reviver !== undefined || options !== undefined) {
    const args = readArguments(caller, [reviver, options], PARSE_ARGUMENTS);
    reviver = args[0];
    options = args[1];
  }
  const parser = options === undefined ? (defaultParser ??= new Parser()) : new Parser(options);
  return [parser, reviver];
}
