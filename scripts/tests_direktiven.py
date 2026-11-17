"""Zusatztests: Direktiven (6.5), %define (6.6) und %version (6.7)."""
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
    '%version: {}\n{}', '%version: null\n{}', '%version: false\n{}', '%define: v = 1\n%version: v\n{}',
    '%version: nil\n{}', '%version: 1k\n{}', '%version: 0x10L\n{}', '%version: 1.5pct\n{}',
    '%version: s = [1]\n{}', '%version: s = {}\n{}', '%version: "1" = 1\n{}', '%version\n{}',
    '%version: 1 2\n{}', '%version:\n{}', '%version: a = \n{}',
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
    print('Tests D: %d gueltig, %d ungueltig, %d Versionsangaben geprueft: %s'
          % (len(VALID), len(INVALID), len(VERSIONS), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
