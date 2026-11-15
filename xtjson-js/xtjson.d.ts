/**
 * XTJSON parser for JavaScript, modelled on the global `JSON` object.
 *
 * @example
 * import XTJSON from '@cwkr/xtjson';
 * const config = XTJSON.parse('name: "demo"\nport: 8080');
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

/** Custom definitions for named values (6.4) and number suffixes (9.5). */
export interface XTJSONDefinitionsInit {
  /**
   * Named values: identifier → JSON value, in a fixed order.
   * `true`, `false` and `null` are predefined and cannot be redefined.
   */
  values?: DefinitionEntries<JSONValue>;
  /**
   * Number suffixes: suffix → conversion function. The suffixes
   * `k`, `K`, `kb`, `Kb`, `kB`, `KB`, `mb`, `Mb`, `mB`, `MB` are predefined
   * and cannot be redefined.
   */
  suffixes?: DefinitionEntries<SuffixFunction>;
  /**
   * I-JSON mode (section 12). If true, a document is an error if an object
   * contains a name twice, or if a name or string value (also from a named
   * value) contains an unpaired surrogate or a Unicode noncharacter.
   * Default: false; then the member that comes last applies.
   */
  ijson?: boolean;
}

/**
 * A validated, immutable set of custom definitions. Create it once and pass
 * it to every call; plain `XTJSONDefinitionsInit` objects are validated
 * again on each call.
 */
export class XTJSONDefinitions implements XTJSONDefinitionsInit {
  /** @throws {TypeError} if a definition violates section 6.4 or 9.5. */
  constructor(init?: XTJSONDefinitionsInit | null);
  /** The named values in their defined order (a new Map; values are frozen). */
  get values(): Map<string, JSONValue>;
  /** The custom number suffixes (a new Map). */
  get suffixes(): Map<string, SuffixFunction>;
  /** True for the I-JSON mode. */
  get ijson(): boolean;
  get [Symbol.toStringTag](): 'XTJSONDefinitions';
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

/**
 * Parses an XTJSON document and returns its value.
 *
 * @param text the document
 * @param reviver transforms the result, as in `JSON.parse`; `null` or
 *   `undefined` for none
 * @param definitions custom named values and number suffixes
 * @throws {XTJSONError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the arguments or the definitions are invalid
 */
export function parse(
  text: string,
  reviver?: Reviver | null,
  definitions?: XTJSONDefinitions | XTJSONDefinitionsInit | null,
): any;
/**
 * Parses an XTJSON document with custom named values and number suffixes.
 *
 * @param text the document
 * @param definitions custom named values and number suffixes
 * @throws {XTJSONError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the definitions are invalid
 */
export function parse(
  text: string,
  definitions: XTJSONDefinitions | XTJSONDefinitionsInit,
): any;

export interface XTJSON {
  parse: typeof parse;
  readonly [Symbol.toStringTag]: 'XTJSON';
}

declare const XTJSON: XTJSON;
export default XTJSON;
