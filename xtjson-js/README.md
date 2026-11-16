# @cwkr/xtjson

XTJSON parser and generator for JavaScript. XTJSON is a syntactic superset of
JSON for files that are written and maintained by people, such as
configuration files. See the specification in
[`docs/xtjson-spec-en.md`](../docs/xtjson-spec-en.md) (draft 0.4).

- ES modules in plain JavaScript, with TypeScript declarations. Importing
  them has no side effects.
- No dependencies. Runs in current browsers, Node.js (18 or later), Bun and Deno.
- `parse()` and `stringify()` work like the functions of the global `JSON`
  object; `Parser` and `Generator` keep validated options for many calls.

```js
import { parse, stringify } from '@cwkr/xtjson';

const config = parse(`
# Service configuration
name: 'demo-service'
port: 8080            // a line break replaces the comma
cache: 64mb
motd: """
  Welcome.
  """
`);
// { name: 'demo-service', port: 8080, cache: 67108864, motd: 'Welcome.\n' }

stringify(config, 2);
// name: "demo-service"
// port: 8080
// cache: 64mb
// motd: """
//   Welcome.
//   """
```

## API

### `parse(text, reviver?, options?)`

Parses an XTJSON document and returns its value.

- `text`: the document. Like `JSON.parse`, the argument is converted to a
  string. It must be decoded text; when reading bytes, decode them as UTF-8
  first (for example with `new TextDecoder('utf-8', { fatal: true })`).
