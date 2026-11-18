"""Zusatztests: die Direktiven %strict und %extends (6.4 bis 6.6) und der Strict-Modus (12)."""
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402


def resolver_for(bases):
    """Resolver, der zu einem Verweis eine Kopie des Basiswerts aus bases liefert;
    ein unbekannter Verweis ist ein Fehler des Resolvers."""
    return lambda ref: copy.deepcopy(bases[ref])

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

# %extends (6.6) mit Resolver: (Text, Basiswerte {Verweis: Wert}, erwarteter Wert).
# Die ersten Faelle folgen den Beispielen in Anhang A von RFC 7396.
EXTENDS_VALID = [
    ("%extends: 'b'\n{a: 'c'}", {'b': {'a': 'b'}}, {'a': 'c'}),
    ("%extends: 'b'\n{b: 'c'}", {'b': {'a': 'b'}}, {'a': 'b', 'b': 'c'}),
    ("%extends: 'b'\n{a: null}", {'b': {'a': 'b'}}, {}),
    ("%extends: 'b'\n{a: nil}", {'b': {'a': 'b', 'b': 'c'}}, {'b': 'c'}),
    ("%extends: 'b'\n{a: 'c'}", {'b': {'a': ['b']}}, {'a': 'c'}),
    ("%extends: 'b'\n{a: ['b']}", {'b': {'a': 'c'}}, {'a': ['b']}),
    ("%extends: 'b'\n{a: {b: 'd', c: null}}", {'b': {'a': {'b': 'c'}}}, {'a': {'b': 'd'}}),
    ("%extends: 'b'\n{a: [1]}", {'b': {'a': [{'b': 'c'}]}}, {'a': [1]}),
    ("%extends: 'b'\n['c', 'd']", {'b': ['a', 'b']}, ['c', 'd']),
    ("%extends: 'b'\n['c']", {'b': {'a': 'b'}}, ['c']),
    ("%extends: 'b'\nnull", {'b': {'a': 'foo'}}, None),
    ("%extends: 'b'\n'bar'", {'b': {'a': 'foo'}}, 'bar'),
    ("%extends: 'b'\n{a: 1}", {'b': {'e': None}}, {'e': None, 'a': 1}),
    ("%extends: 'b'\n{a: 'b', c: null}", {'b': [1, 2]}, {'a': 'b'}),
    ("%extends: 'b'\n{a: {bb: {ccc: null}}}", {'b': {}}, {'a': {'bb': {}}}),
    # Schreibweise, Trenner, Reihenfolge mit %strict
    ("%extends: './defaults.json'\nport: 8443", {'./defaults.json': {'host': 'h', 'port': 80}}, {'host': 'h', 'port': 8443}),
    ('%extends:"b",{}', {'b': {'x': 1}}, {'x': 1}),
    ("%extends :\n  'b'\n\n# k\nx: 2", {'b': {'x': 1}}, {'x': 2}),
    ("%extends: /* k */ 'b' // k\nx: 2", {'b': {'x': 1}}, {'x': 2}),
    ("%strict: true\n%extends: 'b'\n{y: 2}", {'b': {'x': 1}}, {'x': 1, 'y': 2}),
    ("%extends: 'b', %strict: false, {y: 2}", {'b': {'x': 1}}, {'x': 1, 'y': 2}),
    ('%extends: "\n  b\n  "\n{}', {'b\n': {'x': 1}}, {'x': 1}),
    ("%extends: ''\n{x: 1}", {'': None}, {'x': 1}),
    # doppelte Namen im Inhalt werden vor der Zusammenfuehrung aufgeloest (7.2)
    ("%extends: 'b'\n{a: 1, a: null}", {'b': {'a': 0}}, {}),
    ("%extends: 'b'\n{a: null, a: 1}", {'b': {'a': 0}}, {'a': 1}),
    # null bleibt in Arrays erhalten; Objekte werden in jeder Tiefe zusammengefuehrt
    ("%extends: 'b'\n[nil]", {'b': {}}, [None]),
    ("%extends: 'b'\n{a: [{b: null}]}", {'b': {}}, {'a': [{'b': None}]}),
    ("%extends: 'b'\n{a: {}}", {'b': {'a': {'x': 1}}}, {'a': {'x': 1}}),
    ("%extends: 'b'\n{a: {}}", {'b': {'a': 5}}, {'a': {}}),
    ("%extends: 'b'\n{a: {b: {c: 2}}}", {'b': {'a': {'b': {'c': 1, 'd': 1}, 'e': 1}}}, {'a': {'b': {'c': 2, 'd': 1}, 'e': 1}}),
    ("%extends: 'b'\n{}", {'b': 'text'}, {}),
    ("%extends: 'b'\n1", {'b': {'a': 1}}, 1),
    ("%extends: 'b'\n{x: 10k, größe: nil}", {'b': {'größe': 1}}, {'x': 10000}),
    # der Basiswert kann Werte enthalten, die der Inhalt nicht schreiben kann
    ("%extends: 'b'\n{}", {'b': {'a': None, 'é': [None, True, 1.5]}}, {'a': None, 'é': [None, True, 1.5]}),
]

