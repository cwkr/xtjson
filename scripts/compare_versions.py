"""Vergleicht die deutsche und die englische Fassung der XTJSON-Spezifikation.

Aufruf: python3 compare_versions.py xtjson-spec-de.md xtjson-spec-en.md

Geprueft wird, ob beide Fassungen dieselbe Syntax und dasselbe Verhalten beschreiben:
  1. gleiche Gliederung (Anzahl und Nummern der Ueberschriften)
  2. identische ABNF-Bloecke (ohne Kommentare)
  3. Beispiele: jede Fassung parst; die Werte haben dieselbe Gestalt und dieselben Zahlen
  4. Tabellen: gleiche Zeilen- und Spaltenzahl
  5. gleiche Anzahl normativer Schluesselwoerter je Abschnitt
  6. gleiche Listenpunkte je Abschnitt
  7. Code-Angaben (`...`) je Abschnitt: Unterschiede werden zur Durchsicht ausgegeben
"""
import os
import re
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xtjson_ref import parse  # noqa: E402

FENCE = re.compile(r'```(\w+)\n(.*?)```', re.S)


def sections(md):
    """[(Ueberschrift, Text ohne Codebloecke, Codebloecke)] in Dokumentreihenfolge."""
    out, cur, buf = [], '(Kopf)', []
    for line in md.split('\n'):
        if re.match(r'#{1,3} ', line) and not buf_in_fence(buf):
            out.append((cur, '\n'.join(buf)))
            cur, buf = line, []
        else:
            buf.append(line)
    out.append((cur, '\n'.join(buf)))
    return out


def buf_in_fence(buf):
    return sum(1 for l in buf if l.startswith('```')) % 2 == 1


def number_of(heading):
    m = re.match(r'#+ ((?:\d+(?:\.\d+)*\.?)|(?:\w+ [A-D])|(?:[A-D]\.\d+))', heading)
    return m.group(1) if m else re.sub(r'[^#]', '', heading)


def abnf(md):
    res = []
    for lang, body in FENCE.findall(md):
        if lang == 'abnf':
            lines = [re.sub(r'\s*;.*$', '', l) for l in body.split('\n')]
            res.append(re.sub(r'\s+', ' ', ' '.join(lines)).strip())
    return res


def shape(v):
    if isinstance(v, dict):
        return ('obj', [shape(x) for x in v.values()])
    if isinstance(v, list):
        return ('arr', [shape(x) for x in v])
    if isinstance(v, str):
        return 'str'
    return ('lit', v)


KW_DE = [('MUST NOT', r'DARF NICHT|DÜRFEN NICHT|DARF KEINE|DÜRFEN KEINE|DARF ihn NICHT'),
         ('SHOULD NOT', r'SOLLTEN? NICHT'),
         ('MUST', r'MUSS|MÜSSEN'),
         ('SHOULD', r'SOLLTEN?'),
         ('RECOMMENDED', r'EMPFOHLENE?'),
         ('MAY', r'DARF|DÜRFEN')]
KW_EN = [('MUST NOT', r'MUST NOT'), ('SHOULD NOT', r'SHOULD NOT'), ('MUST', r'MUST'),
         ('SHOULD', r'SHOULD'), ('RECOMMENDED', r'RECOMMENDED'), ('MAY', r'MAY')]


def keywords(text, table):
    text = FENCE.sub('', text)
    c = Counter()
    for name, pat in table:                    # laengere Formen zuerst, dann entfernen
        found = re.findall(r'(?<![A-Za-zÄÖÜ])(?:%s)(?![A-Za-zÄÖÜ])' % pat, text)
        c[name] += len(found)
        text = re.sub(r'(?<![A-Za-zÄÖÜ])(?:%s)(?![A-Za-zÄÖÜ])' % pat, ' ', text)
    return +c


def tables(text):
    res, cur = [], None
    for line in FENCE.sub('', text).split('\n'):
        if line.startswith('|'):
            if cur is None:
                cur = []
            cur.append(line.count('|') - 1 - line.count('\\|'))
        elif cur is not None:
            res.append((len(cur), cur[0]))
            cur = None
    if cur is not None:
        res.append((len(cur), cur[0]))
    return res


