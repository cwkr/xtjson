"""Referenz-Parser fuer XTJSON (Entwurf 0.6) + Pruefung der Beispiele der Spezifikation."""
import copy
import json
import re
import sys
from decimal import Decimal, localcontext


class XTJSONError(ValueError):
    pass


ID = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*')
NUM = re.compile(
    r'-?(?:0[xX][0-9A-Fa-f](?:_?[0-9A-Fa-f])*'
    r'|0[oO][0-7](?:_?[0-7])*'
    r'|0[bB][01](?:_?[01])*'
    r'|(?:0|[1-9](?:_?[0-9])*)(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?)'
)
WS = ' \t\v\f\xa0\u1680\u202f\u205f\u3000\u2028\u2029\ufeff' + ''.join(chr(c) for c in range(0x2000, 0x200B))
CP = re.compile(r'\{0*([0-9A-Fa-f]{1,5}|10[0-9A-Fa-f]{4})\}')
ESC = {'"': '"', "'": "'", '\\': '\\', '/': '/', 'b': '\b', 'f': '\f',
       'n': '\n', 'r': '\r', 't': '\t', 'v': '\v'}

SUF = re.compile(r'[g-np-wyzG-NP-WYZ$][A-Za-z0-9_$]*')
FIXED_VALUES = {'true': True, 'false': False, 'null': None}
# Suffixe nach 9.5: Suffix -> (Faktor, Teiler). Die Tabelle ist abschliessend.
SUFFIXES = {}
for _names, _factor, _divisor in (
        ('k K', 1000, 1), ('kb Kb kB KB', 1024, 1), ('mb Mb mB MB', 1048576, 1),
        ('ms', 1, 1000), ('s', 1, 1), ('min', 60, 1), ('h', 3600, 1),
        ('pct', 1, 100), ('px', 1, 1), ('L', 1, 1), ('n', 1, 1)):
    for _n in _names.split():
        SUFFIXES[_n] = (_factor, _divisor)


# Grenze fuer die Groesse des Werts nach dem Ersetzen benannter Werte (11, 13):
# Anzahl der JSON-Werte, die durch Ersetzen entstehen.
MAX_EXPANSION = 1000000


def size(v):
    """Anzahl der JSON-Werte in v (ein Objekt oder Array zaehlt mit)."""
    if isinstance(v, dict):
        return 1 + sum(size(x) for x in v.values())
    if isinstance(v, list):
        return 1 + sum(size(x) for x in v)
    return 1


def apply_suffix(text, value, suf):
    """text: Zahl ohne '_' und ohne Suffix; value: ihr Wert (int oder float)."""
    if suf not in SUFFIXES:
        raise XTJSONError('Suffix %r gibt es nicht' % suf)
    factor, divisor = SUFFIXES[suf]
    if factor == divisor:                             # Suffix ohne Wirkung
        return value
    if isinstance(value, int) and divisor == 1:
        return value * factor
    with localcontext() as ctx:                       # exakte Dezimalrechnung
        ctx.prec = 2000
        r = (Decimal(value) if isinstance(value, int) else Decimal(text)) * factor / divisor
        return int(r) if r == r.to_integral_value() else float(r)


