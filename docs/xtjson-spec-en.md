# XTJSON

**Specification, draft 0.7** · Date: 18 November 2026

## Contents

1. [Introduction](#1-introduction)
2. [Conventions and terms](#2-conventions-and-terms)
3. [Compatibility](#3-compatibility)
4. [Encoding](#4-encoding)
5. [White space, line breaks and comments](#5-white-space-line-breaks-and-comments)
6. [Document, directives, root object and values](#6-document-directives-root-object-and-values)
7. [Objects, arrays and separators](#7-objects-arrays-and-separators)
8. [Strings](#8-strings)
9. [Numbers](#9-numbers)
10. [Mapping to JSON](#10-mapping-to-json)
11. [Conformance](#11-conformance)
12. [Strict mode](#12-strict-mode)
13. [Security considerations](#13-security-considerations)
- [Appendix A – Complete grammar (ABNF)](#appendix-a--complete-grammar-abnf)
- [Appendix B – Examples](#appendix-b--examples)
- [Appendix C – Deliberately not included](#appendix-c--deliberately-not-included)
- [Appendix D – Design decisions](#appendix-d--design-decisions)
- [References](#references)
- [Changes](#changes)

---

## 1. Introduction

XTJSON is a syntactic superset of JSON for files that are written and maintained by people, such as configuration files. XTJSON extends only the **notation**. The data model remains that of JSON: object, array, string, number, `true`, `false`, `null`.

The extensions over JSON are:

| No. | Extension | Section |
|---|---|---|
| E1 | Comments: `// …`, `/* … */` and `# …` | [5.3](#53-comments) |
| E2 | Trailing comma in objects and arrays | [7.4](#74-trailing-comma) |
| E3 | Optional braces around the object at the top level | [6.2](#62-implicit-root-object) |
| E4 | Names (keys) without quotation marks | [7.2](#72-names) |
| E5 | Line break as a separator in place of a comma | [7.3](#73-separators) |
| E6 | Strings in single quotation marks (`'…'`) | [8.1](#81-delimiters-and-characters) |
| E7 | Integers in hexadecimal, octal and binary notation | [9.2](#92-hexadecimal-octal-binary) |
| E8 | `_` for grouping digits | [9.3](#93-digit-grouping) |
| E9 | Additional escape sequences: `\v`, `\0`, `\xHH`, `\u{…}` | [8.2](#82-escape-sequences) |
| E10 | Additional white space characters: all white space characters of ECMAScript | [5.1](#51-white-space) |
| E11 | Strings across several lines, with indentation removed, and line continuation with `\` | [8.3](#83-line-breaks-in-strings) |
| E12 | `nil` as another notation for `null` | [6.3](#63-values) |
| E13 | Number suffixes (`10k`, `64mb`, `50pct`) | [9.5](#95-number-suffixes) |
| E14 | Directives at the start of the document: `%strict` and `%extends` | [6.4](#64-directives) |

Non-goals: XTJSON introduces no new data types, no expressions and no references (see [Appendix C](#appendix-c--deliberately-not-included)). XTJSON is not an interchange format between machines; for that purpose JSON or I-JSON remains the format of choice.

## 2. Conventions and terms

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED** and **MAY** are to be interpreted as described in BCP 14 [RFC2119] [RFC8174] when they appear in capitals.

The grammar is written in ABNF [RFC5234]. The rules in sections 5–9 are excerpts; [Appendix A](#appendix-a--complete-grammar-abnf) is authoritative. Note: ABNF strings in quotation marks are case-insensitive; where the case is fixed, characters are given as hexadecimal values.

| Term | Meaning |
|---|---|
| JSON text | a text that conforms to the grammar of [RFC8259] or [ECMA-404] |
| XTJSON document | a text that conforms to the rule `XTJSON-text` in Appendix A |
| item | a member of an object or a value of an array |
| name | the key of a member |
| identifier | a name without quotation marks (7.2), and a character sequence of the same form at a value position |
| white space character | one of the characters in the table in 5.1 |
| line break | U+000A, U+000D or the sequence U+000D U+000A (5.2) |
| escaped, unescaped | escaped: written as an escape sequence according to 8.2; unescaped: written as the character itself |
| line continuation | a `\` immediately before a line break in a string; it contributes nothing to the value (8.2) |
| directive | a statement at the start of the document that begins with `%`: `%strict` or `%extends` (6.4) |
| base value | the JSON value that a document with `%extends` extends (6.6) |
| resolver | a function of the application that provides the base value for the string of `%extends` (6.6) |
| predefined | fixed by this specification and not changeable |
| strict mode | the mode in which a parser additionally enforces the prohibitions of section 12 |
| JSON equivalent | the JSON text onto which an XTJSON document is mapped according to [section 10](#10-mapping-to-json) |

## 3. Compatibility

This section is normative. It states what "fully compatible" with [RFC8259] (STD 90), [ECMA-404] and [I-JSON] means.

**K1 – Syntactic superset.** Every UTF-8 encoded JSON text according to [RFC8259] and [ECMA-404] is a valid XTJSON document. The same holds for every I-JSON message according to [I-JSON].

**K2 – Preservation of meaning.** As an XTJSON document, a JSON text denotes the same value as it does as a JSON text. No extension changes the meaning of a text that is already valid JSON.

**K3 – Unchanged data model.** Every XTJSON document has a JSON equivalent ([section 10](#10-mapping-to-json)) that determines its value. `nil` and number suffixes are only other notations for JSON values. The directive `%strict` contributes nothing to the value. The value of a document with `%extends` is the result of merging it with its base value, which is itself a JSON value (6.6). A value that cannot be represented in JSON cannot be represented in XTJSON either.

**K4 – Inherited semantics.** Everything that this specification does not explicitly extend applies as in [RFC8259]: the meaning of `true`, `false` and `null`, the escape sequences of JSON, the treatment of number range and precision, the insignificance of member order, and string comparison.

**K5 – Delimitation.** An XTJSON document that uses at least one of the extensions E1–E14 is **not** a JSON text. It follows that:

- Such documents MUST NOT be labelled with the media type `application/json` or sent to recipients that expect JSON.
- An XTJSON parser is not a conforming processor in the sense of [ECMA-404], because such a processor is not to accept non-conforming input. It is, however, a permitted parser in the sense of [RFC8259] section 9, which explicitly allows parsers to accept extensions.
- Whoever generates JSON MUST adhere strictly to the JSON grammar ([RFC8259] section 10). The mapping in section 10 is the bridge.

Informative – why K1 and K2 hold: every extension occupies only notations that are a syntax error in JSON. `/`, `#`, `%`, `'` and the additional white space characters (5.1) do not occur in JSON outside strings; the additional escape sequences are invalid `\` sequences in JSON; an unescaped line break or tab in a string is invalid in JSON; a name without quotation marks, a comma before a closing bracket, a `:` after the root value, two items without a comma, and `0x`, `0o`, `0b` and `_` in numbers are invalid in JSON; so are an identifier at a value position other than `true`, `false` and `null` (and thus also `nil`), and a suffix directly after a number. The values `true`, `false` and `null` of JSON are predefined and cannot be changed, and no suffix begins with `e` or `E`, so the exponent of a JSON number is never read as a suffix. A string without a line break keeps its JSON value, because the rules of 8.3 change only strings that extend across several lines. The line break rule (E5) applies only where JSON requires a comma; everywhere else a line break remains insignificant white space.

## 4. Encoding

- An XTJSON document MUST be encoded in UTF-8 [RFC3629]. A text that is not well-formed UTF-8 is not an XTJSON document.
- U+FEFF is white space (5.1). A byte order mark at the start of the document is therefore permitted and has no meaning. Generators SHOULD nevertheless not prepend one: a document with a BOM is not a JSON text, even if it uses no other extension.
- RECOMMENDED file extensions: `.xtjson` and `.xtj`. No media type is registered.

## 5. White space, line breaks and comments

### 5.1 White space

The white space characters are exactly the characters in the following table. These are the four white space characters of JSON and, in addition, all further characters that ECMAScript 2026 [ECMA-262] treats as white space (*WhiteSpace*) or as a line terminator (*LineTerminator*). The column "Origin" gives JSON if the character is already white space there, and otherwise the ECMAScript edition since which it has been white space or a line terminator there.

| Character | Name | Origin | Line break according to 5.2 |
|---|---|---|---|
| U+0009 | tab | JSON | no |
| U+000A | line feed (LF) | JSON | **yes** |
| U+000B | vertical tab | ES1 (1997) | no |
| U+000C | form feed | ES1 (1997) | no |
| U+000D | carriage return (CR) | JSON | **yes** |
| U+0020 | space | JSON | no |
| U+00A0 | no-break space | ES3 (1999) | no |
| U+1680 | Ogham space mark | ES3 (1999) | no |
| U+2000–U+200A | typographic spaces of fixed width (en quad to hair space) | ES3 (1999) | no |
| U+2028 | line separator | ES3 (1999) | no |
| U+2029 | paragraph separator | ES3 (1999) | no |
| U+202F | narrow no-break space | ES3 (1999) | no |
| U+205F | medium mathematical space | ES3 (1999) | no |
| U+3000 | ideographic space | ES3 (1999) | no |
| U+FEFF | zero width no-break space (BOM) | ES5 (2009) | no |

- U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F and U+3000 are the characters of the Unicode category Zs (Space_Separator), which ECMAScript has treated as white space as a whole since ES3. The list in this specification is closed; it does not change if future Unicode versions change the category Zs.
- Only U+000A and U+000D are line breaks, alone or as the sequence CR LF (5.2). All other characters in the table are plain white space: they do not separate items (7.3) and do not end a line comment. In contrast to ECMAScript, this also holds for U+2028 and U+2029, which are line terminators there.
- Inside strings the tab and the line breaks (U+0009, U+000A, U+000D) may appear unescaped, unlike in JSON (8.1). The vertical tab U+000B and the form feed U+000C MUST be escaped as in JSON; all other characters in the table may appear unescaped.
- Characters that are not in the table are not white space, even if they are invisible or have the Unicode property White_Space (for example U+0085, U+180E, U+200B). Outside strings and comments they are an error.

White space and comments are permitted between any tokens. Inside a number, including its suffix, and inside an identifier they are an error (`- 1`, `10 k`, `tr ue`); inside a string they are content.

### 5.2 Line breaks

A line break (`newline`) is U+000A (LF), U+000D (CR) or the sequence U+000D U+000A (CR LF). The sequence counts as a single line break. All other white space characters from 5.1, including U+2028 and U+2029, are **not** line breaks.

Line breaks have three functions: they end a line comment (5.3), they can serve as a separator between two items ([7.3](#73-separators)), and they divide a string into lines ([8.3](#83-line-breaks-in-strings)). Everywhere else they are ordinary white space. A line break inside a block comment is part of the comment and has none of these functions.

### 5.3 Comments

```abnf
line-comment   = ( "//" / "#" ) *non-eol
block-comment  = "/*" *( non-star / ( 1*"*" non-star-slash ) ) 1*"*" "/"
eol            = [ line-comment ] newline
```

- A **line comment** begins with `//` or `#` and extends up to the next line break or to the end of the document. The line break itself is not part of the comment and keeps its function as a separator. U+2028 and U+2029 do not end a line comment.
- A **block comment** begins with `/*` and ends at the first `*/` that follows this `/*`; `/*/` is therefore not a complete comment. Block comments cannot be nested. An unterminated block comment is an error.
- Comments count as white space (`S`) and contribute no information to the value of the document.
- Inside strings, `//`, `/*` and `#` have no special meaning.
- A block comment always acts like a single space. A line break inside it does **not** count as a separator according to 7.3: `[1 /* a` ⏎ `b */ 2]` is an error.

Because `#` starts a comment, a shebang line (`#!…`) at the start of the document is valid without a special rule.

```xtjson
#!/usr/bin/env xtjson-tool
// line comment
# also a line comment
/* block comment,
   also across several lines */
{ "url": "http://example.org/#anchor" /* '#' and '//' in a string are not a comment */ }
```

## 6. Document, directives, root object and values

### 6.1 Document

```abnf
XTJSON-text  = S [ directives item-sep ] ( value / member-list ) S [ line-comment ]
```

A line comment at the end of the document does not need a final line break.

An XTJSON document begins with optional directives (6.4). They are followed either by a single value (as in JSON) or by a sequence of members (`member-list`, 7.1), the implicit root object. A document that consists only of white space, comments and directives is an error, just as an empty text is not a JSON text.

### 6.2 Implicit root object

If the document consists of a sequence of members without enclosing `{` `}`, it denotes the object that contains exactly these members. The same rules apply as inside braces: separators according to 7.3, trailing comma according to 7.4.

```xtjson
name: "demo"
port: 8080
```

is equivalent to `{"name": "demo", "port": 8080}`.

Rules:

- The implicit root object MUST contain at least one member. An empty object is written as `{}`.
- The short form exists only at the top level. Nested objects need braces.
- Mixed forms are invalid: nothing may follow a braced root value (`{a: 1} b: 2` is an error), and an implicit root object is not closed with `}`.

**Detection.** A parser decides after the first token that follows the directives: if it is a string or an identifier and the next token is a `:`, the document is an implicit root object. Otherwise a single value is read. Because a `:` never follows the root value in JSON, no JSON text is reinterpreted.

### 6.3 Values

```abnf
value        = object / array / string / number /
               %x74.72.75.65 / %x66.61.6C.73.65 /   ; true false
               %x6E.75.6C.6C / %x6E.69.6C           ; null nil
```

A value is an object or an array (section 7), a string (section 8), a number (section 9) or one of the four values `true`, `false`, `null` and `nil`. `true`, `false` and `null` have the meaning they have in JSON. `nil` is another notation for `null` and denotes the same value.

- **Fixed.** `true`, `false`, `null` and `nil` are predefined. They MUST NOT be redefined, overridden or removed, and there are no further values without quotation marks: neither the document nor the application can define values.
- **Case is significant.** The four values are written in lower case: `True`, `NULL` and `Nil` are errors.
- **No other values without quotation marks.** Every other identifier at a value position is an error (`colour: red`, `undefined`, `NaN`). A parser MUST NOT interpret it as a string or in any other way instead.
- **Name position.** At a name position `true`, `false`, `null` and `nil` are identifiers like any other and yield ordinary names (7.2): `{nil: nil}` has the name `"nil"` and the value `null`.
- **Mapping.** In the JSON equivalent, `nil` is replaced by `null` (section 10).

```xtjson
{
  middle_name: nil
  children: null
  married: false
  nil: "an ordinary name at a name position"
}
```

JSON equivalent:

```json
{
  "middle_name": null,
  "children": null,
  "married": false,
  "nil": "an ordinary name at a name position"
}
```

### 6.4 Directives

```abnf
directives   = strict-directive [ item-sep extends-directive ]
             / extends-directive [ item-sep strict-directive ]
```

A directive is a statement at the start of the document. There are exactly two directives: `%strict` (6.5) and `%extends` (6.6), for example `%strict: true, %extends: './defaults.json'`.

Rules:

- **Notation.** A directive begins with `%`, directly followed by its name in lower case; together they form a single token, and white space and comments after the `%` are an error (`% strict`). A `:` and the value follow. Before and after the `:`, white space and comments are permitted as between any tokens (5.1), line breaks included.
- **Position.** Directives are permitted only at the top level, before the root value or before the first member of the implicit root object. A directive inside an object or an array, or after the content has begun, is an error.
- **Separators.** Two directives, and the last directive and the content of the document, MUST be separated like two items according to 7.3: by a comma or by white space that contains a line break. `%strict: true [1]` is an error.
- **Order and number.** `%strict` and `%extends` can be written in either order. Each of them MUST occur at most once; a second `%strict` or `%extends` is an error, even if it states the same value.
- **No other directives.** Any other text that begins with `%` is an error (`%include: "a.xtj"`, `%Strict: true`). A parser MUST NOT know further directives or accept any from the application.

### 6.5 The directive `%strict`

```abnf
strict-directive = %x25.73.74.72.69.63.74 S ":" S
                   ( %x74.72.75.65 / %x66.61.6C.73.65 )   ; %strict: true / false
```

`%strict` states whether the document is to be read in strict mode (section 12).

```xtjson
%strict: true

name: 'demo'
port: 8080
```

JSON equivalent:

```json
{ "name": "demo", "port": 8080 }
```

Rules:

- **Value.** The value MUST be `true` or `false`. Any other value is an error (`%strict: 1`, `%strict: 'true'`, `%strict: nil`).
- **`%strict: true`.** A parser MUST read the content of the document in strict mode, even if the application has not requested it.
- **`%strict: false`.** The document does not require strict mode. If the application has requested strict mode, the document contradicts it, and a parser MUST reject it as an error.
- **Without `%strict`.** A parser reads the document in strict mode if the application requests it.
- **No effect on the value.** The JSON equivalent does not depend on `%strict`. The directive decides only whether the document is accepted.

### 6.6 The directive `%extends`

```abnf
extends-directive = %x25.65.78.74.65.6E.64.73 S ":" S string   ; %extends
```

`%extends` names a base for the document: the document extends the value of another source, its **base value**, according to the rules of JSON Merge Patch [RFC7396].

Base value, for example from a file `defaults.json`:

```json
{
  "name": "demo",
  "server": { "host": "0.0.0.0", "port": 8080, "debug": true },
  "tags": ["a", "b"]
}
```

XTJSON document:

```xtjson
%extends: './defaults.json'

server: {
  port: 8443
  debug: nil
}
tags: ['c']
```

JSON equivalent:

```json
{
  "name": "demo",
  "server": { "host": "0.0.0.0", "port": 8443 },
  "tags": ["c"]
}
```

Rules:

- **Value.** The value MUST be a string. Any other value is an error (`%extends: nil`, `%extends: ['a.json']`). The string is a reference to the source of the base value; it is not part of the value of the document.
- **Reference.** This specification does not determine how the reference is resolved. A URI reference [RFC3986] is RECOMMENDED, for example a relative path such as `'./defaults.json'` or a URL such as `'https://example.org/defaults.xtj'`; a relative reference then refers to the location of the document.
- **Resolver.** A parser obtains the base value from a resolver of the application: a function that receives the value of the string and returns the base value as a JSON value. Where the resolver reads the source and in which format the source is written is left to the application; the source need not be an XTJSON document.
- **Support.** A parser MAY support `%extends`. If it does not support it, or if the application has not given it a resolver, `%extends` is disabled, and the parser MUST reject a document with `%extends` as an error. It MUST also reject the document if the resolver reports an error or returns a value that is not a JSON value.
- **Merging.** The value of the document is MergePatch(base value, value of the content). MergePatch(target, patch) is defined as in [RFC7396]:
  1. If patch is not an object, the result is patch; target is not used.
  2. Otherwise the result is an object: a copy of target if target is an object, and an empty object otherwise. For each member of patch: if its value is `null`, a member with the same name is removed from the result; otherwise the member with this name in the result gets the value MergePatch(its previous value, or nothing, value of the member of patch).
- **Consequences.** Members of the base value that the document does not name are kept, and objects are merged member by member at any depth. Arrays, strings, numbers, `true` and `false` replace a value of the base value as a whole; arrays are not merged. A member whose value is `null` or `nil` removes the member with the same name, so a member with the value `null` cannot be set in a document with `%extends`. Duplicate names in the content are resolved before merging (7.2).
- **Strict mode.** In strict mode the prohibitions on names, string values and the root value also apply to the result (section 12).
- **Nested bases.** The base value can itself be the value of a document with `%extends`; resolving it is the task of the resolver (section 13).

## 7. Objects, arrays and separators

### 7.1 Structure

```abnf
object       = "{" S [ member-list S ] "}"
member-list  = member *( item-sep member ) [ S "," ]
member       = name S ":" S value

array        = "[" S [ value-list S ] "]"
value-list   = value *( item-sep value ) [ S "," ]
```

### 7.2 Names

```abnf
name         = string / name-start *( name-start / DIGIT )
name-start   = ALPHA / "_" / "$" / %xB5 /                 ; letters of
               %xC0-D6 / %xD8-F6 / %xF8-FF                ; Latin-1 Supplement
```

- A name is a string (section 8) or an identifier, a name without quotation marks. Like every other string, a name in quotation marks may extend across several lines; its value is determined according to 8.3.
- An identifier begins with an ASCII letter, `_`, `$` or a letter of the block Latin-1 Supplement: U+00B5 (micro sign), U+00C0 to U+00D6, U+00D8 to U+00F6 and U+00F8 to U+00FF. After that, ASCII digits are permitted as well. ECMAScript also permits these letters in identifiers [ECMA-262]; the ordinal indicators U+00AA and U+00BA and the middle dot U+00B7, which ECMAScript permits as well, are not permitted.
- As a name an identifier stands for exactly the character sequence as written; there are no escape sequences in identifiers, and names are not normalized: `é` written as U+00E9 and as `e` followed by U+0301 are different names, and the second can only be written in quotation marks.
- Every other name MUST be in quotation marks: names with spaces, hyphens, dots or other characters (for example `€`, `×`, `π` or combining characters), names that begin with a digit, and the empty name.
- `true`, `false`, `null` and `nil` (6.3) are permitted as identifiers at a name position and yield ordinary names there (`"true"`, `"nil"`). A value never appears at a name position, so this is unambiguous.
- At a value position only `true`, `false`, `null` and `nil` are permitted without quotation marks (6.3). There are no freely chosen values without quotation marks: `colour: red` is an error.
- The notation is irrelevant to the identity of a name: `a`, `"a"`, `'a'` and `"\u0061"` denote the same name.

```xtjson
{
  $schema: "https://example.org/schema.json",
  max_age: 3600,
  "max-age": 3600,
  diameter_µm: 180,
  outdoor_café: true,
  _internal: true,
  "with spaces": 1,
  "2fa": false
}
```

**Duplicate names.** As in [RFC8259], the names within an object SHOULD be unique. If a name occurs more than once in an object, the member with this name that comes last in the document applies; the earlier ones are discarded. This also holds for the implicit root object. A parser MUST behave in this way and SHOULD point out duplicate names. In strict mode duplicate names are forbidden ([section 12](#12-strict-mode)).

### 7.3 Separators

```abnf
item-sep     = ( S "," S ) / S-nl
```

Two consecutive items of an object, an array or the implicit root object MUST be separated by

1. exactly one comma (with any white space before and after it), **or**
2. white space that contains at least one line break (LF, CR or CR LF, see 5.2) outside block comments (`S-nl`).

Both together – comma and line break – is case 1 and therefore valid. Two items on the same line without a comma are an error.

```xtjson
{
  matrix: [
    1, 2, 3
    4, 5, 6
  ]
  active: true
  name: "x", alias: "y"
}
```

Clarifications:

- Several line breaks, empty lines and comments between two items are a single separator.
- Not separators are: a line break inside a block comment, and all white space characters that are not a line break according to 5.2, in particular U+2028 and U+2029. If only such characters or block comments stand between two items, that is an error.
- Two commas in a row (`[1,,2]`) and a leading comma (`[,1]`) are errors. There are no "empty" items.
- A line break separates only **complete** items. Between a name and `:` and between `:` and the value it remains insignificant white space, as in JSON.
- XTJSON has no expressions. `[1` ⏎ `-2]` is therefore unambiguously an array with the two items `1` and `-2`.

### 7.4 Trailing comma

After the last item of an object, an array or the implicit root object there MAY be exactly one comma. It has no meaning. A comma without a preceding item is an error (`[,]`, `{,}`).

```xtjson
{
  list: [1, 2, 3,],
  empty: [],
}
```

## 8. Strings

### 8.1 Delimiters and characters

```abnf
string        = DQUOTE *( unescaped / SQUOTE / escape-seq ) DQUOTE
              / SQUOTE *( unescaped / DQUOTE / escape-seq ) SQUOTE
unescaped     = %x09 / newline / %x20-21 / %x23-26 / %x28-5B / %x5D-10FFFF
                                             ; without " ' \ and without control
                                             ; characters other than HT and line breaks
```

- A string is enclosed in double (`"`) or in single (`'`) quotation marks. Both forms are equivalent and permitted wherever a string may appear, including as a name.
- It ends at the first unescaped occurrence of the character with which it began.
- In a `"` string, `'` may appear unescaped; in a `'` string, `"` may appear unescaped. The respective delimiter MUST be escaped (`\"` or `\'`).
- A string may extend across several lines: line breaks according to 5.2 and the tab U+0009 may appear unescaped. The backslash and all other control characters (U+0000 to U+0008, U+000B, U+000C, U+000E to U+001F) MUST be escaped as in JSON.
- All other characters may appear unescaped as in JSON, including U+007F, U+2028, U+2029 and the non-ASCII white space characters from 5.1.
- The character sequences `//`, `/*` and `#` have no special meaning in a string, and a line break in a string is not a separator according to 7.3.
- The value of a string is determined according to 8.3. For a string without a line break it is, as in JSON, the sequence of its characters after the escape sequences (8.2) have been resolved.

### 8.2 Escape sequences

```abnf
escape-seq     = %x5C ( %x22 / %x27 / %x5C / %x2F /  ; " ' \ /
                        %x62 / %x66 / %x6E / %x72 /  ; b f n r
                        %x74 / %x76 /                ; t v
                        %x30 /                       ; \0, not before a DIGIT
                        %x78 2HEXDIG /               ; \xHH
                        %x75 4HEXDIG /               ; \uXXXX
                        %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}" /
                                                     ; \u{…}, at most 10FFFF, not D800-DFFF
                        newline )                    ; line continuation
```

XTJSON has all escape sequences of JSON and, in addition, six more from ECMAScript [ECMA-262]: `\'`, `\v`, `\0`, `\xHH`, `\u{…}` and the line continuation, a `\` before a line break. All of them apply in both string forms. The column "Origin" gives JSON if the sequence already applies there, and otherwise the ECMAScript edition that introduced it.

| Sequence | Result | Origin |
|---|---|---|
| `\"` | U+0022 quotation mark | JSON |
| `\\` | U+005C backslash | JSON |
| `\/` | U+002F slash | JSON |
| `\b` | U+0008 backspace | JSON |
| `\f` | U+000C form feed | JSON |
| `\n` | U+000A line feed | JSON |
| `\r` | U+000D carriage return | JSON |
| `\t` | U+0009 tab | JSON |
| `\uXXXX` | UTF-16 code unit XXXX (four hexadecimal digits) | JSON |
| `\'` | U+0027 apostrophe | ES1 (1997) |
| `\xHH` | U+00HH (two hexadecimal digits) | ES1 (1997) |
| `\v` | U+000B vertical tab | ES3 (1999) |
| `\0` | U+0000 null | ES3 (1999) |
| `\` before a line break | nothing (line continuation) | ES5 (2009) |
| `\u{…}` | code point U+0000 to U+10FFFF (one or more hexadecimal digits) | ES2015 (ES6) |

Rules:

- **`\xHH` and `\uXXXX`** require exactly two and exactly four hexadecimal digits respectively, in upper or lower case. The letters `x` and `u` themselves are lower case. `\xHH` stands for the code point U+00HH, not for a byte. Characters outside the BMP are written either with `\u{…}` or, as in JSON, as a surrogate pair of two `\uXXXX` sequences.
- **`\u{…}`** contains at least one hexadecimal digit between the braces, in upper or lower case; leading zeros are permitted, `_` and white space are not. The value MUST NOT be greater than 10FFFF. The sequence stands for exactly this code point: `\u{1F600}` is equivalent to the surrogate pair `\uD83D\uDE00`, `\u{e4}` to `\u00E4`. A value in the surrogate range (D800 to DFFF) is an error; a single surrogate can only be written with `\uXXXX`, as in JSON.
- **`\0`** MUST NOT be followed immediately by a decimal digit. `\1` to `\9` are errors. There are thus no octal escape sequences.
- **Line continuation.** A `\` that is followed immediately by a line break (LF, CR or CR LF, see 5.2) contributes nothing to the value: neither the backslash nor the line break appears in it. The line break MUST follow the `\` immediately; a space or tab after the `\` is an error. Unlike in ECMAScript, U+2028 and U+2029 are not line breaks here either. How a line continuation affects the indentation of the following line is determined by 8.3.
- **Every other sequence with `\` is an error.** This holds in particular for `\` before any other character (`\a`, `\-`, `\N`, `\X41`) and for `\` before a space or tab.

```xtjson
[
  'single',
  "double",
  'He said "hello"',
  "He said \"hello\"",
  'It\'s',
  "It's",
  'Line 1\nLine 2 \u00e4',
  "\x41\v\0",
  "\u{1F600} \u{e4} \u{000041}"
]
```

### 8.3 Line breaks in strings

A string that contains a line break extends across several lines. Its value is then not simply the sequence of its characters: white space at the end of lines is removed, and indentation can be removed. Line continuations (8.2) join lines without a line break.

In this section, "white space" means only unescaped spaces (U+0020) and tabs (U+0009). All other white space characters from 5.1 are ordinary text here. The value of a string is obtained in four steps:

1. **Form lines.** The text between the delimiters is split into lines at every line break according to 5.2, including the line break of a line continuation. The first line begins after the opening delimiter, the last one ends before the closing delimiter. A text without a line break consists of a single line. Escape sequences such as `\n` are not line breaks in this sense. The `\` of a line continuation remains at the end of its line until step 4.
2. **Remove white space at the end of lines.** From every line except the last, the white space at its end is removed. This always happens. A line that ends with the `\` of a line continuation has no white space at its end; white space before the `\` is kept. The last line remains unchanged, because it does not end at a line end but at the closing delimiter.
3. **Remove indentation.** This step applies only if the string begins with an empty line, that is: if there are at least two lines and the first one is empty after step 2. A line that contains the `\` of a line continuation is not empty.
   1. The first line is dropped.
   2. The indentation of a line is the sequence of white space characters at its beginning; its length is the number of these characters. A tab counts as one character.
   3. The smallest indentation of all non-empty lines is determined. The last line always counts, even if it is empty or consists only of white space.
   4. From every line, as many characters are removed at the beginning as the smallest indentation indicates. Empty lines remain empty. The removed characters MUST be the same in all lines from which characters are removed; otherwise the string is an error, for example if one line is indented with a tab and another with spaces.
4. **Join.** The lines are joined with one U+000A each, regardless of whether the line break is written in the file as LF, CR or CR LF. After that the escape sequences are resolved; a line continuation thereby removes its `\` together with the following U+000A.

Consequences of these rules:

- A string without a line break is not changed by steps 1 to 3. Its value is the same as in JSON.
- If nothing or only white space follows the opening delimiter up to the line break, this white space and the line break are not part of the value. A line break before the closing delimiter is part of the value, unless it is written as a line continuation.
- The position of the closing delimiter helps determine how much indentation is removed: if it is as far left as the text, the common indentation disappears entirely; if it is further left, the difference is kept; if it is at the start of the line, nothing is removed; if it is further right, the excess white space before it remains at the end of the value.
- If the text begins on the line of the opening delimiter, no indentation is removed. This also holds if the first line consists only of the `\` of a line continuation.
- A line continuation joins two lines. The indentation of the following line is removed in step 3 like that of every other line; white space before the `\` is kept.
- White space that is to be kept at the end or at the beginning of a line is written as an escape sequence, for example `\x20` or `\t`.
- Empty lines within the text are kept as empty lines and do not affect the indentation.

In the following table `·` stands for a space and `⏎` for a line break. The right-hand column shows the value as a JSON string.

| Written | Value | Explanation |
|---|---|---|
| `"⏎··a⏎··b⏎··"` | `"a\nb\n"` | common indentation of 2 removed |
| `"⏎····a⏎··"` | `"  a\n"` | the closing delimiter is further left |
| `"⏎··a⏎"` | `"  a\n"` | the closing delimiter is at the start of the line |
| `"⏎··a⏎····"` | `"a\n  "` | the closing delimiter is further right |
| `"⏎··a⏎⏎··b"` | `"a\n\nb"` | the empty line does not count |
| `"a··⏎··b"` | `"a\n  b"` | does not begin with an empty line: only the line end is cleaned |
| `"⏎a··⏎b\x20⏎"` | `"a\nb \n"` | escaped white space at the end of a line is kept |
| `"a··"` | `"a  "` | no line end, nothing removed |
| `"⏎··a·\⏎··b⏎··"` | `"a b\n"` | line continuation: the space before `\` is kept, the indentation of the next line is removed |
| `"⏎··a\⏎··"` | `"a"` | line continuation before the closing delimiter: no line break at the end |
| `"a\⏎··b"` | `"a  b"` | does not begin with an empty line: no indentation is removed |
| `"\⏎··a"` | `"  a"` | the first line contains `\` and is not empty |

```xtjson
{
  sql: "
    SELECT name
      FROM customers
     WHERE city = 'Köln'
    "
  note: '
      Two characters of indentation remain,
      because the closing delimiter is further left.
    '
  direct: "The text begins on the line of the delimiter:
    no indentation is removed here."
  long_line: "
    A long line can be written across \
    several lines with line continuations.\
    "
}
```

JSON equivalent:

```json
{
  "sql": "SELECT name\n  FROM customers\n WHERE city = 'Köln'\n",
  "note": "  Two characters of indentation remain,\n  because the closing delimiter is further left.\n",
  "direct": "The text begins on the line of the delimiter:\n    no indentation is removed here.",
  "long_line": "A long line can be written across several lines with line continuations."
}
```

## 9. Numbers

```abnf
number   = [ minus ] ( ( radix-int / decimal ) [ suffix ]
                     / ( radix-int / int ) %x6E )   ; n only after an integer (9.5)
```

### 9.1 Decimal numbers

```abnf
decimal  = int [ frac ] [ exp ]
int      = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac     = "." digits
exp      = e [ minus / plus ] digits
digits   = DIGIT *( [ "_" ] DIGIT )
```

Without `_` and without a suffix this is exactly the number grammar of JSON. In particular the following remain invalid: leading zeros (`0755`), a leading `+`, a missing integer or fraction part (`.5`, `5.`). `Infinity` and `NaN` are not numbers; at a value position they are an error (6.3).

### 9.2 Hexadecimal, octal, binary

```abnf
radix-int = zero ( ( %x78 / %x58 ) HEXDIG *( [ "_" ] HEXDIG )       ; 0x 0X
                 / ( %x6F / %x4F ) %x30-37 *( [ "_" ] %x30-37 )     ; 0o 0O
                 / ( %x62 / %x42 ) BIT *( [ "_" ] BIT ) )           ; 0b 0B
```

| Form | Prefix | Digits | Example | Value |
|---|---|---|---|---|
| hexadecimal | `0x` or `0X` | `0`–`9`, `a`–`f`, `A`–`F` | `0xFF` | 255 |
| octal | `0o` or `0O` | `0`–`7` | `0o755` | 493 |
| binary | `0b` or `0B` | `0`, `1` | `0b1010` | 10 |

- Case is irrelevant both in the prefix and in the hexadecimal digits: `0xff`, `0XFF` and `0xFf` are the same value. Because `0O` is easily confused with `00`, lower case is RECOMMENDED.
- At least one digit MUST follow the prefix. Leading zeros after the prefix are permitted (`0x00FF`).
- No suffix begins with `x`, `X`, `o`, `O`, `b` or `B` (9.5). A prefix without a digit such as `0x` is therefore always an error and never the number `0` with a suffix.
- These forms denote **integers** only. There is no fraction part and no exponent; in `0x1e3`, `e` is a hexadecimal digit (value 483).
- A preceding `-` is permitted: `-0x10` has the value −16.
- The value is the mathematical integer that the digit sequence represents in the respective base. It is indistinguishable from the equivalent decimal number: `0xFF`, `0o377`, `0b1111_1111` and `255` are the same value.
- A notation such as `0755` is **not** read as an octal number; it remains an error.

### 9.3 Digit grouping

- Between two digits there MAY be exactly one `_`. It has no meaning and is discarded when reading.
- This applies to all digit sequences: integer part, fraction part, exponent, and the digits after `0x`, `0o`, `0b`.
- A `_` at the beginning or end of a digit sequence, two `_` in a row, and a `_` next to a prefix, a sign, `.` or `e`/`E` are errors.

```xtjson
[
  1_000_000,
  3.141_592_653,
  6.022_140_76e23,
  1e1_0,
  0xDEAD_BEEF,
  0o7_5_5,
  0b1010_0101,
  -0x10
]
```

### 9.4 Range and precision

Like [RFC8259] and [ECMA-404], XTJSON does not prescribe a number type; implementations may limit range and precision. For interoperability the same applies as there:

- Numbers SHOULD stay within the magnitude and precision of IEEE 754 binary64.
- Integers in the range [−(2⁵³)+1, (2⁵³)−1] are exactly interoperable.
- Hexadecimal, octal and binary numbers often stand for bit masks in which every digit matters. If an implementation cannot represent such a number exactly, it MUST report an error; it MUST NOT round.
- The result of a number with a suffix (9.5) is subject to the same recommendations as any other number.

### 9.5 Number suffixes

```abnf
suffix      = %x6B / %x6B.62 / %x6D /     ; k kb m
              %x6D.62 / %x6D.73 /         ; mb ms
              %x6D.69.6E / %x73 / %x68 /  ; min s h
              %x70.63.74                  ; pct
```

A suffix may be appended to a number. The suffix stands for a conversion: it is applied to the value of the number including the sign and yields a number. In the JSON equivalent, the result appears in place of the number with the suffix. All suffixes are predefined; the rules `suffix` and `number` (for `n`) and the table in this section list them completely.

**Notation**

- The suffix follows the last digit immediately. White space, comments and `_` between the number and the suffix are an error.
- Every suffix has exactly one notation, in lower case letters. Case is significant: `10K`, `64MB` and `5Min` are errors.
- The longest match applies: `10kb` carries the suffix `kb`, not `k` followed by `b`; likewise `10mb`, `10ms` and `10min` carry the suffixes `mb`, `ms` and `min`, not `m`.
- The suffix ends the number. A letter, digit, `_` or `$` immediately after it does not belong to it but begins a new token, which needs a separator according to 7.3. `10kbs`, `10k5` and `10mi` are therefore errors, and so is `10_k`, because a `_` after a digit is digit grouping (9.3).
- `n` is permitted only after an integer, that is after a decimal number without fraction part and exponent or after a hexadecimal, octal or binary number (`10n`, `-3n`, `0xFFn`). `1.5n`, `1.0n` and `1e3n` are errors.
- All other suffixes are permitted on all number forms, including after an exponent and on hexadecimal, octal and binary numbers: `1e3k`, `0x10kb`.

**Overview of the suffixes**

| Suffix | Conversion | Example | Result |
|---|---|---|---|
| `k` | number times 1000 | `10k` | `10000` |
| `kb` | number times 1024 | `4kb` | `4096` |
| `m` | number times 1000000 | `2m` | `2000000` |
| `mb` | number times 1048576 | `64mb` | `67108864` |
| `ms` | number divided by 1000 | `100ms` | `0.1` |
| `s` | none; the value remains unchanged | `30s` | `30` |
| `min` | number times 60 | `5min` | `300` |
| `h` | number times 3600 | `2h` | `7200` |
| `pct` | number divided by 100 | `50pct` | `0.5` |
| `n` | none; the value remains unchanged; only after an integer | `10n` | `10` |

- The table is exhaustive. Any other notation after a number is an error (`10q`, `10K`, `12px`).
- The suffixes MUST NOT be redefined, overridden or removed. A parser MUST NOT know further suffixes or accept any from the application.
- The result is the exact product or the exact quotient. In the JSON equivalent its decimal representation appears: `1.5k` yields `1500`, `0.5kb` yields `512`, `0.1kb` yields `102.4`, `-2k` yields `-2000`, `2.5m` yields `2500000`, `0x10kb` yields `16384`, `1.5h` yields `5400`, `1ms` yields `0.001`, `12.5pct` yields `0.125`.
- For `s` and `n` the result is the value of the number itself: `30s` and `30` denote the same value. The suffix contributes no information to the value of the document.
- `ms`, `s`, `min` and `h` convert a time into seconds.
- The result is always a number. A suffix cannot produce a string or any other data type.

Example:

```xtjson
{
  timeout: 30s
  interval: 5min
  lifetime: 12h
  delay: 250ms
  cache: 64mb
  block: 0x10kb
  half: 0.5k
  ratio: 50pct
  surcharge: 110pct
  budget: 2.5m
  counter: 100n
}
```

JSON equivalent:

```json
{
  "timeout": 30,
  "interval": 300,
  "lifetime": 43200,
  "delay": 0.25,
  "cache": 67108864,
  "block": 16384,
  "half": 500,
  "ratio": 0.5,
  "surcharge": 1.1,
  "budget": 2500000,
  "counter": 100
}
```

## 10. Mapping to JSON

The **JSON equivalent** of an XTJSON document is obtained by the following steps. They also define the meaning of every XTJSON document.

1. **Comments** are removed. **White space characters** that JSON does not have are replaced by a space (U+0020).
2. **Implicit root object:** the members are enclosed in `{` `}`.
3. **Separators:** between any two consecutive items there is exactly one comma. Trailing commas are dropped.
4. **Names:** an identifier at a name position becomes the JSON string with the same character sequence.
5. **Strings:** a `'` string becomes the `"` string with the same content; unescaped `"` become `\"`. Escape sequences that JSON does not have are replaced in both string forms: `\'` by `'`, `\v` by `\u000B`, `\0` by `\u0000`, `\xHH` by `\u00HH`, `\u{…}` by the `\uXXXX` sequence of the same code point, above U+FFFF by the corresponding surrogate pair. A string with a line break becomes the `"` string that represents its value according to 8.3; line continuations are thereby dropped, and characters that may not appear unescaped in a JSON string (`"`, `\` and control characters such as line break and tab) are escaped.
6. **Numbers:** all `_` are removed from decimal numbers; otherwise the notation remains unchanged. Hexadecimal, octal and binary numbers become the decimal integer of the same value, with a leading minus sign if preceded by `-`. A number with a suffix is replaced by the result of the conversion, written as a JSON number (9.5).
7. **`true`, `false`, `null` and `nil`:** the first three remain unchanged; `nil` is replaced by `null` (6.3).
8. **Directives** are removed, each together with the separator that follows it (6.4).
9. **Base value:** if the document contains `%extends`, the JSON text obtained so far is applied as a merge patch to the base value (6.6); the JSON equivalent is the JSON text of the result.

The JSON equivalent is unique up to white space and the choice of equivalent escape sequences; for a document with `%extends` this holds for a given base value. If it contains an object with duplicate names, the rule from 7.2 applies to its value: the last member applies. Two XTJSON documents are **equivalent** if their JSON equivalents denote the same value. A document that is already a JSON text is its own JSON equivalent (up to white space).

An example with a side-by-side comparison is given in [Appendix B.1](#b1-complete-example).

## 11. Conformance

**Document.** A text is a conforming XTJSON document if it is encoded according to section 4, conforms to the rule `XTJSON-text` and, if it contains `%strict: true`, it satisfies the prohibitions of section 12. A conforming document without `%extends` is **portable**: its value depends only on its text and on this specification, and every conforming parser can read it, unless a limit or a restriction of the application applies (section 11). The value of a document with `%extends` also depends on its base value, and only a parser with a resolver can read it (6.6).

**Parser.** A conforming XTJSON parser

- MUST accept every conforming XTJSON document and deliver the value of its JSON equivalent – and thus also every JSON text and every I-JSON message – unless a limit or restriction according to the fourth item applies or the document contains `%extends` and `%extends` is disabled (6.6);
- MUST reject as an error every text that is not a conforming XTJSON document, in particular one with an identifier other than `true`, `false`, `null` and `nil` at a value position or an unknown directive, and MUST NOT silently accept any further syntax extensions;
- MUST know the values `true`, `false`, `null` and `nil` (6.3), the directives from 6.4 and all suffixes from 9.5. It MUST NOT allow them to be redefined, and MUST NOT accept values, directives or suffixes from the application;
- MAY set limits on document size, nesting depth, number range and precision, and string length, and enforce semantic restrictions (for example strict mode according to section 12);
- MUST offer strict mode according to section 12 to the application, and MUST read a document with `%strict: true` in strict mode (6.5);
- MAY support `%extends` with a resolver of the application (6.6).

**Generator.** An XTJSON generator MUST output conforming XTJSON documents. Every JSON generator that outputs UTF-8 is therefore also an XTJSON generator. If the recipient is a program, JSON SHOULD be output.

**Converter.** A converter from XTJSON to JSON MUST produce the JSON equivalent according to section 10; for a document with `%extends` it needs the base value (6.6). Its output MUST conform strictly to the grammar of [RFC8259].

## 12. Strict mode

In **strict mode** a parser enforces the following prohibitions beyond sections 4–9. Strict mode applies if the application requests it or if the document contains `%strict: true` (6.5). The prohibitions apply to the content of the document, the part after the directives. For a document with `%extends` the prohibitions on names, string values and the root value also apply to the result of merging it with its base value (6.6).

- Names and string values MUST NOT contain surrogates or Unicode noncharacters, neither directly nor as an escape sequence. A single `"\uDEAD"` is invalid; a correct surrogate pair is permitted.
- An object MUST NOT contain duplicate names. The comparison is made after all escape sequences have been resolved and independently of the notation of the name (identifier or string in one of the forms from section 8).
- The root value MUST be an object or an array. The implicit root object satisfies this rule.

A parser in strict mode MUST reject documents that violate one of these prohibitions.

Numbers SHOULD NOT exceed the magnitude or precision of IEEE 754 binary64. For integers outside [−(2⁵³)+1, (2⁵³)−1] exact processing must not be expected; this also applies to hexadecimal, octal and binary notation. Such values are better transmitted as strings. A parser can enforce this with a limit on the number range (section 11).

**Relation to I-JSON.** If a document satisfies the prohibitions and the recommendation on numbers, its JSON equivalent is an I-JSON message according to [I-JSON]. Strict mode goes beyond I-JSON only for the root value, which I-JSON only recommends to be an object or an array.

The recommendations of [I-JSON] for protocols also apply unchanged to XTJSON documents: ignore unknown members, write times as strings according to RFC 3339, write binary data as base64url strings.

## 13. Security considerations

- **No `eval`.** XTJSON is not a subset of JavaScript or of any other programming language and MUST NOT be read by evaluating it as program code.
- **Resource limits.** Deeply nested structures, very long strings or numbers, and unterminated block comments and strings can overload parsers. Parsers SHOULD set limits (section 11).
- **Divergent interpretation.** If two components process the same document differently, checks can be bypassed. This concerns above all duplicate names, which other JSON tools may treat differently from what 7.2 specifies, numbers outside the exact range, and documents with `%extends`, whose value depends on the resolver. Where a document controls security-relevant decisions, strict mode (section 12) is RECOMMENDED.
- **No definitions.** The values without quotation marks, the directives and the conversions of the suffixes are fixed by this specification alone; neither the document nor the application can define values. The meaning of a document without `%extends` therefore does not depend on the configuration of the parser, and a document can bring along no code.
- **`%extends`.** A document with `%extends` makes the parser call the resolver of the application with a string from the document. A document from an untrusted source can thereby cause local files to be read or network requests to be made, for example with `'/etc/passwd'`, `'file:///…'` or the address of a service in an internal network, and their content becomes part of the value. Resolvers SHOULD resolve only sources that the application permits, SHOULD detect cycles when a base value itself comes from a document with `%extends`, and SHOULD limit the number and the size of the sources. Where documents come from untrusted sources, `%extends` SHOULD be disabled or the resolver restricted accordingly.
- **Similar characters in names.** Identifiers may contain letters of the block Latin-1 Supplement. Some of them resemble other characters, for example U+00B5 (micro sign) and U+03BC (Greek small letter mu), and names are compared code point by code point without normalization (7.2). Tools SHOULD point out names that differ only in such characters.
- **Confusion with JSON.** An XTJSON document that is passed off as JSON leads to errors with strict recipients and to inconsistent behaviour with lenient ones. Hence the delimitation in K5.
- **Comments.** Comments are lost in the mapping to JSON and are not seen by programs. Invisible characters and characters that control text direction in comments and strings can make the displayed text differ from the processed text; tools SHOULD point this out.
- **U+2028 and U+2029.** Some editors display these characters as a line change. In XTJSON they neither end a line comment nor separate items. Text that is displayed below a line comment can therefore still belong to the comment and is then not processed. Tools SHOULD make these characters visible outside strings or warn about them.
- **Strings across several lines.** White space at the end of lines and, where applicable, the indentation are not part of the value (8.3). The value can therefore differ from what is seen. Where every character matters, for example in key material or signed texts, white space is better written as an escape sequence.
- **Missing closing quotation mark.** Because a string may extend across several lines, a forgotten closing quotation mark does not end the string at the end of the line: the following lines become part of the string up to the next matching quotation mark. The error is then reported far from its cause, and in rare cases the document remains valid with a different value. Tools SHOULD make the extent of strings across several lines visible.

---

## Appendix A – Complete grammar (ABNF)

Normative. The core rules `ALPHA`, `DIGIT`, `HEXDIG`, `BIT` and `DQUOTE` come from [RFC5234]; because of the case-insensitivity rule, `HEXDIG` there also includes `a`–`f`.

```abnf
; ---------- Document ----------
XTJSON-text    = S [ directives item-sep ] ( value / member-list ) S [ line-comment ]
                                             ; member-list: implicit root object

; ---------- Directives ----------
directives     = strict-directive [ item-sep extends-directive ]
               / extends-directive [ item-sep strict-directive ]
strict-directive  = %x25.73.74.72.69.63.74 S ":" S
                    ( %x74.72.75.65 / %x66.61.6C.73.65 )   ; %strict: true / false
extends-directive = %x25.65.78.74.65.6E.64.73 S ":" S string   ; %extends

; ---------- Values ----------
value          = object / array / string / number /
                 %x74.72.75.65 / %x66.61.6C.73.65 /  ; true false
                 %x6E.75.6C.6C / %x6E.69.6C          ; null nil (the same value)

; ---------- Objects ----------
object         = "{" S [ member-list S ] "}"
member-list    = member *( item-sep member ) [ S "," ]
member         = name S ":" S value
name           = string / name-start *( name-start / DIGIT )
name-start     = ALPHA / "_" / "$" / %xB5 /                 ; letters of
                 %xC0-D6 / %xD8-F6 / %xF8-FF                ; Latin-1 Supplement

; ---------- Arrays ----------
array          = "[" S [ value-list S ] "]"
value-list     = value *( item-sep value ) [ S "," ]

; ---------- Separators ----------
item-sep       = ( S "," S ) / S-nl

; ---------- White space and comments ----------
S              = *( blank / block-comment / eol )
S-nl           = *( blank / block-comment ) eol S
eol            = [ line-comment ] newline
blank          = %x09 / %x0B / %x0C /                ; HT, VT, FF
                 %x20 / %xA0 / %x1680 /              ; category Zs:
                 %x2000-200A / %x202F /              ;   SP, NBSP and the
                 %x205F / %x3000 /                   ;   other spaces
                 %x2028 / %x2029 /                   ; LS, PS
                 %xFEFF                              ; ZWNBSP (BOM)
newline        = %x0D.0A / %x0A / %x0D       ; CR LF, LF or CR
line-comment   = ( "//" / "#" ) *non-eol
block-comment  = "/*" *( non-star / ( 1*"*" non-star-slash ) ) 1*"*" "/"
non-eol        = %x00-09 / %x0B-0C / %x0E-10FFFF   ; everything except LF and CR
non-star       = %x00-29 / %x2B-10FFFF
non-star-slash = %x00-29 / %x2B-2E / %x30-10FFFF

; ---------- Strings ----------
string         = DQUOTE *( unescaped / SQUOTE / escape-seq ) DQUOTE
               / SQUOTE *( unescaped / DQUOTE / escape-seq ) SQUOTE
unescaped      = %x09 / newline / %x20-21 / %x23-26 / %x28-5B / %x5D-10FFFF
                                             ; without " ' \ and without control
                                             ; characters other than HT and line breaks
escape-seq     = %x5C ( %x22 / %x27 / %x5C / %x2F /  ; " ' \ /
                        %x62 / %x66 / %x6E / %x72 /  ; b f n r
                        %x74 / %x76 /                ; t v
                        %x30 /                       ; \0, not before a DIGIT
                        %x78 2HEXDIG /               ; \xHH
                        %x75 4HEXDIG /               ; \uXXXX
                        %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}" /
                                                     ; \u{…}, at most 10FFFF, not D800-DFFF
                        newline )                    ; line continuation
SQUOTE         = %x27                        ; '

; ---------- Numbers ----------
number         = [ minus ] ( ( radix-int / decimal ) [ suffix ]
                           / ( radix-int / int ) %x6E )  ; n only after an integer (9.5)
suffix         = %x6B / %x6B.62 / %x6D /     ; k kb m
                 %x6D.62 / %x6D.73 /         ; mb ms
                 %x6D.69.6E / %x73 / %x68 /  ; min s h
                 %x70.63.74                  ; pct
decimal        = int [ frac ] [ exp ]
int            = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac           = "." digits
exp            = e [ minus / plus ] digits
digits         = DIGIT *( [ "_" ] DIGIT )
radix-int      = zero ( ( %x78 / %x58 ) HEXDIG *( [ "_" ] HEXDIG )       ; 0x 0X
                      / ( %x6F / %x4F ) %x30-37 *( [ "_" ] %x30-37 )     ; 0o 0O
                      / ( %x62 / %x42 ) BIT *( [ "_" ] BIT ) )           ; 0b 0B
digit1-9       = %x31-39
zero           = %x30
minus          = %x2D
plus           = %x2B
e              = %x65 / %x45                 ; e E
```

Notes on tokenization (informative):

- The longest match applies. `0x1e3` is a single hexadecimal number, and `10min` is the number `10` with the suffix `min`.
- Two conditions apply in addition to the grammar: no decimal digit follows the escape sequence `\0`, and the value of `\u{…}` is not in the range D800 to DFFF.
- Two values always need a separator according to 7.3. Character sequences such as `0755`, `1_`, `0b102`, `123abc`, `10_k`, `10kbs` or `1.5n` can therefore never be read as a valid sequence of several tokens and are errors.
- An identifier is read with the longest match. At a value position it must be `true`, `false`, `null` or `nil`: `nullable` and `nil2` are errors, not one of these values followed by further characters.
- `%strict` and `%extends` are single tokens; white space after the `%` is an error.
- A line comment always extends to the next line break: `eol` requires a `newline` after it, and `non-eol` excludes only U+000A and U+000D. Only at the end of the document may the line break be missing.
- The sequence CR LF is always a single `newline`, never two.
- For strings the grammar describes only the notation. Their value results from the steps in 8.3.
- Three quotation marks in a row (`"""` or `'''`) do not delimit a string: they are an empty string followed directly by the start of another string, and therefore always an error (7.3).
- Apart from the current character, a parser needs only the information "since the last token a line break has occurred outside a block comment". Only at the start of the content (6.2) is one further token of lookahead needed.

## Appendix B – Examples

### B.1 Complete example

XTJSON document:

```xtjson
# Service configuration – the root braces are omitted
%strict: true

name: 'demo-service'
version: "1.4.0"
$schema: "https://example.org/schema/service.json"

listen: {
  host: "0.0.0.0"
  port: 8080            // the line break replaces the comma
  proxy: nil            // nil is the same as null
  tls: false,           // commas remain permitted
}

/* Numbers in other bases
   and with digit grouping */
limits: {
  max_body_bytes: 10_485_760
  file_mode: 0o644
  feature_mask: 0b1010_0101
  magic: 0xDEAD_BEEF
  cache_bytes: 64mb     // suffix: times 1048576
  rate_limit: 5k        // suffix: times 1000
  idle_timeout: 5min    // suffix: times 60
  "retry-after": 30     // a name with a hyphen needs quotation marks
  banner: 'Welcome to demo-service\x21'
}

// string across several lines: the common indentation is not part of the value
motd: "
  Welcome.
  Maintenance: Sundays 02:00.
  "

tags: [
  'internal'
  "says \"hello\""
  'says "hello"',
]
```

JSON equivalent:

```json
{
  "name": "demo-service",
  "version": "1.4.0",
  "$schema": "https://example.org/schema/service.json",
  "listen": { "host": "0.0.0.0", "port": 8080, "proxy": null, "tls": false },
  "limits": {
    "max_body_bytes": 10485760,
    "file_mode": 420,
    "feature_mask": 165,
    "magic": 3735928559,
    "cache_bytes": 67108864,
    "rate_limit": 5000,
    "idle_timeout": 300,
    "retry-after": 30,
    "banner": "Welcome to demo-service!"
  },
  "motd": "Welcome.\nMaintenance: Sundays 02:00.\n",
  "tags": ["internal", "says \"hello\"", "says \"hello\""]
}
```

### B.2 Unchanged JSON

Every JSON text is valid and keeps its meaning:

```xtjson
{"a": [1, 2.5e-3, true, null], "b": {"c": "d\u00e9"}}
```

### B.3 Invalid documents

In the tables `⏎` stands for a line break.

**Structure and separators**

| Text | Reason |
|---|---|
| *(empty or only comments)* | no value; the implicit root object needs at least one member |
| `[1 2]` | two items on one line without a comma |
| `a: 1 b: 2` | likewise, in the implicit root object |
| `[1,,2]` | two commas in a row |
| `[,]` and `{,}` | comma without a preceding item |
| `{a: 1} b: 2` | text after the root value |
| `a: 1 }` | the implicit root object is not closed with `}` |
| `[abc]` | `abc` is not `true`, `false`, `null` or `nil`; there are no other values without quotation marks |
| `[True]` and `[Nil]` | case is significant |

**Directives**

| Text | Reason |
|---|---|
| `% strict: true` ⏎ `{}` | white space after the `%` |
| `%include: "a.xtj"` ⏎ `{}` and `%Strict: true` ⏎ `{}` | unknown directive; case is significant |
| `%strict: true [1]` | no separator between the directive and the content |
| `%strict: true` | only a directive; the document has no content |
| `a: 1` ⏎ `%strict: true` | directive after the first member |
| `[%strict: true]` | directive not at the top level |
| `%strict: 1` ⏎ `{}`, `%strict: 'true'` ⏎ `{}` and `%strict: nil` ⏎ `{}` | not `true` or `false` |
| `%strict: true` ⏎ `%strict: true` ⏎ `{}` | `%strict` twice |
| `%extends: nil` ⏎ `{}` and `%extends: ['a.json']` ⏎ `{}` | the value of `%extends` is not a string |
| `%extends: 'a.json'` ⏎ `%extends: 'b.json'` ⏎ `{}` | `%extends` twice |
| `%extends: 'a.json'` ⏎ `{}`, if `%extends` is disabled | the parser has no resolver |
| `%strict: true` ⏎ `"x"` | strict mode: the root value is not an object and not an array |
| `%strict: true` ⏎ `{a: 1, a: 2}` | strict mode: duplicate name |
| `%strict: true` ⏎ `["\uFFFF"]` | strict mode: noncharacter in a string |
| `%strict: false` ⏎ `{}`, if the application requests strict mode | the document contradicts the application |

**Names**

| Text | Reason |
|---|---|
| `{2fa: true}` | identifier begins with a digit |
| `{π: 1}` and `{a×b: 1}` | `π` and `×` are not letters of ASCII or Latin-1 Supplement |
| `{Nº: 1}` and `{a·b: 1}` | `º`, `ª` and `·` are not permitted in identifiers |
| `{a.b: 1}` | `.` is not permitted in an identifier |
| `{max-age: 1}` | `-` is not permitted in an identifier |

**Strings**

| Text | Reason |
|---|---|
| `'It's'` | `'` not escaped in a `'` string |
| `"a` VT `b"` | U+000B is not escaped |
| `"a\` SPACE ⏎ `b"` | white space between `\` and the line break |
| `"\a"`, `"\N"`, `"\-"` | unknown escape sequence |
| `"\1"` and `"\01"` | digit after `\` or after `\0` |
| `"\x4"` and `"\u12"` | too few hexadecimal digits |
| `"\u{110000}"`, `"\u{D800}"` | code point greater than U+10FFFF or in the surrogate range |
| `"\u{}"`, `"\u{1_F600}"`, `"\u{ 41 }"`, `"\U{41}"` | no digit, `_` or white space in the braces, capital `U` |
| `"abc` | string not terminated |
| `"""a"""` | three quotation marks do not delimit a string: an empty string followed by further strings without a separator |
| `"⏎` TAB `a⏎··b⏎·"` | the removed indentation is not the same in all lines |

**White space, line breaks and comments**

| Text | Reason |
|---|---|
| `[1` VT `2]`, `[1` U+2028 `2]` | U+000B and U+2028 are white space but not separators |
| `[1,` U+200B `2]` | U+200B (zero width space) is not a white space character |
| `{a: 1 /* x` ⏎ `*/ b: 2}` | a line break in a block comment is not a separator |
| `/* open` and `/*/` | block comment not terminated |

**Numbers**

| Text | Reason |
|---|---|
| `0755` | leading zero; not an octal number |
| `0x` | no digit after the prefix |
| `0x_FF` | `_` directly after the prefix |
| `1__000` | two `_` in a row |
| `1_` and `1_.5` | `_` not between two digits |
| `0b102` | `2` is not a binary digit |
| `0o78` | `8` is not an octal digit |
| `0x1.8` | fraction part on a non-decimal number |
| `- 1` | white space between sign and digits |
| `+1`, `.5`, `5.` | invalid as in JSON |
| `NaN`, `Infinity` | not numbers; no values without quotation marks |
| `10q`, `12px` and `100L` | not a suffix from the table in 9.5 |
| `10K`, `64MB` and `5Min` | suffixes are written in lower case only |
| `10 k` and `10_k` | white space or `_` between number and suffix |
| `10kbs`, `10k5` and `10mi` | further characters after the suffix without a separator |
| `1.5n` and `1e3n` | `n` only after an integer without fraction part and exponent |
| `50%` and `10e` | `%` is not a suffix; `e` introduces the exponent, which needs digits |

## Appendix C – Deliberately not included

The following extensions, known from other JSON dialects, are **not** part of XTJSON. A conforming parser rejects them.

- freely chosen values without quotation marks (`colour: red`); at a value position only `true`, `false`, `null` and `nil` are permitted
- values defined in the document or by the application, such as aliases, constants or variables
- other notations of `true`, `false`, `null` and `nil` (`True`, `NULL`, `Nil`) and further values without quotation marks such as `undefined`
- switching off strict mode that the application has requested; `%strict: false` is then an error
- directives other than `%strict` and `%extends`, directives of the parser or of the application, directives inside objects and arrays or after the start of the content, and a second `%strict` or `%extends`; version statements in the document
- several bases in one document, and rules for merging other than JSON Merge Patch, for example appending to arrays
- suffixes defined in the document or by the application; further suffixes such as `px` or `L`; suffixes in upper case and other spellings of a suffix (`10K`, `64MB`); white space before the suffix; `n` after a number with a fraction part or an exponent; suffixes that yield anything other than a number
- strings delimited by three quotation marks (`"""…"""`, `'''…'''`), heredocs and raw strings without escape sequences
- a line continuation with white space between `\` and the line break
- `\` before arbitrary characters (`\a` for `a`) and octal escape sequences (`\1`, `\012`)
- `+` as a sign, `.5`, `5.`, and `Infinity` and `NaN` as numbers
- a fraction part or exponent on hexadecimal, octal and binary numbers
- octal numbers with a bare leading zero (`0755`)
- identifiers with characters other than ASCII letters and digits, `_`, `$` and the letters of Latin-1 Supplement; escape sequences and `-` in identifiers; normalization of names
- characters as white space that ECMAScript does not treat as white space (for example U+0085, U+180E, U+200B)
- U+2028 and U+2029 as a line break
- implicit arrays at the top level, several documents in one file
- nestable comments
- additional data types (date, binary data, `undefined`), references to parts of a document, includes at arbitrary positions, expressions

## Appendix D – Design decisions

Informative. Decisions at points where several solutions were possible, with their rationale.

| Topic | Decision | Rationale |
|---|---|---|
| Empty document | an error, not `{}` | An empty or truncated file should be noticed; JSON behaves the same way. |
| Duplicate names | the last member applies; forbidden in strict mode | A fixed behaviour prevents two parsers from reading the same document differently. A general prohibition would exclude valid JSON texts and violate K1. |
| Characters in identifiers | ASCII letters, digits, `_`, `$`, `µ` and the letters U+00C0 to U+00FF without `×` and `÷` | Names in many Western European languages, such as `größe` or `café`, can be written without quotation marks, as in ECMAScript. `ª`, `º` and `·`, which ECMAScript also permits, are left out: they are not letters of a word, are rarely needed in names and are easily confused with superscripts, the degree sign or other dots. A fixed list from one Unicode block needs no Unicode tables and does not change with new Unicode versions. Other characters, including combining characters, need quotation marks, and names are not normalized. Names such as `max-age` are written in quotation marks. |
| `true`, `false`, `null`, `nil` as a name | permitted | Unambiguous at a name position; avoids a special rule. |
| Line break | LF, CR or CR LF; CR LF counts as one | A single definition that is the same everywhere for separators, line comments and strings, independent of the line endings of the file. |
| Additional white space | all white space and line terminator characters of ECMAScript 2026; only the line break according to 5.2 is a separator | In this way the structure of a document does not depend on characters that editors display inconsistently or not at all. Unlike in ECMAScript, U+2028 and U+2029 are therefore not line terminators. |
| Category Zs | given as a fixed list | Parsers need no Unicode tables, and the grammar does not change with new Unicode versions. ECMAScript, by contrast, refers to the current category in each case. |
| U+FEFF | white space everywhere, not only at the start of the document | Follows from adopting the ECMAScript white space characters. A special rule for the BOM at the start of the document is thus not needed. |
| Line break in a block comment | does not count as a separator | A block comment behaves like a space everywhere and never changes the structure. The separator rule can thus be expressed completely in ABNF. |
| Additional escape sequences | only `\'`, `\v`, `\0`, `\xHH`, `\u{…}` and the line continuation | There is no `\` before arbitrary characters: a typo such as `\N` instead of `\n` is reported as an error instead of silently yielding `N`. |
| Strings across several lines | permitted in both string forms; no separate notation such as `"""` | A single string notation is easier to learn and to read. An unescaped line break in a string is an error in JSON, so no JSON text changes its meaning. |
| Strings: end | at the first unescaped delimiter, as in JSON | A simple rule. A forgotten closing quotation mark is therefore not noticed at the end of the line (section 13). |
| Strings: line endings | CR and CR LF become LF | The value does not depend on the line endings with which the file is saved. |
| Strings: tab and line breaks | permitted unescaped; all other control characters, including U+000B and U+000C, must be escaped | Text indented with tabs should not be an error. Vertical tab and form feed are invisible in most editors and would make the value differ from what is seen. |
| Strings: white space at the end of lines | unescaped white space before a line break is always removed | Invisible characters at the end of a line should not change the value. Before the closing delimiter, white space is visible and is therefore kept. |
| Strings: indentation | the smallest indentation is removed if the string begins with an empty line | The text can be indented together with the surrounding structure. To keep the indentation, begin the text on the line of the opening delimiter. |
| Strings: last line | always counts towards the smallest indentation | The position of the closing delimiter makes it possible to determine how much indentation is kept. |
| Strings: empty lines | do not count towards the smallest indentation | Otherwise the smallest indentation would be zero for every text with paragraphs. |
| Strings: measure of indentation | number of characters; a tab counts as one; the removed characters must be the same in all lines | No assumption about tab widths. Mixed indentation is reported as an error instead of shifting the text unnoticed. |
| Strings: what counts as white space | only unescaped spaces and tabs | Other white space characters can belong to the text, for example U+3000 at the start of a paragraph or U+00A0 at the end of a line. |
| Strings across several lines as a name | permitted | A name is a string like any other. A special rule would make the string forms differ depending on their position. |
| Line continuation and indentation | the `\` and its line break are removed only when the lines are joined (step 4 in 8.3); before that, the indentation of the following line is removed like that of any other line | A long line can be wrapped and indented together with the surrounding text. White space before the `\` is visible and is kept. Java text blocks follow the same model. |
| Line continuation: white space after `\` | an error | Otherwise invisible white space at the end of a line would decide whether the line break belongs to the value. |
| Line continuation: first line | a first line that contains the `\` of a line continuation is not empty; no indentation is removed | The `\` is a character of its line until step 4, like every other escape sequence. A special rule is not needed. |
| `\u{…}` | no value in the surrogate range | The notation stands for a code point; single surrogates remain reserved for the form `\uXXXX` adopted from JSON. |
| Non-decimal numbers | exact or an error | With bit masks and addresses every digit matters; silent rounding would be an error that is hard to find. |
| Prefixes `0x`/`0o`/`0b` | upper and lower case equivalent | Consistent with `e`/`E` in the exponent. Lower case is recommended. |
| Sign on non-decimal numbers | `-` permitted, `+` not | Consistent with the JSON rule `[ minus ]`. |
| `_` in numbers | single, only between two digits | A simple rule that is easy to check. |
| Values without quotation marks | only `true`, `false`, `null` and `nil` | A typo such as `ture` is reported as an error instead of being read as a string. |
| `true`, `false`, `null` | predefined, not changeable | Otherwise a valid JSON text could change its meaning (K2). |
| `nil` | another notation for `null`, fixed in the grammar | Many programming languages write the null value as `nil`. `nil` is a syntax error in JSON, so no JSON text changes its meaning (K1, K2). |
| No definitions | neither the document nor the application can define values | The value of a document can be read from its text without resolving definitions, and two parsers cannot read the same document differently. The only part of a value from outside the text is the base value of `%extends` (6.6), and it is taken over as a whole. |
| Suffixes: notation | a fixed list in the grammar; only lower case, exactly one notation per suffix | A reader recognizes every suffix without a list of alternative spellings, and a parser needs no character rules for suffixes. No suffix begins with `a`–`f`, `o`, `x` or `_`, so hexadecimal digits, the exponent, number prefixes and digit grouping remain unambiguous. Every other character after a number needs a separator and remains an error; later versions can therefore add suffixes without changing the value of a valid document. |
| Suffix `m` | number times 1000000 | Large numbers are written as briefly as with `k`. The longest match distinguishes `m` from `mb`, `ms` and `min`. |
| Suffix `n` | only after an integer, not after a fraction part or an exponent | As in ECMAScript, where `n` marks an integer literal (BigInt) and `1.5n` and `1e3n` are errors as well. |
| Suffixes: where defined | exclusively by this specification; no custom suffixes | A number with a suffix has the same value with every parser, and a parser executes no conversion functions of the application. |
| Suffixes without effect | `s` and `n` leave the value unchanged | A time can be written with its unit, and an integer in the form familiar from ECMAScript, without its value changing. |
| Suffix: result | always a number | A suffix converts; it does not create another data type. |
| Suffix: precision | exact result | `0.1kb` should yield `102.4` and `100ms` should yield `0.1`, independent of the floating-point arithmetic of the parser. |
| Directives: notation | `%strict` and `%extends`, each with `:` and its value, fixed in the grammar | `%` does not occur in JSON outside strings, so no JSON text changes its meaning (K1, K2). The `:` corresponds to the notation of a member. Every other text after a `%` is an error; later versions can therefore add directives without changing the value of a valid document. |
| Directives: position | only at the top level, before the content; in either order | Readers and parsers know whether strict mode applies and which base the document extends before the content begins. The order of the two directives does not change the value. |
| Directives: which exist | only `%strict` and `%extends`; the parser and the application cannot add any | Every document is read in the same way by every parser that supports the directives. |
| `%extends`: purpose | a document extends a base value according to JSON Merge Patch [RFC7396] | Configuration files often differ from a common base only in a few values. JSON Merge Patch is a published and simple standard; it works on the JSON data model, so the base can come from JSON, XTJSON or another format, and the result is again a JSON value. |
| `%extends`: resolution | left to a resolver of the application; support is optional | How a reference becomes a value depends on the environment (files, network, packages) and on security rules that only the application knows. The specification fixes only the merging, so the result is the same with every parser for the same base value. A parser without a resolver reports an error instead of ignoring the base. |
| `%extends`: value | a string; a URI reference is recommended | A URI covers local files as well as URLs. A string can contain every character. |
| `%extends`: `null` | removes a member, as in RFC 7396; this also holds for `nil` | `nil` and `null` denote the same value everywhere. A deviation would make the result differ from other implementations of JSON Merge Patch. A member with the value `null` therefore cannot be set in a document with `%extends`. |
| `%extends`: number | at most once | Several bases would need rules for their order and for conflicts. A base value can itself come from a document with `%extends`. |
| Strict mode and `%extends` | the prohibitions on names, string values and the root value also apply to the result | The JSON equivalent of a document that is valid in strict mode remains an I-JSON message, whatever the base value contains. |
| Strict mode: root value | an object or an array | [I-JSON] only recommends this. A single string or number as the root value cannot be extended later by further members; in strict mode the recommendation becomes a rule that a parser can check. |
| Strict mode: support | every parser must offer it | Otherwise one parser would accept a document with `%strict: true` that another rejects; every document remains portable. |
| `%strict`: value | `true` or `false`; at most once | A switch has two states. A second `%strict` could only repeat or contradict the first one. |
| `%strict: false` and the application | an error if the application requests strict mode | A document can tighten the checks of the application but cannot switch them off. A contradiction is reported instead of silently preferring one side. |

## References

**Normative**

- **[RFC8259]** T. Bray (ed.), "The JavaScript Object Notation (JSON) Data Interchange Format", STD 90, RFC 8259, December 2017. <https://www.ietf.org/ietf-ftp/rfc/std/std90.txt>
- **[ECMA-404]** Ecma International, "The JSON Data Interchange Syntax", 2nd edition, December 2017. <https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf>
- **[I-JSON]** T. Bray (ed.), "The I-JSON Message Format", draft-ietf-json-i-json-06, January 2015 (published as RFC 7493). <https://www.ietf.org/archive/id/draft-ietf-json-i-json-06.txt>
- **[ECMA-262]** Ecma International, "ECMAScript 2026 Language Specification", ECMA-262, 17th edition, June 2026. <https://262.ecma-international.org/17.0/index.html> – authoritative only for the white space characters and escape sequences adopted in 5.1 and 8.2.
- **[RFC5234]** D. Crocker, P. Overell, "Augmented BNF for Syntax Specifications: ABNF", STD 68, RFC 5234.
- **[RFC3629]** F. Yergeau, "UTF-8, a transformation format of ISO 10646", STD 63, RFC 3629.
- **[RFC3986]** T. Berners-Lee, R. Fielding, L. Masinter, "Uniform Resource Identifier (URI): Generic Syntax", STD 66, RFC 3986.
- **[RFC7396]** P. Hoffman, J. Snell, "JSON Merge Patch", RFC 7396, October 2014; replaces RFC 7386 with the same algorithm.
- **[RFC2119]**, **[RFC8174]** Key words for use in RFCs to indicate requirement levels, BCP 14.

**Informative**

- ECMA-262, 1st edition (June 1997), 3rd edition (December 1999), 5th edition (December 2009) and 6th edition (June 2015, "ECMAScript 2015") – for the information in the "Origin" columns; referred to in the tables as ES1, ES3, ES5 and ES2015.
- RFC 3339, "Date and Time on the Internet: Timestamps".
- RFC 4648, "The Base16, Base32, and Base64 Data Encodings".

## Changes

**Draft 0.7**

- 6.3: named values are dropped. The only values without quotation marks are `true`, `false`, `null` and the new `nil`, another notation for `null`; they are written directly in the rule `value`. Section 6.3 takes over the rules of 6.4.
- 6.4: "Directives" (formerly 6.5). There are exactly the directives `%strict` and `%extends`, fixed in the grammar; each occurs at most once, in either order. The directives `%define` and `%version` are dropped.
- 6.5: "The directive `%strict`" (formerly 6.8); its value is `true` or `false`.
- 6.6 (new): `%extends` extends a base value according to JSON Merge Patch [RFC7396]. A resolver of the application provides the base value for the string of the directive. Support is optional; without a resolver, a document with `%extends` is an error. Sections 6.7 and 6.8 are dropped.
- 7.2: identifiers may also contain `µ` (U+00B5) and the letters U+00C0 to U+00FF of Latin-1 Supplement except `×` and `÷`. The rule `identifier` is dropped; its characters are part of the rule `name`.
- 9.5: the suffixes are fixed in the grammar (rule `suffix`, and `n` in the rule `number`). The rules on the characters of a suffix are dropped; a character directly after a suffix begins a new token.
- 9.5: every suffix has a single notation, in lower case. The suffixes `K`, `Kb`, `kB`, `KB`, `Mb`, `mB`, `MB`, `px` and `L` are dropped.
- 9.5: new suffix `m` (times 1000000).
- 9.5: `n` is permitted only after an integer, not after a number with a fraction part or an exponent.
- 6.1, 8.2, 9, Appendix A: the grammar is simplified. The escape sequences are written directly in `escape-seq`, the hexadecimal, octal and binary numbers in `radix-int`; the rules `root-members`, `named-value`, `identifier` and the helper rules of the escape sequences and suffixes are dropped.
- 10, 11, 12, 13: the JSON equivalent of a document with `%extends` depends on its base value, and such a document is portable only together with it. Strict mode also checks the result of the merge. New security considerations for resolvers and for similar characters in names. The limit on the size of the value after replacing named values and the rules for the values of directives are dropped.
- 1, 2, 3, 5.1, 9.1 and Appendices B to D are adapted to these changes; section 6 is now called "Document, directives, root object and values".

**Draft 0.6**

- 6.5 (new): directives. A directive at the start of the document begins with `%`, followed immediately by its name and `:`, and then a value, optionally preceded by an identifier and `=`. Directives are separated like items. There are exactly the directives `%define`, `%version` and `%strict`; every other directive is an error. The values of directives always satisfy the prohibitions of section 12 on names, string values and duplicate names, and a directive has no effect on the directives before it.
- 6.4, 6.6 (new): named values are defined only in the document, with `%define`; the application can no longer define named values. A named value can be assigned an object or an array. A definition can use the named values defined before it; a second definition of the same named value is an error.
- 6.7 (new): `%version` states the version of this specification and, with an identifier, versions of other things such as a schema. Its value is a string or a number, also with a suffix or as a named value.
- 6.8 (new): `%strict: true` makes a parser read the content of the document in strict mode. `%strict: false` is an error if the application requests strict mode.
- 6.1, 6.2: a document begins with optional directives. Section 6 is now called "Document, directives, root object and values".
- 11, 12: every conforming document is portable. Parsers may limit the size of the value after the named values have been replaced. The I-JSON profile becomes strict mode, which every parser must offer. In strict mode the root value must be an object or an array. Section 12 is now called "Strict mode".
- 1, 2, 3, 7.2, 10, 13 and Appendices A to D are adapted to these changes.

**Draft 0.5**

- 8: there is only one kind of string, in `"` or in `'`. Every string may extend across several lines; line breaks (LF, CR, CR LF) and tabs may appear unescaped, while all other control characters, including U+000B and U+000C, must still be escaped. The rules for white space at the end of lines and for removing indentation (8.3) apply to every string. Strings with `"""` and `'''` no longer exist; such a notation is an error.
- 8.2: new escape sequence: a `\` immediately before a line break (line continuation) contributes nothing to the value. White space between `\` and the line break is an error. Section 8.3 defines how a line continuation affects the indentation of the following line.
- 6.2, 7.2: every string is permitted as a name, including one that extends across several lines.
- Sections 8.1 and 8.3 are now called "Delimiters and characters" and "Line breaks in strings".
- 1, 2, 3, 5.1, 5.2, 10, 13 and Appendices A to D are adapted to these changes.

**Draft 0.4**

- 6.4: a custom definition can no longer assign an object or an array to a named value; permitted are a string, a number, `true`, `false` and `null`.
- 9.5: suffixes are now defined only by this specification; custom suffixes of the application no longer exist.
- 9.5: a suffix consists of the same characters as an identifier and is no longer limited to two characters; as before it does not begin with `a`–`f`, `o` or `x`, in either case, nor with `_`. `%` is no longer permitted in a suffix; digits and, except at the beginning, `_` now are.
- 9.5: new suffixes `ms` (divided by 1000), `min` (times 60), `h` (times 3600) and `pct` (divided by 100) as well as `s`, `px`, `L` and `n` (without effect on the value). New overview table of all suffixes.
- 2, 3, 10, 11, 13: the term "definition" now refers only to named values. A conforming document uses only suffixes from 9.5; whether a document is portable now depends only on its named values.
- Appendices A to D are adapted to these changes.

**Draft 0.3**

- Review without changes to the syntax; wording made more precise.
- Section 7.2 is now called "Names". The term "identifier" is defined in section 2.
- 5.1: white space is also an error between a number and its suffix; the statement about "literals" is adapted to named values.
- 6.2: only a single-line string or an identifier can start an implicit root object.
- 6.4: definitions apply unchanged to the entire document.
- 7.2 and 10: the rule "the last member applies" refers to the order in the document, explicitly also holds in the implicit root object, and applies to the JSON equivalent.
- 8.3: the condition of identical indentation concerns only lines from which characters are removed.
- 9.1, 9.5, 11, 13: minor clarifications on suffixes, on the precision of custom conversion functions, on generators and on duplicate names.
- The specification is additionally available in German (`xtjson-spec-de.md`); both versions describe the same syntax and the same behaviour.

**Draft 0.2**

- New: named values (6.3, 6.4). An identifier at a value position is an alias for a JSON value. `true`, `false` and `null` are predefined; further named values are defined by the application in the parser. Undefined named values are an error.
- New: number suffixes of one or two characters (9.5). Predefined are `k`/`K` (times 1000), `kb`/`Kb`/`kB`/`KB` (times 1024) and `mb`/`Mb`/`mB`/`MB` (times 1048576); further suffixes are defined by the application together with a conversion function. Undefined suffixes are an error. A suffix does not begin with `a`–`f`, `o` or `x`, in either case.
- The grammar no longer has `true`, `false` and `null` as separate rules but as `named-value`.
- Conformance: new terms "valid with respect to a set of definitions" and "portable"; new obligations of the parser regarding definitions (11).
- Section 6 is now called "Document, root object and values".
- Appendix B.3: the example "multi-line string as a name" was in the wrong table.

**Draft 0.1** – first version.
