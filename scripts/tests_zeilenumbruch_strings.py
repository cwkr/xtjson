"""Zusatztests: Zeilenumbruch nur LF / CR LF, mehrzeilige Strings."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse, XTJSONError  # noqa: E402

VALID = [
    ('[1\r\n2]', [1, 2]),
    ('[1\n2]', [1, 2]),
    ('[1,\r2]', [1, 2]),
    ('\r[1]\r', [1]),
    ('a: 1 // k\r\nb: 2', {'a': 1, 'b': 2}),
    ('a: 1 // k\rb: 2', {'a': 1, 'b': 2}),
    ('[1\r2]', [1, 2]),
    ('a: 1\rb: 2', {'a': 1, 'b': 2}),
    ('"""a\rb"""', 'a\nb'),
    ('"""\r  a\r  """', 'a\n'),
    ('[1 # k\r\n\r2]', [1, 2]),
    ('{a: 1, "a": 2, \'a\': 3}', {'a': 3}),
    ('a: 1 # k\r\n\r\nb: 2', {'a': 1, 'b': 2}),
    ('{"a"\r:\r1}', {'a': 1}),
    ('"""abc"""', 'abc'),
    ('"""\nabc\n"""', 'abc\n'),
    ('"""\r\nabc\r\n"""', 'abc\n'),
    ('"""\nabc"""', 'abc'),
    ("'''a\"\"\"b''c'''", 'a"""b\'\'c'),
    ('""""""', ''),
    ("''''''", ''),
    ('"""\n"""', ''),
    ('"""\n\n"""', '\n'),
    ('"""a\\n\\tb\\u{41}\\x41"""', 'a\n\tbAA'),
    ('"""a\tb"""', 'a\tb'),
    ('"""a""b"c"""', 'a""b"c'),
    ('"""a\\""""', 'a"'),
    ('"""a"\\""""', 'a""'),
    ("'''it's'''", "it's"),
    ('a: """x\ny"""\nb: 2', {'a': 'x\ny', 'b': 2}),
    ('a: """x\ny""", b: 2', {'a': 'x\ny', 'b': 2}),
    ('["""a""", \'\'\'b\'\'\']', ['a', 'b']),
    ('["""a"""\n\'\'\'b\'\'\']', ['a', 'b']),
    ('"""// kein Kommentar # /* */"""', '// kein Kommentar # /* */'),
    ('"""  a\n  b\n  """', '  a\n  b\n  '),
    ('["", ""]', ['', '']),
    ('"" // leer', ''),
]

INVALID = [
    '"""k""": 1',
    '{"""k""": 1}',
    "{'''k''': 1}",
    '"\\u{D800}"',
    '"\\u{dfff}"',
    '"\\u{D83D}\\u{DE00}"',
    '"""\n\ta\n b\n """',
    '"""\n  a\n \tb\n  """',
    '"a\rb"',
    '"""abc',
    '"""abc""',
    '"""a""""',
    "'''a''''",
    '"""a\\\nb"""',
    '"""a\x00"""',
    '"""a\x0bb"""',
    '["""a""" """b"""]',
    '"""a"""x',
    '"a\nb"',
    "'a\nb'",
    '"""a""" """b"""',
    '"""\\q"""',
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
    print('Tests A: %d gueltig, %d ungueltig geprueft: %s'
          % (len(VALID), len(INVALID), 'OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
