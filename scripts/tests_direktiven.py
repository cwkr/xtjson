"""Zusatztests: die Direktive %strict (6.5) und der Strict-Modus (12)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

# (Text, erwarteter Wert)
VALID = [
    # Schreibweise: Leerraum, Zeilenumbrueche und Kommentare um ':'
    ('%strict:true\n[1]', [1]),
    ('%strict :true\n[1]', [1]),
    ('%strict:\n  true\n[1]', [1]),
    ('%strict /* k */ : /* k */ true\n[1]', [1]),
    ('%strict: // k\n  true\n[1]', [1]),
    ('%strict:\ttrue\t\n[1]', [1]),
    # Trenner wie zwischen Elementen
    ('%strict: true, [1]', [1]),
    ('%strict: true,\n[1]', [1]),
    ('%strict: true\n,[1]', [1]),
    ('%strict: true // k\n[1]', [1]),
    ('%strict: true /* k */\n[1]', [1]),
    ('%strict: true\r\n[1]', [1]),
    ('%strict: true\r[1]', [1]),
    ('%strict: true,\n\n[1]', [1]),
    ('%strict:true,[1]', [1]),
    # Kommentare, Shebang und BOM vor der Direktive
    ('# Kommentar\n%strict: true\n\n# x\nb: 1', {'b': 1}),
    ('#!/usr/bin/env xtjson-tool\n%strict: false\n{}', {}),
    ('﻿%strict: true\n[1]', [1]),
    ('/* k */ %strict: true\n[1]', [1]),
    # Inhalt nach der Direktive: Wert oder implizites Wurzelobjekt
    ('%strict: true\n"x": 1', {'x': 1}),
    ("%strict: true\n'x': 1, y: nil", {'x': 1, 'y': None}),
    ('%strict: true\nstrict: true', {'strict': True}),
    ('%strict: true\n{"a": 1}', {'a': 1}),
    ('%strict: false\n"s"', 's'),
    ('%strict: false\n-1', -1),
    ('%strict: false, 1', 1),
    ('%strict: false\nnil', None),
    ('%strict: true\n[nil]', [None]),
    ('%strict: true\na: 1', {'a': 1}),
    # Namen und Strings, die wie Direktiven aussehen
    ('{define: 1, version: 2, strict: 3}', {'define': 1, 'version': 2, 'strict': 3}),
    ('"%strict": true', {'%strict': True}),
    ("{'%define': 'a = 1'}", {'%define': 'a = 1'}),
    ('["%strict: true"]', ['%strict: true']),
    # Strict-Modus mit %strict: true
    ('%strict: true\n{"\\uD83D\\uDE00": "\\u{1F600}"}', {'\U0001F600': '\U0001F600'}),
    ('%strict: true\n[{a: 1}, {a: 2}, {b: {a: 3}}]', [{'a': 1}, {'a': 2}, {'b': {'a': 3}}]),
    ('%strict: true\n{a: nil, b: null}', {'a': None, 'b': None}),
    # ohne Strict-Modus gelten seine Verbote nicht
    ('%strict: false\n["\\uDEAD"]', ['\udead']),
    ('%strict: false\n{a: 1, a: 2}', {'a': 2}),
    ('{a: 1, "a": 2}', {'a': 2}),
]

# Texte, die abgelehnt werden muessen
INVALID = [
    # Schreibweise
    '% strict: true\n{}', '%\tstrict: true\n{}', '%/**/strict: true\n{}', '%\nstrict: true\n{}',
    '%strict true\n{}', '%strict: true true\n{}', '%strict:: true\n{}', '%strict = true\n{}',
    '%strict: s = true\n{}', '%strict: xtjson = true\n{}', '%strict\n{}', '%strict:\n{}', '%\n1', '%1: 2\n1',
    '%%strict: true\n{}', '%-strict: true\n{}', '%strict: true;\n{}', '%"strict": true\n{}',
    '%strictly: true\n{}', '%strict_: true\n{}', '%stricttrue\n{}',
    # unbekannte Direktiven; Gross- und Kleinschreibung
    '%Strict: true\n{}', '%STRICT: true\n{}', '%define: a = 1\n[a]', '%define: nil = null\n[1]',
    '%version: 1\n{}', "%version: '0.7'\n{}", '%version: xtjson = 1\n{}',
    '%include: "a.xtj"\n{}', '%import: text = "./text.txt"\n{}', '%extends: "./base.xtj"\n{}', '%x: 1\n{}',
    # Wert: nur true oder false
    '%strict: 1\n{}', "%strict: 'true'\n{}", '%strict: "false"\n{}', '%strict: null\n{}', '%strict: nil\n{}',
    '%strict: [true]\n{}', '%strict: {}\n{}', '%strict: True\n{}', '%strict: FALSE\n{}', '%strict: yes\n{}',
    '%strict: 0\n{}', '%strict: 1k\n{}', '%strict: truee\n{}', '%strict: t\n{}',
    # Trenner
    '%strict: true [1]', '%strict: true {}', '%strict: true a: 1', '%strict: true,,[1]',
    '%strict: true /* \n */ [1]', '%strict: true\x0b[1]', ',%strict: true\n[1]', '%strict: true [1]',
    # kein Inhalt
    '%strict: true', '%strict: false,', '%strict: true\n', '%strict: true\n// k\n', '%strict: true\n/* k */',
    # Position und Wiederholung
    '[1]\n%strict: true', '{a: 1}\n%strict: true', '{%strict: true}', '{a: %strict: true}',
    'a: 1\n%strict: true', '"s"\n%strict: true', '[%strict: true]', 'a: %strict', '[1, %strict]',
    '%strict: true\n%strict: true\n{}', '%strict: true\n%strict: false\n{}', '%strict: false, %strict: false, {}',
    # Verstoesse gegen den Strict-Modus (12) mit %strict: true
    '%strict: true\n"x"', '%strict: true\n1', '%strict: true\nnull', '%strict: true\nnil', '%strict: true\ntrue',
    '%strict: true\n10k',
    '%strict: true\n{a: 1, a: 2}', "%strict: true\na: 1\n'a': 2", '%strict: true\n{a: {"\\u0061": 1, a: 2}}',
    '%strict: true\n[{a: 1, "a": 2}]', '%strict: true\n{nil: 1, "nil": 2}',
    '%strict: true\n["\\uDEAD"]', '%strict: true\n["\\uD83D"]', '%strict: true\n["\\uDE00\\uD83D"]',
    '%strict: true\n["\\uFFFF"]', '%strict: true\n["\\uFFFE"]', '%strict: true\n["\\u{FDD0}"]', '%strict: true\n["\\uFDEF"]',
    '%strict: true\n["\\u{10FFFE}"]', '%strict: true\n["\\u{1FFFF}"]', '%strict: true\n{"\\uD800": 1}', "%strict: true\n'\\uFFFF': 1",
    '%strict: true\n["￿"]', '%strict: true\n["﷐"]',
    # '=' gibt es nicht
    'a = 1', '[1 = 2]', '{a = 1}', 'a: = 1', '=',
]

# Strict-Modus der Anwendung (12): (Text, erwarteter Wert)
STRICT_VALID = [
    ('{}', {}),
    ('[]', []),
    ('a: 1', {'a': 1}),
    ('[1, "\\uD83D\\uDE00", "\\u{10FFFD}", "\\uFFFD"]', [1, '\U0001F600', '\U0010FFFD', '�']),
    ('{"a": 1, "b": {"a": 2}}', {'a': 1, 'b': {'a': 2}}),
    ('%strict: true\n[1]', [1]),
    ('{a: nil, nil: null}', {'a': None, 'nil': None}),
]

# Texte, die gueltig sind, die der Strict-Modus der Anwendung aber ablehnt
STRICT_INVALID = [
    '1', '"x"', 'null', 'nil', 'true', '-0',
    '{a: 1, a: 2}', '{"a": 1, "\\u0061": 2}', 'a: 1\na: 2', "a: 1\n'a': 2", '[{b: {c: 1, c: 1}}]',
    '["\\uDEAD"]', '["\\uFFFF"]', '["\\uFDEF"]', '{"\\uFFFE": 1}', '["\\u{2FFFF}"]',
    # %strict: false widerspricht der Anwendung (6.5)
    '%strict: false\n{}', '%strict: false\n[1]',
]


def main():
    fails = 0
    for text, exp in VALID:
        try:
            got = parse(text)
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte gueltig sein: %r (%s)' % (text, ex))
            continue
        if got != exp or isinstance(got, bool) != isinstance(exp, bool):
            fails += 1
            print('FEHLER: %r -> %r, erwartet %r' % (text, got, exp))
    for text in INVALID:
        try:
            got = parse(text)
        except XTJSONError:
            continue
        fails += 1
        print('FEHLER: sollte ungueltig sein: %r -> %r' % (text, got))
    for text, exp in STRICT_VALID:
        try:
            got = parse(text, strict=True)
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte im Strict-Modus gueltig sein: %r (%s)' % (text, ex))
            continue
        if got != exp:
            fails += 1
            print('FEHLER: %r -> %r, erwartet %r' % (text, got, exp))
    for text in STRICT_INVALID:
        try:
            parse(text)                                # ohne Strict-Modus gueltig
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte ohne Strict-Modus gueltig sein: %r (%s)' % (text, ex))
        try:
            got = parse(text, strict=True)
        except XTJSONError:
            continue
        fails += 1
        print('FEHLER: sollte im Strict-Modus ungueltig sein: %r -> %r' % (text, got))
    print('Tests D: %d gueltig, %d ungueltig, Strict-Modus %d gueltig und %d ungueltig geprueft: %s'
          % (len(VALID), len(INVALID), len(STRICT_VALID), len(STRICT_INVALID),
             'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
