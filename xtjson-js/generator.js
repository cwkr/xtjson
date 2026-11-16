/**
 * XTJSON generator: `Generator` and `stringify()`.
 *
 * Implements the XTJSON specification, draft 0.4 (docs/xtjson-spec-en.md).
 *
 * Design notes:
 * - Serialization as in `JSON.stringify` (ECMA-262 SerializeJSONProperty),
 *   with the output format of XTJSON.
 * - Errors of the application (invalid options or arguments, values that
 *   cannot be written) throw `TypeError`.
 * - The configuration and the state of a run are private. A `Generator` can
 *   be reused for many values.
 * - The module has no side effects when it is imported; tables are built on
 *   first use.
 */

import {
  CharacterTables, ID_PART, ID_START, ijsonStringIssue, indentation, isDigit, isOptions, isReplacer, isSpace,
  readArguments, resolveOptions,
} from './shared.js';

// Character codes. Declared in this module rather than imported: V8 folds
// module-local constants, but reads imported bindings at run time.
const TAB = 0x09;
const FF = 0x0c;
const CR = 0x0d;
const SPACE = 0x20;
const DQUOTE = 0x22;
const SQUOTE = 0x27;
const MINUS = 0x2d;
const BACKSLASH = 0x5c;

// ---------------------------------------------------------------------------
// Generator

/**
 * Suffixes that stringify writes for integers, in the order of priority
 * (9.5): the binary sizes first, then thousands, then hours and minutes.
 */
const MULTIPLYING_SUFFIXES = [['mb', 1048576], ['kb', 1024], ['k', 1000], ['h', 3600], ['min', 60]];

/**
 * Suffixes that stringify writes for fractions between -1 and 1, in the
 * order of priority, with the power of ten they divide by (9.5).
 */
const DIVIDING_SUFFIXES = [['pct', 2], ['ms', 3]];

/** Integers with at least this magnitude get `_` between groups of digits. */
const GROUPING_THRESHOLD = 10000;
const GROUPING_DIGITS = 5; // digits of GROUPING_THRESHOLD

const HAS_LINE_SEPARATOR = /[\u2028\u2029]/;
const LINE_SEPARATORS = /[\u2028\u2029]/g;

/**
 * A string in double quotation marks (8.1). Uses the escapes of
 * JSON.stringify and in addition escapes U+2028 and U+2029, which some
 * editors display as a line break (section 13).
 */
function quoteString(s) {
  const json = JSON.stringify(s);
  return HAS_LINE_SEPARATOR.test(json)
    ? json.replace(LINE_SEPARATORS, (c) => (c.charCodeAt(0) === 0x2028 ? '\\u2028' : '\\u2029'))
    : json;
}

/**
 * A string in single quotation marks (8.1): the escapes of `quoteString`,
 * but `"` unescaped and `'` escaped.
 */
function singleQuoteString(s) {
  const json = quoteString(s);
  // Without a backslash and a "'" only the delimiters differ.
  if (!json.includes('\\') && !json.includes("'")) return "'" + json.slice(1, -1) + "'";
  const body = json.slice(1, -1).replace(/\\.|'/g, (m) => {
    if (m === "'") return "\\'";
    return m === '\\"' ? '"' : m;
  });
  return "'" + body + "'";
}

/** A BigInt as an integer with the suffix `n` (9.5). */
function formatBigInt(n) {
  return groupDigits(String(n)) + 'n';
}

/**
 * A number in decimal notation. With `writeNumberSuffixes`, a suffix where one
 * applies (9.5):
 *
 * - An integer that is a multiple of 1048576, 1024, 1000, 3600 or 60 gets
 *   the suffix `mb`, `kb`, `k`, `h` or `min`, the first that applies, as
 *   long as the remaining factor is a safe integer.
 * - A fraction between -1 and 1 that is a whole number of hundredths or
 *   thousandths gets the suffix `pct` or `ms`, the first that applies.
 *
 * Every text reads back as exactly the same number. An integer part of
 * 10000 or more gets `_` between groups of three digits (9.3).
 */
