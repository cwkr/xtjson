/**
 * XTJSON parser for JavaScript. `parse` works like `JSON.parse`; `Parser`
 * keeps validated options for many calls. `format` lays out a document
 * again.
 *
 * @example
 * import { parse, format } from '@cwkr/xtjson';
 * const config = parse('name: "demo"\nport: 8080');
 * const text = format('{name: "demo", port: 8080}', 2);
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
 * Options for `parse`.
 *
 * There are no options for values, directives or number suffixes: the
 * values without quotation marks, the directives and the suffixes are fixed
 * by the specification (6.3 to 6.6, 9.5). Unknown properties are a
 * `TypeError`.
 */
export interface OptionsInit {
  /**
   * Maximum nesting depth of objects and arrays, a positive integer; an
   * implicit root object counts as a level. `parse` reports a deeper
   * document as a `ParserError`. Default: 1000. A very large value can
   * exceed the call stack of the engine; `parse` then also throws a
   * `ParserError`.
   */
  maxDepth?: number;
  /**
   * Resolver for the directive `%extends` (section 6.6): receives the string
   * after `%extends` and returns the base value, a JSON value (an object, an
   * array, a string, a finite number, a bigint, `true`, `false` or `null`).
   * The document is merged into a copy of it according to JSON Merge Patch
   * (RFC 7396). An exception of the resolver or another value is a
   * `ParserError`. Default: none; then a document with `%extends` is an
   * error. The resolver decides which sources a document may name.
   */
  resolver?: ((reference: string) => any) | null;
  /**
   * Strict mode (section 12). `parse` rejects a document in which an object
   * contains a name twice, in which a name or string value contains an
   * unpaired surrogate or a Unicode noncharacter, or whose root value is not
   * an object or an array. A document with `%strict: false` is an error.
   * Default: false; then a document can still request strict mode with
   * `%strict: true`, and the member that comes last applies.
   */
  strict?: boolean;
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
  /** The resolver for `%extends`, or undefined if `%extends` is disabled. */
  get resolver(): ((reference: string) => any) | undefined;
  /** True for strict mode. */
  get strict(): boolean;
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

/**
 * Parses an XTJSON document and returns its value. Numbers become `number`;
 * an integer with the suffix `n` becomes a `bigint` (`10n`, `0xFFn`).
 *
 * @param text the document
 * @param options strict mode and the limits
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the options are invalid
 */
export function parse(text: string, options?: Options | OptionsInit | null): any;

/**
 * Formats an XTJSON document with the indentation `space`, as
 * `JSON.stringify` would lay it out, keeping comments and the notation of
 * names and values. The text is not parsed or validated; formatting is best
 * effort, and a valid document keeps its value. Without indentation, a line
 * break that separates two items becomes a comma.
 *
 * @param text the document
 * @param space indentation as in `JSON.stringify`: a number of spaces (at
 *   most 10) or a string of spaces and tabs
 * @returns the formatted text, without a line break at the end
 * @throws {TypeError} if `space` is invalid
 */
export function format(text: string, space?: string | number | null): string;

/**
 * Parser with fixed options. The options are validated once; the instance
 * can be reused for many documents. Its state is private.
 *
 * @example
 * const parser = new Parser({ strict: true });
 * const value = parser.parse('owner: nil');
 */
export class Parser {
  /** @throws {TypeError} if the options are invalid */
  constructor(options?: Options | OptionsInit | null);
  /**
   * Parses an XTJSON document, see `parse`.
   * @throws {ParserError} if the text is not a valid XTJSON document
   */
  parse(text: string): any;
}
