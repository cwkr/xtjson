# CLAUDE.md

Guidance for working in this repository.

## What this is

This repository contains the specification of **XTJSON**, a syntactic superset of JSON for files maintained by people, a reference parser that makes the specification testable, and source code for implementations of the format.

The specification is the source of truth. The order of authority is:

1. the specification in `docs/` (German and English versions, equal in rank),
2. the reference parser and tests in `scripts/`, which follow the specification,
3. the implementations, which follow both.

If these disagree, the specification wins. If the specification itself is unclear or contradictory, fix the specification first; never settle the question silently in code.

## Layout

```
docs/
  xtjson-spec-de.md               specification, German version
  xtjson-spec-en.md               specification, English version
scripts/
  xtjson_ref.py                   reference parser; checks the examples of one spec version
  compare_versions.py             compares the two language versions
  tests_zeilenumbruch_strings.py  tests: line breaks, strings, names, escapes
  tests_mehrzeilige_strings.py    tests: value of multi-line strings
  tests_definitionen.py           tests: named values and number suffixes
  build_index.py                  generates docs/index.html
  index_template.html             template for docs/index.html
  export_corpus.py                exports the test cases as JSON for implementations
xtjson-js/                        JavaScript implementation (npm package @cwkr/xtjson)
```

`docs/` also contains the overview page for GitHub Pages: `index.html` (generated, do not edit by hand) and `style.css` (written by hand).

Implementation source code lives in its own directories next to `docs/` and `scripts/`. Each implementation documents its own build and test commands in a README in its directory; read that before touching it. Do not put implementation code into `docs/` or `scripts/`.

## Checks for the specification

The scripts need only the Python standard library (Python 3.8 or later). Run them from the repository root:

```sh
python3 scripts/xtjson_ref.py docs/xtjson-spec-de.md
python3 scripts/xtjson_ref.py docs/xtjson-spec-en.md
python3 scripts/tests_zeilenumbruch_strings.py
python3 scripts/tests_mehrzeilige_strings.py
python3 scripts/tests_definitionen.py
python3 scripts/compare_versions.py docs/xtjson-spec-de.md docs/xtjson-spec-en.md
```

Each script ends with a result line and exit code 0 on success. The scripts print their messages in German: `ERGEBNIS: OK` and `ERGEBNIS: keine Abweichung in 1-6` mean success, `FEHLER` marks a failure. Run all six after every change to `docs/` or `scripts/`. A change is not done until all six pass.

What they check:

- `xtjson_ref.py <version>` parses every fenced block tagged `xtjson` in the given version. If a block tagged `json` follows immediately, its value must be equal. It also runs built-in valid and invalid cases and plain JSON texts (the superset property).
- The three `tests_*.py` files contain pairs of text and expected value, and texts that must be rejected.
- `compare_versions.py` compares the outline, the ABNF blocks (without comments), the shape of the example values, tables, list items and the number of normative key words per section. Item 7 of its output lists code spans that occur in only one version; only translated example words are acceptable there.

The comparison is mechanical. It does not detect differences of meaning in prose. Always read changed sentences against each other in both versions.

## Overview page

`docs/index.html` is an informal English overview with railroad diagrams, modelled on json.org. It is generated:

```sh
python3 scripts/build_index.py           # writes docs/index.html
python3 scripts/build_index.py --check   # fails if docs/index.html is out of date
```

- The grammar, the example from Appendix B.1, the draft number and the date are copied from `docs/xtjson-spec-en.md`. Rebuild the page after every change to the English version and commit the result with it.
- The prose is in `scripts/index_template.html`, the diagrams are in `DIAGRAMS` in `scripts/build_index.py`. Both are written by hand from the specification and are not checked against it. After a rule or grammar change, read them against the changed sections and adapt them.
- The page is not normative. It must not say anything the specification does not say.

## Rules for changing the specification

1. **Always change both versions**, in the same commit, section by section. Same section numbers, same number of list items and table rows, same normative statements.
2. **ABNF is character-identical in both versions**; only the comments after `;` are translated. The excerpts in sections 5 to 9 must match Appendix A, which is authoritative.
3. **Version and change list.** Every substantive change increases the draft number in the header of both versions and gets an entry in the section "Änderungen" / "Changes". The text itself does not refer to earlier drafts ("formerly", "now", "no longer"); such remarks belong only in the change list.
4. **Tests are part of the change.** A new or changed rule gets valid and invalid cases in the test files, and the reference parser is adapted. Every example in the text must run through the parser.
5. **Keep the appendices in step.** Check and update Appendix B.3 (invalid documents), Appendix C (deliberately not included) and Appendix D (design decisions with rationale) with every rule change.
6. **Check cross-references.** Section numbers, anchors in the table of contents and the extension table in section 1 (E1 to E13) must be correct in both versions.
7. **Implementations follow.** A specification change that alters behaviour is not finished until the implementations in this repository are updated or an open issue records what is outstanding.

