"""Erzeugt docs/index.html, die Uebersichtsseite fuer GitHub Pages.

Die Seite entsteht aus scripts/index_template.html. Die Syntaxdiagramme
werden hier als Inline-SVG erzeugt; Grammatik (Anhang A), Beispiel (B.1),
Entwurfsnummer und Datum stammen unveraendert aus docs/xtjson-spec-en.md.

Aufruf:
  python3 scripts/build_index.py           schreibt docs/index.html
  python3 scripts/build_index.py --check   prueft, ob docs/index.html aktuell ist

Die Diagramme in DIAGRAMS sind von Hand aus Anhang A abgeleitet. Nach einer
Aenderung der Grammatik muessen sie hier angepasst werden.
"""
import html
import re
import sys
from pathlib import Path

R = 10          # Radius der Boegen
VS = 8          # senkrechter Abstand zwischen Zeilen
GAP = 10        # Linie zwischen den Gliedern einer Folge
BOX_H = 12      # halbe Hoehe eines Kastens


def esc(s):
    return html.escape(s, quote=True)


class El:
    w = 0
    up = 0
    down = 0

    def draw(self, x, y):
        return []


def hline(x1, x2, y):
    if abs(x2 - x1) < 0.01:
        return []
    return ['<path d="M%g %gH%g"/>' % (x1, y, x2)]


class Skip(El):
    pass


class Box(El):
    """kind: t = Literal, n = Regel (Link), c = Zeichenklasse / Beschreibung"""

    def __init__(self, text, kind, href=None):
        self.text, self.kind, self.href = text, kind, href
        per = 7.9 if kind == 't' else 7.2
        self.w = round(len(text) * per + 20)
        if kind == 't':
            self.w = max(self.w, 28)
        self.up = self.down = BOX_H

    def draw(self, x, y):
        rx = {'t': BOX_H, 'n': 0, 'c': 4}[self.kind]
        out = ['<rect class="%s" x="%g" y="%g" width="%g" height="%g" rx="%g"/>'
               % (self.kind, x, y - BOX_H, self.w, 2 * BOX_H, rx),
               '<text class="%s" x="%g" y="%g">%s</text>'
               % (self.kind, x + self.w / 2, y, esc(self.text))]
        if self.href:
            out = ['<a href="%s">' % esc(self.href)] + out + ['</a>']
        return out


def T(text):
    return Box(text, 't')


def N(text, anchor=None):
    return Box(text, 'n', '#' + (anchor or text.replace(' ', '-')))


def C(text):
    return Box(text, 'c')


class Label(El):
    def __init__(self, text):
        self.text = text
        self.w = round(len(text) * 6.6 + 6)
        self.up = self.down = BOX_H

    def draw(self, x, y):
        return ['<text class="l" x="%g" y="%g">%s</text>' % (x + 4, y, esc(self.text))]


class Seq(El):
    def __init__(self, *items):
        self.items = items
        self.w = sum(i.w for i in items) + GAP * (len(items) - 1)
        self.up = max(i.up for i in items)
        self.down = max(i.down for i in items)

    def draw(self, x, y):
        out = []
        for n, i in enumerate(self.items):
            if n:
                if not isinstance(i, Label):
                    out += hline(x, x + GAP, y)
                x += GAP
            out += i.draw(x, y)
            x += i.w
        return out


class Choice(El):
    def __init__(self, *items):
        self.items = items
        self.inner = max(i.w for i in items)
        self.w = self.inner + 4 * R
        self.up = items[0].up
        self.dy = [0]
        for a, b in zip(items, items[1:]):
            self.dy.append(self.dy[-1] + max(2 * R, a.down + VS + b.up))
        self.down = self.dy[-1] + items[-1].down

    def draw(self, x, y):
        out = []
        ix = x + 2 * R
        end = ix + self.inner
        for i, dy in zip(self.items, self.dy):
            if dy == 0:
                out += hline(x, ix, y) + hline(end, end + 2 * R, y)
            else:
                out.append('<path d="M%g %ga%d %d 0 0 1 %d %dv%ga%d %d 0 0 0 %d %d"/>'
                           % (x, y, R, R, R, R, dy - 2 * R, R, R, R, R))
                out.append('<path d="M%g %ga%d %d 0 0 0 %d %dv%ga%d %d 0 0 1 %d %d"/>'
                           % (end, y + dy, R, R, R, -R, -(dy - 2 * R), R, R, R, -R))
            out += i.draw(ix, y + dy)
            out += hline(ix + i.w, end, y + dy)
        return out