def string_value(out, rawidx, nlidx, contidx):
    """Wert eines Strings nach 8.3 (Schritte 1 bis 4).

    out: Zeichen nach Aufloesung der Escape-Sequenzen; rawidx: Positionen
    unmaskierter Zeichen; nlidx: Positionen der Zeilenumbrueche; contidx: die
    davon, die zu einer Zeilenfortsetzung gehoeren. Das '\\' einer
    Zeilenfortsetzung steht als Merkmal der Zeile (cont), nicht in out.
    """
    lines, cont = [[]], []
    for k, ch in enumerate(out):                       # 1. Zeilen bilden
        if k in nlidx:
            cont.append(k in contidx)
            lines.append([])
        else:
            lines[-1].append((ch, k in rawidx))
    cont.append(False)                                 # die letzte Zeile endet am Begrenzer

    def ws(t):
        return t[1] and t[0] in ' \t'

    for i, ln in enumerate(lines[:-1]):                # 2. Leerraum am Zeilenende
        while not cont[i] and ln and ws(ln[-1]):       # vor '\' bleibt er erhalten
            ln.pop()

    def empty(i):
        return not lines[i] and not cont[i]            # eine Zeile mit '\' ist nicht leer

    if len(lines) > 1 and empty(0):                    # 3. Einrueckung
        lines, cont = lines[1:], cont[1:]

        def indent(ln):
            k = 0
            while k < len(ln) and ws(ln[k]):
                k += 1
            return k

        used = [ln for i, ln in enumerate(lines) if not empty(i) or i == len(lines) - 1]
        m = min(indent(ln) for ln in used)
        if len({tuple(ln[:m]) for ln in used}) > 1:
            raise XTJSONError('Einrueckung nicht in allen Zeilen gleich')
        lines = [ln[m:] for ln in lines]
    res = []                                           # 4. Zusammensetzen
    for i, ln in enumerate(lines):
        res.append(''.join(ch for ch, _ in ln))
        if i < len(lines) - 1 and not cont[i]:         # Zeilenfortsetzung: kein U+000A
            res.append('\n')
    return ''.join(res)


def strict_char(ch):
    """True, wenn ch im Strict-Modus verboten ist: Surrogat oder Noncharacter (12)."""
    o = ord(ch)
    return 0xD800 <= o <= 0xDFFF or 0xFDD0 <= o <= 0xFDEF or (o & 0xFFFE) == 0xFFFE


def tokenize(s):
    toks, i, n, nl = [], 0, len(s), False
    while i < n:
        c = s[i]
        if c in WS:
            i += 1
        elif c in '\n\r':
            nl = True
            i += 1
        elif c == '#' or s.startswith('//', i):
            while i < n and s[i] not in '\n\r':
                i += 1
        elif s.startswith('/*', i):
            j = s.find('*/', i + 2)
            if j < 0:
                raise XTJSONError('Blockkommentar nicht abgeschlossen')
            i = j + 2
        elif c in '{}[]:,=':
            toks.append((c, c, nl))
            nl = False
            i += 1
        elif c in '"\'':
            j, out = i + 1, []
            rawidx, nlidx, contidx = set(), set(), set()
            while True:
                if j >= n:
                    raise XTJSONError('String nicht abgeschlossen')
                d = s[j]
                if d == c:
                    break
                if d in '\n\r':
                    nlidx.add(len(out))
                    out.append('\n')
                    j += 2 if s.startswith('\r\n', j) else 1
                    continue
                if d == '\t':
                    rawidx.add(len(out))
                    out.append(d)
                    j += 1
                    continue
                if ord(d) < 0x20:
                    raise XTJSONError('Steuerzeichen im String')
                if d == '\\':
                    e = s[j + 1] if j + 1 < n else ''
                    if e and e in '\n\r':                 # Zeilenfortsetzung (8.2)
                        contidx.add(len(out))
                        nlidx.add(len(out))
                        out.append('\n')
                        j += 3 if s.startswith('\r\n', j + 1) else 2
                    elif e in ESC:
                        out.append(ESC[e])
                        j += 2
                    elif e == 'u' and s[j + 2:j + 3] == '{':
                        m = CP.match(s, j + 2)
                        if not m:
                            raise XTJSONError('ungueltige Escape-Sequenz \\u{...}')
                        if 0xD800 <= int(m.group(1), 16) <= 0xDFFF:
                            raise XTJSONError('Surrogat in \\u{...}')
                        out.append(chr(int(m.group(1), 16)))
                        j = m.end()
                    elif e == 'u' and re.fullmatch(r'[0-9A-Fa-f]{4}', s[j + 2:j + 6]):
                        out.append(chr(int(s[j + 2:j + 6], 16)))
                        j += 6
                    elif e == 'x' and re.fullmatch(r'[0-9A-Fa-f]{2}', s[j + 2:j + 4]):
                        out.append(chr(int(s[j + 2:j + 4], 16)))
                        j += 4
                    elif e == '0' and not re.match(r'[0-9]', s[j + 2:j + 3]):
                        out.append('\0')
                        j += 2
                    else:
                        raise XTJSONError('ungueltige Escape-Sequenz')
                else:
                    rawidx.add(len(out))
                    out.append(d)
                    j += 1
            # Surrogatpaare zusammenfuehren
            val = string_value(out, rawidx, nlidx, contidx).encode('utf-16', 'surrogatepass').decode('utf-16', 'surrogatepass')
            toks.append(('str', val, nl))
            nl = False
            i = j + 1
        elif c == '-' or c.isdigit() and c.isascii():
            m = NUM.match(s, i)
            if not m:
                raise XTJSONError('ungueltige Zahl bei %d' % i)
            t = m.group().replace('_', '')
            neg = t.startswith('-')
            body = t[1:] if neg else t
            if body[:2].lower() in ('0x', '0o', '0b'):
                v = int(body[2:], {'x': 16, 'o': 8, 'b': 2}[body[1].lower()])
                v = -v if neg else v
            elif re.fullmatch(r'-?\d+', t):
                v = int(t)
            else:
                v = float(t)
            i = m.end()
            ms = SUF.match(s, i)
            if ms:
                v = apply_suffix(t, v, ms.group())
                i = ms.end()
            toks.append(('num', v, nl))
            nl = False
        elif c == '%':                                 # Direktive (6.5): '%' und Name ohne Leerraum
            m = ID.match(s, i + 1)
            if not m:
                raise XTJSONError("Name der Direktive muss unmittelbar auf '%' folgen")
            toks.append(('dir', m.group(), nl))
            nl = False
            i = m.end()
        else:
            m = ID.match(s, i)
            if not m:
                raise XTJSONError('unerwartetes Zeichen %r bei %d' % (c, i))
            toks.append(('id', m.group(), nl))
            nl = False
            i = m.end()
            continue
        # Tokens muessen aneinandergrenzende Tokens nicht pruefen: der Parser
        # verlangt zwischen Elementen Komma oder Zeilenumbruch.
    toks.append(('eof', None, nl))
    return toks