# mit Resolver ungueltig: (Text, Basiswerte)
EXTENDS_INVALID = [
    ("%extends: 'b'\n%extends: 'b'\n{}", {'b': {}}),
    ("%extends: 'b'\n%strict: true\n%extends: 'b'\n{}", {'b': {}}),
    ('%extends: nil\n{}', {'b': {}}),
    ('%extends: b\n{}', {'b': {}}),
    ('%extends: 1\n{}', {'1': {}}),
    ("%extends: ['b']\n{}", {'b': {}}),
    ("%extends 'b'\n{}", {'b': {}}),
    ("% extends: 'b'\n{}", {'b': {}}),
    ("%Extends: 'b'\n{}", {'b': {}}),
    ("%extend: 'b'\n{}", {'b': {}}),
    ("%extends: 'b' {}", {'b': {}}),
    ("%extends: 'b'", {'b': {}}),
    ("%extends: 'b',", {'b': {}}),
    ("[%extends: 'b']", {'b': {}}),
    ("a: 1\n%extends: 'b'", {'b': {}}),
    ("%extends: 'b' = 'c'\n{}", {'b': {}}),
    # der Resolver meldet einen Fehler (unbekannter Verweis)
    ("%extends: 'x'\n{}", {'b': {}}),
    # Strict-Modus: Verbote auch fuer das Ergebnis (12)
    ("%strict: true\n%extends: 'b'\n{}", {'b': {'s': chr(0xFFFF)}}),
    ("%extends: 'b'\n%strict: true\n{}", {'b': {chr(0xD800): 1}}),
    ("%strict: true\n%extends: 'b'\n{a: 1}", {'b': {'x': [chr(0xFDD0)]}}),
    ("%strict: true\n%extends: 'b'\n'x'", {'b': {}}),
    ("%extends: 'b'\n%strict: true\nnull", {'b': {'a': 1}}),
    ("%strict: true\n%extends: 'b'\n{a: 1, a: 2}", {'b': {}}),
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
    for text, bases, exp in EXTENDS_VALID:
        try:
            got = parse(text, resolver=resolver_for(bases))
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte mit Resolver gueltig sein: %r (%s)' % (text, ex))
            continue
        if got != exp:
            fails += 1
            print('FEHLER: %r -> %r, erwartet %r' % (text, got, exp))
        try:
            parse(text)                                # ohne Resolver abgeschaltet (6.6)
            fails += 1
            print('FEHLER: %%extends ohne Resolver angenommen: %r' % text)
        except XTJSONError:
            pass
    for text, bases in EXTENDS_INVALID:
        try:
            got = parse(text, resolver=resolver_for(bases))
        except XTJSONError:
            continue
        fails += 1
        print('FEHLER: sollte mit Resolver ungueltig sein: %r -> %r' % (text, got))
    # der Resolver liefert keinen JSON-Wert
    for bad in (float('nan'), float('inf'), {1: 2}, {'a': {1}}, (1, 2), object()):
        try:
            parse("%extends: 'b'\n{}", resolver=lambda ref, bad=bad: bad)
            fails += 1
            print('FEHLER: Resolver-Wert ohne JSON-Wert angenommen: %r' % (bad,))
        except XTJSONError:
            pass
    # der Basiswert des Resolvers wird nicht veraendert
    base = {'a': {'b': 1}}
    parse("%extends: 'b'\n{a: {b: 2, c: 3}}", resolver=lambda ref: base)
    if base != {'a': {'b': 1}}:
        fails += 1
        print('FEHLER: der Basiswert des Resolvers wurde veraendert: %r' % base)
    print('Tests D: %d gueltig, %d ungueltig, Strict-Modus %d gueltig und %d ungueltig, '
          '%%extends %d gueltig und %d ungueltig geprueft: %s'
          % (len(VALID), len(INVALID), len(STRICT_VALID), len(STRICT_INVALID),
             len(EXTENDS_VALID), len(EXTENDS_INVALID), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
