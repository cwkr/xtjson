"""Zusatztests: benannte Werte (6.4) und Zahlen-Suffixe (9.5)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

VALUES = {'nil': None, 'zero': 0, 'unbekannt': 'keine Angaben', 'liste': [1, {'a': 2}]}
SUFFIXES = {
    '%': lambda x: x / 100,
    '$': lambda x: x * 100,
    'px': lambda x: x,
    'y': lambda x: x,
    'wx': lambda x: x,
    '%%': lambda x: x / 10000,
    'k%': lambda x: x * 10,
    'q': lambda x: 'kein Zahlwert',
    'r': lambda x: float('inf'),
    's': lambda x: True,
    't': lambda x: 1 / 0,
}
D = dict(values=VALUES, suffixes=SUFFIXES)

# (Text, Definitionen, erwarteter Wert)
VALID = [
    # benannte Werte
    ('nil', D, None),
    ('[nil, zero, unbekannt]', D, [None, 0, 'keine Angaben']),
    ('[nil\nzero\nunbekannt]', D, [None, 0, 'keine Angaben']),
    ('{nil: nil}', D, {'nil': None}),
    ('nil: zero\nzero: nil', D, {'nil': 0, 'zero': None}),
    ('a: liste, b: liste', D, {'a': [1, {'a': 2}], 'b': [1, {'a': 2}]}),
    ('[true\nfalse\nnull]', {}, [True, False, None]),
    ('true: false', {}, {'true': False}),
    ('[$a, _b]', dict(values={'$a': 1, '_b': 'x'}), [1, 'x']),
    ('[Nil, nil]', dict(values={'Nil': 1, 'nil': 2}), [1, 2]),
    ('[NaN, Infinity]', dict(values={'NaN': None, 'Infinity': '∞'}), [None, '∞']),
    # vordefinierte Suffixe
    ('10k', {}, 10000), ('10K', {}, 10000),
    ('1kb', {}, 1024), ('1Kb', {}, 1024), ('1kB', {}, 1024), ('1KB', {}, 1024),
    ('1mb', {}, 1048576), ('1Mb', {}, 1048576), ('1mB', {}, 1048576), ('1MB', {}, 1048576),
    ('1.5k', {}, 1500), ('0.5kb', {}, 512), ('0.1kb', {}, 102.4), ('-2k', {}, -2000),
    ('0x10kb', {}, 16384), ('0b11k', {}, 3000), ('0o17K', {}, 15000), ('0XffKB', {}, 261120),
    ('1e3k', {}, 1000000), ('1_000k', {}, 1000000), ('2.5e-1k', {}, 250), ('0k', {}, 0),
    ('64mb', {}, 67108864), ('0.001k', {}, 1), ('1.0005k', {}, 1000.5),
    ('[10k\n20k]', {}, [10000, 20000]), ('{a: 10k, b: 1mb}', {}, {'a': 10000, 'b': 1048576}),
    ('a: 5k // Kommentar', {}, {'a': 5000}), ('[1k,2k]', {}, [1000, 2000]),
    # eigene Suffixe
    ('50%', D, 0.5), ('110%', D, 1.1), ('-50%', D, -0.5), ('5$', D, 500),
    ('12px', D, 12), ('10y', D, 10), ('10wx', D, 10), ('0y', D, 0), ('0.0y', D, 0.0), ('1%%', D, 0.0001),
    ('2k%', D, 20), ('0x10%', D, 0.16), ('[50%, 10k]', D, [0.5, 10000]),
]

# (Text, Definitionen)
INVALID = [
    ('nil', {}), ('[abc]', {}), ('True', {}), ('NULL', {}), ('[Nil]', dict(values={'nil': 1})),
    ('[nil nil]', D), ('nil zero', D), ('NaN', {}), ('Infinity', {}), ('[ture]', D),
    ('10q', {}), ('10m', {}), ('10M', {}), ('10kk', {}), ('10kbs', {}), ('10 k', {}),
    ('10ab', {}), ('10e', {}), ('10E', {}), ('10_k', {}), ('10k5', {}), ('10kb%', {}),
    ('10%', {}), ('10k k', {}), ('[10k 20k]', {}), ('1.k', {}), ('10Bk', {}), ('10kB1', {}),
    ('10k_', {}), ('10bk', {}), ('10f', {}), ('k', {}), ('10 %', D), ('%', D), ('10k%%', D),
    ('0x', {}), ('0xk', {}), ('0o', {}), ('0Xy', {}), ('0O', {}),
    ('0x', D), ('0xy', D), ('-0x', D), ('0ok', D), ('10x', D), ('10X', D), ('10o', D), ('10O', D),
    ('10xy', D), ('10oz', D), ('0.0x', D), ('1e3x', D), ('0b', D), ('0B', D), ('10b', D),
    ('1q', D), ('1r', D), ('1s', D), ('1t', D),
]

# Definitionen, die der Parser zurueckweisen muss (ValueError, aber kein XTJSONError)
BAD_DEFS = [
    dict(values={'true': 1}), dict(values={'false': False}), dict(values={'null': None}),
    dict(values={'a-b': 1}), dict(values={'1a': 1}), dict(values={'': 1}), dict(values={'ä': 1}),
    dict(values={'x': float('nan')}), dict(values={'x': object()}), dict(values={'x': {1, 2}}),
    dict(suffixes={'k': abs}), dict(suffixes={'K': abs}), dict(suffixes={'KB': abs}),
    dict(suffixes={'mB': abs}), dict(suffixes={'a': abs}), dict(suffixes={'e': abs}),
    dict(suffixes={'F': abs}), dict(suffixes={'abc': abs}), dict(suffixes={'ghi': abs}),
    dict(suffixes={'k1': abs}), dict(suffixes={'': abs}), dict(suffixes={'g_': abs}),
    dict(suffixes={'%': None}), dict(suffixes={'px': 2}),
    dict(suffixes={'x': abs}), dict(suffixes={'X': abs}), dict(suffixes={'o': abs}),
    dict(suffixes={'O': abs}), dict(suffixes={'xy': abs}), dict(suffixes={'Ox': abs}),
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
    # eigene Definitionen duerfen sich zwischen Aufrufen nicht gegenseitig veraendern
    a = parse('liste', **D)
    a.append(99)
    if parse('liste', **D) != [1, {'a': 2}]:
        fails += 1
        print('FEHLER: benannter Wert wurde durch das Ergebnis veraendert')
    print('Tests C: %d gueltig, %d ungueltig, %d Definitionen geprueft: %s'
          % (len(VALID), len(INVALID), len(BAD_DEFS), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