function formatNumber(n, writeNumberSuffixes) {
  if (n === 0) return '0'; // also for -0, as in JSON.stringify
  if (!writeNumberSuffixes) {
    return n > -GROUPING_THRESHOLD && n < GROUPING_THRESHOLD ? String(n) : groupDigits(String(n));
  }
  if (Number.isInteger(n)) {
    for (const [suffix, factor] of MULTIPLYING_SUFFIXES) {
      if (n % factor === 0 && Math.abs(n / factor) <= Number.MAX_SAFE_INTEGER) {
        return groupDigits(String(n / factor)) + suffix;
      }
    }
  } else if (Math.abs(n) < 1) {
    // |n| = digits × 10^exponent, from the shortest decimal that reads back
    // as n; shifting the decimal point keeps the value exact.
    const m = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(Math.abs(n)));
    const fraction = m[2] ?? '';
    const digits = (m[1] + fraction).replace(/^0+/, '');
    const exponent = Number(m[3] ?? 0) - fraction.length;
    for (const [suffix, shift] of DIVIDING_SUFFIXES) {
      if (exponent + shift >= 0) {
        return (n < 0 ? '-' : '') + groupDigits(digits + '0'.repeat(exponent + shift)) + suffix;
      }
    }
  }
  return groupDigits(String(n));
}

/** Inserts `_` into an integer part of 10000 or more (9.3). */
function groupDigits(text) {
  const start = text.charCodeAt(0) === MINUS ? 1 : 0;
  let end = start;
  while (isDigit(text.charCodeAt(end))) end++;
  const length = end - start;
  if (length < GROUPING_DIGITS) return text;
  const first = start + (length % 3 || 3);
  let out = text.slice(0, first);
  for (let i = first; i < end; i += 3) out += '_' + text.slice(i, i + 3);
  return out + text.slice(end);
}

function isBlankCode(c) {
  return c === SPACE || c === TAB;
}

/** Escape sequence for a single character in a string across several lines. */
function escapeCode(c) {
  switch (c) {
    case SPACE: return '\\x20';
    case TAB: return '\\t';
    case 0x08: return '\\b';
    case FF: return '\\f';
    case CR: return '\\r';
    case BACKSLASH: return '\\\\';
    case DQUOTE: return '\\"';
    case SQUOTE: return "\\'";
    default: return '\\u' + c.toString(16).toUpperCase().padStart(4, '0');
  }
}

/**
 * Text of one line of a string across several lines (8.3). Escapes what
 * would end the string or change its value: the delimiter `quote` (the code
 * of its quotation mark), backslashes, control characters except tab,
 * unpaired surrogates, U+2028 and U+2029, and a space or tab at the end of
 * a line that step 2 would remove (`trailingBlank`).
 */
function escapeLineText(text, trailingBlank, quote) {
  const n = text.length;
  let out = '';
  let chunk = 0; // start of the text that is not yet copied to `out`
  for (let i = 0; i < n; i++) {
    const c = text.charCodeAt(i);
    let escape = false;
    if (isBlankCode(c)) {
      escape = trailingBlank && i === n - 1;
    } else if (c === quote || c < SPACE || c === BACKSLASH || c === 0x2028 || c === 0x2029) {
      escape = true;
    } else if (c >= 0xd800 && c <= 0xdfff) {
      const d = text.charCodeAt(i + 1);
      if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) i++; // a surrogate pair
      else escape = true;
    }
    if (escape) {
      out += text.slice(chunk, i) + escapeCode(c);
      chunk = i + 1;
    }
  }
  return chunk === 0 ? text : out + text.slice(chunk);
}

/**
 * A string across several lines (8.3) whose lines are indented with
 * `indent`, with the delimiter `"` or `'` (`quote`). The text begins with an
 * empty line, so that exactly `indent` is removed again when it is read.
 */