class Parser:
    def __init__(self, text, strict=False, max_expansion=MAX_EXPANSION):
        self.values = {}                               # Definitionen aus %define (6.6)
        self.sizes = {}
        self.versions = {}                             # Angaben aus %version (6.7)
        self.doc_strict = None                         # Wert von %strict (6.8)
        self.expanded = 0
        self.max_expansion = max_expansion
        self.t = tokenize(text)
        self.p = 0
        self.strict = strict
        # Werte von Direktiven halten die Verbote zu Strings und doppelten Namen
        # immer ein (6.5); im Inhalt werden Verstoesse gegen den Strict-Modus (12)
        # gesammelt und am Ende gemeldet, wenn er gilt.
        self.in_directives = False
        self.violations = []

    def violation(self, msg):
        if self.in_directives:
            raise XTJSONError(msg + ' im Wert einer Direktive')
        self.violations.append(msg)

    def check_str(self, v):
        if any(strict_char(ch) for ch in v):
            self.violation('Surrogat oder Noncharacter in %r' % v)

    def peek(self):
        return self.t[self.p]

    def next(self):
        tok = self.t[self.p]
        self.p += 1
        return tok

    def document(self):
        self.in_directives = True
        while self.peek()[0] == 'dir':
            self.directive()
            k, _, nl = self.peek()                     # Trenner wie zwischen Elementen (7.3)
            if k == ',':
                self.next()
            elif not nl or k == 'eof':
                raise XTJSONError('Komma oder Zeilenumbruch nach der Direktive erwartet')
            if self.peek()[0] == 'eof':
                raise XTJSONError('Dokument ohne Inhalt nach den Direktiven')
        self.in_directives = False
        k0 = self.peek()[0]
        if k0 in ('str', 'id') and self.t[self.p + 1][0] == ':':
            v = self.members('eof')
        else:
            v = self.value()
        if self.peek()[0] != 'eof':
            raise XTJSONError('Text nach dem Wurzelwert')
        if not isinstance(v, (dict, list)):
            self.violations.append('Wurzelwert ist kein Objekt und kein Array')
        if self.strict and self.doc_strict is False:
            raise XTJSONError('%strict: false widerspricht dem Strict-Modus der Anwendung')
        if (self.strict or self.doc_strict) and self.violations:
            raise XTJSONError('Strict-Modus: ' + self.violations[0])
        return v

    def directive(self):
        _, name, _ = self.next()
        if self.next()[0] != ':':
            raise XTJSONError("':' nach dem Namen der Direktive erwartet")
        ident = None
        if self.peek()[0] == 'id' and self.t[self.p + 1][0] == '=':
            ident = self.next()[1]
            self.next()
        if name == 'define':
            if ident is None:
                raise XTJSONError('%define braucht einen Bezeichner und =')
            if ident in FIXED_VALUES or ident in self.values:
                raise XTJSONError('benannter Wert %r ist bereits definiert' % ident)
            v = self.value()                           # ident ist hier noch nicht definiert
            self.values[ident] = v
            self.sizes[ident] = size(v)
        elif name == 'version':
            ident = 'xtjson' if ident is None else ident
            if ident in self.versions:
                raise XTJSONError('Version %r ist bereits angegeben' % ident)
            v = self.value()
            if isinstance(v, bool) or not isinstance(v, (str, int, float)):
                raise XTJSONError('%version erwartet einen String oder eine Zahl')
            self.versions[ident] = v
        elif name == 'strict':
            if ident is not None:
                raise XTJSONError('%strict hat keinen Bezeichner')
            if self.doc_strict is not None:
                raise XTJSONError('%strict ist bereits angegeben')
            v = self.value()
            if not isinstance(v, bool):
                raise XTJSONError('%strict erwartet true oder false')
            self.doc_strict = v
        else:
            raise XTJSONError('unbekannte Direktive %%%s' % name)

    def value(self):
        k, v, _ = self.next()
        if k == '{':
            if self.peek()[0] == '}':
                self.next()
                return {}
            obj = self.members('}')
            self.next()
            return obj
        if k == '[':
            return self.items()
        if k == 'str':
            self.check_str(v)
            return v
        if k == 'num':
            return v
        if k == 'id':
            if v in FIXED_VALUES:
                return FIXED_VALUES[v]
            if v in self.values:
                self.expanded += self.sizes[v]
                if self.expanded > self.max_expansion:
                    raise XTJSONError('Grenze fuer die Groesse nach dem Ersetzen benannter Werte erreicht')
                return copy.deepcopy(self.values[v])   # jede Stelle erhaelt eine eigene Kopie
            raise XTJSONError('benannter Wert %r ist nicht definiert' % (v,))
        raise XTJSONError('Wert erwartet, gefunden %r' % (v,))

    def separator(self, closer):
        """True, wenn ein weiteres Element folgt."""
        k, _, nl = self.peek()
        if k == ',':
            self.next()
            return self.peek()[0] != closer
        if k == closer:
            return False
        if nl:
            return True
        raise XTJSONError('Komma oder Zeilenumbruch erwartet')

    def members(self, closer):
        obj = {}
        while True:
            k, name, _ = self.next()
            if k not in ('str', 'id'):
                raise XTJSONError('Name erwartet')
            if k == 'str':
                self.check_str(name)
            if self.next()[0] != ':':
                raise XTJSONError("':' erwartet")
            if name in obj:
                self.violation('doppelter Name %r' % name)
            obj[name] = self.value()
            if not self.separator(closer):
                return obj

    def items(self):
        arr = []
        if self.peek()[0] == ']':
            self.next()
            return arr
        while True:
            arr.append(self.value())
            if not self.separator(']'):
                self.next()
                return arr


