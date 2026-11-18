"""Zusatztests: Direktiven (6.5), %define (6.6), %version (6.7), %strict (6.8)
und Strict-Modus (12)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, parse_document, XTJSONError  # noqa: E402

# Definitionen, die einander verwenden: jede Stufe verzehnfacht die Groesse (13)
BOMBE = ''.join('%%define: s%d = [%s]\n' % (i, ', '.join(['s%d' % (i - 1) if i else '1'] * 10))
                for i in range(10)) + 's9'

# (Text, erwarteter Wert)
VALID = [
    # Schreibweise: Leerraum, Zeilenumbrueche und Kommentare um ':' und '='
    ('%define:nil=null\n[nil]', [None]),
    ('%define :a=1\n[a]', [1]),
    ('%define:\n  a\n  =\n  1\n[a]', [1]),
    ('%define: a /* k */ = /* k */ 1\n[a]', [1]),
    ('%define: a = // k\n  1\n[a]', [1]),
    ('%define:\ta\t=\t1\n[a]', [1]),
    # Trenner wie zwischen Elementen
    ('%define: a = 1, [a]', [1]),
    ('%define: a = 1,\n[a]', [1]),
    ('%define: a = 1\n,[a]', [1]),
    ('%define: a = 1 // k\n[a]', [1]),
    ('%define: a = 1 /* k */\n[a]', [1]),
    ('%define: a = 1\r\n[a]', [1]),
    ('%define: a = 1\r[a]', [1]),
    ('%define: a = 1,\n\n[a]', [1]),
    ('%define: a = 1, %define: b = 2, [a, b]', [1, 2]),
    ('%define: a = 1\n\n\n%define: b = 2\n\n[a, b]', [1, 2]),
    # Kommentare, Shebang und BOM vor den Direktiven
    ('# Kommentar\n%define: a = 1\n\n# x\nb: a', {'b': 1}),
    ('#!/usr/bin/env xtjson-tool\n%version: 1\n{}', {}),
    ('﻿%define: a = 1\n[a]', [1]),
    ('/* k */ %define: a = 1\n[a]', [1]),
    # Inhalt nach den Direktiven: Wert oder implizites Wurzelobjekt
    ('%define: a = 1\n"x": a', {'x': 1}),
    ("%define: a = 1\n'x': a, y: a", {'x': 1, 'y': 1}),
    ('%define: a = 1\na: a', {'a': 1}),
    ('%define: a = 1\n{"a": a}', {'a': 1}),
    ('%define: a = "x"\n"s"', 's'),
    ('%define: a = 1\n-1', -1),
    ('%define: a = 1\na', 1),
    # %define: Reihenfolge, Objekte und Arrays
    ('%define: a = 1\n%define: b = a\n%define: c = b\n[c]', [1]),
    ('%define: a = 1\n%define: b = [a, a]\n%define: c = {b: b}\nc', {'b': [1, 1]}),
    ('%define: a = {x: [1, {y: null}]}\n[a, a]', [{'x': [1, {'y': None}]}, {'x': [1, {'y': None}]}]),
    ('%define: true_ = true\n[true_]', [True]),
    ('%define: define = 1\n%define: version = 2\n[define, version]', [1, 2]),
    ('%define: a = 10k\n[a]', [10000]),
    ('%define: a = "\n  x\n  "\n[a]', ['x\n']),
    # %version definiert keinen benannten Wert; eigener Namensraum
    ('%version: v = 1\n%define: v = 2\n[v]', [2]),
    ('%define: v = 2\n%version: v = 1\n[v]', [2]),
    ('%version: xtjson = 1\n{xtjson: 1}', {'xtjson': 1}),
    ('%version: 0.6\n{}', {}),
    ('%version: -1\n{}', {}),
    ('%version: 0x10\n{}', {}),
    ('%version: 1_000\n{}', {}),
    ("%version: ''\n{}", {}),
    ('%version: "a\nb"\n{}', {}),
    # %version: Zahlen mit Suffix und benannte Werte mit String oder Zahl
    ('%version: windows = 2k\n{}', {}),
    ('%version: 1.5pct\n{}', {}),
    ('%version: 0x10n\n{}', {}),
    ('%version: 1.5m\n{}', {}),
    ('%define: v = 1\n%version: v\n{}', {}),
    ("%define: v = '1.4.0'\n%version: app = v\nversion: v", {'version': '1.4.0'}),
    ('%define: n = 2k\n%version: s = n\n[n]', [2000]),
    # %strict (6.8): true oder false, auch als benannter Wert, an beliebiger Stelle
    ('%strict: true\n{}', {}),
    ('%strict:true,[1]', [1]),
    ('%strict: false\n"x"', 'x'),
    ('%strict: false, 1', 1),
    ('%define: yes = true, %strict: yes\n[1]', [1]),
    ('%define: no = false\n%strict: no\n1', 1),
    ('%strict: true\na: 1', {'a': 1}),
    ('%strict: true\n%define: a = [1]\na', [1]),
    ('%strict: true\n%version: 1\n{}', {}),
    ('%define: strict = 1\n%strict: true\n[strict]', [1]),
    ('%strict: /* k */ true // k\n{}', {}),
    ('%strict: true\n{"\\uD83D\\uDE00": "\\u{1F600}"}', {'\U0001F600': '\U0001F600'}),
    ('%strict: true\n[{a: 1}, {a: 2}, {b: {a: 3}}]', [{'a': 1}, {'a': 2}, {'b': {'a': 3}}]),
    ('%define: a = {x: 1}\n%strict: true\n{a: a, b: a}', {'a': {'x': 1}, 'b': {'x': 1}}),
    # ohne Strict-Modus gelten seine Verbote im Inhalt nicht
    ('%strict: false\n["\\uDEAD"]', ['\udead']),
    ('%strict: false\n{a: 1, a: 2}', {'a': 2}),
    ('%define: a = 1\n{a: a, "a": 2}', {'a': 2}),
    # Beispiele aus der Aufgabenstellung
    ("%version: 0.6\n%version:schema='2026.05.01b'\n%define:nil=null\n# Hyper media ref\n"
     "%define:self = {\n  href: 'http://api.example.org/people/1234'\n}\n\nid: 1234\nname: 'Bob'\n"
     "email: nil\nself: self\n",
     {'id': 1234, 'name': 'Bob', 'email': None, 'self': {'href': 'http://api.example.org/people/1234'}}),
    ("%version:xtjson='0.6.1',%define:empty=\"\",[null, 543, empty]", [None, 543, '']),
]

# Texte, die abgelehnt werden muessen
INVALID = [
    # Schreibweise
    '% define: a = 1\n[a]', '%\tdefine: a = 1\n[a]', '%/**/define: a = 1\n[a]', '%\ndefine: a = 1\n[a]',
    '%define a = 1\n[a]', '%define: a 1\n[a]', '%define: a == 1\n[a]', '%define: = 1\n1',
    '%define:\n1', '%\n1', '%1: 2\n1', '%-define: a = 1\n[a]', '%%define: a = 1\n[a]',
    '%define: a = 1;\n[a]', '%define: a := 1\n[a]', '%define: "a" = 1\n[a]', "%define: 'a' = 1\n1",
    '%"define": a = 1\n[a]', '%define: a = 1 = 2\n[a]', '%define: a = %define: b = 1\n[a]',
    # unbekannte Direktiven
    '%DEFINE: a = 1\n[a]', '%Version: 1\n{}', '%import: text = "./text.txt"\n{}',
    '%extends: "./base.xtj"\n{}', '%x: 1\n{}', '%_define: a = 1\n[a]', '%defines: a = 1\n[a]',
    # Trenner
    '%define: a = 1 [a]', '%define: a = 1 %define: b = 2\n[a]', '%define: a = 1,,[a]',
    '%define: a = 1 /* \n */ [a]', '%define: a = 1 [a]', '%define: a = 1\x0b[a]',
    '%define: a = 1 a: a', ',%define: a = 1\n[a]',
    # kein Inhalt
    '%define: a = 1', '%define: a = 1,', '%define: a = 1\n', '%define: a = 1\n// k\n',
    '%version: 1,\n', '%version: 1\n%define: a = 1',
    # Position
    '[1]\n%define: a = 1', '{a: 1}\n%define: b = 2', '{%define: a = 1}', '{a: %define: b = 1}',
    'a: 1\n%version: 1', '"s"\n%version: 1', '[%version: 1]', 'a: %define', '%define: a = [%define: b = 1]\n1',
    # %define
    '%define: 1\n{}', '%define: "x"\n{}', '%define: {a: 1}\n{}', '%define: a\n[a]',
    '%define: a = 1\n%define: a = 1\n[a]', '%define: a = b\n[a]', '%define: a = [a]\n1',
    '%define: a = 1\n[A]', '%define: null = 1\n1',
    # %version
    '%version: 1\n%version: 2\n{}', "%version: xtjson = 1\n%version: '1'\n{}",
    '%version: 1\n%version: xtjson = 1\n{}', '%version: s = 1\n%version: s = 1\n{}',
    '%version: {}\n{}', '%version: null\n{}', '%version: false\n{}', '%version: nil\n{}', '%version: 1q\n{}',
    '%define: n = null\n%version: n\n{}', '%define: v = [1]\n%version: v\n{}', '%define: t = true\n%version: t\n{}',
    '%define: o = {}\n%version: s = o\n{}', '%version: v\n%define: v = 1\n{}',
    '%version: s = [1]\n{}', '%version: s = {}\n{}', '%version: "1" = 1\n{}', '%version\n{}',
    '%version: 1 2\n{}', '%version:\n{}', '%version: a = \n{}',
    # %strict: Form und Wert
    '%strict: 1\n{}', "%strict: 'true'\n{}", '%strict: null\n{}', '%strict: [true]\n{}', '%strict: {}\n{}',
    '%strict: s = true\n{}', '%strict: xtjson = true\n{}', '%strict: True\n{}', '%strict: yes\n{}',
    '%define: z = 0\n%strict: z\n{}', '%define: e = ""\n%strict: e\n{}', '%strict\n{}', '%strict:\n{}',
    '%strict: true', '%Strict: true\n{}', '% strict: true\n{}', '%strict: yes\n%define: yes = true\n{}',
    # %strict hoechstens einmal
    '%strict: true\n%strict: true\n{}', '%strict: true\n%strict: false\n{}', '%strict: false, %strict: false, {}',
    # Verstoesse gegen den Strict-Modus (12) mit %strict: true
    '%strict: true\n"x"', '%strict: true\n1', '%strict: true\nnull', '%strict: true\ntrue', '%strict: true\n10k',
    '%define: a = 1\n%strict: true\na', '%define: yes = true\n%define: s = "x"\n%strict: yes\ns',
    '%strict: true\n{a: 1, a: 2}', "%strict: true\na: 1\n'a': 2", '%strict: true\n{a: {"\\u0061": 1, a: 2}}',
    '%strict: true\n[{a: 1, "a": 2}]', '%define: d = {a: 1, a: 2}\n%strict: true\n{}',
    '%define: d = {a: 1, a: 2}\n%define: yes = true\n%strict: yes\n{}', '%strict: true\n%define: d = [{x: 1, x: 1}]\n{}',
    '%strict: true\n["\\uDEAD"]', '%strict: true\n["\\uD83D"]', '%strict: true\n["\\uDE00\\uD83D"]',
    '%strict: true\n["\\uFFFF"]', '%strict: true\n["\\uFFFE"]', '%strict: true\n["\\u{FDD0}"]', '%strict: true\n["\\uFDEF"]',
    '%strict: true\n["\\u{10FFFE}"]', '%strict: true\n["\\u{1FFFF}"]', '%strict: true\n{"\\uD800": 1}', "%strict: true\n'\\uFFFF': 1",
    '%strict: true\n["\uFFFF"]', '%strict: true\n["\uFDD0"]',
    '%define: s = "\\uDC00"\n%strict: true\n{}', '%version: "\\uFFFE"\n%strict: true\n{}',
    # Werte von Direktiven halten die Verbote zu Strings und doppelten Namen
    # immer ein, auch ohne Strict-Modus (6.5)
    '%define: d = {a: 1, a: 2}\n[d]', '%define: d = {a: 1, a: 2}\n[1]', '%define: d = {a: 1, a: 2}\n%strict: false\n[d]',
    '%define: d = [{a: 1, a: 2}]\n{}', '%define: o = {"a": 1, "\\u0061": 2}\n[1]', "%define: k = {'\\uFDD0': 1}\n[1]",
    '%define: s = "\\uDEAD"\n[1]', '%define: s = "\\uFFFF"\n[s]', '%define: u = "\\uDBFF"\n[1]', '%define: s = "\uFFFE"\n[1]',
    '%version: "\\uFFFE"\n{}', '%version: s = "\\uFDD0"\n{}', '%version: s = "\\uDC00"\n{}',
    '%strict: false\n%define: d = {a: 1, a: 2}\n[1]',
    # '=' gibt es nur in Direktiven
    'a = 1', '[1 = 2]', '{a = 1}', 'a: = 1', '=',
    # Grenze fuer die Groesse nach dem Ersetzen benannter Werte (11, 13)
    BOMBE,
]

# (Text, erwartete Versionsangaben)
VERSIONS = [
    ('{}', {}),
    ("%version: '0.6'\n{}", {'xtjson': '0.6'}),
    ('%version: xtjson = 0.6\n{}', {'xtjson': 0.6}),
    ("%version: '0.6', %version: schema = '2026.05.01b'\n{}", {'xtjson': '0.6', 'schema': '2026.05.01b'}),
    ('%version: a = 1\n%version: b = 2\n%define: c = 3\n[c]', {'a': 1, 'b': 2}),
    ('%version: v = 0x10\n{}', {'v': 16}),
    ('%version: windows = 2k\n{}', {'windows': 2000}),
    ('%version: 100ms\n{}', {'xtjson': 0.1}),
    ("%define: v = '1.4.0'\n%version: app = v\n{}", {'app': '1.4.0'}),
    ('%define: v = 6\n%version: v\n%version: w = v\n{}', {'xtjson': 6, 'w': 6}),
    ('%strict: true\n%version: 1\n{}', {'xtjson': 1}),
]

# Strict-Modus der Anwendung (12): (Text, erwarteter Wert)
STRICT_VALID = [
    ('{}', {}),
    ('[]', []),
    ('a: 1', {'a': 1}),
    ('[1, "\\uD83D\\uDE00", "\\u{10FFFD}", "\\uFFFD"]', [1, '\U0001F600', '\U0010FFFD', '\ufffd']),
    ('{"a": 1, "b": {"a": 2}}', {'a': 1, 'b': {'a': 2}}),
    ('%strict: true\n[1]', [1]),
    ('%define: d = {a: 1}\n{d: d, e: d}', {'d': {'a': 1}, 'e': {'a': 1}}),
    ('%define: a = [1]\na', [1]),
    ('%version: 1\n{}', {}),
]

# Texte, die gueltig sind, die der Strict-Modus der Anwendung aber ablehnt
STRICT_INVALID = [
    '1', '"x"', 'null', 'true', '-0', '%define: a = 1\na', '%define: a = "x"\na',
    '{a: 1, a: 2}', '{"a": 1, "\\u0061": 2}', 'a: 1\na: 2', "a: 1\n'a': 2", '[{b: {c: 1, c: 1}}]',
    '["\\uDEAD"]', '["\\uFFFF"]', '["\\uFDEF"]', '{"\\uFFFE": 1}', '["\\u{2FFFF}"]',
    # %strict: false widerspricht der Anwendung (6.8)
    '%strict: false\n{}', '%strict: false\n[1]', '%define: no = false\n%strict: no\n{}',
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
    for text, exp in VERSIONS:
        try:
            got = parse_document(text)[1]
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte gueltig sein: %r (%s)' % (text, ex))
            continue
        if got != exp:
            fails += 1
            print('FEHLER: Versionen von %r: %r, erwartet %r' % (text, got, exp))
    # jede Stelle erhaelt eine eigene Kopie, keinen Verweis (6.4)
    v = parse('%define: a = {x: [1]}\n[a, a]')
    v[0]['x'].append(2)
    if v[1] != {'x': [1]}:
        fails += 1
        print('FEHLER: benannter Wert wird nicht kopiert')
    # die Grenze ist einstellbar; ein Dokument unter der Grenze bleibt gueltig
    small = '%define: a = [1, 1]\n%define: b = [a, a]\n[b, b]'
    try:
        parse(small, max_expansion=20)
    except XTJSONError as ex:
        fails += 1
        print('FEHLER: sollte unter der Grenze gueltig sein: %r (%s)' % (small, ex))
    try:
        parse(small, max_expansion=10)
        fails += 1
        print('FEHLER: Grenze nicht eingehalten: %r' % small)
    except XTJSONError:
        pass
    print('Tests D: %d gueltig, %d ungueltig, %d Versionsangaben, Strict-Modus %d gueltig und %d ungueltig geprueft: %s'
          % (len(VALID), len(INVALID), len(VERSIONS), len(STRICT_VALID), len(STRICT_INVALID),
             'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