function multiLineString(value, indent, quote) {
  const delimiter = String.fromCharCode(quote);
  const parts = value.split('\n');
  const last = parts.length - 1;
  const lines = [];
  for (let i = 0; i < last; i++) {
    lines.push(parts[i] === '' ? '' : indent + escapeLineText(parts[i], true, quote));
  }
  if (parts[last] === '') {
    // The value ends with a line break: the closing delimiter gets its own line.
    lines.push(indent + delimiter);
  } else {
    let text = escapeLineText(parts[last], false, quote);
    // The last line counts towards the smallest indentation. If it and all
    // other lines begin with white space, more than `indent` would be
    // removed; escaping its first character prevents that.
    if (isBlankCode(text.charCodeAt(0)) &&
        lines.every((line) => line === '' || isBlankCode(line.charCodeAt(indent.length)))) {
      text = escapeCode(text.charCodeAt(0)) + text.slice(1);
    }
    lines.push(indent + text + delimiter);
  }
  return delimiter + '\n' + lines.join('\n');
}

/**
 * Generator for XTJSON documents with fixed options. Validates the options
 * once; reuse the instance for many values.
 *
 *     const generator = new Generator({ writeNumberSuffixes: true });
 *     const text = generator.stringify(value, null, 2);
 */
export class Generator {
  // Configuration, fixed when the generator is created
  /** @type {import('./shared.js').OptionsState} */
  #state;
  /** @type {Map<unknown, string> | undefined} undefined without custom named values, which saves the lookups */
  #names;
  #ijson = false;
  #maxDepth = 0;
  #writeNumberSuffixes = false;
  #quote = DQUOTE;
  /** @type {Uint8Array} */
  #flags;
  /** @type {(value: unknown) => boolean} */
  #isRawJSON;

  // State of the current run
  /** @type {Function | undefined} */
  #replacer;
  /** @type {string[] | undefined} */
  #propertyList;
  #gap = '';
  #colon = ':';
  /** @type {object[]} objects and arrays being written, to detect cycles */
  #stack = [];
  #busy = false;

  /**
   * @param {import('./shared.js').Options | object | null} [options] named
   *   values, the I-JSON mode, the maximum nesting depth, number suffixes and
   *   quotation marks
   * @throws {TypeError} if the options are invalid
   */
  constructor(options) {
    this.#configure(resolveOptions(options));
    this.#flags = CharacterTables.get().flags;
    this.#isRawJSON = typeof JSON.isRawJSON === 'function' ? JSON.isRawJSON : () => false;
  }

