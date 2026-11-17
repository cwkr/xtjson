/**
 * Code shared by the parser (parser.js) and the generator (generator.js):
 * character codes and classes, the options (strict mode, section 12,
 * limits, section 11, and the output format), the strict mode check for
 * strings and the assignment of optional arguments.
 *
 * The module has no side effects when it is imported: at the top level there
 * are only declarations and literals. Tables are built on first use.
 *
 * Only `Options` is part of the API of the package; everything else is
 * internal.
 */

// ---------------------------------------------------------------------------
// Limits (section 11). Hitting a limit is reported as an error.

/** Default for the option `maxDepth`: maximum nesting depth of objects and arrays. */
export const DEFAULT_MAX_DEPTH = 1000;

/**
 * Default for the option `maxExpansion`: maximum number of JSON values that
 * replacing named values may produce in one document (sections 11 and 13).
 */
export const DEFAULT_MAX_EXPANSION = 1000000;

// ---------------------------------------------------------------------------
// Character classes
//
// The character codes are declared in each module that uses them rather than
// exported from here: V8 folds module-local constants, but reads imported
// bindings at run time, which costs several percent in the parser.

const DIGIT_0 = 0x30;
const DIGIT_9 = 0x39;

// Flags for ASCII characters in `CharacterTables.flags`
export const ID_START = 1; // ALPHA / "_" / "$"                       (7.2)
export const ID_PART = 2; // ALPHA / DIGIT / "_" / "$"                (7.2)
export const SUFFIX_FIRST = 4; // g-n p-w y z G-N P-W Y Z $            (9.5)
export const DIGIT = 8;

/**
 * Lookup tables for ASCII characters, built on first use and shared by all
 * parsers and generators. Parser and generator copy the references into
 * private fields when they are created.
 */
export class CharacterTables {
  /** @type {{flags: Uint8Array, hex: Int8Array} | undefined} */
  static #tables;

  /**
   * `flags`: the flags `ID_START`, `ID_PART`, `SUFFIX_FIRST` and `DIGIT` of
   * each ASCII character. `hex`: the value of a hexadecimal digit, or -1.
   * @returns {{flags: Uint8Array, hex: Int8Array}}
   */
  static get() {
    return (CharacterTables.#tables ??= CharacterTables.#build());
  }

  static #build() {
    const flags = new Uint8Array(128);
    const hex = new Int8Array(128).fill(-1);
    for (let c = 0; c < 128; c++) {
      const ch = String.fromCharCode(c);
      let f = 0;
      if (/[A-Za-z_$]/.test(ch)) f |= ID_START | ID_PART;
      if (/[0-9]/.test(ch)) f |= ID_PART | DIGIT;
      if (/[g-np-wyzG-NP-WYZ$]/.test(ch)) f |= SUFFIX_FIRST;
      flags[c] = f;
      if (/[0-9A-Fa-f]/.test(ch)) hex[c] = parseInt(ch, 16);
    }
    return { flags, hex };
  }
}

export function isDigit(c) {
  return c >= DIGIT_0 && c <= DIGIT_9;
}

/** `U+XXXX` for a code point, for messages. */
export function hex4(c) {
  return 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
}

/** A value for messages: strings in quotation marks. */
export function quote(x) {
  return typeof x === 'string' ? JSON.stringify(x) : String(x);
}

/** True for the predefined named values `true`, `false` and `null` (6.4). */
export function isPredefined(id) {
  return id === 'true' || id === 'false' || id === 'null';
}

// ---------------------------------------------------------------------------
// Strict mode (12)

/**
 * Why a name or string value is not permitted in strict mode: it contains an
 * unpaired surrogate or a noncharacter. Returns undefined if it is permitted.
 */
