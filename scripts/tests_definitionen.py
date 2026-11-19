"""Zusatztests: Werte ohne Anfuehrungszeichen (6.3), Bezeichner (7.2) und Zahlen-Suffixe (9.5).

Der Dateiname stammt aus einer Zeit, in der Dokumente benannte Werte
definieren konnten; heute gibt es ohne Anfuehrungszeichen nur true, false
und null.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

# (Text, erwarteter Wert)
VALID = [
    # die drei Werte ohne Anfuehrungszeichen
    ('null', None), ('true', True), ('false', False),
    ('[null, true, false]', [None, True, False]),
    ('[null\nnull\ntrue]', [None, None, True]),
    ('[true\nfalse\nnull]', [True, False, None]),
    ('{null: null}', {'null': None}), ('{"null": null}', {'null': None}),
    ('a: null, b: true', {'a': None, 'b': True}),
    ('true: false', {'true': False}),
    ('{true: true, false: false, null: null}', {'true': True, 'false': False, 'null': None}),
    ('[null,null]', [None, None]), ('a: null // Kommentar', {'a': None}), ('[null/* k */]', [None]),
    ('[[null], {a: [null]}]', [[None], {'a': [None]}]), ('a: null\n', {'a': None}),
    # nil ist an Namensposition ein gewoehnlicher Name
    ('{nil: 1}', {'nil': 1}), ('{"nil": null}', {'nil': None}),
    ('nil: null\nnull: 1', {'nil': None, 'null': 1}),
    ('{nil: "nil", Nil: [true]}', {'nil': 'nil', 'Nil': [True]}),
    # Bezeichner an Namensposition sind gewoehnliche Namen
    ('{$a: 1, _b: null, Nil: 2, NaN: 3, px: 4, ms: 5, k: 6}',
     {'$a': 1, '_b': None, 'Nil': 2, 'NaN': 3, 'px': 4, 'ms': 5, 'k': 6}),
    # Bezeichner mit U+00B5 und den Buchstaben U+00C0 bis U+00FF aus Latin-1 Supplement
    ('{größe: 1}', {'größe': 1}),
    ('{µ: 1, À: 2, Ö: 3, Ø: 4, ö: 5, ø: 6, ÿ: 7, ß: 8, Þ: 9}',
     {'µ': 1, 'À': 2, 'Ö': 3, 'Ø': 4, 'ö': 5, 'ø': 6, 'ÿ': 7, 'ß': 8, 'Þ': 9}),
    ('{a9ö: 1, Ö9_$: 2, _ü: 3}', {'a9ö': 1, 'Ö9_$': 2, '_ü': 3}),
    ('größe: 1\nbreite_µm: 2', {'größe': 1, 'breite_µm': 2}),
    ('{"größe": 1, größe: 2}', {'größe': 2}),
    ('{é: 1, "\\u00e9": 2}', {'é': 2}),
    ('{"e\\u0301": 1, é: 2}', {'e\N{COMBINING ACUTE ACCENT}': 1, 'é': 2}),
    ('{ÿ: [1], nil: null}', {'ÿ': [1], 'nil': None}),
    # Suffixe: Faktor 1000, 1024, 1000000, 1048576
    ('10k', 10000), ('1kb', 1024), ('2m', 2000000), ('1mb', 1048576),
    ('1.5k', 1500), ('0.5kb', 512), ('0.1kb', 102.4), ('-2k', -2000),
    ('0x10kb', 16384), ('0b11k', 3000), ('0o17k', 15000), ('0Xffkb', 261120),
    ('1.5m', 1500000), ('0.1m', 100000), ('0.000001m', 1), ('-3m', -3000000),
    ('0x10m', 16000000), ('1e3m', 1000000000), ('2.5e-1m', 250000), ('0m', 0),
    ('1_000m', 1000000000), ('0.000_000_1m', 0.1),
    # laengste Uebereinstimmung: m, mb, ms, min
    ('[1m, 1mb, 1ms, 1min]', [1000000, 1048576, 0.001, 60]),
    ('[1m\n2m]', [1000000, 2000000]), ('a: 5m // Kommentar', {'a': 5000000}),
    ('a: 1m# Kommentar', {'a': 1000000}), ('[1m/* x */,2k]', [1000000, 2000]),
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
    # Suffixe ohne Wirkung; n nur nach einer ganzen Zahl
    ('10n', 10), ('-3n', -3), ('0n', 0), ('-0n', 0), ('1_000n', 1000),
    ('0b101n', 5), ('0xFFn', 255), ('-0x10n', -16), ('0o17n', 15), ('0XFFn', 255),
    ('9007199254740993n', 9007199254740993), ('[1n,2n\n3n]', [1, 2, 3]),
    # ein '_' nach einer Ziffer ist immer Zifferngruppierung
    ('1_0', 10), ('1_0k', 10000), ('1_0s', 10), ('0x1_0n', 16), ('1_0m', 10000000),
    # Literale und Suffixe zusammen
    ('[50pct, 10k, null]', [0.5, 10000, None]),
    ('{t: 30s, g: 64mb, n: null}', {'t': 30, 'g': 67108864, 'n': None}),
]

# Texte, die abgelehnt werden muessen
INVALID = [
    # nur die drei Werte, nur in Kleinbuchstaben; nil gibt es nicht
    'nil', '[nil]', 'a: nil', '{nil: nil}', '{"a": nil}', '[null, nil]', 'nil: nil',
    '[abc]', 'True', 'NULL', 'False', 'Nil', 'NIL', 'nIl', '[None]', '[none]',
    'NaN', 'Infinity', 'undefined', '[ture]', '[nul]', '[yes]', '[on]', 'a: red',
    # laengste Uebereinstimmung: weitere Zeichen gehoeren zum Bezeichner
    'nill', 'nil2', 'nil_', 'nil$', '_nil', '$nil', 'nullable', 'trueish', 'falsey',
    # Leerraum und fehlende Trenner
    '[null null]', 'null true', '[n ull]', '[nu ll]', 'a: null null', 'tr ue',
    # andere Zeichen als Buchstaben aus ASCII und Latin-1 Supplement; auch nicht ª, º und ·
    '{ª: 1}', '{º: 1}', '{Nº: 1}', '{aª: 1}', '{·a: 1}', '{·: 1}', '{a·b: 1}', '{a·: 1}', '{×: 1}', '{a×b: 1}', '{÷: 1}', '{a÷: 1}', '{π: 1}', '{€: 1}',
    '{a€: 1}', '{©: 1}', '{«a»: 1}', '{¿a: 1}', '{a¹: 1}', '{²: 1}', '{\xad: 1}', '{a\xadb: 1}',
    '{e\N{COMBINING ACUTE ACCENT}: 1}', '{gr\N{LATIN SMALL LETTER LONG S}: 1}', '{Ā: 1}', '{a\x7f: 1}',
    '{9ö: 1}', '{ö-ä: 1}', '{ö.ä: 1}',
    # Bezeichner an Wertposition sind auch mit Latin-1-Buchstaben ein Fehler
    '[größe]', '[µ]', 'ä', 'a: nül', '[nil·]',
    # Werte koennen nicht definiert werden
    '%define: a = 1\n[a]', '%define: nil = null\nnil', '%define: x = 1\n1',
    # Suffixe, die es nicht gibt; Zeichen direkt nach einem Suffix
    '10q', '10kk', '10kbs', '10k5', '10y', '10wx',
    '10g', '10mi', '10mins', '10sec', '10hs', '10ss',
    '10px', '10px2', '10min5', '10pc', '10pcts', '10kb1',
    '10k_', '10s_', '10_k', '1_s', '10$', '10$s',
    '10_', '1__0', '1_', '10nn', '10L', '10LL',
    '10mm', '10mn', '10kn', '10nk', '10m5', '10mb_',
    '10m$', '10ms5', '10mbs', '10msec', '10hh', '10pctx',
    # entfallene Suffixe und Schreibweisen
    '10K', '1Kb', '1kB', '1KB', '1Mb', '1mB', '1MB', '12px', '100L', '0xFFL',
    # n nur nach einer ganzen Zahl
    '1.5n', '1.0n', '0.0n', '-1.5n', '1e3n', '1E3n', '1e-3n', '1.5e3n', '1e0n',
    '1_0.5n', '1.0_0n',
    # kein Suffix beginnt mit '_'
    '10_s', '10_ms', '10_n', '0x10_k', '1e3_k', '1.5_k', '10_m',
    '[10_k]', '[_k]', '[1_]',
    # Gross- und Kleinschreibung
    '10l', '10S', '10MS', '10Ms', '10mS', '10Min',
    '10MIN', '10H', '10PX', '10Px', '10pX', '10N',
    '10PCT', '10Pct', '10M', '10KB', '10Mb', '10mB', '10Kb', '10kB',
    # Zeichen, die kein Suffix einleiten oder nicht in einem Suffix stehen
    '10ab', '10e', '10E', '10Bk', '10bk', '10f',
    '10%', '50%', '10kb%', '10k%', '10pct%', '%',
    '10x', '10X', '10o', '10O', '10xy', '10oz',
    '0.0x', '1e3x', '10b',
    # Leerraum, fehlende Trenner, fehlende Ziffern
    '10 k', '10 ms', '10 m', '100 pct', '10k k', '10ms ms', '10 n', '10m m',
    '[10k 20k]', '[30s 5min]', '1.k', '1.s', 'k', 'ms',
    '0x', '0xk', '0o', '0Xy', '0O', '-0x', '0ok',
    '0b', '0B', '0xs', '0bn',
    # Suffixe sind keine Werte, Literale keine Suffixe
    '10nil', '10null', '1true', '[px]', '[m]', '[n]', '[k]', '[ms]',
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
    # die Anwendung kann weder Werte noch Suffixe definieren
    for extra in (dict(values={'nil': None}), dict(suffixes={'q': abs}), dict(max_expansion=10)):
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
