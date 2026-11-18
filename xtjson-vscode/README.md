# XTJSON for Visual Studio Code

Language support for [XTJSON](https://xtjson.cwkr.de), a syntactic superset
of JSON for files maintained by people, in files with the extension
`.xtjson` or `.xtj`:

- **Syntax highlighting** for comments (`//`, `#`, `/* */`), names with and
  without quotation marks, strings across several lines, escape
  sequences including the line continuation, numbers in all bases with digit grouping, number suffixes,
  the literals `true`, `false`, `null` and `nil`, and the directive `%strict`. Invalid escape
  sequences, unescaped control characters in strings, three quotation marks
  in a row, malformed numbers (`0755`, `10_k`, `10K`, `1.5n`), `=` and unknown
  directives such as `%define` are marked as errors.
- **Folding** of objects, arrays, strings across several lines, block comments, runs of
  line comments, and regions between `// #region` and `// #endregion` (or
  `#region` and `#endregion`).
- **Formatting** of the whole document (*Format Document*) with the editor's
  indentation settings. It uses `format` from
  [`@cwkr/xtjson`](https://github.com/cwkr/xtjson/tree/main/xtjson-js#readme): comments and the notation of names
  and values are kept, every member and array item is placed on a line of its
  own, the directive is laid out like a member, and at most one blank line
  between items is kept.
- Comment toggling, bracket matching and auto-closing of brackets and quotes.

Implements the XTJSON specification, draft 0.7
([`docs/xtjson-spec-en.md`](https://github.com/cwkr/xtjson/blob/main/docs/xtjson-spec-en.md)).

## Limits

- Highlighting and folding are lexical. They do not check the structure of
  the document: an identifier at a value position other than a literal is
  an error, but it is not marked as one, because it could also be a name
  whose `:` follows on a later line; the directive is highlighted wherever
  it stands. A name that extends across several lines is highlighted as a
  string.
- `format` does not validate the document. A valid document keeps its value;
  an invalid one is formatted as far as possible. Formatting a selection is
  not supported.
- There is no validation or error reporting yet.

## Development

Requires Node.js 20 or later. `@cwkr/xtjson` is taken from `../xtjson-js`
and bundled into the extension.

```sh
npm install
npm run build      # bundles src/ into dist/extension.cjs
npm test           # folding, formatting and grammar tests
npm run package    # builds xtjson-<version>.vsix
```

To try the extension, open this directory in VS Code and start
*Run Extension* (F5), or install the `.vsix` with
*Extensions: Install from VSIX…*.

| File | Content |
|---|---|
| `syntaxes/xtjson.tmLanguage.json` | TextMate grammar |
| `language-configuration.json` | comments, brackets, auto-closing, indentation |
| `src/extension.js` | registers the formatter and the folding ranges |
| `src/format.js` | adapter between the editor settings and `format` |
| `src/folding.js` | folding ranges |
| `test/grammar.test.js` | tokenizes with `vscode-textmate` and `vscode-oniguruma`, as VS Code does; the valid texts of the shared corpus and the examples of the specification must contain no token marked as invalid |

## License

[MIT](https://github.com/cwkr/xtjson/blob/main/xtjson-vscode/LICENSE)