  #configure(state) {
    this.#state = state;
    this.#names = state.names.size > 0 ? state.names : undefined;
    this.#ijson = state.ijson;
    this.#maxDepth = state.maxDepth;
    this.#writeNumberSuffixes = state.writeNumberSuffixes;
    this.#quote = state.writeSingleQuotes ? SQUOTE : DQUOTE;
  }

  /**
   * Writes a value as an XTJSON document, like `JSON.stringify`.
   *
   * @param {any} value
   * @param {Function | Array<string | number> | null} [replacer] a function
   *   or an array of names, as in `JSON.stringify`
   * @param {number | string | null} [space] indentation: a number of spaces
   *   (at most 10) or a string of spaces and tabs
   * @returns {string | undefined} undefined if the value cannot be written
   *   (undefined, a function or a symbol), as in `JSON.stringify`
   * @throws {TypeError} for circular references, nesting deeper than
   *   maxDepth, invalid arguments, and strings not permitted in I-JSON mode
   */
  stringify(value, replacer, space) {
    if (replacer !== undefined && replacer !== null && !isReplacer(replacer)) {
      throw new TypeError(`Generator.stringify: the replacer must be a function or an array, not ${typeof replacer}`);
    }
    if (space !== undefined && space !== null && !isSpace(space)) {
      throw new TypeError(`Generator.stringify: space must be a number or a string, not ${typeof space}`);
    }
    if (this.#busy) {
      // Called again during a run, from toJSON or a replacer: use a
      // generator of its own.
      const generator = new Generator();
      generator.#configure(this.#state);
      return generator.stringify(value, replacer, space);
    }
    const gap = indentation(space, 'stringify');
    const list = Array.isArray(replacer) ? propertyList(replacer) : undefined;
    this.#replacer = typeof replacer === 'function' ? replacer : undefined;
    this.#propertyList = list;
    this.#gap = gap;
    this.#colon = gap === '' ? ':' : ': ';
    this.#busy = true;
    try {
      return this.#document(value);
    } finally {
      this.#busy = false;
      this.#replacer = undefined;
      this.#propertyList = undefined;
      this.#stack.length = 0;
    }
  }

  /** True if `s` can be written as a name without quotation marks (7.2). */
  #isIdentifier(s) {
    const flags = this.#flags;
    const length = s.length;
    if (length === 0) return false;
    let c = s.charCodeAt(0);
    if (!(c < 128) || (flags[c] & ID_START) === 0) return false;
    for (let i = 1; i < length; i++) {
      c = s.charCodeAt(i);
      if (!(c < 128) || (flags[c] & ID_PART) === 0) return false;
    }
    return true;
  }

  /** The document, or undefined if the value cannot be written. */
  #document(value) {
    const root = this.#prepare({ '': value }, '', value);
    if (root !== null && typeof root === 'object' && !Array.isArray(root) && !this.#isRawJSON(root)) {
      // 6.2: an object at the top level is written without braces, unless
      // it is empty.
      this.#enter(root);
      const members = this.#members(root, '');
      this.#leave();
      return members === '' ? '{}' : members;
    }
    return this.#write(root, '');
  }

  /**
   * `value`, which is `holder[key]`, after toJSON, the replacer and
   * unwrapping. `key` is a string or the index of an array item.
   */
  #prepare(holder, key, value) {
    if ((value !== null && typeof value === 'object') || typeof value === 'bigint') {
      const toJSON = value.toJSON;
      if (typeof toJSON === 'function') value = toJSON.call(value, typeof key === 'number' ? String(key) : key);
    }
    if (this.#replacer !== undefined) {
      value = this.#replacer.call(holder, typeof key === 'number' ? String(key) : key, value);
    }
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
  #write(value, indent) {
    switch (typeof value) {
      case 'string':
        return this.#string(value, indent);
      case 'number':
        if (!Number.isFinite(value)) return this.#literal(null); // as JSON
        if (this.#names !== undefined) {
          const name = this.#names.get(value);
          if (name !== undefined) return name;
        }
        return formatNumber(value, this.#writeNumberSuffixes);
      case 'boolean':
        return this.#literal(value);
      case 'bigint':
        return formatBigInt(value); // always with the suffix n, so it reads back as a BigInt
      case 'object':
        if (value === null) return this.#literal(null);
        if (this.#isRawJSON(value)) return value.rawJSON;
        return Array.isArray(value) ? this.#array(value, indent) : this.#object(value, indent);
      default:
        return undefined; // undefined, functions and symbols
    }
  }

  /** `true`, `false` or `null`, or a custom named value for it. */
  #literal(value) {
    return this.#names?.get(value) ?? String(value);
  }

  #string(value, indent) {
    if (this.#ijson) this.#checkIJSON(value, 'a string');
    if (this.#names !== undefined) {
      const name = this.#names.get(value);
      if (name !== undefined) return name;
    }
    if (this.#gap !== '' && value.includes('\n')) return multiLineString(value, indent + this.#gap, this.#quote);
    return this.#quoted(value);
  }

  /** A name (7.2): an identifier if possible, otherwise a string. */
  #name(key) {
    if (this.#ijson) this.#checkIJSON(key, 'the name');
    return this.#isIdentifier(key) ? key : this.#quoted(key);
  }

  /** A single-line string in the configured quotation marks. */
  #quoted(value) {
    return this.#quote === SQUOTE ? singleQuoteString(value) : quoteString(value);
  }

  #checkIJSON(value, what) {
    const issue = ijsonStringIssue(value);
    if (issue !== undefined) {
      throw new TypeError(`stringify: ${what} ${quoteString(value)} contains ${issue}, which is not permitted in I-JSON mode`);
    }
  }

  #enter(value) {
    if (this.#stack.includes(value)) {
      throw new TypeError('stringify: the value contains a circular reference');
    }
    if (this.#stack.length >= this.#maxDepth) {
      throw new TypeError(`stringify: objects and arrays are nested deeper than the limit of ${this.#maxDepth} (option maxDepth)`);
    }
    this.#stack.push(value);
  }

  #leave() {
    this.#stack.pop();
  }

  /**
   * Members of an object, each written as `name: value`. They are separated
   * by a comma or, with indentation, by a line break and `indent` (7.3).
   * The text is built by concatenation, which the engines handle better
   * than collecting the parts in an array.
   */
  #members(value, indent) {
    const keys = this.#propertyList ?? Object.keys(value);
    const colon = this.#colon;
    const separator = this.#gap === '' ? ',' : '\n' + indent;
    const always = this.#replacer !== undefined;
    let out = '';
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let item = value[key];
      const type = typeof item;
      if (always || type === 'object' || type === 'bigint') item = this.#prepare(value, key, item);
      const text = this.#write(item, indent);
      if (text === undefined) continue;
      const member = this.#name(key) + colon + text;
      out = out === '' ? member : out + separator + member;
    }
    return out;
  }

  #object(value, indent) {
    this.#enter(value);
    const inner = indent + this.#gap;
    const members = this.#members(value, inner);
    this.#leave();
    return this.#block('{', members, '}', indent, inner);
  }

  #array(value, indent) {
    this.#enter(value);
    const inner = indent + this.#gap;
    const separator = this.#gap === '' ? ',' : '\n' + inner;
    const always = this.#replacer !== undefined;
    const length = value.length;
    let out = '';
    for (let i = 0; i < length; i++) {
      let item = value[i];
      const type = typeof item;
      if (always || type === 'object' || type === 'bigint') item = this.#prepare(value, i, item);
      const text = this.#write(item, inner) ?? this.#literal(null);
      out = i === 0 ? text : out + separator + text;
    }
    this.#leave();
    return this.#block('[', out, ']', indent, inner);
  }

  /** Items in brackets: compact, or one per line (7.3). */
  #block(open, items, close, indent, inner) {
    if (items === '') return open + close;
    if (this.#gap === '') return open + items + close;
    return open + '\n' + inner + items + '\n' + indent + close;
  }
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
// stringify()

