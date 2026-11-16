"""Zusatztests: Leerraum am Zeilenende, Entfernen der Einrueckung, Zeilenfortsetzung (8.3)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

Z = chr(0x3000)   # ideografisches Leerzeichen
N = chr(0xA0)     # geschuetztes Leerzeichen

VALID = [
    # die zwoelf Zeilen der Tabelle in 8.3
    ('"\n  a\n  b\n  "', 'a\nb\n'),
    ('"\n    a\n  "', '  a\n'),
    ('"\n  a\n"', '  a\n'),
    ('"\n  a\n    "', 'a\n  '),
    ('"\n  a\n\n  b"', 'a\n\nb'),
    ('"a  \n  b"', 'a\n  b'),
    ('"\na  \nb\\x20\n"', 'a\nb \n'),
    ('"a  "', 'a  '),
    ('"\n  a \\\n  b\n  "', 'a b\n'),
    ('"\n  a\\\n  "', 'a'),
    ('"a\\\n  b"', 'a  b'),
    ('"\\\n  a"', '  a'),
    # weitere Faelle
    ('"  \n  a\n  "', 'a\n'),
    ('"\n\ta\n\t\tb\n\t"', 'a\n\tb\n'),
    ('"\n  a\n \t \n  b\n  "', 'a\n\nb\n'),
    ('"\n  a \\t\n  "', 'a \t\n'),
    ('"\n  \\x20a\n    b\n  "', ' a\n  b\n'),
    ('"\n' + Z + Z + 'a' + N + '\n' + Z + Z + '"', Z + Z + 'a' + N + '\n' + Z + Z),
    ('"\n  a' + N + Z + ' \n  "', 'a' + N + Z + '\n'),
    ('"\n\ta\n  b\n"', '\ta\n  b\n'),
    ('"\n\t a\n\t b\n\t "', 'a\nb\n'),
    ('"\n  a\n\n\t\n  b\n  "', 'a\n\n\nb\n'),
    ('"\r\n  a  \r\n  b\r\n  "', 'a\nb\n'),
    ('"\n  a\\n  b\n  "', 'a\n  b\n'),
    ("'\n  x\n  '", 'x\n'),
    ('"\n"', ''),
    ('"\n  "', ''),
    ('"\n\n  a\n  "', '\na\n'),
    ('"\n  a\n  b"', 'a\nb'),
    ('"\n    a\n  b\n      c\n    "', '  a\nb\n    c\n  '),
    ('"a\n  b\n  c"', 'a\n  b\n  c'),
    ('"a  \n\n  b  "', 'a\n\n  b  '),
    ('" a"', ' a'),
    ('"\n  \'q\'\n  \\"\n  "', "'q'\n\"\n"),
    ('k: "\n    v\n    ", l: 1', {'k': 'v\n', 'l': 1}),
    # Zeilenfortsetzung
    ('"\n  a\\\n  b\\\n  c\n  "', 'abc\n'),
    ('"\n  a\\\r\n  b\r\n  "', 'ab\n'),
    ('"\n  a\\\r  b\r  "', 'ab\n'),
    ('"\n  a  \\\n  b"', 'a  b'),
    ('"\n  a \\t\\\n  b\n  "', 'a \tb\n'),
    ('"\n  \\\n  a\n  "', 'a\n'),
    ('"\n\\\n  a\n  "', '  a\n  '),
    ('"\\\n"', ''),
    ('"a\\\n\\\nb"', 'ab'),
    ("'\n    lang \\\n    und kurz\\\n    '", 'lang und kurz'),
    # Namen ueber mehrere Zeilen
    ('"\n  ab\n  ": 1', {'ab\n': 1}),
    ('{"a\\\nb": 1, \'c\nd\': 2}', {'ab': 1, 'c\nd': 2}),
]

INVALID = [
    '"\n  a\\ \n  "',
    '"\n  a\\\t\n  "',
    '"\n\ta\n b\n "',
    '"\n  a\n \tb\n  "',
    '"\n  a\x0b\n  "',
    '"\n  a\x0c\n  "',
    '"""\n  a\n  """',
    "'''\n  a\n  '''",
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
        if got != exp:
            fails += 1
            print('FEHLER: %r -> %r, erwartet %r' % (text, got, exp))
    for text in INVALID:
        try:
            got = parse(text)
        except XTJSONError:
            continue
        fails += 1
        print('FEHLER: sollte ungueltig sein: %r -> %r' % (text, got))
    print('Tests B: %d gueltig, %d ungueltig geprueft: %s'
          % (len(VALID), len(INVALID), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
