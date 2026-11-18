/**
 * XTJSON parser for JavaScript.
 *
 * Implements the XTJSON specification, draft 0.7 (docs/xtjson-spec-en.md).
 *
 *     import { parse } from '@cwkr/xtjson';
 *     const value = parse(text, options);
 *
 *     import { Parser, Options } from '@cwkr/xtjson';
 *     const options = new Options({ strict: true });
 *     const value = new Parser(options).parse(text);
 *
 *     import { format } from '@cwkr/xtjson';
 *     const formatted = format(text, 2);
 *
 * The parser and `Options` are in parser.js, the formatter in formatter.js.
 * No module has side effects when it is imported.
 */

export { parse, Parser, ParserError, Options } from './parser.js';
export { format } from './formatter.js';