export function strictStringIssue(s) {
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

// ---------------------------------------------------------------------------
// Options: strict mode (12), limits (11) and output format

const OPTION_NAMES = ['maxDepth', 'maxExpansion', 'strict', 'writeNumberSuffixes', 'writeSingleQuotes'];
const OPTION_LIST = '"maxDepth", "maxExpansion", "strict", "writeNumberSuffixes" and "writeSingleQuotes"';

/**
 * Internal state of an `Options` instance, read by parser and generator.
 * @typedef {object} OptionsState
 * @property {number} maxDepth
 * @property {number} maxExpansion
 * @property {boolean} strict
 * @property {boolean} writeNumberSuffixes
 * @property {boolean} writeSingleQuotes
 */

/** Set in the static block of `Options`; see `resolveOptions`. */
let resolve;

/**
 * Validated, immutable options for `parse()` and `stringify()`: strict mode
 * (12), limits (11) and the output format of `stringify`.
 *
 * Named values are defined only in the document, with `%define` (6.6); the
 * directives and the number suffixes are fixed by sections 6.5 and 9.5. None
 * of them can be defined by the application. Validate once and reuse the
 * instance for many calls.
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
   * @param {{maxDepth?: number, maxExpansion?: number, strict?: boolean,
   *   writeNumberSuffixes?: boolean, writeSingleQuotes?: boolean} | Options} [init]
   *   `maxDepth`: maximum nesting depth of objects and arrays (default 1000).
   *   `maxExpansion`: maximum number of JSON values that replacing named
   *   values may produce in one document (default 1000000).
   *   `strict`: true for strict mode (default false).
   *   `writeNumberSuffixes`: `stringify` writes number suffixes (default false).
   *   `writeSingleQuotes`: `stringify` writes strings in `'` (default false).
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
            ? '; named values are defined in the document with %define, not by the application'
            : key === 'ijson' ? '; the I-JSON mode is strict mode, option "strict"' : '';
          throw new TypeError(`Unknown XTJSON option ${quote(key)}${hint}. The options are ${OPTION_LIST}`);
        }
      }
    }
    const strict = Options.#booleanOption(init, 'strict');
    const writeNumberSuffixes = Options.#booleanOption(init, 'writeNumberSuffixes');
    const writeSingleQuotes = Options.#booleanOption(init, 'writeSingleQuotes');
    const maxDepth = Options.#limitOption(init, 'maxDepth', DEFAULT_MAX_DEPTH);
    const maxExpansion = Options.#limitOption(init, 'maxExpansion', DEFAULT_MAX_EXPANSION);
    this.#state = { maxDepth, maxExpansion, strict, writeNumberSuffixes, writeSingleQuotes };
    Object.freeze(this);
  }

  /**
   * Maximum nesting depth of objects and arrays, for `parse` and
   * `stringify`. An implicit root object counts as a level.
   * @returns {number}
   */
  get maxDepth() {
    return this.#state.maxDepth;
  }

  /**
   * Maximum number of JSON values that replacing named values may produce
   * in one document, for `parse`. Every object, array and other value
   * counts as one.
   * @returns {number}
   */
  get maxExpansion() {
    return this.#state.maxExpansion;
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

  /**
   * True if `stringify` writes number suffixes (`64mb`, `2h`, `50pct`).
   * BigInt values always get the suffix `n`.
   * @returns {boolean}
   */
  get writeNumberSuffixes() {
    return this.#state.writeNumberSuffixes;
  }

  /**
   * True if `stringify` writes strings and quoted names in `'` instead
   * of `"`.
   * @returns {boolean}
   */
  get writeSingleQuotes() {
    return this.#state.writeSingleQuotes;
  }

  get [Symbol.toStringTag]() {
    return 'Options';
  }

  /** A boolean option; false if not given. */
  static #booleanOption(init, name) {
    const value = init?.[name] ?? false;
    if (typeof value !== 'boolean') {
      throw new TypeError(`Invalid XTJSON option: "${name}" must be true or false, not ${quote(value)}`);
    }
    return value;
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
export function resolveOptions(options) {
  return resolve(options);
}

// ---------------------------------------------------------------------------
// Optional arguments of parse() and stringify()

export const isFunction = (x) => typeof x === 'function';
export const isReplacer = (x) => typeof x === 'function' || Array.isArray(x);
export const isSpace = (x) => typeof x === 'number' || typeof x === 'string' || x instanceof Number || x instanceof String;
export const isOptions = (x) => typeof x === 'object' && !Array.isArray(x) && !(x instanceof Number) && !(x instanceof String);

/**
 * Indentation from the `space` argument, as in JSON.stringify: at most 10
 * spaces, or the first 10 characters of a string of spaces and tabs.
 * @param {unknown} space
 * @param {string} caller name of the function, for messages
 */
export function indentation(space, caller) {
  if (space instanceof Number) space = Number(space);
  else if (space instanceof String) space = String(space);
  if (typeof space === 'number') {
    const n = Math.min(10, Math.trunc(space) || 0);
    return n >= 1 ? ' '.repeat(n) : '';
  }
  if (typeof space === 'string') {
    const gap = space.slice(0, 10);
    if (!/^[ \t]*$/.test(gap)) {
      throw new TypeError(`${caller}: "space" may only contain spaces and tabs; other characters would make the indentation invalid`);
    }
    return gap;
  }
  return '';
}

/**
 * Assigns the optional arguments by their type. Each kind may occur once,
 * in the order of `kinds`; null and undefined are skipped.
 * @param {string} caller name of the function, for messages
 * @param {unknown[]} args
 * @param {{name: string, description: string, test: (x: unknown) => boolean}[]} kinds
 */
export function readArguments(caller, args, kinds) {
  const result = new Array(kinds.length).fill(undefined);
  const expected = () => kinds.map((kind) => kind.description).join(', ');
  let next = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined || arg === null) continue;
    let k = 0;
    while (k < kinds.length && !kinds[k].test(arg)) k++;
    if (k === kinds.length) {
      throw new TypeError(`${caller}: unexpected argument of type ${typeof arg}; expected ${expected()}, in this order`);
    }
    if (k < next) {
      const problem = result[k] !== undefined ? 'given twice' : 'in the wrong position';
      throw new TypeError(`${caller}: the ${kinds[k].name} is ${problem}; expected ${expected()}, in this order`);
    }
    result[k] = arg;
    next = k + 1;
  }
  return result;
}