def Opt(item):
    return Choice(Skip(), item)


class Loop(El):
    """Ein- oder mehrmals: item auf der Linie, Rueckweg darunter (ueber rep)."""

    def __init__(self, item, rep=None):
        self.item, self.rep = item, rep or Skip()
        self.inner = max(item.w, self.rep.w)
        self.w = self.inner + 2 * R
        self.up = item.up
        self.dy = max(2 * R, item.down + VS + self.rep.up)
        self.down = self.dy + self.rep.down

    def draw(self, x, y):
        ix = x + R
        end = ix + self.inner
        dy = self.dy
        out = hline(x, ix, y) + self.item.draw(ix, y)
        out += hline(ix + self.item.w, end + R, y)
        out.append('<path d="M%g %ga%d %d 0 0 1 %d %dv%ga%d %d 0 0 1 %d %d"/>'
                   % (end, y, R, R, R, R, dy - 2 * R, R, R, -R, R))
        out.append('<path d="M%g %ga%d %d 0 0 1 %d %dv%ga%d %d 0 0 1 %d %d"/>'
                   % (ix, y + dy, R, R, -R, -R, -(dy - 2 * R), R, R, R, -R))
        rx = ix + (self.inner - self.rep.w) / 2
        out += hline(ix, rx, y + dy) + self.rep.draw(rx, y + dy)
        out += hline(rx + self.rep.w, end, y + dy)
        return out


def Many(item, rep=None):
    """Null- oder mehrmals."""
    return Opt(Loop(item, rep))


def svg(name, el):
    pad = 8
    lead = 22
    w = el.w + 2 * lead + 2 * pad
    h = el.up + el.down + 2 * pad
    x = pad + lead
    y = pad + el.up
    body = ['<path class="cap" d="M%g %gv16m4 -16v16"/>' % (pad, y - 8)]
    body += hline(pad + 4, x, y)
    body += el.draw(x, y)
    body += hline(x + el.w, w - pad - 4, y)
    body.append('<path class="cap" d="M%g %gv16m4 -16v16"/>' % (w - pad - 4, y - 8))
    return ('<svg class="rr" viewBox="0 0 %g %g" width="%g" height="%g" role="img" '
            'aria-label="Railroad diagram: %s">\n%s\n</svg>'
            % (w, h, w, h, esc(name), '\n'.join(body)))


# ---------------------------------------------------------------- Diagramme

def underscore():
    return Choice(Skip(), T('_'))


CHARS_DQ = 'any character except " \\ and control characters'
CHARS_SQ = "any character except ' \\ and control characters"

