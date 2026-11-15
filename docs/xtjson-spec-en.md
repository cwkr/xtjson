# XTJSON

**Specification, draft 0.4** · Date: 15 November 2026

## Contents

1. [Introduction](#1-introduction)
2. [Conventions and terms](#2-conventions-and-terms)
3. [Compatibility](#3-compatibility)
4. [Encoding](#4-encoding)
5. [White space, line breaks and comments](#5-white-space-line-breaks-and-comments)
6. [Document, root object and values](#6-document-root-object-and-values)
7. [Objects, arrays and separators](#7-objects-arrays-and-separators)
8. [Strings](#8-strings)
9. [Numbers](#9-numbers)
10. [Mapping to JSON](#10-mapping-to-json)
11. [Conformance](#11-conformance)
12. [I-JSON profile](#12-i-json-profile)
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
| E6 | Strings in single quotation marks (`'…'`) | [8.1](#81-single-line-strings) |
| E7 | Integers in hexadecimal, octal and binary notation | [9.2](#92-hexadecimal-octal-binary) |
| E8 | `_` for grouping digits | [9.3](#93-digit-grouping) |
| E9 | Additional escape sequences: `\v`, `\0`, `\xHH`, `\u{…}` | [8.2](#82-escape-sequences) |
| E10 | Additional white space characters: all white space characters of ECMAScript | [5.1](#51-white-space) |
| E11 | Multi-line strings with `"""` or `'''` | [8.3](#83-multi-line-strings) |
| E12 | Named values: identifiers as values, aliases for JSON values defined in the parser (`nil`) | [6.4](#64-named-values) |
| E13 | Number suffixes (`10k`, `64mb`, `50pct`) | [9.5](#95-number-suffixes) |

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
| definition | the assignment of a JSON value to a named value (6.4) |
| predefined | fixed by this specification and not changeable |
| custom definition | a definition that the application passes to the parser |
| JSON equivalent | the JSON text onto which an XTJSON document is mapped according to [section 10](#10-mapping-to-json) |

## 3. Compatibility

This section is normative. It states what "fully compatible" with [RFC8259] (STD 90), [ECMA-404] and [I-JSON] means.

**K1 – Syntactic superset.** Every UTF-8 encoded JSON text according to [RFC8259] and [ECMA-404] is a valid XTJSON document. The same holds for every I-JSON message according to [I-JSON].

**K2 – Preservation of meaning.** As an XTJSON document, a JSON text denotes the same value as it does as a JSON text. No extension changes the meaning of a text that is already valid JSON.

**K3 – Unchanged data model.** Every XTJSON document has, relative to the definitions with which it is read (6.4), a JSON equivalent ([section 10](#10-mapping-to-json)) that determines its value. Named values and number suffixes are only other notations for JSON values. A value that cannot be represented in JSON cannot be represented in XTJSON either.

**K4 – Inherited semantics.** Everything that this specification does not explicitly extend applies as in [RFC8259]: the meaning of `true`, `false` and `null`, the escape sequences of JSON, the treatment of number range and precision, the insignificance of member order, and string comparison.

**K5 – Delimitation.** An XTJSON document that uses at least one of the extensions E1–E13 is **not** a JSON text. It follows that:

- Such documents MUST NOT be labelled with the media type `application/json` or sent to recipients that expect JSON.
- An XTJSON parser is not a conforming processor in the sense of [ECMA-404], because such a processor is not to accept non-conforming input. It is, however, a permitted parser in the sense of [RFC8259] section 9, which explicitly allows parsers to accept extensions.
- Whoever generates JSON MUST adhere strictly to the JSON grammar ([RFC8259] section 10). The mapping in section 10 is the bridge.

Informative – why K1 and K2 hold: every extension occupies only notations that are a syntax error in JSON. `/`, `#`, `'` and the additional white space characters (5.1) do not occur in JSON outside strings; the additional escape sequences are invalid `\` sequences in JSON; three quotation marks in a row cannot start a value in JSON; a name without quotation marks, a comma before a closing bracket, a `:` after the root value, two items without a comma, and `0x`, `0o`, `0b` and `_` in numbers are invalid in JSON; so are an identifier at a value position other than `true`, `false` and `null`, and a suffix directly after a number. The three literals of JSON are predefined and cannot be changed, and no suffix begins with `e` or `E`, so the exponent of a JSON number is never read as a suffix. The line break rule (E5) applies only where JSON requires a comma; everywhere else a line break remains insignificant white space.

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
- Inside strings nothing changes compared to JSON: the control characters U+0009 to U+000D MUST be escaped; all other characters in the table may appear unescaped. Exceptions apply in multi-line strings (8.3).
- Characters that are not in the table are not white space, even if they are invisible or have the Unicode property White_Space (for example U+0085, U+180E, U+200B). Outside strings and comments they are an error.

White space and comments are permitted between any tokens. Inside a number, including its suffix, and inside an identifier they are an error (`- 1`, `10 k`, `tr ue`); inside a string they are content.

### 5.2 Line breaks

A line break (`newline`) is U+000A (LF), U+000D (CR) or the sequence U+000D U+000A (CR LF). The sequence counts as a single line break. All other white space characters from 5.1, including U+2028 and U+2029, are **not** line breaks.

Line breaks have three functions: they end a line comment (5.3), they can serve as a separator between two items ([7.3](#73-separators)), and they divide a multi-line string into lines ([8.3](#83-multi-line-strings)). Everywhere else they are ordinary white space. A line break inside a block comment is part of the comment and has none of these functions.

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

## 6. Document, root object and values

### 6.1 Document

```abnf
XTJSON-text  = S ( value / root-members ) S [ line-comment ]
root-members = member-list
```

A line comment at the end of the document does not need a final line break.

An XTJSON document is either a single value (as in JSON) or an implicit root object. A document that consists only of white space and comments is an error, just as an empty text is not a JSON text.

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

**Detection.** A parser decides after the first token: if it is a single-line string or an identifier and the next token is a `:`, the document is an implicit root object. Otherwise a single value is read. Because a `:` never follows the root value in JSON, no JSON text is reinterpreted.

### 6.3 Values

```abnf
value        = object / array / string / number / named-value
named-value  = identifier
```

A value is an object or an array (section 7), a string (section 8), a number (section 9) or a named value (6.4). The literals `true`, `false` and `null` of JSON are named values with a fixed meaning in XTJSON.

### 6.4 Named values

A named value is an identifier (7.2) at a value position. It therefore consists of the same characters as a name without quotation marks. It stands for the JSON value that a definition assigns to it.

- **Predefined** are exactly three named values: `true`, `false` and `null`, with the meaning they have in JSON. They MUST NOT be redefined, overridden or removed.
- **Custom definitions.** The application can pass further named values to the parser. Each definition assigns exactly one JSON value to an identifier: a string, a number, `true`, `false` or `null`. An object or an array MUST NOT be assigned.
- **Alias, not a data type.** In the JSON equivalent, the assigned JSON value appears in place of the named value. A named value is only another notation for that value; no new data types arise.
- **Case is significant.** `nil`, `Nil` and `NIL` are three different named values, and `True` is not `true`.
- **Undefined is an error.** An identifier at a value position for which there is no definition is an error. A parser MUST NOT interpret it as a string or in any other way instead.
- **Name position.** At a name position an identifier is always a name and never a named value (7.2): `{nil: nil}` has the name `"nil"`.
- **Not part of the document.** Definitions belong to the configuration of the parser. A document cannot itself define named values. The definitions apply unchanged to the entire document.

Examples of custom definitions:

| Named value | JSON value |
|---|---|
| `nil` | `null` |
| `zero` | `0` |
| `unknown` | `"not specified"` |

Read with these three definitions:

```xtjson
{
  middle_name: nil
  children: zero
  occupation: unknown
  nil: "an ordinary name at a name position"
}
```

JSON equivalent:

```json
{
  "middle_name": null,
  "children": 0,
  "occupation": "not specified",
  "nil": "an ordinary name at a name position"
}
```

Without these definitions the same document is an error.

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
name         = dq-string / sq-string / identifier
identifier   = id-start *id-continue
id-start     = ALPHA / "_" / "$"
id-continue  = ALPHA / DIGIT / "_" / "$"
```

- A name is a single-line string (8.1) or an identifier. A multi-line string (8.3) is not permitted as a name.
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

**Duplicate names.** As in [RFC8259], the names within an object SHOULD be unique. If a name occurs more than once in an object, the member with this name that comes last in the document applies; the earlier ones are discarded. This also holds for the implicit root object. A parser MUST behave in this way and SHOULD point out duplicate names. In the I-JSON profile duplicate names are forbidden ([section 12](#12-i-json-profile)).

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

### 8.1 Single-line strings

```abnf
string        = ml-dq-string / ml-sq-string / dq-string / sq-string
dq-string     = DQUOTE *( dq-unescaped / escape-seq ) DQUOTE
sq-string     = SQUOTE *( sq-unescaped / escape-seq ) SQUOTE
```

- A single-line string is enclosed in double (`"`) or in single (`'`) quotation marks. Both forms are equivalent and permitted wherever a string may appear, including as a name.
- It ends at the first unescaped occurrence of the character with which it began.
- In a `"` string, `'` may appear unescaped; in a `'` string, `"` may appear unescaped. The respective delimiter MUST be escaped (`\"` or `\'`).
- As in JSON, the backslash and the control characters U+0000 to U+001F MUST be escaped. A single-line string therefore cannot extend across a line break; multi-line strings (8.3) exist for that purpose.
- All other characters may appear unescaped as in JSON, including U+007F, U+2028, U+2029 and the non-ASCII white space characters from 5.1.

### 8.2 Escape sequences

```abnf
escape-seq       = %x5C ( char-escape / null-escape / hex-escape /
                          unicode-escape / codepoint-escape )
codepoint-escape = %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}"
```

XTJSON has all escape sequences of JSON and, in addition, five more from ECMAScript [ECMA-262]: `\'`, `\v`, `\0`, `\xHH` and `\u{…}`. All of them apply in all string forms, including multi-line strings (8.3). The column "Origin" gives JSON if the sequence already applies there, and otherwise the ECMAScript edition that introduced it.

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
| `\u{…}` | code point U+0000 to U+10FFFF (one or more hexadecimal digits) | ES2015 (ES6) |

Rules:

- **`\xHH` and `\uXXXX`** require exactly two and exactly four hexadecimal digits respectively, in upper or lower case. The letters `x` and `u` themselves are lower case. `\xHH` stands for the code point U+00HH, not for a byte. Characters outside the BMP are written either with `\u{…}` or, as in JSON, as a surrogate pair of two `\uXXXX` sequences.
- **`\u{…}`** contains at least one hexadecimal digit between the braces, in upper or lower case; leading zeros are permitted, `_` and white space are not. The value MUST NOT be greater than 10FFFF. The sequence stands for exactly this code point: `\u{1F600}` is equivalent to the surrogate pair `\uD83D\uDE00`, `\u{e4}` to `\u00E4`. A value in the surrogate range (D800 to DFFF) is an error; a single surrogate can only be written with `\uXXXX`, as in JSON.
- **`\0`** MUST NOT be followed immediately by a decimal digit. `\1` to `\9` are errors. There are thus no octal escape sequences.
- **Every other sequence with `\` is an error.** This holds in particular for `\` before any other character (`\a`, `\-`, `\N`, `\X41`) and for `\` before a line break (no line continuation).

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

### 8.3 Multi-line strings

```abnf
ml-dq-string  = 3DQUOTE *ml-dq-item 3DQUOTE
ml-sq-string  = 3SQUOTE *ml-sq-item 3SQUOTE
ml-dq-item    = [ DQUOTE [ DQUOTE ] ] ( dq-unescaped / ml-plain )
ml-sq-item    = [ SQUOTE [ SQUOTE ] ] ( sq-unescaped / ml-plain )
ml-plain      = escape-seq / newline / %x09
```

A multi-line string begins and ends with three double (`"""`) or three single (`'''`) quotation marks. It is permitted wherever a value may appear; it is not permitted as a name (7.2). Both forms are equivalent. It may also be written on a single line.

**Notation**

- **Detection.** If a string begins with three identical quotation marks in a row, it is always a multi-line string.
- **End.** The string ends at the first occurrence of three identical unescaped delimiter characters in a row. One or two delimiter characters in a row may appear unescaped in the text, but not immediately before the closing delimiter; there they are escaped (`\"` or `\'`). The other quotation mark may appear unescaped any number of times.
- **Line breaks and tab.** Line breaks according to 5.2 and U+0009 may appear unescaped in the string. All other control characters (U+0000 to U+001F) MUST be escaped as in single-line strings.
- **Escape sequences** apply as in 8.2. A `\` before a line break is an error.
- The character sequences `//`, `/*` and `#` have no special meaning in the string, and a line break in the string is not a separator according to 7.3.

**Value**

In this section, "white space" means only unescaped spaces (U+0020) and tabs (U+0009). All other white space characters from 5.1 are ordinary text here. The value of a multi-line string is obtained in four steps:

1. **Form lines.** The text between the delimiters is split into lines at every unescaped line break. The first line begins after the opening delimiter, the last one ends before the closing delimiter. A text without a line break consists of a single line. Escape sequences such as `\n` are not line breaks in this sense.
2. **Remove white space at the end of lines.** From every line except the last, the unescaped white space at its end is removed. This always happens. The last line remains unchanged, because it does not end at a line end but at the closing delimiter.
3. **Remove indentation.** This step applies only if the string begins with an empty line, that is: if there are at least two lines and the first one is empty after step 2.
   1. The first line is dropped.
   2. The indentation of a line is the sequence of white space characters at its beginning; its length is the number of these characters. A tab counts as one character.
   3. The smallest indentation of all non-empty lines is determined. The last line always counts, even if it is empty or consists only of white space.
   4. From every line, as many characters are removed at the beginning as the smallest indentation indicates. Empty lines remain empty. The removed characters MUST be the same in all lines from which characters are removed; otherwise the string is an error, for example if one line is indented with a tab and another with spaces.
4. **Join.** The lines are joined with one U+000A each, regardless of whether the line break is written in the file as LF, CR or CR LF. After that the escape sequences are resolved.

Consequences of these rules:

- If nothing or only white space follows the opening delimiter up to the line break, this white space and the line break are not part of the value. A line break before the closing delimiter is part of the value.
- The position of the closing delimiter helps determine how much indentation is removed: if it is as far left as the text, the common indentation disappears entirely; if it is further left, the difference is kept; if it is at the start of the line, nothing is removed; if it is further right, the excess white space before it remains at the end of the value.
- If the text begins on the line of the opening delimiter, no indentation is removed.
- White space that is to be kept at the end or at the beginning of a line is written as an escape sequence, for example `\x20` or `\t`.
- Empty lines within the text are kept as empty lines and do not affect the indentation.

In the following table `·` stands for a space and `⏎` for a line break. The right-hand column shows the value as a JSON string.

| Written | Value | Explanation |
|---|---|---|
| `"""⏎··a⏎··b⏎··"""` | `"a\nb\n"` | common indentation of 2 removed |
| `"""⏎····a⏎··"""` | `"  a\n"` | the closing delimiter is further left |
| `"""⏎··a⏎"""` | `"  a\n"` | the closing delimiter is at the start of the line |
| `"""⏎··a⏎····"""` | `"a\n  "` | the closing delimiter is further right |
| `"""⏎··a⏎⏎··b"""` | `"a\n\nb"` | the empty line does not count |
| `"""a··⏎··b"""` | `"a\n  b"` | does not begin with an empty line: only the line end is cleaned |
| `"""⏎a··⏎b\x20⏎"""` | `"a\nb \n"` | escaped white space at the end of a line is kept |
| `"""a··"""` | `"a  "` | no line end, nothing removed |

```xtjson
{
  sql: '''
    SELECT "name"
      FROM customers
     WHERE city = 'Köln'
    '''
  note: """
      Two characters of indentation remain,
      because the closing delimiter is further left.
    """
  direct: """The text begins on the line of the delimiter:
    no indentation is removed here."""
  single_line: """also permitted on one line"""
}
```

JSON equivalent:

```json
{
  "sql": "SELECT \"name\"\n  FROM customers\n WHERE city = 'Köln'\n",
  "note": "  Two characters of indentation remain,\n  because the closing delimiter is further left.\n",
  "direct": "The text begins on the line of the delimiter:\n    no indentation is removed here.",
  "single_line": "also permitted on one line"
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

The **JSON equivalent** of an XTJSON document is obtained by the following steps. They also define the meaning of every XTJSON document. If the document contains named values, the JSON equivalent is relative to the definitions with which the document is read.

1. **Comments** are removed. **White space characters** that JSON does not have are replaced by a space (U+0020).
2. **Implicit root object:** the members are enclosed in `{` `}`.
3. **Separators:** between any two consecutive items there is exactly one comma. Trailing commas are dropped.
4. **Names:** an identifier at a name position becomes the JSON string with the same character sequence.
5. **Strings:** a `'` string becomes the `"` string with the same content; unescaped `"` become `\"`. Escape sequences that JSON does not have are replaced in all string forms: `\'` by `'`, `\v` by `\u000B`, `\0` by `\u0000`, `\xHH` by `\u00HH`, `\u{…}` by the `\uXXXX` sequence of the same code point, above U+FFFF by the corresponding surrogate pair. A multi-line string becomes the `"` string that represents the value according to 8.3; characters that may not appear unescaped in a JSON string (`"`, `\` and control characters such as line break and tab) are escaped in the process.
6. **Numbers:** all `_` are removed from decimal numbers; otherwise the notation remains unchanged. Hexadecimal, octal and binary numbers become the decimal integer of the same value, with a leading minus sign if preceded by `-`. A number with a suffix is replaced by the result of the conversion, written as a JSON number (9.5).
7. **Named values:** `true`, `false` and `null` remain unchanged. Every other named value is replaced by the JSON value that its definition assigns to it (6.4).

The JSON equivalent is unique up to white space and the choice of equivalent escape sequences. If it contains an object with duplicate names, the rule from 7.2 applies to its value: the last member applies. Two XTJSON documents are **equivalent** if their JSON equivalents denote the same value. A document that is already a JSON text is its own JSON equivalent (up to white space).

An example with a side-by-side comparison is given in [Appendix B.1](#b1-complete-example).

## 11. Conformance

**Document.** A text is a conforming XTJSON document if it is encoded according to section 4, conforms to the rule `XTJSON-text` and each of its number suffixes is listed in the table in 9.5. A conforming document is **valid with respect to a set of definitions** if each of its named values is defined in it. It is **portable** if it uses only predefined named values; a portable document can be read by every conforming parser.

**Parser.** A conforming XTJSON parser

- MUST accept every conforming XTJSON document that is valid with respect to its definitions and deliver the value of its JSON equivalent – and thus also every JSON text and every I-JSON message – unless a limit or restriction according to the fourth item applies;
- MUST reject as an error every text that is not a conforming XTJSON document or that contains an undefined named value, and MUST NOT silently accept any further syntax extensions;
- MUST know the predefined named values and all suffixes from 9.5, MUST NOT allow them to be redefined or further suffixes to be added, and MUST reject custom definitions that violate 6.4. It SHOULD enable the application to define custom named values. Without action by the application, only the predefined named values are active;
- MAY set limits on document size, nesting depth, number range and precision, and string length, and enforce semantic restrictions (for example in the I-JSON mode according to section 12);
- SHOULD offer an I-JSON mode according to section 12.

**Generator.** An XTJSON generator MUST output conforming XTJSON documents. Every JSON generator that outputs UTF-8 is therefore also an XTJSON generator. If the recipient is a program, JSON SHOULD be output. Custom named values SHOULD be output only if it is certain that the recipient uses the same definitions.

**Converter.** A converter from XTJSON to JSON MUST produce the JSON equivalent according to section 10, relative to the definitions passed to it; its output MUST conform strictly to the grammar of [RFC8259].

## 12. I-JSON profile

An XTJSON document is **I-JSON conforming** if its JSON equivalent is a valid I-JSON message according to [I-JSON]. The values that result from named values and number suffixes are also relevant here. Beyond sections 4–9 this means:

- Names and string values MUST NOT contain surrogates or Unicode noncharacters, neither directly nor as an escape sequence. A single `"\uDEAD"` is invalid; a correct surrogate pair is permitted.
- An object MUST NOT contain duplicate names. The comparison is made after all escape sequences have been resolved and independently of the notation of the name (identifier or string in one of the forms from section 8).
- Numbers SHOULD NOT exceed the magnitude or precision of IEEE 754 binary64. For integers outside [−(2⁵³)+1, (2⁵³)−1] exact processing must not be expected; this also applies to hexadecimal, octal and binary notation. Such values are better transmitted as strings.
- The root value SHOULD be an object or an array. The implicit root object satisfies this recommendation.

A parser in I-JSON mode MUST reject documents that violate one of the two prohibitions (MUST NOT).

The recommendations of [I-JSON] for protocols also apply unchanged to XTJSON documents: ignore unknown members, write times as strings according to RFC 3339, write binary data as base64url strings.

## 13. Security considerations

- **No `eval`.** XTJSON is not a subset of JavaScript or of any other programming language and MUST NOT be read by evaluating it as program code.
- **Resource limits.** Deeply nested structures, very long strings or numbers, and unterminated block comments and multi-line strings can overload parsers. Parsers SHOULD set limits (section 11).
- **Divergent interpretation.** If two components process the same document differently, checks can be bypassed. This concerns above all duplicate names, which other JSON tools may treat differently from what 7.2 specifies, and numbers outside the exact range. Where a document controls security-relevant decisions, the I-JSON profile is RECOMMENDED.
- **Definitions.** The meaning of a document with custom named values depends on the definitions of the parser. Two parsers with different definitions read the same document differently, or one of them rejects it. Custom definitions are therefore part of the interface between author and application and SHOULD be documented. The conversions of the suffixes are fixed by this specification alone; a document can bring along neither definitions nor code.
- **Confusion with JSON.** An XTJSON document that is passed off as JSON leads to errors with strict recipients and to inconsistent behaviour with lenient ones. Hence the delimitation in K5.
- **Comments.** Comments are lost in the mapping to JSON and are not seen by programs. Invisible characters and characters that control text direction in comments and strings can make the displayed text differ from the processed text; tools SHOULD point this out.
- **U+2028 and U+2029.** Some editors display these characters as a line change. In XTJSON they neither end a line comment nor separate items. Text that is displayed below a line comment can therefore still belong to the comment and is then not processed. Tools SHOULD make these characters visible outside strings or warn about them.
- **Multi-line strings.** White space at the end of lines and, where applicable, the indentation are not part of the value (8.3). The value can therefore differ from what is seen. Where every character matters, for example in key material or signed texts, white space is better written as an escape sequence.

---

## Appendix A – Complete grammar (ABNF)

Normative. The core rules `ALPHA`, `DIGIT`, `HEXDIG`, `BIT` and `DQUOTE` come from [RFC5234]; because of the case-insensitivity rule, `HEXDIG` there also includes `a`–`f`.

```abnf
; ---------- Document ----------
XTJSON-text    = S ( value / root-members ) S [ line-comment ]
root-members   = member-list                 ; implicit root object

; ---------- Values ----------
value          = object / array / string / number / named-value
named-value    = identifier                  ; true, false, null and
                                             ; custom definitions (6.4)

; ---------- Objects ----------
object         = "{" S [ member-list S ] "}"
member-list    = member *( item-sep member ) [ S "," ]
member         = name S ":" S value
name           = dq-string / sq-string / identifier
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
string         = ml-dq-string / ml-sq-string / dq-string / sq-string
dq-string      = DQUOTE *( dq-unescaped / escape-seq ) DQUOTE
sq-string      = SQUOTE *( sq-unescaped / escape-seq ) SQUOTE
ml-dq-string   = 3DQUOTE *ml-dq-item 3DQUOTE
ml-sq-string   = 3SQUOTE *ml-sq-item 3SQUOTE
ml-dq-item     = [ DQUOTE [ DQUOTE ] ] ( dq-unescaped / ml-plain )
ml-sq-item     = [ SQUOTE [ SQUOTE ] ] ( sq-unescaped / ml-plain )
ml-plain       = escape-seq / newline / %x09
dq-unescaped   = %x20-21 / %x23-5B / %x5D-10FFFF     ; without " and \
sq-unescaped   = %x20-26 / %x28-5B / %x5D-10FFFF     ; without ' and \
escape-seq     = %x5C ( char-escape / null-escape / hex-escape /
                        unicode-escape / codepoint-escape )
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
- Three conditions apply in addition to the grammar: no decimal digit follows `null-escape`, the value in `codepoint-escape` is not in the range D800 to DFFF, and every `suffix` is listed in the table in 9.5.
- Two values always need a separator according to 7.3. Character sequences such as `0755`, `1_`, `0b102`, `123abc` or `10_k` can therefore never be read as a valid sequence of several tokens and are errors.
- Whether a `named-value` is defined is decided not by the grammar but by the set of definitions (6.4).
- A line comment always extends to the next line break: `eol` requires a `newline` after it, and `non-eol` excludes only U+000A and U+000D. Only at the end of the document may the line break be missing.
- The sequence CR LF is always a single `newline`, never two.
- For multi-line strings the grammar describes only the notation. Their value results from the steps in 8.3.
- A parser needs two characters of lookahead (for `"""` and `'''`) and the information "since the last token a line break has occurred outside a block comment". Only at the start of the document is one further token of lookahead needed (6.2).

## Appendix B – Examples

### B.1 Complete example

XTJSON document:

```xtjson
# Service configuration – the root braces are omitted
name: 'demo-service'
version: "1.4.0"
$schema: "https://example.org/schema/service.json"

listen: {
  host: "0.0.0.0"
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

// multi-line string: the common indentation is not part of the value
motd: """
  Welcome.
  Maintenance: Sundays 02:00.
  """

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

In the tables `⏎` stands for a line break. The tables apply to a parser without custom definitions.

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

**Names**

| Text | Reason |
|---|---|
| `{2fa: true}` | identifier begins with a digit |
| `{größe: 1}` | non-ASCII character in the identifier |
| `{a.b: 1}` | `.` is not permitted in an identifier |
| `{max-age: 1}` | `-` is not permitted in an identifier |
| `{"""a""": 1}` | multi-line string as a name |

**Strings**

| Text | Reason |
|---|---|
| `'It's'` | `'` not escaped in a `'` string |
| `"a` ⏎ `b"` | line break in a single-line string |
| `"a\` ⏎ `b"` | no line continuation |
| `"\a"`, `"\N"`, `"\-"` | unknown escape sequence |
| `"\1"` and `"\01"` | digit after `\` or after `\0` |
| `"\x4"` and `"\u12"` | too few hexadecimal digits |
| `"\u{110000}"`, `"\u{D800}"` | code point greater than U+10FFFF or in the surrogate range |
| `"\u{}"`, `"\u{1_F600}"`, `"\u{ 41 }"`, `"\U{41}"` | no digit, `_` or white space in the braces, capital `U` |
| `"""abc` | multi-line string not terminated |
| `"""a""""` | quotation mark immediately before the closing delimiter not escaped |
| `"""⏎` TAB `a⏎··b⏎·"""` | the removed indentation is not the same in all lines |

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
- objects and arrays as named values
- definitions inside the document: a document cannot define named values or suffixes
- custom suffixes of the application; suffixes with characters other than those of an identifier (`50%`), or with white space before the suffix; suffixes that yield anything other than a number
- line continuation with `\`, heredocs and raw strings without escape sequences
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
| Duplicate names | the last member applies; forbidden in the I-JSON profile | A fixed behaviour prevents two parsers from reading the same document differently. A general prohibition would exclude valid JSON texts and violate K1. |
| Characters in identifiers | ASCII letters, digits, `_`, `$` | Needs no Unicode tables and avoids confusable characters. Names such as `max-age` are written in quotation marks. |
| `true`/`false`/`null` as a name | permitted | Unambiguous at a name position; avoids a special rule. |
| Line break | LF, CR or CR LF; CR LF counts as one | A single definition that is the same everywhere for separators, line comments and multi-line strings, independent of the line endings of the file. |
| Additional white space | all white space and line terminator characters of ECMAScript 2026; only the line break according to 5.2 is a separator | In this way the structure of a document does not depend on characters that editors display inconsistently or not at all. Unlike in ECMAScript, U+2028 and U+2029 are therefore not line terminators. |
| Category Zs | given as a fixed list | Parsers need no Unicode tables, and the grammar does not change with new Unicode versions. ECMAScript, by contrast, refers to the current category in each case. |
| U+FEFF | white space everywhere, not only at the start of the document | Follows from adopting the ECMAScript white space characters. A special rule for the BOM at the start of the document is thus not needed. |
| Line break in a block comment | does not count as a separator | A block comment behaves like a space everywhere and never changes the structure. The separator rule can thus be expressed completely in ABNF. |
| Additional escape sequences | only `\'`, `\v`, `\0`, `\xHH` and `\u{…}` | There is no line continuation and no `\` before arbitrary characters: single-line strings stay on one line, and a typo such as `\N` instead of `\n` is reported as an error instead of silently yielding `N`. |
| Multi-line strings: escape sequences | effective in `"""` and `'''` alike | Both forms remain equivalent, as with single-line strings. |
| Multi-line strings: end | at the first `"""` or `'''` | A simple rule; a quotation mark directly before the end is escaped. |
| Multi-line strings: line endings | CR and CR LF become LF | The value does not depend on the line endings with which the file is saved. |
| Multi-line strings: tab | permitted unescaped | Text indented with tabs should not be an error. |
| Multi-line strings: white space at the end of lines | unescaped white space before a line break is always removed | Invisible characters at the end of a line should not change the value. Before the closing delimiter, white space is visible and is therefore kept. |
| Multi-line strings: indentation | the smallest indentation is removed if the string begins with an empty line | The text can be indented together with the surrounding structure. To keep the indentation, begin the text on the line of the opening delimiter. |
| Multi-line strings: last line | always counts towards the smallest indentation | The position of the closing delimiter makes it possible to determine how much indentation is kept. |
| Multi-line strings: empty lines | do not count towards the smallest indentation | Otherwise the smallest indentation would be zero for every text with paragraphs. |
| Multi-line strings: measure of indentation | number of characters; a tab counts as one; the removed characters must be the same in all lines | No assumption about tab widths. Mixed indentation is reported as an error instead of shifting the text unnoticed. |
| Multi-line strings: as a name | not permitted | A name across several lines is almost always a mistake. |
| Multi-line strings: what counts as white space | only unescaped spaces and tabs | Other white space characters can belong to the text, for example U+3000 at the start of a paragraph or U+00A0 at the end of a line. |
| `\u{…}` | no value in the surrogate range | The notation stands for a code point; single surrogates remain reserved for the form `\uXXXX` adopted from JSON. |
| Non-decimal numbers | exact or an error | With bit masks and addresses every digit matters; silent rounding would be an error that is hard to find. |
| Prefixes `0x`/`0o`/`0b` | upper and lower case equivalent | Consistent with `e`/`E` in the exponent. Lower case is recommended. |
| Sign on non-decimal numbers | `-` permitted, `+` not | Consistent with the JSON rule `[ minus ]`. |
| `_` in numbers | single, only between two digits | A simple rule that is easy to check. |
| Named values | only defined identifiers, no free text | A typo such as `ture` is reported as an error instead of being read as a string. |
| Named values: result | a string, a number, `true`, `false` or `null`; no object and no array | A named value is an alias for a simple value. The structure of a document, made of objects and arrays, is thus written entirely in the document itself and does not depend on the definitions. |
| `true`, `false`, `null` | predefined, not changeable | Otherwise a valid JSON text could change its meaning (K2). |
| Suffix: permitted characters | the same as in an identifier, but not `_` and not `a`–`f`, `A`–`F`, `o`, `O`, `x`, `X` at the beginning | A single character rule for names, named values and suffixes. `a`–`f` are excluded as the first character because they are hexadecimal digits and `e` introduces the exponent; `o` and `x` because they introduce number prefixes. A forgotten digit part (`0x`) thus remains an error without a special rule. |
| Suffix: `_` at the beginning | not permitted | A `_` after a digit thus always belongs to digit grouping. `1_0` cannot be read as `1` with the suffix `_0`, and the rules of 9.3 apply without exception. |
| Suffixes: where defined | exclusively by this specification; no custom suffixes | A number with a suffix has the same value with every parser, and a parser executes no conversion functions of the application. |
| Suffixes without effect | `s`, `px`, `L` and `n` leave the value unchanged | A number can be written with its unit, or in a form familiar from other languages, without its value changing. |
| Suffix: result | always a number | A suffix converts; it does not create another data type. |
| Suffix: precision | exact result | `0.1kb` should yield `102.4` and `100ms` should yield `0.1`, independent of the floating-point arithmetic of the parser. |
| Definitions | part of the configuration of the parser, not of the document | A document can neither change meanings nor inject code. Without custom definitions all parsers behave the same. |

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
