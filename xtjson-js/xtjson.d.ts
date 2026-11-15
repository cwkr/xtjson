/**
 * XTJSON parser and generator for JavaScript, modelled on the global `JSON`
 * object.
 *
 * @example
 * import XTJSON from '@cwkr/xtjson';
 * const config = XTJSON.parse('name: "demo"\nport: 8080');
 * const text = XTJSON.stringify(config, 2);
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
 * Conversion function of a number suffix (section 9.5). Receives the value
 * of the number including its sign and returns a finite number. An exception
 * thrown by it is reported as an error of the document.
 */
export type SuffixFunction = (value: number) => number;

/**
 * Definitions given as a plain object, a `Map` or an iterable of
 * `[key, value]` pairs. The order of the entries is kept.
 */
export type DefinitionEntries<T> =
  | Readonly<Record<string, T>>
  | ReadonlyMap<string, T>
  | Iterable<readonly [string, T]>;

/** Options for `parse` and `stringify`. */
export interface XTJSONOptionsInit {
  /**
   * Named values (6.4): identifier → JSON value, in a fixed order.
   * `true`, `false` and `null` are predefined and cannot be redefined.
   * `stringify` writes a string, number, boolean or `null` as a named value
   * if one has exactly this value; if several have it, the one defined last
   * wins, and the predefined ones are used only if no custom one matches.
   */
  values?: DefinitionEntries<JSONValue>;
  /**
   * Number suffixes (9.5): suffix → conversion function. The suffixes
   * `k`, `K`, `kb`, `Kb`, `kB`, `KB`, `mb`, `Mb`, `mB`, `MB` are predefined
   * and cannot be redefined. Only `parse` uses custom suffixes.
   */
  suffixes?: DefinitionEntries<SuffixFunction>;
  /**
   * I-JSON mode (section 12). `parse` rejects a document in which an object
   * contains a name twice, or in which a name or string value (also from a
   * named value) contains an unpaired surrogate or a Unicode noncharacter.
   * `stringify` throws a `TypeError` for such names and strings.
   * Default: false; then the member that comes last applies.
   */
  ijson?: boolean;
}

/**
 * Validated, immutable options. Create them once and pass them to every
 * call; plain `XTJSONOptionsInit` objects are validated again on each call.
 */
export class XTJSONOptions implements XTJSONOptionsInit {
  /** @throws {TypeError} if a definition violates section 6.4 or 9.5. */
  constructor(init?: XTJSONOptionsInit | null);
  /** The named values in their defined order (a new Map; values are frozen). */
  get values(): Map<string, JSONValue>;
  /** The custom number suffixes (a new Map). */
  get suffixes(): Map<string, SuffixFunction>;
  /** True for the I-JSON mode. */
  get ijson(): boolean;
  get [Symbol.toStringTag](): 'XTJSONOptions';
}

/** Error in an XTJSON document. */
export class XTJSONError extends SyntaxError {
  name: 'XTJSONError';
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

/** Options as an instance or as a plain object. */
export type Options = XTJSONOptions | XTJSONOptionsInit;

/**
 * Parses an XTJSON document and returns its value.
 *
 * @param text the document
 * @param reviver transforms the result, as in `JSON.parse`; `null` or
 *   `undefined` for none
 * @param options named values, number suffixes and the I-JSON mode
 * @throws {XTJSONError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the options are invalid
 */
export function parse(text: string, reviver?: Reviver | null, options?: Options | null): any;
/** Parses an XTJSON document with options. */
export function parse(text: string, options: Options): any;

/**
 * Writes a value as an XTJSON document, like `JSON.stringify`.
 *
 * Output: an object at the top level without braces; names without
 * quotation marks where possible; with `space`, one item per line without
 * commas and strings with line breaks as multi-line strings; numbers grouped
 * with `_` and with the suffix `mb`, `kb` or `k` where they are multiples;
 * strings, numbers, booleans and `null` as named values where defined.
 *
 * @param value the value
 * @param replacer a function or an array of names, as in `JSON.stringify`
 * @param space indentation: a number of spaces (at most 10) or a string of
 *   at most 10 spaces and tabs
 * @param options named values and the I-JSON mode
 * @returns the document, or `undefined` for `undefined`, functions and symbols
 * @throws {TypeError} for circular references, BigInt values, invalid
 *   arguments or options, and strings not permitted in I-JSON mode
 */
export function stringify(
  value: any,
  replacer?: Replacer | (string | number)[] | null,
  space?: string | number | null,
  options?: Options | null,
): string;
/** Writes a value with a replacer and options, without indentation. */
export function stringify(value: any, replacer: Replacer | (string | number)[] | null, options: Options): string;
/** Writes a value with indentation and optional options. */
export function stringify(value: any, space: string | number, options?: Options | null): string;
/** Writes a value with options, without indentation. */
export function stringify(value: any, options: Options): string;

export interface XTJSON {
  parse: typeof parse;
  stringify: typeof stringify;
  readonly [Symbol.toStringTag]: 'XTJSON';
}

declare const XTJSON: XTJSON;
export default XTJSON;
