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

/**
 * Options for `parse` and `stringify`.
 *
 * There are no options for named values, directives or number suffixes:
 * named values are defined in the document with `%define` (6.6), directives
 * and suffixes are fixed by the specification (6.5, 9.5). Unknown properties
 * are a `TypeError`.
 */
export interface OptionsInit {
  /**
   * I-JSON mode (section 12). `parse` rejects a document in which an object
   * contains a name twice, or in which a name or string value contains an
   * unpaired surrogate or a Unicode noncharacter; this also applies to the
   * values of `%define` and `%version`, even if they are not used.
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
   * Maximum number of JSON values that replacing named values may produce
   * in one document, a positive integer; every object, array and other
   * value counts as one. Definitions that use one another can multiply the
   * size of the value (section 13). `parse` reports a document that
   * exceeds the limit as a `ParserError`. Default: 1000000.
   */
  maxExpansion?: number;
  /**
   * `stringify` writes number suffixes: integers that are a multiple of the
   * factor with `mb`, `kb`, `k`, `h` or `min`, fractions between -1 and 1
   * that are whole hundredths or thousandths with `pct` or `ms`, the first
   * in this order that applies. Default: false. BigInt values always get
   * the suffix `n`.
   */
  writeNumberSuffixes?: boolean;
  /**
   * `stringify` writes strings and quoted names in `'` instead of `"`.
   * Default: false.
   */
  writeSingleQuotes?: boolean;
}

/**
 * Validated, immutable options. Create them once and pass them to every
 * call; plain `OptionsInit` objects are validated again on each call.
 */
export class Options implements OptionsInit {
  /** @throws {TypeError} if an option is unknown or invalid. */
  constructor(init?: OptionsInit | null);
  /** The maximum nesting depth of objects and arrays. */
  get maxDepth(): number;
  /** The maximum number of JSON values that replacing named values may produce. */
  get maxExpansion(): number;
  /** True for the I-JSON mode. */
  get ijson(): boolean;
  /** True if `stringify` writes number suffixes. */
  get writeNumberSuffixes(): boolean;
  /** True if `stringify` writes strings in `'`. */
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

/** The value of a document together with its version statements. */
export interface ParsedDocument {
  /** The value of the document, as returned by `parse`. */
  value: any;
  /**
   * The version statements of the `%version` directives (6.7), identifier
   * → value, in the order of the document. The version of the specification
   * is stored under `xtjson`. The versions are not checked.
   */
  versions: Map<string, string | number>;
}

/**
 * Parses an XTJSON document and returns its value. Numbers become `number`;
 * a number with the suffix `n` and without a fraction part becomes a
 * `bigint` if its value is an integer (`10n`, `0xFFn`, `1e3n`).
 *
 * @param text the document
 * @param reviver transforms the result, as in `JSON.parse`; `null` or
 *   `undefined` for none
 * @param options the I-JSON mode and the limits
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
export function parse(text: string, reviver?: Reviver | null, options?: Options | OptionsInit | null): any;
/** Parses an XTJSON document with options. */
export function parse(text: string, options: Options | OptionsInit): any;

/**
 * Parses an XTJSON document and returns its value together with the version
 * statements of its `%version` directives. The arguments are the same as for
 * `parse`.
 *
 * @example
 * parseDocument('%version: "0.6"\nport: 8080');
 * // { value: { port: 8080 }, versions: Map { 'xtjson' => '0.6' } }
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
export function parseDocument(text: string, reviver?: Reviver | null, options?: Options | OptionsInit | null): ParsedDocument;
/** Parses an XTJSON document with options and returns its value and versions. */
export function parseDocument(text: string, options: Options | OptionsInit): ParsedDocument;

/**
 * Writes a value as an XTJSON document, like `JSON.stringify`.
 *
 * Output: an object at the top level without braces; names without
 * quotation marks where possible; with `space`, one item per line without
 * commas and strings with line breaks across several lines; numbers of
 * 10000 or more grouped with `_`; number suffixes only with
 * `writeNumberSuffixes`; `bigint` values with the suffix `n`; strings in `"`, or in `'` with
 * `writeSingleQuotes`. Named values and directives are not written.
 *
 * @param value the value
 * @param replacer a function or an array of names, as in `JSON.stringify`
 * @param space indentation: a number of spaces (at most 10) or a string of
 *   at most 10 spaces and tabs
 * @param options the I-JSON mode, the maximum nesting depth, number
 *   suffixes and quotation marks
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
 * Formats an XTJSON document with the indentation `space`, as `stringify`
 * would lay it out, keeping comments and the notation of names and values.
 * The text is not parsed or validated; formatting is best effort, and a
 * valid document keeps its value. Without indentation, a line break that
 * separates two items becomes a comma.
 *
 * @param text the document
 * @param space indentation as in `stringify`: a number of spaces (at most
 *   10) or a string of spaces and tabs
 * @returns the formatted text, without a line break at the end
 * @throws {TypeError} if `space` is invalid
 */
export function format(text: string, space?: string | number | null): string;

/**
 * Parser with fixed options. The options are validated once; the instance
 * can be reused for many documents. Its state is private.
 *
 * @example
 * const parser = new Parser({ ijson: true });
 * const value = parser.parse('%define: nil = null\nowner: nil');
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
  /**
   * Parses an XTJSON document and returns its value and version statements,
   * see `parseDocument`.
   * @throws {ParserError} if the text is not a valid XTJSON document
   * @throws {TypeError} if the reviver is not a function
   */
  parseDocument(text: string, reviver?: Reviver | null): ParsedDocument;
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
