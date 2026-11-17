# XTJSON

**Specification, draft 0.6** · Date: 17 November 2026

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
| E12 | Named values: identifiers as values, aliases for JSON values defined in the document (`nil`) | [6.4](#64-named-values) |
| E13 | Number suffixes (`10k`, `64mb`, `50pct`) | [9.5](#95-number-suffixes) |
| E14 | Directives at the start of the document: `%define`, `%version` and `%strict` | [6.5](#65-directives) |

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
| identifier | a character sequence conforming to the rule `identifier` (7.2); a name at a name position, a named value at a value position |
| white space character | one of the characters in the table in 5.1 |
| line break | U+000A, U+000D or the sequence U+000D U+000A (5.2) |
| escaped, unescaped | escaped: written as an escape sequence according to 8.2; unescaped: written as the character itself |
| line continuation | a `\` immediately before a line break in a string; it contributes nothing to the value (8.2) |
| directive | a statement at the start of the document that begins with `%` (6.5) |
| definition | the assignment of a JSON value to a named value by the directive `%define` (6.6) |
| predefined | fixed by this specification and not changeable |
| strict mode | the mode in which a parser additionally enforces the prohibitions of section 12 |
| JSON equivalent | the JSON text onto which an XTJSON document is mapped according to [section 10](#10-mapping-to-json) |

## 3. Compatibility

This section is normative. It states what "fully compatible" with [RFC8259] (STD 90), [ECMA-404] and [I-JSON] means.

**K1 – Syntactic superset.** Every UTF-8 encoded JSON text according to [RFC8259] and [ECMA-404] is a valid XTJSON document. The same holds for every I-JSON message according to [I-JSON].

**K2 – Preservation of meaning.** As an XTJSON document, a JSON text denotes the same value as it does as a JSON text. No extension changes the meaning of a text that is already valid JSON.

**K3 – Unchanged data model.** Every XTJSON document has a JSON equivalent ([section 10](#10-mapping-to-json)) that determines its value. Named values and number suffixes are only other notations for JSON values. Directives contribute to the value only through the named values that they define. A value that cannot be represented in JSON cannot be represented in XTJSON either.

**K4 – Inherited semantics.** Everything that this specification does not explicitly extend applies as in [RFC8259]: the meaning of `true`, `false` and `null`, the escape sequences of JSON, the treatment of number range and precision, the insignificance of member order, and string comparison.

**K5 – Delimitation.** An XTJSON document that uses at least one of the extensions E1–E14 is **not** a JSON text. It follows that:

- Such documents MUST NOT be labelled with the media type `application/json` or sent to recipients that expect JSON.
- An XTJSON parser is not a conforming processor in the sense of [ECMA-404], because such a processor is not to accept non-conforming input. It is, however, a permitted parser in the sense of [RFC8259] section 9, which explicitly allows parsers to accept extensions.
- Whoever generates JSON MUST adhere strictly to the JSON grammar ([RFC8259] section 10). The mapping in section 10 is the bridge.

Informative – why K1 and K2 hold: every extension occupies only notations that are a syntax error in JSON. `/`, `#`, `%`, `'` and the additional white space characters (5.1) do not occur in JSON outside strings; the additional escape sequences are invalid `\` sequences in JSON; an unescaped line break or tab in a string is invalid in JSON; a name without quotation marks, a comma before a closing bracket, a `:` after the root value, two items without a comma, and `0x`, `0o`, `0b` and `_` in numbers are invalid in JSON; so are an identifier at a value position other than `true`, `false` and `null`, and a suffix directly after a number. The three literals of JSON are predefined and cannot be changed, and no suffix begins with `e` or `E`, so the exponent of a JSON number is never read as a suffix. A string without a line break keeps its JSON value, because the rules of 8.3 change only strings that extend across several lines. The line break rule (E5) applies only where JSON requires a comma; everywhere else a line break remains insignificant white space.

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
XTJSON-text  = S [ directives item-sep ] ( value / root-members ) S [ line-comment ]
root-members = member-list
```

A line comment at the end of the document does not need a final line break.

An XTJSON document begins with optional directives (6.5). They are followed either by a single value (as in JSON) or by an implicit root object. A document that consists only of white space, comments and directives is an error, just as an empty text is not a JSON text.

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
value        = object / array / string / number / named-value
named-value  = identifier
```

A value is an object or an array (section 7), a string (section 8), a number (section 9) or a named value (6.4). The literals `true`, `false` and `null` of JSON are named values with a fixed meaning in XTJSON.

### 6.4 Named values

A named value is an identifier (7.2) at a value position. It therefore consists of the same characters as a name without quotation marks. It stands for the JSON value that a definition assigns to it.

- **Predefined** are exactly three named values: `true`, `false` and `null`, with the meaning they have in JSON. They MUST NOT be redefined, overridden or removed.
- **Definitions in the document.** All further named values are defined by the document itself with the directive `%define` (6.6). Each definition assigns exactly one JSON value to an identifier: a string, a number, an object, an array, `true`, `false` or `null`. The application cannot define named values.
- **Alias, not a data type.** In the JSON equivalent, the assigned JSON value appears in place of the named value, at every position as a copy of its own. A named value is only another notation for that value; neither new data types nor references arise.
- **Case is significant.** `nil`, `Nil` and `NIL` are three different named values, and `True` is not `true`.
- **Undefined is an error.** An identifier at a value position for which there is no definition is an error. A parser MUST NOT interpret it as a string or in any other way instead.
- **Name position.** At a name position an identifier is always a name and never a named value (7.2): `{nil: nil}` has the name `"nil"`.
- **Scope.** A definition applies from the directive that contains it to the end of the document: in the values of all following directives and in the content of the document.

```xtjson
%define: nil = null
%define: zero = 0
%define: unknown = "not specified"
%define: address = {
  city: unknown
  postcode: nil
}

{
  middle_name: nil
  children: zero
  home: address
  work: address
  nil: "an ordinary name at a name position"
}
```

JSON equivalent:

```json
{
  "middle_name": null,
  "children": 0,
  "home": { "city": "not specified", "postcode": null },
  "work": { "city": "not specified", "postcode": null },
  "nil": "an ordinary name at a name position"
}
```

Without the four directives the same document is an error, because `nil`, `zero` and `address` are not defined.

### 6.5 Directives

```abnf
directives   = directive *( item-sep directive )
directive    = "%" identifier S ":" S [ identifier S "=" S ] value
```

A directive is a statement at the start of the document. It begins with `%`, followed immediately by the name of the directive and a `:`. After that comes either an identifier, a `=` and a value, or a value alone.

```xtjson
%version: '0.6', %define: empty = "", [null, 543, empty]
```

JSON equivalent:

```json
[null, 543, ""]
```

Rules:

- **Notation.** The name of a directive is an identifier (7.2) and follows the `%` immediately; white space and comments between them are an error (`% define`). Before the `%`, before and after the `:` and before and after the `=`, white space and comments are permitted as between any tokens (5.1), line breaks included.
- **Position.** Directives are permitted only at the top level, before the root value or before the first member of the implicit root object. A directive inside an object or an array, or after the content has begun, is an error.
- **Separators.** Two consecutive directives, and the last directive and the content of the document, MUST be separated like two items according to 7.3: by a comma or by white space that contains a line break. `%define: a = 1 [a]` is an error.
- **Known directives.** This specification defines exactly three directives: `%define` (6.6), `%version` (6.7) and `%strict` (6.8). Every other directive is an error. Case is significant: `%Define` is not `%define`. A parser MUST NOT know further directives or accept any from the application. Further directive names are reserved for later versions of this specification.
- **Repetition.** A directive MAY occur more than once, unless its section restricts this.
- **Value.** The value of a directive is a value according to 6.3. It can use the named values that earlier directives have defined.
- **Checked values.** The values of directives MUST satisfy the prohibitions of section 12 on names, string values and duplicate names, also when the document is not read in strict mode, and even where a named value defined by them is not used.
- **Order.** A directive has no effect on the directives that come before it in the document.
- **Effect.** Directives contribute nothing to the JSON equivalent except the definitions of named values (section 10).

### 6.6 The directive `%define`

`%define` defines a named value (6.4). The identifier before the `=` is the named value; the value after the `=` is assigned to it.

```xtjson
%version: '0.6'
%version: schema = '2026.05.01b'
%define: nil = null
# hypermedia reference
%define: self = {
  href: 'http://api.example.org/people/1234'
}

id: 1234
name: 'Bob'
email: nil
self: self
```

JSON equivalent:

```json
{
  "id": 1234,
  "name": "Bob",
  "email": null,
  "self": { "href": "http://api.example.org/people/1234" }
}
```

Rules:

- **Form.** `%define` MUST be written with an identifier and `=`. A `%define` with a value alone (`%define: "foobar"`) is an error.
- **Only once.** An identifier that is already defined MUST NOT be defined again: neither `true`, `false` and `null` nor a named value that an earlier `%define` has defined. A second definition is an error, even if it assigns the same value.
- **Order.** The value can use the named values that earlier `%define` directives have defined. A named value that is defined only by a later directive is not yet defined at this position and therefore an error; so is the identifier that is being defined (`%define: a = [a]`). There are thus no forward references and no cycles.
- **Identifier before the `=`.** It names the named value that is being defined; it is not itself a named value and needs no definition.

### 6.7 The directive `%version`

`%version` states for which version of this specification, or of another specification, the document is written.

- **Version of this specification.** `%version: '0.6'` states the version of this specification that a parser must support in order to read the document. `%version: xtjson = '0.6'` has the same meaning. This specification states its version in the line below its title: this document has the version `0.6`.
- **Further versions.** With another identifier before the `=`, the directive states the version of something else, for example of a schema: `%version: schema = '2026.05.01b'`. Such a statement is information for the application. It defines no named value.
- **Value.** The value MUST be a string or a number. A number can carry a suffix (9.5), and a named value can be used whose value is a string or a number: `%version: windows = 2k` states the version `2000`. `true`, `false`, `null`, an object, an array, and a named value with such a value are an error. A string is RECOMMENDED, because a number distinguishes neither `0.1` from `0.10` nor `2k` from `2000`.
- **Only once.** Each version MUST be stated at most once. Two `%version` without identifier, one without identifier and one with `xtjson`, and two with the same identifier are therefore an error.
- **Effect on the parser.** A parser MAY reject a document as an error if it does not support the stated version of this specification; it MAY also ignore the statement. It SHOULD make all version statements of the document available to the application, each with its identifier and its value.
- **No effect on the value.** The JSON equivalent does not depend on the `%version` directives.

### 6.8 The directive `%strict`

`%strict` states whether the document is to be read in strict mode (section 12).

```xtjson
%define: yes = true
%strict: yes

name: 'demo'
port: 8080
```

JSON equivalent:

```json
{ "name": "demo", "port": 8080 }
```

Rules:

- **Form.** `%strict` MUST be written without an identifier and `=`. Its value MUST be `true` or `false`, or a named value whose value is `true` or `false`. Any other value is an error (`%strict: 1`, `%strict: 'true'`).
- **Only once.** `%strict` MUST occur at most once in a document. A second `%strict` is an error, even if it states the same value.
- **`%strict: true`.** A parser MUST read the content of the document in strict mode, even if the application has not requested it.
- **`%strict: false`.** The document does not require strict mode. If the application has requested strict mode, the document contradicts it, and a parser MUST reject it as an error.
- **Without `%strict`.** A parser reads the document in strict mode if the application requests it.
- **Scope.** Strict mode applies to the content of the document, the part after the directives. The values of the directives satisfy its prohibitions on names, string values and duplicate names in every case (6.5).
- **No effect on the value.** The JSON equivalent does not depend on `%strict`. The directive decides only whether the document is accepted.

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
name         = string / identifier
identifier   = id-start *id-continue
id-start     = ALPHA / "_" / "$"
id-continue  = ALPHA / DIGIT / "_" / "$"
```

- A name is a string (section 8) or an identifier. Like every other string, a name may extend across several lines; its value is determined according to 8.3.
- An identifier begins with an ASCII letter, `_` or `$`; after that, ASCII digits are permitted as well. As a name it stands for exactly the character sequence as written; there are no escape sequences in identifiers.
- Every other name MUST be in quotation marks: names with spaces, hyphens, dots or non-ASCII characters, names that begin with a digit, and the empty name.
- `true`, `false`, `null` and all other named values (6.4) are permitted as identifiers at a name position and yield ordinary names there (`"true"`, `"nil"`). A value never appears at a name position, so this is unambiguous.
- At a value position an identifier is a named value (6.4). There are no freely chosen values without quotation marks: `colour: red` is valid only if `red` is defined.
- The notation is irrelevant to the identity of a name: `a`, `"a"`, `'a'` and `"\u0061"` denote the same name.

```xtjson
{
  $schema: "https://example.org/schema.json",
  max_age: 3600,
  "max-age": 3600,
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
escape-seq       = %x5C ( char-escape / null-escape / hex-escape /
                          unicode-escape / codepoint-escape / newline )
codepoint-escape = %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}"
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
number   = [ minus ] ( hex-int / oct-int / bin-int / decimal ) [ suffix ]
```

### 9.1 Decimal numbers

```abnf
decimal  = int [ frac ] [ exp ]
int      = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac     = "." digits
exp      = e [ minus / plus ] digits
digits   = DIGIT *( [ "_" ] DIGIT )
```

Without `_` and without a suffix this is exactly the number grammar of JSON. In particular the following remain invalid: leading zeros (`0755`), a leading `+`, a missing integer or fraction part (`.5`, `5.`). `Infinity` and `NaN` are not numbers; as identifiers they are named values and an error without a definition (6.4).

### 9.2 Hexadecimal, octal, binary

```abnf
hex-int  = %x30 ( %x78 / %x58 ) HEXDIG    *( [ "_" ] HEXDIG )      ; 0x 0X
oct-int  = %x30 ( %x6F / %x4F ) oct-digit *( [ "_" ] oct-digit )   ; 0o 0O
bin-int  = %x30 ( %x62 / %x42 ) BIT       *( [ "_" ] BIT )         ; 0b 0B
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
suffix        = suffix-start *id-continue
suffix-start  = %x67-6E / %x70-77 / %x79-7A /     ; g-n p-w y z
                %x47-4E / %x50-57 / %x59-5A /     ; G-N P-W Y Z
                "$"
```

A suffix may be appended to a number. The suffix stands for a conversion: it is applied to the value of the number including the sign and yields a number. In the JSON equivalent, the result appears in place of the number with the suffix. All suffixes are predefined; the table in this section lists them completely.

**Notation**

- The suffix follows the last digit immediately. White space, comments and `_` between the number and the suffix are an error.
- A suffix consists of the same characters as an identifier (7.2): it begins with an ASCII letter or `$`; after that, ASCII digits and `_` are permitted as well. Its length is not limited.
- In addition: no suffix begins with `a` to `f` (hexadecimal digits; `e` also introduces the exponent) or with `o` or `x` (number prefixes `0o` and `0x`), in either case.
- Case is significant: `k` and `K` are two different suffixes, as are `mb`, `Mb`, `mB` and `MB`. `L` is a suffix, `l` is not.
- The longest match applies: all letters, digits, `_` and `$` that follow its first character immediately belong to the suffix. `10kb` carries the suffix `kb`, not `k` followed by `b`. `10kbs` carries the suffix `kbs` and `10k5` the suffix `k5`; neither exists.
- Unlike an identifier, a suffix does not begin with `_`. A `_` immediately after a digit is therefore always digit grouping (9.3) or an error: `1_0` is the number 10, `10_k` is an error.
- Suffixes are permitted on all number forms, including after an exponent and on hexadecimal, octal and binary numbers: `1e3k`, `0x10kb`.

**Overview of the suffixes**

| Suffix | Conversion | Example | Result |
|---|---|---|---|
| `k`, `K` | number times 1000 | `10k` | `10000` |
| `kb`, `Kb`, `kB`, `KB` | number times 1024 | `4kb` | `4096` |
| `mb`, `Mb`, `mB`, `MB` | number times 1048576 | `64mb` | `67108864` |
| `ms` | number divided by 1000 | `100ms` | `0.1` |
| `s` | none; the value remains unchanged | `30s` | `30` |
| `min` | number times 60 | `5min` | `300` |
| `h` | number times 3600 | `2h` | `7200` |
| `pct` | number divided by 100 | `50pct` | `0.5` |
| `px` | none; the value remains unchanged | `12px` | `12` |
| `L` | none; the value remains unchanged | `100L` | `100` |
| `n` | none; the value remains unchanged | `10n` | `10` |

- The table is exhaustive. A suffix that is not listed in it is an error (`10q`, `10m`, `10MS`).
- The suffixes MUST NOT be redefined, overridden or removed. A parser MUST NOT know further suffixes or accept any from the application.
- The result is the exact product or the exact quotient. In the JSON equivalent its decimal representation appears: `1.5k` yields `1500`, `0.5kb` yields `512`, `0.1kb` yields `102.4`, `-2k` yields `-2000`, `0x10kb` yields `16384`, `1.5h` yields `5400`, `1ms` yields `0.001`, `12.5pct` yields `0.125`.
- For `s`, `px`, `L` and `n` the result is the value of the number itself: `12px` and `12` denote the same value. The suffix contributes no information to the value of the document.
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
  half: 0.5K
  ratio: 50pct
  surcharge: 110pct
  width: 320px
  counter: 100L
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
  "width": 320,
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
7. **Named values:** `true`, `false` and `null` remain unchanged. Every other named value is replaced, at every position where it is used, by the JSON equivalent of the value that its definition assigns to it (6.4, 6.6).
8. **Directives** are removed, each together with the separator that follows it (6.5).

The JSON equivalent is unique up to white space and the choice of equivalent escape sequences. If it contains an object with duplicate names, the rule from 7.2 applies to its value: the last member applies. Two XTJSON documents are **equivalent** if their JSON equivalents denote the same value. A document that is already a JSON text is its own JSON equivalent (up to white space).

An example with a side-by-side comparison is given in [Appendix B.1](#b1-complete-example).

## 11. Conformance

**Document.** A text is a conforming XTJSON document if it is encoded according to section 4, conforms to the rule `XTJSON-text`, each of its directives satisfies the rules of 6.5 to 6.8, each of its named values is defined (6.4), each of its number suffixes is listed in the table in 9.5 and, if it contains `%strict: true`, it satisfies the prohibitions of section 12. Every conforming document is **portable**: its value depends only on its text and on this specification, and every conforming parser can read it, unless a limit or a restriction of the application applies (section 11) or the parser does not support the version stated with `%version` (6.7).

**Parser.** A conforming XTJSON parser

- MUST accept every conforming XTJSON document and deliver the value of its JSON equivalent – and thus also every JSON text and every I-JSON message – unless a limit or restriction according to the fourth item applies or the parser rejects the version stated with `%version` (6.7);
- MUST reject as an error every text that is not a conforming XTJSON document, in particular one with an undefined named value or an unknown directive, and MUST NOT silently accept any further syntax extensions;
- MUST know the predefined named values, the directives from 6.5 and all suffixes from 9.5. It MUST NOT allow them to be redefined, and MUST NOT accept named values, directives or suffixes from the application;
- MAY set limits on document size, nesting depth, number range and precision, string length, and the size of the value after the named values have been replaced, and enforce semantic restrictions (for example strict mode according to section 12);
- MUST offer strict mode according to section 12 to the application, and MUST read a document with `%strict: true` in strict mode (6.8).

**Generator.** An XTJSON generator MUST output conforming XTJSON documents. Every JSON generator that outputs UTF-8 is therefore also an XTJSON generator. If the recipient is a program, JSON SHOULD be output.

**Converter.** A converter from XTJSON to JSON MUST produce the JSON equivalent according to section 10; its output MUST conform strictly to the grammar of [RFC8259].

## 12. Strict mode

In **strict mode** a parser enforces the following prohibitions beyond sections 4–9. Strict mode applies if the application requests it or if the document contains `%strict: true` (6.8). The prohibitions apply to the content of the document; the values of the directives satisfy the prohibitions on names, string values and duplicate names in every case (6.5). The values that result from named values and number suffixes are also relevant here.

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
- **Divergent interpretation.** If two components process the same document differently, checks can be bypassed. This concerns above all duplicate names, which other JSON tools may treat differently from what 7.2 specifies, and numbers outside the exact range. Where a document controls security-relevant decisions, strict mode (section 12) is RECOMMENDED.
- **Definitions.** Named values are defined only in the document itself (6.6), and only the directives of this specification exist. The meaning of a document therefore does not depend on the configuration of the parser, and the application cannot change it. The conversions of the suffixes are fixed by this specification alone; a document can bring along no code.
- **Size after replacing named values.** A named value whose value is an object or an array is copied to every position where it is used (6.4). Definitions that use one another can therefore make the value grow exponentially from a short document: `%define: a = [1, 1, 1, 1]`, `%define: b = [a, a, a, a]` and so on. Parsers SHOULD limit the size of the value after the named values have been replaced (section 11).
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
XTJSON-text    = S [ directives item-sep ] ( value / root-members ) S [ line-comment ]
root-members   = member-list                 ; implicit root object

; ---------- Directives ----------
directives     = directive *( item-sep directive )
directive      = "%" identifier S ":" S [ identifier S "=" S ] value
                                             ; only %define, %version and %strict (6.5)

; ---------- Values ----------
value          = object / array / string / number / named-value
named-value    = identifier                  ; true, false, null and
                                             ; definitions with %define (6.4)

; ---------- Objects ----------
object         = "{" S [ member-list S ] "}"
member-list    = member *( item-sep member ) [ S "," ]
member         = name S ":" S value
name           = string / identifier
identifier     = id-start *id-continue
id-start       = ALPHA / "_" / "$"
id-continue    = ALPHA / DIGIT / "_" / "$"

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
escape-seq     = %x5C ( char-escape / null-escape / hex-escape /
                        unicode-escape / codepoint-escape / newline )
                                             ; \ before newline: line continuation
char-escape    = %x22 / %x27 / %x5C / %x2F /         ; " ' \ /
                 %x62 / %x66 / %x6E / %x72 /         ; b f n r
                 %x74 / %x76                         ; t v
null-escape    = %x30                        ; \0, not before a DIGIT
hex-escape     = %x78 2HEXDIG                ; \xHH
unicode-escape = %x75 4HEXDIG                ; \uXXXX
codepoint-escape = %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}"
                                             ; \u{…}, at most 10FFFF, not D800-DFFF
SQUOTE         = %x27                        ; '

; ---------- Numbers ----------
number         = [ minus ] ( hex-int / oct-int / bin-int / decimal ) [ suffix ]
suffix         = suffix-start *id-continue   ; only the suffixes from 9.5
suffix-start   = %x67-6E / %x70-77 / %x79-7A /       ; g-n p-w y z
                 %x47-4E / %x50-57 / %x59-5A /       ; G-N P-W Y Z
                 "$"
decimal        = int [ frac ] [ exp ]
int            = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac           = "." digits
exp            = e [ minus / plus ] digits
digits         = DIGIT *( [ "_" ] DIGIT )
hex-int        = zero ( %x78 / %x58 ) HEXDIG    *( [ "_" ] HEXDIG )     ; 0x 0X
oct-int        = zero ( %x6F / %x4F ) oct-digit *( [ "_" ] oct-digit )  ; 0o 0O
bin-int        = zero ( %x62 / %x42 ) BIT       *( [ "_" ] BIT )        ; 0b 0B
oct-digit      = %x30-37
digit1-9       = %x31-39
zero           = %x30
minus          = %x2D
plus           = %x2B
e              = %x65 / %x45                 ; e E
```

Notes on tokenization (informative):

- The longest match applies. `0x1e3` is a single hexadecimal number.
- Four conditions apply in addition to the grammar: no decimal digit follows `null-escape`, the value in `codepoint-escape` is not in the range D800 to DFFF, every `suffix` is listed in the table in 9.5, and every `directive` satisfies the rules of 6.5 to 6.8.
- Two values always need a separator according to 7.3. Character sequences such as `0755`, `1_`, `0b102`, `123abc` or `10_k` can therefore never be read as a valid sequence of several tokens and are errors.
- Whether a `named-value` is defined is decided not by the grammar but by the `%define` directives that precede it (6.4, 6.6).
- The `%` of a directive and the following identifier form a single token; white space between them is an error.
- A line comment always extends to the next line break: `eol` requires a `newline` after it, and `non-eol` excludes only U+000A and U+000D. Only at the end of the document may the line break be missing.
- The sequence CR LF is always a single `newline`, never two.
- For strings the grammar describes only the notation. Their value results from the steps in 8.3.
- Three quotation marks in a row (`"""` or `'''`) do not delimit a string: they are an empty string followed directly by the start of another string, and therefore always an error (7.3).
- Apart from the current character, a parser needs only the information "since the last token a line break has occurred outside a block comment". Only at the start of the content (6.2) and after the `:` of a directive, where an identifier can be followed by `=` (6.5), is one further token of lookahead needed.

## Appendix B – Examples

### B.1 Complete example

XTJSON document:

```xtjson
# Service configuration – the root braces are omitted
%version: '0.6'
%strict: true
%define: any_host = "0.0.0.0"

name: 'demo-service'
version: "1.4.0"
$schema: "https://example.org/schema/service.json"

listen: {
  host: any_host        // named value from %define
  port: 8080            // the line break replaces the comma
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
  "listen": { "host": "0.0.0.0", "port": 8080, "tls": false },
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
| `[abc]` | the named value `abc` is not defined |
| `[True]` | `True` is not defined; case is significant |

**Directives**

| Text | Reason |
|---|---|
| `% define: a = 1` ⏎ `[a]` | white space between `%` and the name of the directive |
| `%include: "a.xtj"` ⏎ `{}` and `%Define: a = 1` ⏎ `[a]` | unknown directive; case is significant |
| `%define: "x"` ⏎ `{}` | `%define` without identifier and `=` |
| `%define: true = 1` ⏎ `[true]` | a predefined named value cannot be redefined |
| `%define: a = 1` ⏎ `%define: a = 2` ⏎ `[a]` | `a` is defined twice |
| `%define: a = b` ⏎ `%define: b = 1` ⏎ `[a]` | `b` is not yet defined in the first directive |
| `%define: a = [a]` ⏎ `a` | `a` is not yet defined in its own value |
| `%define: a = 1 [a]` | no separator between the directive and the content |
| `%define: a = 1` | only directives; the document has no content |
| `a: 1` ⏎ `%define: b = 2` | directive after the first member |
| `[%define: a = 1]` | directive not at the top level |
| `%version: '0.6'` ⏎ `%version: xtjson = '0.6'` ⏎ `{}` | version of this specification stated twice |
| `%version: s = 1` ⏎ `%version: s = 2` ⏎ `{}` | version `s` stated twice |
| `%version: [0, 6]` and `%version: true` | not a string and not a number |
| `%define: nil = null` ⏎ `%version: nil` ⏎ `{}` | the value of the named value is not a string and not a number |
| `%strict: 1` ⏎ `{}` and `%strict: 'true'` ⏎ `{}` | not `true` or `false` |
| `%strict: s = true` ⏎ `{}` | `%strict` with an identifier |
| `%strict: true` ⏎ `%strict: true` ⏎ `{}` | `%strict` twice |
| `%strict: true` ⏎ `"x"` | strict mode: the root value is not an object and not an array |
| `%strict: true` ⏎ `{a: 1, a: 2}` | strict mode: duplicate name |
| `%define: d = {a: 1, a: 2}` ⏎ `[d]` | duplicate name in the value of a directive, also outside strict mode |
| `%define: n = "\uFFFF"` ⏎ `[1]` | noncharacter in the value of a directive, also outside strict mode |
| `%strict: false` ⏎ `{}`, if the application requests strict mode | the document contradicts the application |

**Names**

| Text | Reason |
|---|---|
| `{2fa: true}` | identifier begins with a digit |
| `{größe: 1}` | non-ASCII character in the identifier |
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
| `NaN`, `Infinity` | not numbers; not defined as named values |
| `10q`, `10m` and `10MS` | not a suffix from the table in 9.5; case is significant |
| `10 k` and `10_k` | white space or `_` between number and suffix |
| `10kbs` and `10k5` | the suffixes `kbs` and `k5` do not exist |
| `50%` | `%` is not permitted in a suffix |
| `10ab` and `10e` | `a` to `f` cannot start a suffix; `e` introduces the exponent |
| `10x` and `10oz` | `x` and `o` cannot start a suffix |

## Appendix C – Deliberately not included

The following extensions, known from other JSON dialects, are **not** part of XTJSON. A conforming parser rejects them.

- freely chosen values without quotation marks (`colour: red`); an identifier at a value position is valid only as a defined named value
- named values defined by the application; named values are defined only in the document with `%define`
- a second definition of the same named value, forward references to named values defined later, and recursive definitions
- switching off strict mode that the application has requested; `%strict: false` is then an error
- directives other than `%define`, `%version` and `%strict`, directives of the parser or of the application, and directives inside objects and arrays or after the start of the content
- suffixes defined in the document or by the application; suffixes with characters other than those of an identifier (`50%`), or with white space before the suffix; suffixes that yield anything other than a number
- strings delimited by three quotation marks (`"""…"""`, `'''…'''`), heredocs and raw strings without escape sequences
- a line continuation with white space between `\` and the line break
- `\` before arbitrary characters (`\a` for `a`) and octal escape sequences (`\1`, `\012`)
- `+` as a sign, `.5`, `5.`, and `Infinity` and `NaN` as numbers
- a fraction part or exponent on hexadecimal, octal and binary numbers
- octal numbers with a bare leading zero (`0755`)
- Unicode identifiers, escape sequences in identifiers and `-` in identifiers
- characters as white space that ECMAScript does not treat as white space (for example U+0085, U+180E, U+200B)
- U+2028 and U+2029 as a line break
- implicit arrays at the top level, several documents in one file
- nestable comments
- additional data types (date, binary data, `undefined`), references, includes, expressions

## Appendix D – Design decisions

Informative. Decisions at points where several solutions were possible, with their rationale.

| Topic | Decision | Rationale |
|---|---|---|
| Empty document | an error, not `{}` | An empty or truncated file should be noticed; JSON behaves the same way. |
| Duplicate names | the last member applies; forbidden in strict mode | A fixed behaviour prevents two parsers from reading the same document differently. A general prohibition would exclude valid JSON texts and violate K1. |
| Characters in identifiers | ASCII letters, digits, `_`, `$` | Needs no Unicode tables and avoids confusable characters. Names such as `max-age` are written in quotation marks. |
| `true`/`false`/`null` as a name | permitted | Unambiguous at a name position; avoids a special rule. |
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
| Named values | only defined identifiers, no free text | A typo such as `ture` is reported as an error instead of being read as a string. |
| Named values: result | any JSON value, including an object or an array | Parts that recur in a document, such as an address or a link, are written once. Because the value is copied to every position, the value of the document remains a tree; there are no references. |
| `true`, `false`, `null` | predefined, not changeable | Otherwise a valid JSON text could change its meaning (K2). |
| Suffix: permitted characters | the same as in an identifier, but not `_` and not `a`–`f`, `A`–`F`, `o`, `O`, `x`, `X` at the beginning | A single character rule for names, named values and suffixes. `a`–`f` are excluded as the first character because they are hexadecimal digits and `e` introduces the exponent; `o` and `x` because they introduce number prefixes. A forgotten digit part (`0x`) thus remains an error without a special rule. |
| Suffix: `_` at the beginning | not permitted | A `_` after a digit thus always belongs to digit grouping. `1_0` cannot be read as `1` with the suffix `_0`, and the rules of 9.3 apply without exception. |
| Suffixes: where defined | exclusively by this specification; no custom suffixes | A number with a suffix has the same value with every parser, and a parser executes no conversion functions of the application. |
| Suffixes without effect | `s`, `px`, `L` and `n` leave the value unchanged | A number can be written with its unit, or in a form familiar from other languages, without its value changing. |
| Suffix: result | always a number | A suffix converts; it does not create another data type. |
| Suffix: precision | exact result | `0.1kb` should yield `102.4` and `100ms` should yield `0.1`, independent of the floating-point arithmetic of the parser. |
| Definitions | only in the document, with `%define`; the application cannot define named values | The value of a document depends only on its text and this specification. Every document is portable, and two parsers cannot read the same document differently. A document cannot inject code. |
| Definitions: order | a named value can be used only after its definition; a second definition is an error | There are no forward references and no cycles, and a parser reads the document in one pass. The meaning of a named value does not depend on the position at which it is used. |
| Directives: notation | `%`, name and `:`, then a value, optionally preceded by an identifier and `=` | `%` does not occur in JSON outside strings, so no JSON text changes its meaning (K1, K2). The `:` corresponds to the notation of a member; the `=` distinguishes the identifier being defined from a named value. |
| Directives: position | only at the top level, before the content | Readers and parsers know all definitions before the content begins. A directive cannot change the meaning of a part that has already been read. |
| Directives: which exist | only `%define`, `%version` and `%strict`; every other directive is an error, and the parser and the application cannot add any | Every document is read in the same way by every parser. Further directives can be added by later versions; permitting directives of the parser later would be compatible, restricting them would not. |
| `%version`: value | a string or a number, also with a suffix or as a named value; at most once per version | The same notations apply as for any other value; a named value can, for example, give the version both in a `%version` statement and in the content. `true`, `false`, `null`, objects and arrays do not state a version. A second statement for the same version could only contradict the first one. |
| `%version`: effect | the parser may reject an unsupported version or ignore the statement | A parser that does not know a version can still read documents that use only rules it knows; unknown rules are errors anyway. Versions of other things, such as a schema, are information for the application. |
| Directives and strict mode | the values of directives always satisfy the prohibitions on names, string values and duplicate names; `%strict` applies only to the content | A definition with a duplicate name or a noncharacter is almost always a mistake. A parser checks every value of a directive where it reads it and reports an error where it occurs, independent of whether a later `%strict` follows. Named values that are inserted into the content therefore satisfy the prohibitions of strict mode as well. |
| Directives: order | a directive has no effect on the directives before it | Every directive can be checked completely when it is read, and a parser reads the directives in one pass. This also holds for directives that later versions add. |
| Strict mode: root value | an object or an array | [I-JSON] only recommends this. A single string or number as the root value cannot be extended later by further members; in strict mode the recommendation becomes a rule that a parser can check. |
| Strict mode: support | every parser must offer it | Otherwise one parser would accept a document with `%strict: true` that another rejects; every document remains portable. |
| `%strict`: value | `true` or `false`, also as a named value; at most once | A switch has two states. A second `%strict` could only repeat or contradict the first one. |
| `%strict: false` and the application | an error if the application requests strict mode | A document can tighten the checks of the application but cannot switch them off. A contradiction is reported instead of silently preferring one side. |

## References

**Normative**

- **[RFC8259]** T. Bray (ed.), "The JavaScript Object Notation (JSON) Data Interchange Format", STD 90, RFC 8259, December 2017. <https://www.ietf.org/ietf-ftp/rfc/std/std90.txt>
- **[ECMA-404]** Ecma International, "The JSON Data Interchange Syntax", 2nd edition, December 2017. <https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf>
- **[I-JSON]** T. Bray (ed.), "The I-JSON Message Format", draft-ietf-json-i-json-06, January 2015 (published as RFC 7493). <https://www.ietf.org/archive/id/draft-ietf-json-i-json-06.txt>
- **[ECMA-262]** Ecma International, "ECMAScript 2026 Language Specification", ECMA-262, 17th edition, June 2026. <https://262.ecma-international.org/17.0/index.html> – authoritative only for the white space characters and escape sequences adopted in 5.1 and 8.2.
- **[RFC5234]** D. Crocker, P. Overell, "Augmented BNF for Syntax Specifications: ABNF", STD 68, RFC 5234.
- **[RFC3629]** F. Yergeau, "UTF-8, a transformation format of ISO 10646", STD 63, RFC 3629.
- **[RFC2119]**, **[RFC8174]** Key words for use in RFCs to indicate requirement levels, BCP 14.

**Informative**

- ECMA-262, 1st edition (June 1997), 3rd edition (December 1999), 5th edition (December 2009) and 6th edition (June 2015, "ECMAScript 2015") – for the information in the "Origin" columns; referred to in the tables as ES1, ES3, ES5 and ES2015.
- RFC 3339, "Date and Time on the Internet: Timestamps".
- RFC 4648, "The Base16, Base32, and Base64 Data Encodings".

## Changes

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