def parse_document(text, strict=False, max_expansion=MAX_EXPANSION):
    """Liest ein XTJSON-Dokument und liefert (Wert, Versionen).

    Versionen: {Bezeichner: Wert} aus den %version-Direktiven (6.7); die Version
    dieser Spezifikation steht unter 'xtjson'. Der Referenz-Parser prueft sie nicht.
    strict: die Anwendung verlangt den Strict-Modus (12); ohne ihn gilt er nur mit
    %strict: true im Dokument (6.8).
    """
    p = Parser(text, strict, max_expansion)
    return p.document(), p.versions


def parse(text, strict=False, max_expansion=MAX_EXPANSION):
    """Liest ein XTJSON-Dokument und liefert seinen Wert."""
    return parse_document(text, strict, max_expansion)[0]


# ----------------------------------------------------------------------------
def main(spec_path):
    md = open(spec_path, encoding='utf-8').read()
    blocks = re.findall(r'```(\w+)\n(.*?)```', md, re.S)
    fails = 0

    # 1) alle xtjson-Bloecke muessen parsen; folgt direkt ein json-Block, muss er gleich sein
    n_l = n_pair = 0
    for idx, (lang, body) in enumerate(blocks):
        if lang != 'xtjson':
            continue
        n_l += 1
        try:
            v = parse(body)
        except XTJSONError as ex:
            fails += 1
            print('FEHLER xtjson-Block %d: %s\n%s' % (n_l, ex, body))
            continue
        if idx + 1 < len(blocks) and blocks[idx + 1][0] == 'json':
            n_pair += 1
            if v != json.loads(blocks[idx + 1][1]):
                fails += 1
                print('FEHLER: JSON-Aequivalent weicht ab (Block %d)' % n_l)
    print('xtjson-Bloecke: %d, davon mit JSON-Vergleich: %d' % (n_l, n_pair))

    # 2) ungueltige Beispiele (Anhang B.3 + Text)
    invalid = [
        '', '  \n# nur Kommentar\n', '[1 2]', 'a: 1 b: 2', '[1,,2]', '[,]', '{,}', '[,1]',
        '{a: 1} b: 2', 'a: 1 }', '[abc]', '{2fa: true}', '{größe: 1}', '{a.b: 1}',
        "'It's'", '/* offen', '0755', '0x', '0x_FF',
        '1__000', '1_', '1_.5', '0b102', '0o78', '0x1.8', '+1', '.5', '5.', 'NaN',
        'Infinity', '{a: 1,, b: 2}', 'a: 1,,', '[1, 2', '{a: 1',
        '[1_]', '{max-age: 1}', '"\\1"', '"\\01"', '"\\x4"', '"\\xZZ"', '"\\u12"',
        '"\\\t"', '"a\x0bb"', '[1\x0b2]', '[1\x0c2]', '"a\\', '0XG', '0B2', '0O8',
        '"\\9"', 'a: 1\x0bb: 2', '[1\u20282]', '[1\u20292]', '[1\xa02]', '{a: 1 /* x\n */ b: 2}', '[1 /* \n */ 2]',
        '[1 // /* \n */ 2]', 'a: 1 /*\n*/ b: 2', '[1, // /* \n */ 2]', "[1,\u200b2]", "[1,\u00852]", "[1,\u180e2]", "[1\u30002]", "[1\ufeff2]", "a: 1\u2003b: 2",
        '"\\u{110000}"', '"\\u{}"', '"\\u{1_F600}"', '"\\u{ 41 }"', '"\\U{41}"', '"\\u{41"', '"\\u{G}"', '"\\u{0000110000}"', '[_1]', '-', '--1', '0x1E+3', '[0xg]', '50%', '10q', '10kbs', '10_k', '10MS', '1_s', '{a 1}', '{"a" "b"}',
        '{a: 1 /* x */ b: 2}', 'a:', ': 1', '1: 2', '[1] [2]', '1 2', '{} {}',
        '"\\ x"', '"\\a"', '"\\N"', '"\\-"',
        '"\\X41"', '"\\ "', '"\\e"', '"\\U0041"', "'\\.'",
        '"""a"""', "'''a'''", '""""""', '{"""a""": 1}', '"a\\ \nb"', '"a\\\t\nb"', '"a\\ \r\nb"',
        '"a\x0cb"', '"a\\\u2028b"', '"abc', "'a\nb", '"\n\ta\n  b\n "',
        # Direktiven (6.5 bis 6.7)
        '% define: a = 1\n[a]', '%include: "a.xtj"\n{}', '%Define: a = 1\n[a]', '%define: "x"\n{}',
        '%define: true = 1\n[true]', '%define: a = 1\n%define: a = 2\n[a]',
        '%define: a = b\n%define: b = 1\n[a]', '%define: a = [a]\na', '%define: a = 1 [a]',
        '%define: a = 1', 'a: 1\n%define: b = 2', '[%define: a = 1]',
        "%version: '0.6'\n%version: xtjson = '0.6'\n{}", '%version: s = 1\n%version: s = 2\n{}',
        '%version: [0, 6]\n{}', '%version: true\n{}', '%define: nil = null\n%version: nil\n{}',
        '%strict: 1\n{}', "%strict: 'true'\n{}", '%strict: s = true\n{}', '%strict: true\n%strict: true\n{}',
        '%strict: true\n"x"', '%strict: true\n{a: 1, a: 2}', '%define: d = {a: 1, a: 2}\n[d]',
        '%define: n = "\\uFFFF"\n[1]',
    ]
    for t in invalid:
        try:
            v = parse(t)
        except XTJSONError:
            continue
        fails += 1
        print('FEHLER: sollte ungueltig sein: %r -> %r' % (t, v))
    print('ungueltige Beispiele geprueft: %d' % len(invalid))

    # 3) gueltige Einzelfaelle mit erwartetem Wert
    valid = [
        ('0xFF', 255), ('0o755', 493), ('0b1010', 10), ('0x1e3', 483), ('-0x10', -16),
        ('0x00FF', 255), ('0o377', 255), ('0b1111_1111', 255), ('1_000_000', 1000000),
        ('1e1_0', 1e10), ('6.022_140_76e23', 6.02214076e23), ('0xDEAD_BEEF', 3735928559),
        ('0o644', 420), ('0b1010_0101', 165), ('10_485_760', 10 * 1024 * 1024),
        ('[1\n-2]', [1, -2]), ('[1\n,2]', [1, 2]), ('[1,\n2,\n]', [1, 2]),
        ('a: 1', {'a': 1}), ('a: 1,', {'a': 1}), ('"a": 1\n\'b\': 2', {'a': 1, 'b': 2}),
        ('true: false\nnull: null', {'true': False, 'null': None}),
        ('true', True), ('"x"', 'x'), ("'x'", 'x'), ('{}', {}), ('[]', []),
        ('a\n:\n1\nb: 2', {'a': 1, 'b': 2}),
        ('{a: 1 /* x\n */\n b: 2}', {'a': 1, 'b': 2}), ('\u00a0[1]\u2028', [1]),
        ('[1,\u2028\xa0\u20292]', [1, 2]), ('a: 1 // k\u2028b: 2', {'a': 1}), ('[1, /* \n */ 2]', [1, 2]),
        ('[1 /* x */\n2]', [1, 2]), ('1 // k', 1), ('[1\ufeff]', [1]), ('[1,\u20032]', [1, 2]),
        ('\ufeff\u3000{a\u1680:\u202f1\u205f}\u200a\u2000', {'a': 1}), ('"\\u{1F600}"', '\U0001F600'),
        ('"\\u{e4}\\u{000041}\\u{0}"', '\xe4A\0'), ('"\\u{10FFFF}"', '\U0010FFFF'), ('"\\u{0010ffff}"', '\U0010FFFF'),
        ('"\\uD83D\\uDE00"', '\U0001F600'), ("'\\u{41}'", 'A'),
        ('"\\u{1f600}" // k\u3000\u2028 immer noch Kommentar', '\U0001F600'), ('"\u3000\ufeff"', '\u3000\ufeff'), ('1 # k', 1), ('"\xa0\u2028"', '\xa0\u2028'),
        ('a: 1 /* x */ // y\n/* z\n */ b: 2', {'a': 1, 'b': 2}),
        ('a: 1 // k\nb: 2 # k\n', {'a': 1, 'b': 2}),
        ("'It\\'s'", "It's"), ('"It\\\'s"', "It's"), ('\'sagt "hi"\'', 'sagt "hi"'),
        ('{a: 1, "a": 2}', {'a': 2}), ('{"max-age": 1, $s: 2, _x9: 3}', {'max-age': 1, '$s': 2, '_x9': 3}),
        ('0X1F', 31), ('0B11', 3), ('0O17', 15), ('-0XfF_ff', -65535), ('0xff', 255), ('0XFF', 255),
        ('"\\x41"', 'A'), ('"\\0"', '\0'), ('"\\0a"', '\0a'), ('"\\v\\f"', '\v\f'),
        ('"\\xe4\\xE4"', '\xe4\xe4'), ('"\u2028"', '\u2028'), ("'\\\"'", '"'),
        ('[1,\x0b\x0c2]', [1, 2]), ('\x0c{a\x0b:\x0c1}\x0b', {'a': 1}), ('[1 //k\x0b\x0c\n2]', [1, 2]),
        ('/**/1', 1), ('/***/1', 1), ('/* * / */1', 1), ('#!shebang\n[1]', [1]),
        ('"\\ud83d\\ude00"', '\U0001F600'), ('\ufeff{"a":1}', {'a': 1}),
        ('5min', 300), ('100ms', 0.1), ('50pct', 0.5), ('12px', 12), ('100L', 100), ('10n', 10),
        ('30s', 30), ('2h', 7200), ('1_0', 10),
        ('[[1,2\n3],{a:[{}]}]', [[1, 2, 3], {'a': [{}]}]),
        ('"a\nb"', 'a\nb'), ("'a\nb'", 'a\nb'), ('"a\\\nb"', 'ab'), ('"a\\\r\nb"', 'ab'),
        ('"a\\\rb"', 'ab'), ("'a\\\n  b'", 'a  b'), ('a: "x\\\ny"\nb: 2', {'a': 'xy', 'b': 2}),
        ('"a\tb"', 'a\tb'), ('"a\\\\\nb"', 'a\\\nb'),
        ('%define: a = 1\n[a]', [1]), ("%version: '0.6', %define: leer = \"\", [null, 543, leer]", [None, 543, '']),
        ('%define: a = {b: [1]}\nx: a\ny: a', {'x': {'b': [1]}, 'y': {'b': [1]}}),
    ]
    for t, exp in valid:
        try:
            v = parse(t)
        except XTJSONError as ex:
            fails += 1
            print('FEHLER: sollte gueltig sein: %r (%s)' % (t, ex))
            continue
        if v != exp or type(v) is not type(exp):
            fails += 1
            print('FEHLER: %r -> %r, erwartet %r' % (t, v, exp))
    print('gueltige Einzelfaelle geprueft: %d' % len(valid))

    # 4) Superset-Eigenschaft: JSON-Texte ergeben denselben Wert wie json.loads
    samples = [
        '{"a":[1,2.5e-3,true,null],"b":{"c":"d\\u00e9"}}', '  [ ]  ', '"s"', '-0', '1E5',
        '{"a"\n:\n1\n,\n"b":[\n1\n,\n2\n]}', '{"a":1,"a":2}', '"\\"\\\\\\/\\b\\f\\n\\r\\t"',
        '"#kein // kommentar /* */"', '{"true":1,"0x10":2}', '[0,0.0,-1e-2,123456789]',
        json.dumps({'x': [1, {'y': 'z\n\u20ac'}], 'k': None}, indent=2),
        json.dumps([[], {}, '', 0, [[[1]]]]),
    ]
    for t in samples:
        try:
            if parse(t) != json.loads(t):
                raise XTJSONError('Wert weicht ab')
        except XTJSONError as ex:
            fails += 1
            print('FEHLER Superset: %r (%s)' % (t, ex))
    print('JSON-Texte geprueft: %d' % len(samples))

    # 5) Strict-Modus der Anwendung (12): doppelte Namen unabhaengig von der
    #    Schreibweise, auch in Werten von Direktiven, die nicht verwendet werden;
    #    Wurzelwert; %strict: false widerspricht (6.8). Weitere Faelle in
    #    tests_direktiven.py.
    for t in ['{a: 1, "a": 2}', "a: 1\n'\\u0061': 2", '%define: d = {a: 1, a: 2}\n[1]', '1',
              '%strict: false\n{}']:
        try:
            parse(t, strict=True)
            fails += 1
            print('FEHLER: Strict-Modus akzeptiert: %r' % t)
        except XTJSONError:
            pass

    print('ERGEBNIS: %s' % ('OK' if not fails else '%d Fehler' % fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