### Normative key words

| German | English |
|---|---|
| MUSS, MÜSSEN | MUST |
| DARF NICHT, DÜRFEN NICHT, DARF KEINE, DÜRFEN KEINE | MUST NOT |
| SOLLTE, SOLLTEN | SHOULD |
| SOLLTE NICHT, SOLLTEN NICHT | SHOULD NOT |
| EMPFOHLEN | RECOMMENDED |
| DARF, DÜRFEN | MAY |

They are normative only in capitals. `compare_versions.py` counts them per section; a new German word form must be added to `KW_DE` there.

### Terminology

Use the terms from section 2 of the specification consistently. The most important pairs:

| German | English |
|---|---|
| Element | item |
| Name | name |
| Bezeichner | identifier |
| benannter Wert | named value |
| Zahlen-Suffix | number suffix |
| Leerraum, Leerraumzeichen | white space, white space character |
| Zeilenumbruch | line break |
| Trenner | separator |
| maskiert, unmaskiert | escaped, unescaped |
| einzeiliger, mehrzeiliger String | single-line, multi-line string |
| Begrenzer | delimiter |
| Einrückung | indentation |
| Definition, vordefiniert, eigene Definition | definition, predefined, custom definition |
| JSON-Äquivalent | JSON equivalent |
| portabel | portable |

Use the English terms in implementation code, identifiers, error messages and documentation.

## Principles of the format

No change may give up these properties:

- **Superset.** Every UTF-8 encoded JSON text is a valid XTJSON document with the same meaning (K1, K2). An extension may only occupy notations that are a syntax error in JSON.
- **JSON data model.** Every document has a JSON equivalent (section 10). There are no new data types, no expressions, no references.
- **Predefined and not changeable** are `true`, `false`, `null` and all number suffixes. The table in 9.5 is exhaustive: `k`, `K`, `kb`, `Kb`, `kB`, `KB`, `mb`, `Mb`, `mB`, `MB`, `ms`, `s`, `min`, `h`, `pct`, `px`, `L`, `n`.
- **Definitions belong to the parser, not to the document.** A document can define neither named values nor suffixes. The application can define named values (a string, a number, `true`, `false` or `null`; never an object or an array), but no suffixes: those are defined only by the specification. Anything undefined is an error.
- **Errors instead of guessing.** When in doubt, an input is an error and is not silently interpreted (unknown escape sequences, undefined identifiers, mixed indentation).
- **Narrow rules first.** Where several solutions are possible, choose the narrower one and give the rationale in Appendix D. Loosening later is compatible; restricting is not.

Do not simply implement proposals that touch one of these principles. Present them for a decision, with reasons.

## Rules for implementations

An implementation in this repository is a conforming XTJSON parser, generator or converter in the sense of section 11 of the specification. In particular:

