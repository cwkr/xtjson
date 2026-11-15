# @cwkr/xtjson

XTJSON parser for JavaScript. XTJSON is a syntactic superset of JSON for files
that are written and maintained by people, such as configuration files. See the
specification in [`docs/xtjson-spec-en.md`](../docs/xtjson-spec-en.md)
(draft 0.3).

- A single ES module in plain JavaScript, with TypeScript declarations.
- No dependencies. Runs in current browsers, Node.js (18 or later), Bun and Deno.
- The API follows the global `JSON` object. So far only `parse` is implemented.

```js
import XTJSON from '@cwkr/xtjson';

const config = XTJSON.parse(`
# Service configuration
name: 'demo-service'
port: 8080            // a line break replaces the comma
cache: 64mb
motd: """
  Welcome.
  """
`);
// { name: 'demo-service', port: 8080, cache: 67108864, motd: 'Welcome.\n' }
```

## API

### `XTJSON.parse(text, reviver?, definitions?)`<br>`XTJSON.parse(text, definitions)`

Parses an XTJSON document and returns its value.

- `text`: the document. Like `JSON.parse`, the argument is converted to a
  string. It must be decoded text; when reading bytes, decode them as UTF-8
  first (for example with `new TextDecoder('utf-8', { fatal: true })`).
- `reviver`: optional, works exactly as in `JSON.parse`.
- `definitions`: optional custom named values and number suffixes, see below.

The type of the second argument decides what it is: a function is a reviver,
an object (an `XTJSONDefinitions` instance or a plain `{ values, suffixes }`
object) is the definitions, and `null` or `undefined` is neither. Any other
type is a `TypeError`, as are definitions given both as the second and as the
third argument.

```js
XTJSON.parse(text, definitions);              // definitions only
XTJSON.parse(text, reviver, definitions);     // both
XTJSON.parse(text, null, definitions);        // also definitions only
```

Every JSON text gives the same value as with `JSON.parse`, with two
exceptions allowed by the specification (section 11): numbers whose magnitude
exceeds the range of a JavaScript number (`1e400`) are an error instead of
`Infinity`, and objects and arrays may be nested at most 1000 levels deep.

If a name occurs more than once in an object, the member that comes last in
the document applies, as with `JSON.parse`. In I-JSON mode it is an error
instead (see below).

### Definitions

Without definitions, only the predefined named values `true`, `false`, `null`
and the predefined suffixes `k`, `K` (times 1000), `kb`, `Kb`, `kB`, `KB`
(times 1024) and `mb`, `Mb`, `mB`, `MB` (times 1048576) are active. An
application can define further ones:

```js
import XTJSON, { XTJSONDefinitions } from '@cwkr/xtjson';

const definitions = new XTJSONDefinitions({
  values: { nil: null, unknown: 'not specified' },
  suffixes: { '%': (x) => x / 100 },
});

XTJSON.parse('ratio: 50%\nowner: unknown', definitions);
// { ratio: 0.5, owner: 'not specified' }
```

- `values` maps identifiers to JSON values. The order of the named values is
  fixed: it is the order in which they are given.
- `suffixes` maps suffixes (one or two characters, see section 9.5) to
  conversion functions. A conversion function receives the number including
  its sign and must return a finite number. An exception thrown by it is
  reported as an error of the document, with the original exception as
  `cause`.
- Both can be given as a plain object, a `Map` or an iterable of
  `[key, value]` pairs.

`XTJSONDefinitions` validates the definitions once and makes a deeply frozen
copy of the named values. Create it once and reuse it. A plain object
`{ values, suffixes }` can be passed to `parse` as well, but it is validated
again on every call. The same definitions object is meant to be passed to
`XTJSON.stringify()` once that exists.

Every named value in a result is a fresh copy, so changing the result never
changes the definitions.

### I-JSON mode

```js
XTJSON.parse(text, { ijson: true });
new XTJSONDefinitions({ values, suffixes, ijson: true });
```

With `ijson: true` the parser rejects documents that violate one of the two
prohibitions of section 12 (I-JSON, RFC 7493):

- an object that contains a name more than once, independent of its notation
  (`a`, `"a"` and `'a'` are the same name);
- a name or string value that contains an unpaired surrogate (for example
  `"\uDEAD"`) or a Unicode noncharacter (U+FDD0 to U+FDEF and every code point
  ending in FFFE or FFFF), written directly or as an escape sequence. This
  also applies to the values of named values that the document uses.

The recommendations of section 12 (numbers within the range of IEEE 754
binary64, an object or array as the root value) are not enforced. The mode is
off by default, because without it every JSON text is accepted, including
texts with duplicate names.

### Errors

- An invalid document throws an `XTJSONError`, a subclass of `SyntaxError`.
  Its message names the violated rule and the position, for example
  `Undefined named value 'ture'; text without quotation marks is not a string, write "ture" for a string (line 3, column 9)`.
  The properties `reason`, `line`, `column` (both 1-based; columns count
  Unicode code points) and `offset` (0-based, in UTF-16 code units) give the
  details.
- Invalid definitions are an error of the application and throw a
  `TypeError`: for example an attempt to redefine `true` or `kb`, an invalid
  identifier or suffix, or a named value that is not a JSON value.

### Named exports

`parse`, `XTJSONDefinitions` and `XTJSONError` are also available as named
exports.

## Numbers

- Decimal numbers become JavaScript numbers, as with `JSON.parse`.
- Hexadecimal, octal and binary numbers are exact or an error: a value that a
  JavaScript number cannot represent exactly (for example `0x20000000000001`)
  is rejected, never rounded (section 9.4).
- Predefined suffixes give the exact product, rounded once: `0.1kb` is `102.4`.

## Not yet implemented

- `XTJSON.stringify()`.
- Warnings about duplicate names outside the I-JSON mode (section 7.2, a
  SHOULD).

## Development

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

  The conversion functions of the suffixes in `tests_definitionen.py` cannot
  be exported; they are written again in `corpus.test.js`, which checks that
  the suffix names match.
- `test/parse.test.js` tests the API, the I-JSON mode, error messages and
  positions, numbers and limits.