const STRINGIFY_ARGUMENTS = [
  { name: 'replacer', description: 'a replacer (a function or an array)', test: isReplacer },
  { name: 'space', description: 'space (a number or a string)', test: isSpace },
  { name: 'options', description: 'options (an object)', test: isOptions },
];

/** Generator without options, created on first use. */
let defaultGenerator;

/**
 * Writes a value as an XTJSON document.
 *
 * Works like `JSON.stringify`, with these differences in the output:
 * an object at the top level is written without braces; names that are
 * identifiers are written without quotation marks; with `space`, items are
 * separated by line breaks instead of commas and strings that contain a
 * line break are written across several lines, with their text indented
 * one level deeper (8.3); numbers of 10000 or more
 * are grouped with `_`; with the option `writeNumberSuffixes`, integers that are
 * multiples of 1048576, 1024, 1000, 3600 or 60 get the suffix `mb`, `kb`,
 * `k`, `h` or `min`, and fractions between -1 and 1 the suffix `pct` or `ms`
 * where they fit; BigInt values are written with the suffix `n`; with the
 * option `writeSingleQuotes`, strings are written in `'`; primitive
 * values for which a named value is defined are written as that named
 * value.
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
 * @param {Function | Array<string | number> | number | string | import('./shared.js').Options | object | null} [replacer]
 * @param {number | string | import('./shared.js').Options | object | null} [space]
 *   indentation: a number of spaces (at most 10) or a string of spaces and
 *   tabs
 * @param {import('./shared.js').Options | object | null} [options] named
 *   values, the I-JSON mode, the maximum nesting depth, number suffixes and
 *   quotation marks
 * @returns {string | undefined} undefined if the value cannot be written
 *   (undefined, a function or a symbol), as in `JSON.stringify`
 * @throws {TypeError} for circular references, nesting deeper than
 *   maxDepth, invalid arguments or options, and strings not permitted in
 *   I-JSON mode
 */
export function stringify(value, replacer, space, options) {
  if (replacer !== undefined || space !== undefined || options !== undefined) {
    const args = readArguments('stringify', [replacer, space, options], STRINGIFY_ARGUMENTS);
    replacer = args[0];
    space = args[1];
    options = args[2];
  }
  const generator = options === undefined ? (defaultGenerator ??= new Generator()) : new Generator(options);
  return generator.stringify(value, replacer, space);
}
