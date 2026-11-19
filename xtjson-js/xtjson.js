/**
 * XTJSON parser for JavaScript.
 *
 * Implements the XTJSON specification, draft 0.8 (docs/xtjson-spec-en.md).
 *
 *     import { parse } from '@cwkr/xtjson';
 *     const value = parse(text, { strict: true });
 *
 *     import { parseAsync } from '@cwkr/xtjson';
 *     const value = await parseAsync(text, { resolver: async (reference, strict) => ... });
 *
 *     import { Parser } from '@cwkr/xtjson';
 *     const parser = new Parser({ strict: true });   // options validated once
 *     const value = parser.parse(text);
 *
 *     import { format } from '@cwkr/xtjson';
 *     const formatted = format(text, 2);
 *
 * The parser is in parser.js, the formatter in formatter.js.
 * No module has side effects when it is imported.
 */

export { parse, parseAsync, Parser, ParserError } from './parser.js';
export { format } from './formatter.js';