- **No dialects.** Accept exactly what the grammar in Appendix A allows, and reject everything else. Do not add convenience extensions, lenient modes or fallbacks that the specification does not define. Options that restrict (for example an I-JSON mode according to section 12) are fine.
- **Only predefined definitions by default.** Without action by the application, only `true`, `false` and `null` are active as named values. Offer an API for custom named values; reject definitions that violate 6.4: a name that is not an identifier, an object or an array as the value, and any attempt to redefine a predefined one. Report such misuse as an error of the application, distinct from an error of the document.
- **No custom suffixes.** Know exactly the suffixes in the table in 9.5. Do not offer an API to add, change or remove suffixes.
- **Behaviour that is easy to get wrong:**
  - Duplicate names: the member that comes last in the document applies (7.2); forbidden in I-JSON mode.
  - Line break: LF, CR or CR LF, with CR LF counting as one. U+2028 and U+2029 are white space, not line breaks, and do not end a line comment.
  - A line break inside a block comment is not a separator.
  - Multi-line strings: follow the four steps in 8.3 exactly, including removal of unescaped trailing spaces and tabs, removal of indentation only when the string begins with an empty line, the last line always counting, and the error for differing removed characters. Multi-line strings are not permitted as names.
  - Escapes: only those in the table in 8.2. `\0` must not be followed by a digit, `\u{…}` must not exceed 10FFFF or lie in D800 to DFFF, every other `\` sequence is an error.
  - Numbers: prefixes `0x`, `0o`, `0b` in either case; `_` only singly between two digits; a leading-zero form such as `0755` is an error. Hexadecimal, octal and binary numbers are exact or an error, never rounded.
  - Suffixes: the characters of an identifier, any length, longest match, no white space before them; the first character excludes `_` and, in either case, `a`–`f`, `o` and `x`. A `_` after a digit is digit grouping or an error (`1_0` is 10, `10_k` is an error). Case is significant (`L` exists, `l` does not), and a suffix that is not in the table in 9.5 is an error. Results are exact (`0.1kb` is `102.4`, `100ms` is `0.1`).
- **Limits are allowed, silent truncation is not.** An implementation may limit document size, nesting depth, number range and string length (section 11), but it must report an error when a limit is hit.
- **Never evaluate a document as code**, and never let a document supply definitions (section 13).
- **Test against the shared cases.** The cases in `scripts/tests_*.py` and the built-in lists in `scripts/xtjson_ref.py` are the conformance corpus. `scripts/export_corpus.py` exports them as JSON (default `xtjson-js/test/corpus.json`); run it after changing those cases, `--check` fails if the export is out of date. Every implementation must accept the valid texts with the expected values and reject the invalid ones. When an implementation bug is found, first add a case to the shared tests and confirm the reference parser handles it as the specification says, then fix the implementation.
- **Use the reference parser as the oracle**, not as a template. It is written for clarity, has known gaps (see below) and is not meant to be ported line by line. Where an implementation and the reference parser disagree, check the specification text before changing either.
- **Follow each implementation's own conventions** for style, tooling, dependencies and tests, as documented in its directory. Do not introduce new dependencies or reformat existing code without need.
- **Error reporting.** Errors should name the position in the document (line and column) and the violated rule in plain English, using the terminology above.

## Pitfalls when editing the specification

- **Escape examples in the text.** The specification shows escape sequences as text, for example a backslash, `u` and four hexadecimal digits. Some tools turn such sequences into the character itself when writing a file. After editing, check that they are still present as sequences:
  `grep -c 'u0061\|u00e4\|u00e9\|uD83D\|u00E4\|u000B\|uDEAD' docs/*.md` must report the same count for both versions (currently 6 each).
- **White space at the end of lines.** In examples with multi-line strings it matters, or is removed by rule. It is made visible in tables with `·` for a space and `⏎` for a line break, never by real spaces at the end of a line. Editors and formatters must not re-wrap the Markdown files or strip white space.
- **Fence tags.** Complete, valid documents go in blocks tagged `xtjson`, JSON equivalents directly after them in `json`, grammar in `abnf`. Invalid examples and fragments are written as inline code or in tables, never in an `xtjson` block.
- **Examples with custom definitions.** The example in 6.4 assumes definitions (`nil`, `zero`, `unbekannt` / `unknown`). They are listed in `EXAMPLE_DEFS` in `scripts/xtjson_ref.py`. If you add an example with further definitions, add them there and name them in the text.
- **Translated examples.** Names and texts in examples are translated; structure and numbers are not. `compare_versions.py` checks that the values have the same shape.
- **Line endings.** The Markdown files use LF. Tests for CR and CR LF are written as escape sequences in the Python files.

## Reference parser

- Interface: `parse(text, ijson=False, values=None)`. `values` maps identifiers to JSON values that are not objects or arrays. The suffixes are fixed in `SUFFIXES`.
- Invalid documents raise `XTJSONError`. Invalid definitions passed by the application raise `ValueError` but not `XTJSONError`.
- Known gaps compared with the specification; do not treat them as done:
  - The I-JSON mode checks only duplicate names, not surrogates, noncharacters or number ranges.
  - Decimal numbers with a fraction part or an exponent become `float` (binary64). Exact arithmetic is used only for integers and for suffixes.
  - It expects text that is already decoded; checking UTF-8 is left to the caller.
- Messages, comments and test file names in `scripts/` are in German, written without umlauts. Keep that as it is; do not translate or rename them as a side effect of other work.

## Working method

- Before a change, read the affected section completely in both versions, together with Appendix A.
- Do not silently interpret ambiguous requirements: record the chosen interpretation in Appendix D and state it explicitly in your answer.
- If a requirement contradicts an existing rule or one of the principles, name the contradiction instead of quietly changing one side.
- Keep specification changes and implementation changes in separate commits where possible. Commit messages name the draft number and the affected sections.
- Do not commit build output or caches (for example `__pycache__/`).

## General Conventions

- Code comments, README.md and commit messages are in English. The maintainer writes in German.
- Commit only when asked, on the current feature branch. Commit messages have a short English subject and a body that explains the change.
