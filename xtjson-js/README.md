# @cwkr/xtjson

XTJSON parser for JavaScript. XTJSON is a syntactic superset of
JSON for files that are written and maintained by people, such as
configuration files. See the specification in
[`docs/xtjson-spec-en.md`](../docs/xtjson-spec-en.md) (draft 0.8).

- ES modules in plain JavaScript, with TypeScript declarations. Importing
  them has no side effects.
- No dependencies. Runs in current browsers and JavaScript runtimes; tested
  with Node.js (18 or later) and Bun.
- `parse()` works like `JSON.parse`; `parseAsync()` also accepts an
  asynchronous resolver for `%extends`, for example one that uses `fetch`.
  `Parser` keeps validated options for many calls. `format()` lays out a
  document again and keeps its comments.

```js
import { parse, format } from '@cwkr/xtjson';

const config = parse(`
# Service configuration
%strict: true

name: 'demo-service'
host: "0.0.0.0"
port: 8080            // a line break replaces the comma
proxy: null           // no proxy
cache: 64mb
motd: "
  Welcome.
  "
`);
// { name: 'demo-service', host: '0.0.0.0', port: 8080, proxy: null, cache: 67108864, motd: 'Welcome.\n' }

format('{port: 8080, /* MiB */ cache: 64mb}', 2);
// {
//   port: 8080, /* MiB */
//   cache: 64mb
// }
```

## API

### `parse(text, options?)`

Parses an XTJSON document and returns its value.

- `text`: the document. Like `JSON.parse`, the argument is converted to a
  string. It must be decoded text; when reading bytes, decode them as UTF-8
  first (for example with `new TextDecoder('utf-8', { fatal: true })`).
