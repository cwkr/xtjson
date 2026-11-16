/**
 * XTJSON parser and generator for JavaScript. `parse` and `stringify` work
 * like the functions of the global `JSON` object; `Parser` and `Generator`
 * keep validated options for many calls.
 *
 * @example
 * import { parse, stringify } from '@cwkr/xtjson';
 * const config = parse('name: "demo"\nport: 8080');
 * const text = stringify(config, 2);
 */

/** A JSON value: the data model of XTJSON. */
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [name: string]: JSONValue };

/** The value of a named value (6.4): a string, a number, a boolean or null. */
export type NamedValue = string | number | boolean | null;

/**
 * Definitions given as a plain object, a `Map` or an iterable of
 * `[key, value]` pairs. The order of the entries is kept.
 */
export type DefinitionEntries<T> =
  | Readonly<Record<string, T>>
  | ReadonlyMap<string, T>
  | Iterable<readonly [string, T]>;

/** Options for `parse` and `stringify`. */
export interface OptionsInit {
  /**
   * Named values (6.4): identifier → string, number, boolean or `null`, in
   * a fixed order; objects and arrays are not permitted. `true`, `false`
   * and `null` are predefined and cannot be redefined.
   * `stringify` writes a value as a named value if one has exactly this
   * value; if several have it, the one defined last wins, and the predefined
   * ones are used only if no custom one matches.
   *
   * There is no option for number suffixes: they are fixed by section 9.5.
   * Unknown properties are a `TypeError`.
   */
  namedValues?: DefinitionEntries<NamedValue>;
  /**
   * I-JSON mode (section 12). `parse` rejects a document in which an object
   * contains a name twice, or in which a name or string value (also from a
   * named value) contains an unpaired surrogate or a Unicode noncharacter.
   * `stringify` throws a `TypeError` for such names and strings.
   * Default: false; then the member that comes last applies.
   */
  ijson?: boolean;
  /**
   * Maximum nesting depth of objects and arrays, a positive integer; an
   * implicit root object counts as a level. `parse` reports a deeper
   * document as a `ParserError`, `stringify` a deeper value as a
   * `TypeError`. Default: 1000. A very large value can exceed the call
   * stack of the engine; `parse` then also throws a `ParserError`.
   */
  maxDepth?: number;
  /**
   * `stringify` writes number suffixes: integers that are a multiple of the
   * factor with `mb`, `kb`, `k`, `h` or `min`, fractions between -1 and 1
   * that are whole hundredths or thousandths with `pct` or `ms`, the first
   * in this order that applies. Default: false. BigInt values always get
   * the suffix `n`.
   */
  writeNumberSuffixes?: boolean;
  /**
   * `stringify` writes strings and quoted names in `'` and multi-line
   * strings in `'''` instead of `"` and `"""`. Default: false.
   */
  writeSingleQuotes?: boolean;
}

/**
 * Validated, immutable options. Create them once and pass them to every
 * call; plain `OptionsInit` objects are validated again on each call.
 */
export class Options implements OptionsInit {
  /** @throws {TypeError} if an option is unknown or invalid, or a definition violates section 6.4. */
  constructor(init?: OptionsInit | null);
  /** The named values in their defined order (a new Map). */
  get namedValues(): Map<string, NamedValue>;
  /** The maximum nesting depth of objects and arrays. */
  get maxDepth(): number;
  /** True for the I-JSON mode. */
  get ijson(): boolean;
  /** True if `stringify` writes number suffixes. */
  get writeNumberSuffixes(): boolean;
  /** True if `stringify` writes strings in `'` and `'''`. */
  get writeSingleQuotes(): boolean;
  get [Symbol.toStringTag](): 'Options';
}

/** Error in an XTJSON document. */
export class ParserError extends SyntaxError {
  name: 'ParserError';
  /** The violated rule, without position. */
  readonly reason: string;
  /** 1-based line number (LF, CR and CR LF are line breaks). */
  readonly line: number;
  /** 1-based column, counted in Unicode code points. */
  readonly column: number;
  /** 0-based offset in the text, in UTF-16 code units. */
  readonly offset: number;
}

