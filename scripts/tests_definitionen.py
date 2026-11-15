"""Zusatztests: benannte Werte (6.4) und Zahlen-Suffixe (9.5)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

VALUES = {'nil': None, 'zero': 0, 'unbekannt': 'keine Angaben', 'halb': 0.5, 'ja': True}
D = dict(values=VALUES)

# (Text, Definitionen, erwarteter Wert)
VALID = [
    # benannte Werte
    ('nil', D, None),
    ('[nil, zero, unbekannt]', D, [None, 0, 'keine Angaben']),
    ('[nil\nzero\nunbekannt]', D, [None, 0, 'keine Angaben']),
    ('{nil: nil}', D, {'nil': None}),
    ('nil: zero\nzero: nil', D, {'nil': 0, 'zero': None}),
    ('a: halb, b: ja', D, {'a': 0.5, 'b': True}),
    ('[true\nfalse\nnull]', {}, [True, False, None]),
    ('true: false', {}, {'true': False}),
    ('[$a, _b]', dict(values={'$a': 1, '_b': 'x'}), [1, 'x']),
    ('[Nil, nil]', dict(values={'Nil': 1, 'nil': 2}), [1, 2]),
    ('[NaN, Infinity]', dict(values={'NaN': None, 'Infinity': '∞'}), [None, '∞']),
    ('[px, ms, k]', dict(values={'px': 1, 'ms': 2, 'k': 3}), [1, 2, 3]),
    # Suffixe: Faktor 1000, 1024, 1048576
    ('10k', {}, 10000), ('10K', {}, 10000),
    ('1kb', {}, 1024), ('1Kb', {}, 1024), ('1kB', {}, 1024), ('1KB', {}, 1024),
    ('1mb', {}, 1048576), ('1Mb', {}, 1048576), ('1mB', {}, 1048576), ('1MB', {}, 1048576),
    ('1.5k', {}, 1500), ('0.5kb', {}, 512), ('0.1kb', {}, 102.4), ('-2k', {}, -2000),
    ('0x10kb', {}, 16384), ('0b11k', {}, 3000), ('0o17K', {}, 15000), ('0XffKB', {}, 261120),
    ('1e3k', {}, 1000000), ('1_000k', {}, 1000000), ('2.5e-1k', {}, 250), ('0k', {}, 0),
    ('64mb', {}, 67108864), ('0.001k', {}, 1), ('1.0005k', {}, 1000.5),
    ('[10k\n20k]', {}, [10000, 20000]), ('{a: 10k, b: 1mb}', {}, {'a': 10000, 'b': 1048576}),
    ('a: 5k // Kommentar', {}, {'a': 5000}), ('[1k,2k]', {}, [1000, 2000]),
    # Suffixe: Zeit
    ('100ms', {}, 0.1), ('1ms', {}, 0.001), ('1500ms', {}, 1.5), ('1000ms', {}, 1),
    ('250ms', {}, 0.25), ('-250ms', {}, -0.25), ('0x10ms', {}, 0.016), ('1e3ms', {}, 1),
    ('0.5ms', {}, 0.0005), ('0ms', {}, 0),
    ('30s', {}, 30), ('0s', {}, 0), ('1.5s', {}, 1.5), ('-3s', {}, -3), ('0x10s', {}, 16),
    ('5min', {}, 300), ('0.5min', {}, 30), ('1.5min', {}, 90), ('0.01min', {}, 0.6),
    ('2h', {}, 7200), ('12h', {}, 43200), ('1.5h', {}, 5400), ('0b11h', {}, 10800), ('-1h', {}, -3600),
    ('[30s\n5min\n2h]', {}, [30, 300, 7200]), ('a: 250ms // Kommentar', {}, {'a': 0.25}),
    # Suffix pct
    ('50pct', {}, 0.5), ('110pct', {}, 1.1), ('-50pct', {}, -0.5), ('12.5pct', {}, 0.125),
    ('100pct', {}, 1), ('1e2pct', {}, 1), ('0x10pct', {}, 0.16), ('0pct', {}, 0),
    # Suffixe ohne Wirkung
    ('12px', {}, 12), ('1.5px', {}, 1.5), ('-12px', {}, -12), ('0xFFpx', {}, 255),
    ('100L', {}, 100), ('0xFFL', {}, 255), ('-1L', {}, -1), ('1_000L', {}, 1000),
    ('10n', {}, 10), ('-3n', {}, -3), ('0b101n', {}, 5), ('1e3n', {}, 1000.0),
    # ein '_' nach einer Ziffer ist immer Zifferngruppierung
    ('1_0', {}, 10), ('1_0k', {}, 10000), ('1_0s', {}, 10), ('0x1_0L', {}, 16),
    # benannte Werte und Suffixe zusammen
    ('[50pct, 10k, nil]', D, [0.5, 10000, None]),
]

# (Text, Definitionen)
INVALID = [
    ('nil', {}), ('[abc]', {}), ('True', {}), ('NULL', {}), ('[Nil]', dict(values={'nil': 1})),
    ('[nil nil]', D), ('nil zero', D), ('NaN', {}), ('Infinity', {}), ('[ture]', D),
    # Suffixe, die es nicht gibt
    ('10q', {}), ('10m', {}), ('10M', {}), ('10kk', {}), ('10kbs', {}), ('10k5', {}),
    ('10y', {}), ('10wx', {}), ('10g', {}), ('10mi', {}), ('10mins', {}), ('10sec', {}),
    ('10hs', {}), ('10ss', {}), ('10px2', {}), ('10min5', {}), ('10pc', {}), ('10pcts', {}),
    ('10kB1', {}), ('10k_', {}), ('10s_', {}), ('10_k', {}), ('1_s', {}), ('10$', {}),
    ('10$s', {}), ('10_', {}), ('1__0', {}), ('1_', {}), ('10nn', {}), ('10LL', {}),
    # kein Suffix beginnt mit '_'
    ('10_s', {}), ('10_ms', {}), ('10_px', {}), ('0x10_k', {}), ('1e3_k', {}), ('1.5_k', {}),
    ('[10_k]', {}), ('10_k', dict(values={'_k': 1})), ('[1_]', dict(values={'_': 1})),
    # Gross- und Kleinschreibung
    ('10l', {}), ('10S', {}), ('10MS', {}), ('10Ms', {}), ('10mS', {}), ('10Min', {}),
    ('10MIN', {}), ('10H', {}), ('10PX', {}), ('10Px', {}), ('10pX', {}), ('10N', {}),
    ('10PCT', {}), ('10Pct', {}),
    # Zeichen, die kein Suffix einleiten oder nicht in einem Suffix stehen
    ('10ab', {}), ('10e', {}), ('10E', {}), ('10Bk', {}), ('10bk', {}), ('10f', {}),
    ('10%', {}), ('50%', {}), ('10kb%', {}), ('10k%', {}), ('10pct%', {}), ('%', {}),
    ('10x', {}), ('10X', {}), ('10o', {}), ('10O', {}), ('10xy', {}), ('10oz', {}),
    ('0.0x', {}), ('1e3x', {}), ('10b', {}),
    # Leerraum, fehlende Trenner, fehlende Ziffern
    ('10 k', {}), ('10 ms', {}), ('10 px', {}), ('100 pct', {}), ('10k k', {}), ('10ms ms', {}),
    ('[10k 20k]', {}), ('[30s 5min]', {}), ('1.k', {}), ('1.s', {}), ('k', {}), ('ms', {}),
    ('0x', {}), ('0xk', {}), ('0o', {}), ('0Xy', {}), ('0O', {}), ('-0x', {}), ('0ok', {}),
    ('0b', {}), ('0B', {}), ('0xs', {}), ('0bn', {}),
    # ein gleichnamiger benannter Wert macht ein Suffix nicht gueltig und umgekehrt
    ('10q', dict(values={'q': 2})), ('10nil', D), ('[px]', {}),
]

# Definitionen, die der Parser zurueckweisen muss (ValueError, aber kein XTJSONError)
BAD_DEFS = [
    dict(values={'true': 1}), dict(values={'false': False}), dict(values={'null': None}),
    dict(values={'a-b': 1}), dict(values={'1a': 1}), dict(values={'': 1}), dict(values={'ä': 1}),
    dict(values={'x': float('nan')}), dict(values={'x': object()}), dict(values={'x': {1, 2}}),
    # Objekte und Arrays sind als benannter Wert nicht erlaubt
    dict(values={'x': []}), dict(values={'x': {}}), dict(values={'x': [1, 2]}),
    dict(values={'x': {'a': 1}}), dict(values={'x': (1, 2)}), dict(values={'x': [[]]}),
]


def main():
    fails = 0
    for text, defs, exp in VALID:
        try:
            got = parse(text, **defs)
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte gueltig sein: %r (%s)' % (text, ex))
            continue
        if got != exp or isinstance(got, bool) != isinstance(exp, bool):
            fails += 1
            print('FEHLER: %r -> %r, erwartet %r' % (text, got, exp))
    for text, defs in INVALID:
        try:
            got = parse(text, **defs)
        except XTJSONError:
            continue
        fails += 1
        print('FEHLER: sollte ungueltig sein: %r -> %r' % (text, got))
    for defs in BAD_DEFS:
        try:
            parse('1', **defs)
        except XTJSONError:
            fails += 1
            print('FEHLER: Definition sollte als ValueError abgelehnt werden: %r' % (defs,))
        except ValueError:
            continue
        else:
            fails += 1
            print('FEHLER: Definition sollte abgelehnt werden: %r' % (defs,))
    # eigene Suffixe gibt es nicht: der Parser nimmt keine an
    try:
        parse('1', suffixes={'q': abs})
    except TypeError:
        pass
    else:
        fails += 1
        print('FEHLER: der Parser nimmt eigene Suffixe an')
    print('Tests C: %d gueltig, %d ungueltig, %d Definitionen geprueft: %s'
          % (len(VALID), len(INVALID), len(BAD_DEFS), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