- `options`: optional strict mode, limits and resolver, a plain object, see
  [Options](#options); `null` and `undefined` mean none. Anything other than
  an object is a `TypeError`.

Every JSON text gives the same value as with `JSON.parse`, with two
exceptions allowed by the specification (section 11): numbers whose magnitude
exceeds the range of a JavaScript number (`1e400`) are an error instead of
`Infinity`, and objects and arrays may be nested at most 1000 levels deep
(see `maxDepth`).

If a name occurs more than once in an object, the member that comes last in
the document applies, as with `JSON.parse`. In [strict mode](#strict-mode)
it is an error instead.

### `parseAsync(text, options?)`

Works like `parse`, but returns a promise, and the resolver for `%extends`
may return a promise of the base value, for example an `async` function that
uses `fetch` (see [Directives](#directives) and
[In the browser](#in-the-browser)). An invalid document or a failing
resolver rejects the promise with a `ParserError`, invalid options with a
`TypeError`. Without `%extends`, or with a synchronous resolver, the result
is the same as with `parse`.

### Names and values without quotation marks

The values without quotation marks are `true`, `false` and `null`
(section 6.3). They are written in lower case. Any other identifier at a
value position is an error, `nil` included; it is never read as a string.
At a name position they are ordinary names: `{null: null}` is
`{ null: null }`, and `{nil: 1}` is `{ nil: 1 }`.

A name without quotation marks (7.2) consists of ASCII letters, `_`, `$`,
`µ` and the letters `À` to `ÿ` of Latin-1 Supplement without `×` and `÷`
(`größe`, `café`, `µm`); after the first character also of digits. `ª`, `º`
and `·` are not permitted. Other names are written in quotation marks. Names are not
normalized.

### Directives

A document can begin with the directives `%strict` (6.5) and `%extends`
(6.6). `%strict` occurs at most once, `%extends` any number of times, and
`%strict` can stand before, between or after the `%extends`. `%strict: true` makes the
parser read the content of the document in [strict mode](#strict-mode).

```js
parse(`
%strict: true

owner: null
tags: [true, false, null]
`);
// { owner: null, tags: [true, false, null] }
```

- The value of `%strict` is `true` or `false`, nothing else.
- Directives stand only at the start of the document and are separated from
  each other and from the content by a comma or a line break.
- There are no other directives, and neither the document nor the
  application can define values, directives or number suffixes; there are
  no options for them.

`%extends: './defaults.json'` makes the document extend a base value
according to JSON Merge Patch (RFC 7396): members of the document replace or
add members of the base value, objects are merged at any depth, arrays are
replaced, and a member with the value `null` removes the member of the base
value. The base value comes from the option `resolver`, a function
`(reference, strict) => value`: it receives the string and whether the
document is read in strict mode, and returns the base value. How it reads
the source, and whether the source is JSON, XTJSON or something else, is up
to the application. Without a resolver, `%extends` is an error.

The following resolver for Node.js reads files below a configuration
directory. Because every JSON text is also an XTJSON document, it reads
every base value with `parse`, and a base value can use `%extends` itself:

```js
import { readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { parse } from '@cwkr/xtjson';

const root = resolve('config');

/**
 * A resolver for the document `file`: resolves a reference relative to the
 * document that names it, only below `root`, and rejects cycles.
 */
function resolverFor(file, seen = new Set([file])) {
  return (reference, strict) => {
    const path = resolve(dirname(file), reference);
    if (!path.startsWith(root + sep)) throw new Error(`${reference} is outside the configuration directory`);
    if (seen.has(path)) throw new Error(`${reference} extends itself`);
    // the base value is read in the same mode as the document that names it
    return parse(readFileSync(path, 'utf8'), { strict, resolver: resolverFor(path, new Set(seen).add(path)) });
  };
}

const file = resolve(root, 'app.xtj');
const config = parse(readFileSync(file, 'utf8'), { resolver: resolverFor(file) });
```

- The resolver is called after the content has been read, once for every
  `%extends`, in document order, with the value of its string and `strict`.
  `strict` is `true` if the document is read in strict mode, because the
  application requested it with the option `strict` or the document contains
  `%strict: true`. A resolver that parses an XTJSON base value can pass it on,
  so that the base value is checked in the same way.
- The resolver returns a JSON value: an object, an array, a string, a finite
  number, a BigInt, `true`, `false` or `null`. Any other value, or an
  exception of the resolver, is a `ParserError` (the exception is its
  `cause`). The returned value is copied, not changed.
- With `parse` the resolver must be synchronous; a promise is a
  `ParserError`. With [`parseAsync`](#parseasynctext-options) it may return a
  promise. `parseAsync` calls the resolver for all `%extends` before it
  awaits a result, so the sources are loaded in parallel; the base values
  are merged in document order nevertheless. If several calls fail, the error
  of the first `%extends` in the document is reported.
- With several `%extends`, the base values are merged in document order,
  each later one as a merge patch on the earlier ones, and the document is
  merged into the result last. A later base value therefore takes precedence,
  and its members with the value `null` remove members of the earlier ones:

  ```js
  parse("%extends: 'defaults.json'\n%extends: 'production.json'\nlog: {file: 'demo.log'}", {
    resolver: (reference) => ({
      'defaults.json': { port: 8080, debug: true, log: { level: 'debug' } },
      'production.json': { port: 443, debug: null, log: { level: 'warn' } },
    })[reference],
  });
  // { port: 443, log: { level: 'warn', file: 'demo.log' } }
  ```

- A base value that itself uses `%extends` is the task of the resolver; it
  can call `parse` or `parseAsync` with a resolver of its own, as above.
  Guard against cycles. An error in a base document is reported as an error
  of the resolver, with the message of the base document and its position.
- A document from an untrusted source can make the resolver read files or
  fetch URLs. Restrict the resolver, or do not give one (section 13).
- In strict mode the result of all merges is checked as well: its names and
  strings must not contain surrogates or noncharacters, and its root value
  must be an object or an array.

### In the browser

The package consists of ES modules without dependencies. Load
`xtjson.js` with a bundler, or with an import map:

```html
<script type="importmap">
  { "imports": { "@cwkr/xtjson": "/js/xtjson/xtjson.js" } }
</script>
```

Read documents with the Fetch API and decode them as UTF-8. `response.text()`
would replace invalid UTF-8 silently; a `TextDecoder` with `fatal: true`
reports it, as section 4 requires:

```js
import { parseAsync } from '@cwkr/xtjson';

/** Loads the text at `url`; an HTTP error or invalid UTF-8 is an error. */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return new TextDecoder('utf-8', { fatal: true }).decode(await response.arrayBuffer());
}

const settings = await parseAsync(await fetchText('/config/settings.xtj'), { strict: true });
```

A resolver that loads base values with `fetch` is an `async` function, so
use `parseAsync`. The following resolver resolves a reference relative to
the URL of the document that names it, loads only from the origin of the
document, rejects cycles, and reads every base value with `parseAsync` and a
resolver of its own, so that a base value can be a JSON or XTJSON document
and use `%extends` itself:

```js
/**
 * A resolver for the document at `url`. `seen` contains the URLs of the
 * documents on the way to it, to detect cycles.
 */
function resolverFor(url, seen = new Set([url.href])) {
  return async (reference, strict) => {
    const source = new URL(reference, url);
    if (source.origin !== url.origin) throw new Error(`${source} is not on ${url.origin}`);
    if (seen.has(source.href)) throw new Error(`${source} extends itself`);
    if (seen.size >= 10) throw new Error('more than 10 nested base documents');
    const text = await fetchText(source);
    // the base value is read in the same mode as the document that names it
    return parseAsync(text, { strict, resolver: resolverFor(source, new Set(seen).add(source.href)) });
  };
}

/** Loads the XTJSON document at `path` and its base values. */
async function loadConfig(path) {
  const url = new URL(path, document.baseURI);
  return parseAsync(await fetchText(url), { resolver: resolverFor(url) });
}

const config = await loadConfig('config/app.xtj');
```

With `config/app.xtj`

```
%extends: './base.xtj'
%extends: './production.json'

name: 'app'
```

the resolver loads `config/base.xtj` and `config/production.json` in
parallel; if `base.xtj` itself contains `%extends: './defaults.json'`, it
loads `config/defaults.json` as well. A document that names a base on
another server, or that extends itself directly or through other documents,
is rejected with a `ParserError`.

### Options

Options are a plain object:

```js
import { parse } from '@cwkr/xtjson';

parse('ratio: 50pct\nowner: "me"', { strict: true });   // { ratio: 0.5, owner: 'me' }
```

- `maxDepth`: the maximum nesting depth of objects and arrays, a positive
  integer. Default `1000`. An implicit root object counts as a level, so
  `a: [1]` has depth 2. `parse` reports a deeper document as a
  `ParserError`. A very large
  limit can exceed the call stack of the JavaScript engine (with Node.js at
  a depth of a few thousand); `parse` then reports a `ParserError` too.
- `resolver`: a function `(reference, strict) => value` that returns the base
  value for the string of an `%extends`, or with `parseAsync` a promise of
  it, see [Directives](#directives). Default none: `%extends` is an error.
- `strict`: `true` for strict mode, see [below](#strict-mode). Default
  `false`.

Other properties are a `TypeError`, so that a misspelt option is not
silently ignored. This includes `namedValues`, `maxExpansion` and `ijson`
of earlier versions: there are no named values, and the I-JSON mode is now
strict mode, option `strict`.

The application cannot define values, directives or number suffixes.
The suffixes are fixed by section 9.5 and always active when parsing: `k`
(times 1000), `kb` (times 1024), `m` (times 1000000), `mb` (times 1048576),
`ms` (divided by 1000), `s`, `min` (times 60), `h` (times 3600), `pct`
(divided by 100) and `n`. `s` and `n` leave the value unchanged; `n` is
permitted only after an integer and yields a BigInt, see
[Numbers](#numbers).

`parse` and `parseAsync` validate the options on every call. To validate
them once, create a [`Parser`](#parser) and reuse it; it takes the place of
the class `Options` of earlier versions.

### `format(text, space?)`

Formats an XTJSON document and returns the text. `space` works as in
`JSON.stringify`: a number of spaces (at most 10) or a string of spaces and
tabs (other characters would not be valid indentation, so they are a
`TypeError`). The layout follows `JSON.stringify`: one member or array item
per line, indented by `space` per level, a space after each `:`, and empty
objects and arrays as `{}` and `[]`. Unlike `JSON.stringify`, `format` keeps
comments, the notation of names, strings and numbers (quotation marks,
suffixes, hexadecimal numbers, ...) and the commas of the text; the
directive is laid out like a member; a line break
that separates two items stays a line break. At most one blank line between
items is kept. Strings across several lines that begin with an empty line
are indented anew, which does not change their value; line continuations
and the white space before them are kept. Other strings are left as they
are.

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

### Strict mode

```js
parse(text, { strict: true });
```

In strict mode (section 12) the parser rejects documents that violate one of
its prohibitions:

- an object that contains a name more than once, independent of its notation
  (`a`, `"a"` and `'\u0061'` are the same name);
- a name or string value that contains an unpaired surrogate (for example
  `"\uDEAD"`) or a Unicode noncharacter (U+FDD0 to U+FDEF and every code point
  ending in FFFE or FFFF), written directly or as an escape sequence;
- a root value that is not an object or an array.

The JSON equivalent of a document that is valid in strict
mode is an I-JSON message (RFC 7493), provided its numbers stay within the
range of IEEE 754 binary64; that range is a recommendation and is not
enforced.

Strict mode applies if the application requests it with `strict: true` or if
the document contains `%strict: true` (6.5). It applies to the content of
the document, the part after the directives, and with `%extends` also to the
result of all merges. With `strict: true`, a
document with `%strict: false` is an error, because it contradicts the
application.

```js
parse('%strict: true\n{a: 1, a: 2}');
// ParserError: Duplicate name "a"; names must be unique in strict mode ...
parse('%strict: false\n{a: 1}', { strict: true });
// ParserError: %strict: false contradicts strict mode, which the application requests ...
```

The option is off by default, because without it every JSON text is accepted,
including texts with duplicate names and a string or number as the root
value.

### Errors

- An invalid document throws a `ParserError`, a subclass of `SyntaxError`.
  Its message names the violated rule and the position, for example
  `Unexpected identifier 'ture'; the values without quotation marks are true, false and null; text without quotation marks is not a string, write "ture" for a string (line 3, column 9)`.
  The properties `reason`, `line`, `column` (both 1-based; columns count
  Unicode code points) and `offset` (0-based, in UTF-16 code units) give the
  details.
- Errors of the application throw a `TypeError`: invalid options (for
  example an unknown option or a limit that is not a positive integer) and
  invalid arguments.

### Parser

```js
import { Parser } from '@cwkr/xtjson';

const parser = new Parser({ strict: true });

parser.parse('owner: null');  // { owner: null }
```

- `new Parser(options?)` takes the options as a plain object, validates them
  once and keeps a copy; later changes to the object have no effect. An
  instance can be reused for any number of documents.
- `parser.parse(text)` and `parser.parseAsync(text)` work like `parse` and
  `parseAsync` with these options. The parser can be used again, also by its
  own resolver, while `parseAsync` waits for the resolver.
- The configuration and the state of a call are private.

`parse` and `parseAsync` use such an instance internally.

### Exports

The package has only named exports: `parse`, `parseAsync`, `format`,
`Parser` and `ParserError`. There is no default export. The TypeScript
declarations also export the types `ParseOptions`, `Resolver` and
`JSONValue`.

## Numbers

- Decimal numbers become JavaScript numbers, as with `JSON.parse`.
- Hexadecimal, octal and binary numbers are exact or an error: a value that a
  JavaScript number cannot represent exactly (for example `0x20000000000001`)
  is rejected, never rounded (section 9.4).
- Suffixes give the exact product or quotient, rounded once: `0.1kb` is
  `102.4`, `100ms` is `0.1`, `12.5pct` is `0.125`. A suffix that is not in
  the table of section 9.5 is an error, and suffixes are written in lower
  case only (`10K`, `10MS` and `12px` are errors).
- An integer with the suffix `n` becomes a BigInt: `10n`, `0xFFn` and
  `9007199254740993n` are exact at any size. After a fraction part or an
  exponent the suffix `n` is an error (`1.5n`, `1e3n`). Note that
  `JSON.stringify` cannot write a BigInt.

## Not yet implemented

- Warnings about duplicate names outside strict mode (section 7.2, a
  SHOULD).

## Development

The source consists of three modules:

| File | Contents |
|---|---|
| `xtjson.js` | entry point of the package; only re-exports |
| `parser.js` | `Parser`, `ParserError`, `parse`, `parseAsync` |
| `formatter.js` | `format` |

Rules for the modules:

- No side effects on import: at the top level there are only declarations,
  literals and re-exports. Tables such as the character flags and the suffix
  table are built on first use.
- State is kept in private fields and methods (`#name`).
- `parser.js` and `formatter.js` do not import each other. Code that both
  need is duplicated rather than shared through a third module.

```sh
npm test
```

runs the tests with the test runner built into Node.js; there are no
dependencies to install. The tests also run with `bun test`. Node.js and Bun
are the supported test environments; Deno uses the same engine as Node.js
(V8) and is not tested separately.

- `test/corpus.test.js` runs the shared conformance corpus. It also checks
  every example in `docs/xtjson-spec-de.md` and `docs/xtjson-spec-en.md`.
  `test/corpus.json` is generated from `scripts/xtjson_ref.py` and
  `scripts/tests_*.py`; do not edit it. From the repository root:

  ```sh
  python3 scripts/export_corpus.py           # writes xtjson-js/test/corpus.json
  python3 scripts/export_corpus.py --check   # fails if it is out of date
  ```

- `test/parse.test.js` tests the API of `parse`, `parseAsync` and `Parser`,
  the names and values, the directives and `%extends` with synchronous and
  asynchronous resolvers, strict mode, error messages and positions, numbers
  and limits.
- `test/format.test.js` tests `format`: the layout, and that every valid text
  of the corpus and the specification keeps its value and is formatted
  stably.

## License

MIT, see [`LICENSE`](LICENSE). Copyright (c) 2026 Christian Winkler.

This package was written with the help of AI (Claude); see `contributors` in
`package.json`.
