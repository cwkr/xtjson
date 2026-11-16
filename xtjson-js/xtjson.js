/**
 * XTJSON parser and generator for JavaScript.
 *
 * Implements the XTJSON specification, draft 0.5 (docs/xtjson-spec-en.md).
 *
 *     import { parse, stringify } from '@cwkr/xtjson';
 *     const value = parse(text, reviver, options);
 *     const text = stringify(value, replacer, space, options);
 *
 *     import { Parser, Generator, Options } from '@cwkr/xtjson';
 *     const options = new Options({ namedValues: { nil: null } });
 *     const value = new Parser(options).parse(text);
 *     const text = new Generator(options).stringify(value, null, 2);
 *
 *     import { format } from '@cwkr/xtjson';
 *     const formatted = format(text, 2);
 *
 * The parser is in parser.js, the generator in generator.js, the formatter in
 * formatter.js and the code that they share, including `Options`, in
 * shared.js. No module has side effects when it is imported.
 */

export { parse, Parser, ParserError } from './parser.js';
export { stringify, Generator } from './generator.js';
export { format } from './formatter.js';
export { Options } from './shared.js';