DIAGRAMS = {
    'document': Seq(Opt(Seq(N('directive'), Opt(Seq(N('separator'), N('directive'))), N('separator'))),
                    Choice(N('value'), N('members'))),
    'directive': Choice(
        Seq(T('%strict'), T(':'), Choice(T('true'), T('false'))),
        Seq(T('%extends'), T(':'), N('string'), Label('a resolver provides the base value'))),
    'object': Seq(T('{'), Opt(N('members')), T('}')),
    'members': Seq(Loop(Seq(N('name'), T(':'), N('value')), N('separator')), Opt(T(','))),
    'array': Seq(T('['), Opt(Seq(Loop(N('value'), N('separator')), Opt(T(',')))), T(']')),
    'separator': Choice(T(','), C('white space containing a line break')),
    'value': Choice(N('object'), N('array'), N('string'), N('number'),
                    T('true'), T('false'), T('null'), Seq(T('nil'), Label('the same as null'))),
    'name': Choice(N('string'), Seq(Choice(C('a–z A–Z'), T('_'), T('$'), C('µ À–Ö Ø–ö ø–ÿ')),
                                    Many(Choice(C('a–z A–Z'), C('0–9'), T('_'), T('$'),
                                                C('µ À–Ö Ø–ö ø–ÿ'))))),
    'string': Choice(
        Seq(T('"'), Many(Choice(C(CHARS_DQ), C('tab'), N('line break'), N('escape'))), T('"')),
        Seq(T("'"), Many(Choice(C(CHARS_SQ), C('tab'), N('line break'), N('escape'))), T("'"))),
    'escape': Seq(T('\\'), Choice(
        Seq(T('"'), Label('quotation mark')),
        Seq(T("'"), Label('apostrophe')),
        Seq(T('\\'), Label('backslash')),
        Seq(T('/'), Label('slash')),
        Seq(T('b'), Label('backspace')),
        Seq(T('f'), Label('form feed')),
        Seq(T('n'), Label('line feed')),
        Seq(T('r'), Label('carriage return')),
        Seq(T('t'), Label('tab')),
        Seq(T('v'), Label('vertical tab')),
        Seq(T('0'), Label('null; no digit may follow')),
        Seq(T('x'), C('2 hex digits')),
        Seq(T('u'), C('4 hex digits')),
        Seq(T('u'), T('{'), C('1 or more hex digits, at most 10FFFF'), T('}')),
        Seq(N('line break'), Label('line continuation; yields nothing')))),
    'number': Seq(Opt(T('-')),
                  Choice(N('decimal'), N('integer')),
                  Choice(Skip(), N('suffix'),
                         Seq(T('n'), Label('only without fraction part and exponent')))),
    'decimal': Seq(
        Choice(T('0'), Seq(C('1–9'), Opt(Seq(underscore(), N('digits'))))),
        Opt(Seq(T('.'), N('digits'))),
        Opt(Seq(Choice(T('e'), T('E')), Choice(Skip(), T('+'), T('-')), N('digits')))),
    'digits': Loop(C('0–9'), underscore()),
    'integer': Seq(T('0'), Choice(
        Seq(Choice(T('x'), T('X')), Loop(C('0–9 a–f A–F'), underscore())),
        Seq(Choice(T('o'), T('O')), Loop(C('0–7'), underscore())),
        Seq(Choice(T('b'), T('B')), Loop(C('0 1'), underscore())))),
    'suffix': Choice(T('k'), T('kb'), T('m'), T('mb'), T('ms'), T('min'),
                     T('s'), T('h'), T('pct')),
    'white space': Many(Choice(C('white space character'), N('line break'), N('comment'))),
    'comment': Choice(
        Seq(Choice(T('//'), T('#')), Many(C('any character except LF and CR'))),
        Seq(T('/*'), C('any text that does not contain */'), T('*/'))),
    'line break': Choice(C('LF (U+000A)'), C('CR (U+000D)'), C('CR LF (U+000D U+000A)')),
}


def fenced_after(text, heading, tag):
    start = text.index(heading)
    m = re.compile(r'```%s\n(.*?)\n```' % tag, re.S).search(text, start)
    return m.group(1)


def build(root):
    spec = (root / 'docs' / 'xtjson-spec-en.md').read_text(encoding='utf-8')
    page = (root / 'scripts' / 'index_template.html').read_text(encoding='utf-8')

    head = re.search(r'\*\*Specification, draft ([0-9.]+)\*\* · Date: (.+)', spec)
    values = {
        'DRAFT': head.group(1),
        'DATE': head.group(2).strip(),
        'ABNF': esc(fenced_after(spec, '## Appendix A', 'abnf')),
        'EXAMPLE_XTJSON': esc(fenced_after(spec, '### B.1', 'xtjson')),
        'EXAMPLE_JSON': esc(fenced_after(spec, '### B.1', 'json')),
    }
    used = set()

    def sub(m):
        key = m.group(1)
        if key.startswith('rr:'):
            name = key[3:]
            used.add(name)
            return svg(name, DIAGRAMS[name])
        return values[key]

    page = re.sub(r'\{\{([^}]+)\}\}', sub, page)
    errors = ['Diagramm nicht verwendet: %s' % n for n in sorted(set(DIAGRAMS) - used)]
    for href in sorted(set(re.findall(r'href="#([^"]+)"', page))):
        if 'id="%s"' % href not in page:
            errors.append('Anker ohne Ziel: #%s' % href)
    return page, len(used), errors


def main():
    root = Path(__file__).resolve().parent.parent
    target = root / 'docs' / 'index.html'
    page, count, errors = build(root)
    for e in errors:
        print('FEHLER:', e)
    if errors:
        sys.exit(1)
    if '--check' in sys.argv[1:]:
        current = target.read_bytes().decode('utf-8') if target.exists() else ''
        if current != page:
            print('FEHLER: docs/index.html ist nicht aktuell; scripts/build_index.py ausfuehren')
            sys.exit(1)
        print('ERGEBNIS: OK (%d Diagramme, docs/index.html ist aktuell)' % count)
        return
    target.write_text(page, encoding='utf-8', newline='\n')
    print('ERGEBNIS: OK (%d Diagramme, %d Zeichen geschrieben)' % (count, len(page)))


if __name__ == '__main__':
    main()
