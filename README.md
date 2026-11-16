# XTJSON

XTJSON is a syntactic superset of JSON for files that are written and
maintained by people, such as configuration files. Every JSON text is a valid
XTJSON document with the same meaning, and every XTJSON document has a JSON
equivalent: XTJSON adds notations, not data types.

```xtjson
# Service configuration
name: 'demo-service'        // names without quotation marks, no root braces
port: 8080                  // a line break separates members, no comma needed
cache: 64mb                 // number suffixes: 67108864
timeout: 30s
mask: 0xFF_FF
hosts: [
  "alpha"
  "beta",                   // trailing comma allowed
]
motd: "
  Welcome.
  Have a nice day.
  "                         // indentation removed: "Welcome.\nHave a nice day.\n"
```

The specification is a draft. The current version is **draft 0.5**; see the
change list at the end of the specification.

- Specification in English: [`docs/xtjson-spec-en.md`](docs/xtjson-spec-en.md)
- Specification in German: [`docs/xtjson-spec-de.md`](docs/xtjson-spec-de.md)
- Overview with railroad diagrams: <https://xtjson.cwkr.de>

Both language versions are equal in rank.

## Contents of this repository

| Path | Content |
|---|---|
| [`docs/`](docs) | the specification in English and German, and the overview page for GitHub Pages (`index.html` is generated) |
| [`scripts/`](scripts) | reference parser, conformance tests and tools for the specification (Python, standard library only) |
| [`xtjson-js/`](xtjson-js) | JavaScript implementation, npm package [`@cwkr/xtjson`](xtjson-js/README.md) |
| [`xtjson-vscode/`](xtjson-vscode) | [extension for Visual Studio Code](xtjson-vscode/README.md): syntax highlighting, folding and formatting |

The specification is the source of truth. The reference parser and the tests
in `scripts/` follow it, and the implementations follow both.

## Checking the specification

The scripts need Python 3.8 or later and nothing else. From the repository
root:

```sh
python3 scripts/xtjson_ref.py docs/xtjson-spec-en.md     # examples and built-in cases
python3 scripts/xtjson_ref.py docs/xtjson-spec-de.md
python3 scripts/tests_zeilenumbruch_strings.py           # line breaks, strings, escapes
python3 scripts/tests_mehrzeilige_strings.py             # strings across several lines
python3 scripts/tests_definitionen.py                    # named values, number suffixes
python3 scripts/compare_versions.py docs/xtjson-spec-de.md docs/xtjson-spec-en.md
python3 scripts/build_index.py --check                   # docs/index.html is up to date
python3 scripts/export_corpus.py --check                 # corpus for implementations is up to date
```

The scripts print their messages in German; `ERGEBNIS: OK` means success.

`scripts/export_corpus.py` exports the test cases as JSON, so that
implementations in any language can run the same conformance corpus.

## Contributing

[`CLAUDE.md`](CLAUDE.md) describes the rules for changing the specification
and the implementations: both language versions change together, every rule
change comes with tests, and implementations accept exactly what the grammar
allows.

Parts of this repository were written with the help of AI (Claude).

## License

- The specification, the reference parser, the scripts, the overview page
  and everything else in this repository that does not state a license of
  its own are dedicated to the public domain under
  [CC0 1.0 Universal](LICENSE).
- The JavaScript implementation in [`xtjson-js/`](xtjson-js) is licensed
  under the [MIT License](xtjson-js/LICENSE).
- The extension for Visual Studio Code in [`xtjson-vscode/`](xtjson-vscode)
  is licensed under the [MIT License](xtjson-vscode/LICENSE).