def bullets(text):
    t = FENCE.sub('', text)
    return (len(re.findall(r'(?m)^- ', t)), len(re.findall(r'(?m)^\s*\d+\. ', t)))


def codespans(text):
    return Counter(re.findall(r'`([^`\n]+)`', FENCE.sub('', text)))


def main(de_path, en_path):
    de, en = (open(p, encoding='utf-8').read() for p in (de_path, en_path))
    problems = 0

    sd, se = sections(de), sections(en)
    nd, ne = [number_of(h) for h, _ in sd], [number_of(h) for h, _ in se]
    norm = lambda xs: [re.sub(r'^(Anhang|Appendix) ', 'A ', x) for x in xs]
    if norm(nd) != norm(ne):
        problems += 1
        print('GLIEDERUNG weicht ab:\n  de:', nd, '\n  en:', ne)
    print('1. Gliederung: %d Abschnitte je Fassung' % len(sd))

    ad, ae = abnf(de), abnf(en)
    if ad != ae:
        problems += 1
        for i, (x, y) in enumerate(zip(ad, ae)):
            if x != y:
                print('ABNF-Block %d weicht ab:\n  de: %s\n  en: %s' % (i + 1, x, y))
        if len(ad) != len(ae):
            print('ABNF: unterschiedliche Anzahl Bloecke', len(ad), len(ae))
    print('2. ABNF: %d Bloecke, %s' % (len(ad), 'identisch' if ad == ae else 'UNTERSCHIEDE'))

    def examples(md):
        return [(lang, body) for lang, body in FENCE.findall(md) if lang in ('xtjson', 'json')]
    xd, xe = examples(de), examples(en)
    if [l for l, _ in xd] != [l for l, _ in xe]:
        problems += 1
        print('BEISPIELE: unterschiedliche Folge von Bloecken')
    n = 0
    for (l1, b1), (l2, b2) in zip(xd, xe):
        v1, v2 = parse(b1), parse(b2)
        n += 1
        if shape(v1) != shape(v2):
            problems += 1
            print('BEISPIEL %d (%s): Werte haben unterschiedliche Gestalt\n  de: %r\n  en: %r' % (n, l1, v1, v2))
    print('3. Beispiele: %d Bloecke je Fassung verglichen' % n)

    for (h1, t1), (h2, t2) in zip(sd, se):
        label = '%s  |  %s' % (h1.strip('# '), h2.strip('# '))
        if tables(t1) != tables(t2):
            problems += 1
            print('TABELLEN weichen ab in [%s]: de %s, en %s' % (label, tables(t1), tables(t2)))
        k1, k2 = keywords(t1, KW_DE), keywords(t2, KW_EN)
        if k1 != k2:
            problems += 1
            print('SCHLUESSELWOERTER weichen ab in [%s]:\n  de %s\n  en %s' % (label, dict(k1), dict(k2)))
        if bullets(t1) != bullets(t2):
            problems += 1
            print('LISTENPUNKTE weichen ab in [%s]: de %s, en %s' % (label, bullets(t1), bullets(t2)))
    kd = sum((keywords(t, KW_DE) for _, t in sd), Counter())
    ke = sum((keywords(t, KW_EN) for _, t in se), Counter())
    print('4.-6. Tabellen, Schluesselwoerter, Listenpunkte je Abschnitt verglichen')
    print('   Schluesselwoerter gesamt: de %s' % dict(sorted(kd.items())))
    print('                             en %s' % dict(sorted(ke.items())))

    print('7. Code-Angaben, die nur in einer Fassung vorkommen (zur Durchsicht):')
    for (h1, t1), (h2, t2) in zip(sd, se):
        c1, c2 = codespans(t1), codespans(t2)
        only1, only2 = c1 - c2, c2 - c1
        if only1 or only2:
            print('   [%s]\n      nur de: %s\n      nur en: %s'
                  % (h1.strip('# '), sorted(only1.elements()), sorted(only2.elements())))

    print('ERGEBNIS: %s' % ('keine Abweichung in 1-6' if not problems else '%d Abweichungen' % problems))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1], sys.argv[2]))
