"""Zusatztests: benannte Werte (6.4, 6.6) und Zahlen-Suffixe (9.5).

Benannte Werte werden nur im Dokument mit %define definiert; D ist eine
Folge solcher Direktiven, die vielen Faellen vorangestellt wird.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

D = ("%define: nil = null\n%define: zero = 0\n%define: unbekannt = 'keine Angaben'\n"
     "%define: halb = 0.5\n%define: ja = true\n")

# (Text, erwarteter Wert)
VALID = [
    # benannte Werte
    (D + 'nil', None),
    (D + '[nil, zero, unbekannt]', [None, 0, 'keine Angaben']),
    (D + '[nil\nzero\nunbekannt]', [None, 0, 'keine Angaben']),
    (D + '{nil: nil}', {'nil': None}),
    (D + 'nil: zero\nzero: nil', {'nil': 0, 'zero': None}),
    (D + 'a: halb, b: ja', {'a': 0.5, 'b': True}),
    ('[true\nfalse\nnull]', [True, False, None]),
    ('true: false', {'true': False}),
    ("%define: $a = 1\n%define: _b = 'x'\n[$a, _b]", [1, 'x']),
    ('%define: Nil = 1, %define: nil = 2, [Nil, nil]', [1, 2]),
    ('%define: NaN = null\n%define: Infinity = "∞"\n[NaN, Infinity]', [None, '∞']),
    ('%define: px = 1, %define: ms = 2, %define: k = 3\n[px, ms, k]', [1, 2, 3]),
    # Objekte und Arrays als benannte Werte; jede Stelle erhaelt eine Kopie
    (D + '%define: liste = [nil, zero, halb]\n%define: obj = {l: liste, j: ja}\n[obj, liste]',
     [{'l': [None, 0, 0.5], 'j': True}, [None, 0, 0.5]]),
    ('%define: e = {}\n%define: a = []\n[e, a, {e: e}]', [{}, [], {'e': {}}]),
    ('%define: o = {a: 1, b: 2}\no', {'a': 1, 'b': 2}),
    ('%define: s = "\n  zwei\n  Zeilen\n  "\n[s]', ['zwei\nZeilen\n']),
    # Suffixe: Faktor 1000, 1024, 1048576
    ('10k', 10000), ('10K', 10000),
    ('1kb', 1024), ('1Kb', 1024), ('1kB', 1024), ('1KB', 1024),
    ('1mb', 1048576), ('1Mb', 1048576), ('1mB', 1048576), ('1MB', 1048576),
    ('1.5k', 1500), ('0.5kb', 512), ('0.1kb', 102.4), ('-2k', -2000),
    ('0x10kb', 16384), ('0b11k', 3000), ('0o17K', 15000), ('0XffKB', 261120),
    ('1e3k', 1000000), ('1_000k', 1000000), ('2.5e-1k', 250), ('0k', 0),
    ('64mb', 67108864), ('0.001k', 1), ('1.0005k', 1000.5),
    ('[10k\n20k]', [10000, 20000]), ('{a: 10k, b: 1mb}', {'a': 10000, 'b': 1048576}),
    ('a: 5k // Kommentar', {'a': 5000}), ('[1k,2k]', [1000, 2000]),
    # Suffixe: Zeit
    ('100ms', 0.1), ('1ms', 0.001), ('1500ms', 1.5), ('1000ms', 1),
    ('250ms', 0.25), ('-250ms', -0.25), ('0x10ms', 0.016), ('1e3ms', 1),
    ('0.5ms', 0.0005), ('0ms', 0),
    ('30s', 30), ('0s', 0), ('1.5s', 1.5), ('-3s', -3), ('0x10s', 16),
    ('5min', 300), ('0.5min', 30), ('1.5min', 90), ('0.01min', 0.6),
    ('2h', 7200), ('12h', 43200), ('1.5h', 5400), ('0b11h', 10800), ('-1h', -3600),
    ('[30s\n5min\n2h]', [30, 300, 7200]), ('a: 250ms // Kommentar', {'a': 0.25}),
    # Suffix pct
    ('50pct', 0.5), ('110pct', 1.1), ('-50pct', -0.5), ('12.5pct', 0.125),
    ('100pct', 1), ('1e2pct', 1), ('0x10pct', 0.16), ('0pct', 0),
    # nur das Ergebnis zaehlt fuer den Zahlenbereich (9.4)
    ('4.4e308pct', 44 * 10 ** 305), ('-1e310ms', -10 ** 307),
    # Suffixe ohne Wirkung
    ('12px', 12), ('1.5px', 1.5), ('-12px', -12), ('0xFFpx', 255),
    ('100L', 100), ('0xFFL', 255), ('-1L', -1), ('1_000L', 1000),
    ('10n', 10), ('-3n', -3), ('0b101n', 5), ('1e3n', 1000.0),
    # ein '_' nach einer Ziffer ist immer Zifferngruppierung
    ('1_0', 10), ('1_0k', 10000), ('1_0s', 10), ('0x1_0L', 16),
    # benannte Werte und Suffixe zusammen
    (D + '[50pct, 10k, nil]', [0.5, 10000, None]),
    ('%define: t = 30s\n%define: g = 64mb\n[t, g]', [30, 67108864]),
]

# Texte, die abgelehnt werden muessen
INVALID = [
    'nil', '[abc]', 'True', 'NULL', '%define: nil = 1\n[Nil]',
    D + '[nil nil]', D + 'nil zero', 'NaN', 'Infinity', D + '[ture]',
    # Definitionen, die gegen 6.4 bis 6.6 verstossen; doppelter Name im Wert (6.5)
    '%define: o = {a: 1, a: 2}\no',
    '%define: true = 1\n1', '%define: false = false\n1', '%define: null = null\n1',
    '%define: a-b = 1\n1', '%define: 1a = 1\n1', '%define: "" = 1\n1', "%define: 'a' = 1\n1",
    '%define: ä = 1\n1', '%define: x = NaN\n1', '%define: x = undefined\n1',
    D + '%define: nil = null\n1', D + '%define: halb = 0.5\nhalb',
    '%define: a = [b]\n%define: b = 1\na', '%define: a = {x: a}\na',
    # Suffixe, die es nicht gibt
    '10q', '10m', '10M', '10kk', '10kbs', '10k5',
    '10y', '10wx', '10g', '10mi', '10mins', '10sec',
    '10hs', '10ss', '10px2', '10min5', '10pc', '10pcts',
    '10kB1', '10k_', '10s_', '10_k', '1_s', '10$',
    '10$s', '10_', '1__0', '1_', '10nn', '10LL',
    # kein Suffix beginnt mit '_'
    '10_s', '10_ms', '10_px', '0x10_k', '1e3_k', '1.5_k',
    '[10_k]', '%define: _k = 1\n10_k', '%define: _ = 1\n[1_]',
    # Gross- und Kleinschreibung
    '10l', '10S', '10MS', '10Ms', '10mS', '10Min',
    '10MIN', '10H', '10PX', '10Px', '10pX', '10N',
    '10PCT', '10Pct',
    # Zeichen, die kein Suffix einleiten oder nicht in einem Suffix stehen
    '10ab', '10e', '10E', '10Bk', '10bk', '10f',
    '10%', '50%', '10kb%', '10k%', '10pct%', '%',
    '10x', '10X', '10o', '10O', '10xy', '10oz',
    '0.0x', '1e3x', '10b',
    # Leerraum, fehlende Trenner, fehlende Ziffern
    '10 k', '10 ms', '10 px', '100 pct', '10k k', '10ms ms',
    '[10k 20k]', '[30s 5min]', '1.k', '1.s', 'k', 'ms',
    '0x', '0xk', '0o', '0Xy', '0O', '-0x', '0ok',
    '0b', '0B', '0xs', '0bn',
    # ein gleichnamiger benannter Wert macht ein Suffix nicht gueltig und umgekehrt
    '%define: q = 2\n10q', D + '10nil', '[px]',
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
    # die Anwendung kann weder benannte Werte noch Suffixe definieren
    for extra in (dict(values={'nil': None}), dict(suffixes={'q': abs})):
        try:
            parse('1', **extra)
        except TypeError:
            continue
        fails += 1
        print('FEHLER: der Parser nimmt Definitionen der Anwendung an: %r' % (extra,))
    print('Tests C: %d gueltig, %d ungueltig geprueft: %s'
          % (len(VALID), len(INVALID), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