- `reviver`: optional, works exactly as in `JSON.parse`.
- `options`: optional named values, I-JSON mode and nesting limit, see
  [Options](#options).

```js
parse(text, options);              // options only
parse(text, reviver, options);     // both
parse(text, null, options);        // also options only
```

Every JSON text gives the same value as with `JSON.parse`, with two
exceptions allowed by the specification (section 11): numbers whose magnitude
exceeds the range of a JavaScript number (`1e400`) are an error instead of
`Infinity`, and objects and arrays may be nested at most 1000 levels deep
(see `maxDepth`).

If a name occurs more than once in an object, the member that comes last in
the document applies, as with `JSON.parse`. In I-JSON mode it is an error
instead.

### `stringify(value, replacer?, space?, options?)`

Writes a value as an XTJSON document. `value`, `replacer` (a function or an
array of names) and `space` work as in `JSON.stringify`: `toJSON` methods are
called, `undefined`, functions and symbols are left out of objects and become
`null` in arrays, `NaN` and `Infinity` become `null`, and a value that cannot
be written at all gives `undefined`. Circular references and nesting deeper
than `maxDepth` throw a `TypeError`. Unlike `JSON.stringify`, BigInt values
can be written: they get the suffix `n` and read back as BigInt.

```js
stringify(value, options);                    // options only
stringify(value, 2, options);                 // space and options
stringify(value, replacer, 2, options);       // all
stringify(value, null, 2);                    // as with JSON.stringify
```

The output differs from `JSON.stringify` in these points:

- **Top level.** An object at the top level is written without braces
  (section 6.2). An empty object stays `{}`, because the implicit root object
  needs at least one member.
- **Names** that are identifiers (ASCII letters, digits, `_`, `$`, not
  beginning with a digit) are written without quotation marks, all others in
  `"` (or `'`, see `writeSingleQuotes`).
- **Strings** are written in `"`. Besides the escapes of `JSON.stringify`,
  U+2028 and U+2029 are escaped. With the option `writeSingleQuotes` they are
  written in `'` and multi-line strings in `'''`; then `'` is escaped and
  `"` is not.
- **With `space`**, every item is on its own line and the line break is the
  separator: there are no commas at the ends of lines. Strings that contain a
  line break (LF) are written as multi-line strings with `"""`, with the text
  indented one level deeper than the line on which the string begins. White
  space that the rules of section 8.3 would remove, a carriage return and
  quotation marks that would end the string are escaped, so the string always
  reads back unchanged. `space` may only contain spaces and tabs; other
  characters would not be valid indentation, so they are a `TypeError`.
- **Numbers** are written in decimal. An integer part of 10000 or more gets
  `_` between groups of three digits (`12_345`, `1_234_567.25`); smaller
  numbers are written without it (`8080`). Every number reads back as
  exactly the same number. A BigInt is written as an integer with the suffix
  `n` (`12_345n`). With the option `writeNumberSuffixes` (off by default), the
  suffixes of section 9.5 that change the value are used where they fit, the
  first one in this order:

  | Numbers | Suffixes, in order | Examples |
  |---|---|---|
  | integers that are a multiple of the factor | `mb`, `kb`, `k`, `h`, `min` | `67108864` is `64mb`, `2048` is `2kb`, `5120000` is `5000kb`, `1000` is `1k`, `7200` is `2h`, `300` is `5min` |
  | fractions between -1 and 1 that are whole hundredths or thousandths | `pct`, `ms` | `0.5` is `50pct`, `0.07` is `7pct`, `0.125` is `125ms` |

  The binary sizes come first because they are the most specific factors,
  then `k`, and the time units last. A multiplying suffix is used only if the
  remaining factor is at most 2⁵³ − 1. The suffixes are chosen from the value
  alone, without knowing what it means: `1920` is written as `32min` and
  `0.25` as `25pct`; enable the option only where that fits the data. `s`,
  `px` and `L` do not change the value and are never written; `n` only for
  BigInt values.
- **Named values.** A string, number, `true`, `false` or `null` is written as
  a named value if one has exactly this value. If several match, the one
  defined last wins; the predefined `true`, `false` and `null` are used only
  if no custom named value matches. With `namedValues: { nil: null }`, `null` is
  always written as `nil`. Names are never replaced.

A document that uses custom named values can only be read with the same
options. The specification (section 11) recommends this only if the
recipient is certain to use the same definitions.

### Options

Without options, only the predefined named values `true`, `false` and `null`
are active. An application can define further named values:

```js
import { parse, stringify, Options } from '@cwkr/xtjson';

const options = new Options({
  namedValues: { nil: null, unknown: 'not specified' },
});

parse('ratio: 50pct\nowner: unknown\nboss: nil', options);
// { ratio: 0.5, owner: 'not specified', boss: null }

stringify({ owner: 'not specified', boss: null }, options);
// 'owner:unknown,boss:nil'
```

- `namedValues` maps identifiers to a string, a number, `true`, `false` or
  `null` (section 6.4); objects and arrays are not permitted. The order of
  the named values is fixed: it is the order in which they are given. They
  can be given as a plain object, a `Map` or an iterable of `[key, value]`
  pairs.
- `ijson`: `true` for the I-JSON mode, see below. Default `false`.
- `maxDepth`: the maximum nesting depth of objects and arrays, a positive
  integer. Default `1000`. An implicit root object counts as a level, so
  `a: [1]` has depth 2. `parse` reports a deeper document as an
  `ParserError`, `stringify` a deeper value as a `TypeError`. A very large
  limit can exceed the call stack of the JavaScript engine (with Node.js at
  a depth of a few thousand); `parse` then reports a `ParserError` too.
- `writeNumberSuffixes`: `true` lets `stringify` write number suffixes, see
  above. Default `false`. `parse` ignores it.
- `writeSingleQuotes`: `true` lets `stringify` write strings and quoted names in
  `'` and multi-line strings in `'''`. Default `false`. `parse` ignores it.

Other properties are a `TypeError`, so that a misspelt option is not
silently ignored.

The application cannot define number suffixes. The suffixes are fixed by
section 9.5 and always active when parsing: `k`, `K` (times 1000), `kb`,
`Kb`, `kB`, `KB` (times 1024), `mb`, `Mb`, `mB`, `MB` (times 1048576), `ms`
(divided by 1000), `s`, `min` (times 60), `h` (times 3600), `pct` (divided
by 100), `px`, `L` and `n`. `s`, `px`, `L` and `n` leave the value
unchanged; `n` in addition yields a BigInt, see [Numbers](#numbers).

`Options` validates the options once. Create it once and reuse it for
`parse` and `stringify`, or create a [`Parser` or `Generator`](#parser-and-generator)
with it. A plain object with the same properties can be passed as well, but
`parse` and `stringify` validate it again on every call.

### `format(text, space?)`

Formats an XTJSON document and returns the text. `space` works as in
`stringify`. The layout follows `stringify`: one member or array item per
line, indented by `space` per level, a space after each `:`, and empty
objects and arrays as `{}` and `[]`. Unlike `stringify`, `format` keeps
comments, the notation of names, strings and numbers (quotation marks,
suffixes, hexadecimal numbers, ...) and the commas of the text; a line break
that separates two items stays a line break. At most one blank line between
items is kept. Multi-line strings that begin with an empty line are indented
anew, which does not change their value; other multi-line strings are left
as they are.

```js
format('{"a":[1,2], /* note */ b:64mb}', 2);
// {
//   "a": [
//     1,
//     2
//   ], /* note */
//   b: 64mb
// }
```

Without indentation (`space` omitted, `0` or `''`), white space and line
breaks are removed where possible: a line break that separates two items
becomes a comma, and a line comment still ends its line.

`format` does not parse or validate the text. It works on a best-effort
basis: a valid document keeps its value, and an invalid document is
formatted as far as possible instead of throwing an error. Line breaks are
written as LF, and the result has no line break at the end. Only an invalid
`space` throws a `TypeError`.

### Telling the arguments apart

The optional arguments after `text` or `value` are told apart by their type,
and they must appear in the order of the signature; `null` and `undefined`
are skipped.

| Type | `parse` | `stringify` |
|---|---|---|
| function | reviver | replacer |
| array | – | replacer |
| number, string | – | space |
| other object | options | options |

Anything else, an argument given twice and arguments in the wrong order
throw a `TypeError`.

### I-JSON mode

```js
parse(text, { ijson: true });
stringify(value, 2, { ijson: true });
```

With `ijson: true` the parser rejects documents that violate one of the two
prohibitions of section 12 (I-JSON, RFC 7493):

- an object that contains a name more than once, independent of its notation
  (`a`, `"a"` and `'\u0061'` are the same name);
- a name or string value that contains an unpaired surrogate (for example
  `"\uDEAD"`) or a Unicode noncharacter (U+FDD0 to U+FDEF and every code point
  ending in FFFE or FFFF), written directly or as an escape sequence. This
  also applies to the values of named values that the document uses.

`stringify` throws a `TypeError` for names and strings that contain such
characters. The recommendations of section 12 (numbers within the range of
IEEE 754 binary64, an object or array as the root value) are not enforced.
The mode is off by default, because without it every JSON text is accepted,
including texts with duplicate names.

### Errors

- An invalid document throws a `ParserError`, a subclass of `SyntaxError`.
  Its message names the violated rule and the position, for example
  `Undefined named value 'ture'; text without quotation marks is not a string, write "ture" for a string (line 3, column 9)`.
  The properties `reason`, `line`, `column` (both 1-based; columns count
  Unicode code points) and `offset` (0-based, in UTF-16 code units) give the
  details.
- Errors of the application throw a `TypeError`: invalid options (for
  example an attempt to redefine `true`, an invalid identifier, an object or
  array as a named value, an unknown option), invalid arguments, and
  values that `stringify` cannot write.

### Parser and generator

```js
import { Parser, Generator, Options } from '@cwkr/xtjson';

const options = new Options({ namedValues: { nil: null } });
const parser = new Parser(options);
const generator = new Generator(options);

parser.parse('owner: nil');                       // { owner: null }
parser.parse(text, reviver);
generator.stringify({ owner: null });             // 'owner:nil'
generator.stringify(value, replacer, 2);
```

- `new Parser(options?)` and `new Generator(options?)` take an `Options`
  instance or a plain object with the same properties and validate it once.
  An instance can be reused for any number of calls.
- `parser.parse(text, reviver?)` and
  `generator.stringify(value, replacer?, space?)` work like `parse` and
  `stringify` with these options. The arguments are positional: a reviver
  must be a function, a replacer a function or an array, `space` a number or
  a string; `null` and `undefined` mean none. Anything else is a `TypeError`.
- The configuration and the state of a call are private. A call that starts
  while the same instance is still busy, for example from a `toJSON` method
  or a replacer, is carried out by a separate instance with the same options.

`parse` and `stringify` use such an instance internally.

### Exports

The package has only named exports: `parse`, `stringify`, `format`,
`Parser`, `Generator`, `Options` and `ParserError`. There is no default export.

## Numbers

- Decimal numbers become JavaScript numbers, as with `JSON.parse`.
- Hexadecimal, octal and binary numbers are exact or an error: a value that a
  JavaScript number cannot represent exactly (for example `0x20000000000001`)
  is rejected, never rounded (section 9.4).
- Suffixes give the exact product or quotient, rounded once: `0.1kb` is
  `102.4`, `100ms` is `0.1`, `12.5pct` is `0.125`. A suffix that is not in
  the table of section 9.5 is an error; suffixes are case-sensitive (`10MS`
  and `10l` are errors).
- A number with the suffix `n` and without a fraction part becomes a BigInt
  if its value is an integer: `10n`, `0xFFn`, `9007199254740993n` and `1e3n`
  (`1000n`) are exact at any size. `1.5n`, `1.0n` and `12e-1n` stay
  numbers, as the specification gives the suffix `n` no effect on the value.
  The exponent of such a number may be at most 10000, so that a short text
  cannot demand a huge BigInt. A reviver receives the BigInt; note that
  `JSON.stringify` cannot write it, `stringify` can.

## Not yet implemented

- Warnings about duplicate names outside the I-JSON mode (section 7.2, a
  SHOULD).

## Development

The source consists of five modules:

| File | Contents |
|---|---|
| `xtjson.js` | entry point of the package; only re-exports |
| `parser.js` | `Parser`, `ParserError`, `parse` |
| `generator.js` | `Generator`, `stringify` |
| `formatter.js` | `format` |
| `shared.js` | `Options`, the character tables, the I-JSON check for strings and the assignment of optional arguments; used by the other modules |

Rules for the modules:

- No side effects on import: at the top level there are only declarations,
  literals and re-exports. Tables such as the character flags and the suffix
  table are private static fields, built on first use.
- State is kept in private fields and methods (`#name`).
- Character codes (`LF`, `DQUOTE`, ...) are declared in each module that
  uses them instead of being imported. V8 folds module-local constants but
  reads imported bindings at run time, which makes the parser several
  percent slower.

```sh
npm test
```

runs the tests with the test runner built into Node.js; there are no
dependencies to install. The tests also run with `bun test` and
`deno test --allow-read`.

- `test/corpus.test.js` runs the shared conformance corpus. It also checks
  every example in `docs/xtjson-spec-de.md` and `docs/xtjson-spec-en.md`.
  `test/corpus.json` is generated from `scripts/xtjson_ref.py` and
  `scripts/tests_*.py`; do not edit it. From the repository root:

  ```sh
  python3 scripts/export_corpus.py           # writes xtjson-js/test/corpus.json
  python3 scripts/export_corpus.py --check   # fails if it is out of date
  ```

  Of the rejected definitions in `tests_definitionen.py` only those that can
  be written as JSON are exported; the others (`NaN`, sets, other objects)
  are written again in `corpus.test.js`.
- `test/parse.test.js` tests the API of `parse` and `Parser`, the I-JSON
  mode, error messages and positions, numbers and limits.
- `test/stringify.test.js` tests `stringify` and `Generator`: the call forms, the behaviour
  of `JSON.stringify`, the output format, named values, multi-line strings,
  and a round trip of random values through `stringify` and `parse`.
- `test/format.test.js` tests `format`: the layout, and that every valid text
  of the corpus and the specification keeps its value and is formatted
  stably.

### Benchmark

```sh
npm run bench                 # node bench/bench.js
deno run bench/bench.js
bun bench/bench.js
```

`bench/bench.js` measures `parse` and `stringify` on generated documents
(JSON texts, a configuration file that uses all extensions, strings,
numbers, a small document) and prints calls per second. `JSON.parse` and
`JSON.stringify` run on the same data as a point of reference. An argument
selects the cases whose name contains it (`node bench/bench.js stringify`),
`--json` prints the results as JSON. The numbers vary with the load of the
machine; to compare two versions, run them alternately.

## License

MIT, see [`LICENSE`](LICENSE). Copyright (c) 2026 Christian Winkler.

This package was written with the help of AI (Claude); see `contributors` in
`package.json`.
