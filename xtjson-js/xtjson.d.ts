/**
 * XTJSON parser for JavaScript. `parse` works like `JSON.parse`;
 * `parseAsync` also accepts an asynchronous resolver for `%extends`;
 * `Parser` keeps validated options for many calls. `format` lays out a
 * document again.
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
 * Resolver for the directive `%extends` (section 6.6).
 *
 * @param reference the value of the string after `%extends`
 * @param strict true if the document is read in strict mode (section 12):
 *   requested by the application with the option `strict` or by the
 *   document with `%strict: true`. A resolver that parses an XTJSON base
 *   value can pass it on as the option `strict`.
 * @returns the base value, a JSON value (an object, an array, a string, a
 *   finite number, a bigint, `true`, `false` or `null`); with `parseAsync`
 *   also a promise of it
 */
export type Resolver = (reference: string, strict: boolean) => unknown;

/**
 * Options for `parse`, `parseAsync` and `new Parser`, a plain object.
 *
 * There are no options for values, directives or number suffixes: the
 * values without quotation marks, the directives and the suffixes are fixed
 * by the specification (6.3 to 6.6, 9.5). Unknown properties are a
 * `TypeError`.
 */
export interface ParseOptions {
  /**
   * Maximum nesting depth of objects and arrays, a positive integer; an
   * implicit root object counts as a level. `parse` reports a deeper
   * document as a `ParserError`. Default: 1000. A very large value can
   * exceed the call stack of the engine; `parse` then also throws a
   * `ParserError`.
   */
  maxDepth?: number;
  /**
   * Resolver for the directive `%extends` (section 6.6), see `Resolver`. It
   * is called once for every `%extends`, in document order, after the
   * content has been read. The base values are merged in this order and the
   * document is merged into the result, according to JSON Merge Patch
   * (RFC 7396); the values of the resolver are copied, not changed. An
   * exception of the resolver, a rejected promise or a value that is not a
   * JSON value is a `ParserError`. With `parse` the resolver must return the
   * base value itself; a promise is a `ParserError`, use `parseAsync`.
   * Default: none; then a document with `%extends` is an error. The
   * resolver decides which sources a document may name.
   */
  resolver?: Resolver | null;
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
 * @param options strict mode, the limits and the resolver
 * @throws {ParserError} if the text is not a valid XTJSON document
 * @throws {TypeError} if the options are invalid
 */
export function parse(text: string, options?: ParseOptions | null): any;

/**
 * Parses an XTJSON document and returns a promise of its value, like
 * `parse`. The resolver for `%extends` may return a promise (an `async`
 * function). It is called for every `%extends` in document order before
 * any result is awaited, so sources can be loaded in parallel; the base
 * values are merged in document order. If several calls fail, the error of
 * the first `%extends` in the document is reported.
 *
 * @param text the document
 * @param options strict mode, the limits and the resolver
 * @returns the value; rejected with a `ParserError` if the text is not a
 *   valid XTJSON document and with a `TypeError` if the options are invalid
 */
export function parseAsync(text: string, options?: ParseOptions | null): Promise<any>;

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
 * const value = parser.parse('owner: null');
 */
export class Parser {
  /** @throws {TypeError} if the options are invalid */
  constructor(options?: ParseOptions | null);
  /**
   * Parses an XTJSON document, see `parse`.
   * @throws {ParserError} if the text is not a valid XTJSON document
   */
  parse(text: string): any;
  /**
   * Parses an XTJSON document, see `parseAsync`. The parser can be used
   * again while it waits for the resolver.
   */
  parseAsync(text: string): Promise<any>;
}