/** Reviver as in `JSON.parse`. */
export type Reviver = (this: any, key: string, value: any) => any;

/** Replacer function as in `JSON.stringify`. */
export type Replacer = (this: any, key: string, value: any) => any;

/**
 * Parses an XTJSON document and returns its value. Numbers become `number`;
 * a number with the suffix `n` and without a fraction part becomes a
 * `bigint` if its value is an integer (`10n`, `0xFFn`, `1e3n`).
 *
 * @param text the document
 * @param reviver transforms the result, as in `JSON.parse`; `null` or
 *   `undefined` for none
 * @param options named values, the I-JSON mode and the maximum nesting depth
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
export function parse(text: string, reviver?: Reviver | null, options?: Options | OptionsInit | null): any;
/** Parses an XTJSON document with options. */
export function parse(text: string, options: Options | OptionsInit): any;

/**
 * Writes a value as an XTJSON document, like `JSON.stringify`.
 *
 * Output: an object at the top level without braces; names without
 * quotation marks where possible; with `space`, one item per line without
 * commas and strings with line breaks as multi-line strings; numbers of
 * 10000 or more grouped with `_`; number suffixes only with
 * `writeNumberSuffixes`; `bigint` values with the suffix `n`; strings in `"`, or in `'` with
 * `writeSingleQuotes`; strings, numbers, booleans and `null` as named values
 * where defined.
 *
 * @param value the value
 * @param replacer a function or an array of names, as in `JSON.stringify`
 * @param space indentation: a number of spaces (at most 10) or a string of
 *   at most 10 spaces and tabs
 * @param options named values, the I-JSON mode, the maximum nesting depth,
 *   number suffixes and quotation marks
 * @returns the document, or `undefined` for `undefined`, functions and symbols
 * @throws {TypeError} for circular references, nesting deeper than
 *   `maxDepth`, invalid arguments or options, and strings not permitted in
 *   I-JSON mode
 */
export function stringify(
  value: any,
  replacer?: Replacer | (string | number)[] | null,
  space?: string | number | null,
  options?: Options | OptionsInit | null,
): string;
/** Writes a value with a replacer and options, without indentation. */
export function stringify(value: any, replacer: Replacer | (string | number)[] | null, options: Options | OptionsInit): string;
/** Writes a value with indentation and optional options. */
export function stringify(value: any, space: string | number, options?: Options | OptionsInit | null): string;
/** Writes a value with options, without indentation. */
export function stringify(value: any, options: Options | OptionsInit): string;

/**
 * Parser with fixed options. The options are validated once; the instance
 * can be reused for many documents. Its state is private.
 *
 * @example
 * const parser = new Parser({ namedValues: { nil: null } });
 * const value = parser.parse('owner: nil');
 */
export class Parser {
  /** @throws {TypeError} if the options are invalid */
  constructor(options?: Options | OptionsInit | null);
  /**
   * Parses an XTJSON document, see `parse`.
   * @throws {ParserError} if the text is not a valid XTJSON document
   * @throws {TypeError} if the reviver is not a function
   */
  parse(text: string, reviver?: Reviver | null): any;
}

/**
 * Generator with fixed options. The options are validated once; the
 * instance can be reused for many values. Its state is private.
 *
 * @example
 * const generator = new Generator({ writeNumberSuffixes: true });
 * const text = generator.stringify({ cache: 67108864 }, null, 2);
 */
export class Generator {
  /** @throws {TypeError} if the options are invalid */
  constructor(options?: Options | OptionsInit | null);
  /**
   * Writes a value as an XTJSON document, see `stringify`.
   * @returns the document, or `undefined` for `undefined`, functions and symbols
   * @throws {TypeError} for circular references, nesting deeper than
   *   `maxDepth`, invalid arguments and strings not permitted in I-JSON mode
   */
  stringify(
    value: any,
    replacer?: Replacer | (string | number)[] | null,
    space?: string | number | null,
  ): string;
}
