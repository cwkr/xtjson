# XTJSON

**Spezifikation, Entwurf 0.7** · Stand: 18. November 2026

## Inhalt

1. [Einleitung](#1-einleitung)
2. [Konventionen und Begriffe](#2-konventionen-und-begriffe)
3. [Kompatibilität](#3-kompatibilität)
4. [Kodierung](#4-kodierung)
5. [Leerraum, Zeilenumbrüche und Kommentare](#5-leerraum-zeilenumbrüche-und-kommentare)
6. [Dokument, Direktiven, Wurzelobjekt und Werte](#6-dokument-direktiven-wurzelobjekt-und-werte)
7. [Objekte, Arrays und Trenner](#7-objekte-arrays-und-trenner)
8. [Strings](#8-strings)
9. [Zahlen](#9-zahlen)
10. [Abbildung auf JSON](#10-abbildung-auf-json)
11. [Konformität](#11-konformität)
12. [Strict-Modus](#12-strict-modus)
13. [Sicherheitsaspekte](#13-sicherheitsaspekte)
- [Anhang A – Vollständige Grammatik (ABNF)](#anhang-a--vollständige-grammatik-abnf)
- [Anhang B – Beispiele](#anhang-b--beispiele)
- [Anhang C – Bewusst nicht enthalten](#anhang-c--bewusst-nicht-enthalten)
- [Anhang D – Entwurfsentscheidungen](#anhang-d--entwurfsentscheidungen)
- [Referenzen](#referenzen)
- [Änderungen](#änderungen)

---

## 1. Einleitung

XTJSON ist eine syntaktische Obermenge (Superset) von JSON für Dateien, die von Menschen geschrieben und gepflegt werden, etwa Konfigurationsdateien. XTJSON erweitert ausschließlich die **Schreibweise**. Das Datenmodell bleibt das von JSON: Objekt, Array, String, Zahl, `true`, `false`, `null`.

Die Erweiterungen gegenüber JSON sind:

| Nr. | Erweiterung | Abschnitt |
|---|---|---|
| E1 | Kommentare: `// …`, `/* … */` und `# …` | [5.3](#53-kommentare) |
| E2 | Abschließendes Komma (Trailing Comma) in Objekten und Arrays | [7.4](#74-abschließendes-komma) |
| E3 | Optionale geschweifte Klammern beim Objekt auf oberster Ebene | [6.2](#62-implizites-wurzelobjekt) |
| E4 | Namen (Keys) ohne Anführungszeichen | [7.2](#72-namen) |
| E5 | Zeilenumbruch als Trenner anstelle eines Kommas | [7.3](#73-trenner) |
| E6 | Strings in einfachen Anführungszeichen (`'…'`) | [8.1](#81-begrenzer-und-zeichen) |
| E7 | Ganzzahlen in hexadezimaler, oktaler und binärer Schreibweise | [9.2](#92-hexadezimal-oktal-binär) |
| E8 | `_` zur Gruppierung von Ziffern | [9.3](#93-zifferngruppierung) |
| E9 | Zusätzliche Escape-Sequenzen: `\v`, `\0`, `\xHH`, `\u{…}` | [8.2](#82-escape-sequenzen) |
| E10 | Zusätzliche Leerraumzeichen: alle Leerraumzeichen von ECMAScript | [5.1](#51-leerraum) |
| E11 | Strings über mehrere Zeilen, mit Entfernen der Einrückung, und Zeilenfortsetzung mit `\` | [8.3](#83-zeilenumbrüche-in-strings) |
| E12 | `nil` als andere Schreibweise für `null` | [6.3](#63-werte) |
| E13 | Zahlen-Suffixe (`10k`, `64mb`, `50pct`) | [9.5](#95-zahlen-suffixe) |
| E14 | Direktiven am Dokumentanfang: `%strict` und `%extends` | [6.4](#64-direktiven) |

Nicht-Ziele: XTJSON führt keine neuen Datentypen, keine Ausdrücke und keine Verweise ein (siehe [Anhang C](#anhang-c--bewusst-nicht-enthalten)). XTJSON ist kein Austauschformat zwischen Maschinen; dafür bleibt JSON bzw. I-JSON das Mittel der Wahl.

## 2. Konventionen und Begriffe

Die Schlüsselwörter **MUSS**, **DARF NICHT**, **SOLLTE**, **SOLLTE NICHT**, **EMPFOHLEN** und **DARF** entsprechen MUST, MUST NOT, SHOULD, SHOULD NOT, RECOMMENDED und MAY nach BCP 14 [RFC2119] [RFC8174], sofern sie in Großbuchstaben geschrieben sind.

Die Grammatik ist in ABNF [RFC5234] notiert. Die Regeln in den Abschnitten 5–9 sind Auszüge; maßgeblich ist [Anhang A](#anhang-a--vollständige-grammatik-abnf). Zu beachten: ABNF-Zeichenketten in Anführungszeichen sind unabhängig von Groß-/Kleinschreibung; wo die Schreibweise festgelegt ist, werden Zeichen als Hexadezimalwerte angegeben.

| Begriff | Bedeutung |
|---|---|
| JSON-Text | Text, der der Grammatik von [RFC8259] bzw. [ECMA-404] entspricht |
| XTJSON-Dokument | Text, der der Regel `XTJSON-text` in Anhang A entspricht |
| Element | ein Member eines Objekts oder ein Wert eines Arrays |
| Name | der Schlüssel (Key) eines Members |
| Bezeichner | ein Name ohne Anführungszeichen (7.2) sowie eine Zeichenfolge derselben Form an Wertposition |
| Leerraumzeichen | eines der Zeichen aus der Tabelle in 5.1 |
| Zeilenumbruch | U+000A, U+000D oder die Folge U+000D U+000A (5.2) |
| maskiert, unmaskiert | maskiert: als Escape-Sequenz nach 8.2 geschrieben; unmaskiert: als das Zeichen selbst geschrieben |
| Zeilenfortsetzung | ein `\` unmittelbar vor einem Zeilenumbruch in einem String; sie trägt nichts zum Wert bei (8.2) |
| Direktive | eine Angabe am Dokumentanfang, die mit `%` beginnt: `%strict` oder `%extends` (6.4) |
| Basiswert | der JSON-Wert, den ein Dokument mit `%extends` erweitert (6.6) |
| Resolver | eine Funktion der Anwendung, die zum String von `%extends` den Basiswert liefert (6.6) |
| vordefiniert | durch diese Spezifikation festgelegt und nicht änderbar |
| Strict-Modus | der Modus, in dem ein Parser zusätzlich die Verbote aus Abschnitt 12 durchsetzt |
| JSON-Äquivalent | der JSON-Text, auf den ein XTJSON-Dokument nach [Abschnitt 10](#10-abbildung-auf-json) abgebildet wird |

## 3. Kompatibilität

Dieser Abschnitt ist normativ. Er legt fest, was „voll kompatibel“ zu [RFC8259] (STD 90), [ECMA-404] und [I-JSON] bedeutet.

**K1 – Syntaktische Obermenge.** Jeder in UTF-8 kodierte JSON-Text nach [RFC8259] und [ECMA-404] ist ein gültiges XTJSON-Dokument. Dasselbe gilt für jede I-JSON-Nachricht nach [I-JSON].

**K2 – Bedeutungserhalt.** Ein JSON-Text bezeichnet als XTJSON-Dokument denselben Wert wie als JSON-Text. Keine Erweiterung ändert die Bedeutung eines Textes, der bereits gültiges JSON ist.

**K3 – Unverändertes Datenmodell.** Jedes XTJSON-Dokument besitzt ein JSON-Äquivalent ([Abschnitt 10](#10-abbildung-auf-json)), das seinen Wert festlegt. `nil` und Zahlen-Suffixe sind nur andere Schreibweisen für JSON-Werte. Die Direktive `%strict` trägt nichts zum Wert bei. Der Wert eines Dokuments mit `%extends` ist das Ergebnis seiner Zusammenführung mit seinem Basiswert, der selbst ein JSON-Wert ist (6.6). Ein Wert, der sich in JSON nicht darstellen lässt, lässt sich auch in XTJSON nicht darstellen.

**K4 – Übernommene Semantik.** Alles, was diese Spezifikation nicht ausdrücklich erweitert, gilt wie in [RFC8259]: die Bedeutung von `true`, `false` und `null`, die Escape-Sequenzen von JSON, der Umgang mit Zahlenbereich und -genauigkeit, die Bedeutungslosigkeit der Member-Reihenfolge und der String-Vergleich.

**K5 – Abgrenzung.** Ein XTJSON-Dokument, das mindestens eine der Erweiterungen E1–E14 nutzt, ist **kein** JSON-Text. Daraus folgt:

- Solche Dokumente DÜRFEN NICHT mit dem Medientyp `application/json` gekennzeichnet oder an Empfänger gesendet werden, die JSON erwarten.
- Ein XTJSON-Parser ist kein konformer Prozessor im Sinne von [ECMA-404], weil dieser nicht konforme Eingaben nicht akzeptieren soll. Er ist jedoch ein zulässiger Parser im Sinne von [RFC8259] Abschnitt 9, der Parsern Erweiterungen ausdrücklich gestattet.
- Wer JSON erzeugt, MUSS strikt die JSON-Grammatik einhalten ([RFC8259] Abschnitt 10). Die Brücke bildet die Abbildung in Abschnitt 10.

Informativ – warum K1 und K2 gelten: Jede Erweiterung belegt ausschließlich Schreibweisen, die in JSON ein Syntaxfehler sind. `/`, `#`, `%`, `'` sowie die zusätzlichen Leerraumzeichen (5.1) kommen in JSON außerhalb von Strings nicht vor; die zusätzlichen Escape-Sequenzen sind in JSON ungültige `\`-Folgen; ein unmaskierter Zeilenumbruch oder Tabulator in einem String ist in JSON ungültig; ein Name ohne Anführungszeichen, ein Komma vor einer schließenden Klammer, ein `:` nach dem Wurzelwert, zwei Elemente ohne Komma sowie `0x`, `0o`, `0b` und `_` in Zahlen sind in JSON ungültig; ebenso ein Bezeichner an Wertposition außer `true`, `false` und `null` (also auch `nil`) und ein Suffix direkt nach einer Zahl. Die Werte `true`, `false` und `null` von JSON sind fest vordefiniert und nicht änderbar, und kein Suffix beginnt mit `e` oder `E`, sodass der Exponent einer JSON-Zahl nie als Suffix gelesen wird. Ein String ohne Zeilenumbruch behält seinen JSON-Wert, weil die Regeln aus 8.3 nur Strings verändern, die über mehrere Zeilen reichen. Die Zeilenumbruch-Regel (E5) greift nur dort, wo JSON zwingend ein Komma verlangt; überall sonst bleibt ein Zeilenumbruch bedeutungsloser Leerraum.

## 4. Kodierung

- Ein XTJSON-Dokument MUSS in UTF-8 [RFC3629] kodiert sein. Ein Text, der kein wohlgeformtes UTF-8 ist, ist kein XTJSON-Dokument.
- U+FEFF ist Leerraum (5.1). Ein Byte Order Mark am Dokumentanfang ist deshalb zulässig und ohne Bedeutung. Erzeuger SOLLTEN dennoch keines voranstellen: Ein Dokument mit BOM ist kein JSON-Text, auch wenn es sonst keine Erweiterung nutzt.
- EMPFOHLENE Dateiendungen: `.xtjson` und `.xtj`. Ein Medientyp ist nicht registriert.

## 5. Leerraum, Zeilenumbrüche und Kommentare

### 5.1 Leerraum

Leerraumzeichen sind genau die Zeichen der folgenden Tabelle. Das sind die vier Leerraumzeichen von JSON und zusätzlich alle weiteren Zeichen, die ECMAScript 2026 [ECMA-262] als Leerraum (*WhiteSpace*) oder als Zeilenende (*LineTerminator*) führt. Die Spalte „Herkunft“ nennt JSON, wenn das Zeichen schon dort Leerraum ist, und sonst die ECMAScript-Ausgabe, seit der es dort Leerraum oder Zeilenende ist.

| Zeichen | Name | Herkunft | Zeilenumbruch nach 5.2 |
|---|---|---|---|
| U+0009 | Tabulator | JSON | nein |
| U+000A | Zeilenvorschub (LF) | JSON | **ja** |
| U+000B | Vertikaltabulator | ES1 (1997) | nein |
| U+000C | Seitenvorschub | ES1 (1997) | nein |
| U+000D | Wagenrücklauf (CR) | JSON | **ja** |
| U+0020 | Leerzeichen | JSON | nein |
| U+00A0 | geschütztes Leerzeichen | ES3 (1999) | nein |
| U+1680 | Ogham-Leerzeichen | ES3 (1999) | nein |
| U+2000–U+200A | typografische Leerzeichen fester Breite (En Quad bis Hair Space) | ES3 (1999) | nein |
| U+2028 | Zeilentrenner (Line Separator) | ES3 (1999) | nein |
| U+2029 | Absatztrenner (Paragraph Separator) | ES3 (1999) | nein |
| U+202F | schmales geschütztes Leerzeichen | ES3 (1999) | nein |
| U+205F | mittleres mathematisches Leerzeichen | ES3 (1999) | nein |
| U+3000 | ideografisches Leerzeichen | ES3 (1999) | nein |
| U+FEFF | breitenloses geschütztes Leerzeichen (BOM) | ES5 (2009) | nein |

- U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F und U+3000 sind die Zeichen der Unicode-Kategorie Zs (Space_Separator), die ECMAScript seit ES3 als Ganzes zum Leerraum zählt. Die Liste in dieser Spezifikation ist abschließend; sie ändert sich nicht, wenn künftige Unicode-Versionen die Kategorie Zs ändern.
- Zeilenumbrüche sind nur U+000A und U+000D, einzeln oder als Folge CR LF (5.2). Alle anderen Zeichen der Tabelle sind einfacher Leerraum: Sie trennen keine Elemente (7.3) und beenden keinen Zeilenkommentar. Das gilt abweichend von ECMAScript auch für U+2028 und U+2029, die dort Zeilenenden sind.
- Innerhalb von Strings dürfen der Tabulator und die Zeilenumbrüche (U+0009, U+000A, U+000D) anders als in JSON unmaskiert stehen (8.1). Der Vertikaltabulator U+000B und der Seitenvorschub U+000C MÜSSEN wie in JSON maskiert werden; alle übrigen Zeichen der Tabelle dürfen unmaskiert stehen.
- Zeichen, die nicht in der Tabelle stehen, sind kein Leerraum, auch wenn sie unsichtbar sind oder die Unicode-Eigenschaft White_Space tragen (etwa U+0085, U+180E, U+200B). Außerhalb von Strings und Kommentaren sind sie ein Fehler.

Leerraum und Kommentare sind zwischen beliebigen Tokens erlaubt. Innerhalb einer Zahl einschließlich ihres Suffixes und innerhalb eines Bezeichners sind sie ein Fehler (`- 1`, `10 k`, `tr ue`); innerhalb eines Strings sind sie Inhalt.

### 5.2 Zeilenumbrüche

Ein Zeilenumbruch (`newline`) ist U+000A (LF), U+000D (CR) oder die Folge U+000D U+000A (CR LF). Die Folge zählt als ein einziger Zeilenumbruch. Alle übrigen Leerraumzeichen aus 5.1, auch U+2028 und U+2029, sind **keine** Zeilenumbrüche.

Zeilenumbrüche haben drei Funktionen: Sie beenden einen Zeilenkommentar (5.3), sie können als Trenner zwischen zwei Elementen dienen ([7.3](#73-trenner)), und sie gliedern einen String in Zeilen ([8.3](#83-zeilenumbrüche-in-strings)). Überall sonst sind sie gewöhnlicher Leerraum. Ein Zeilenumbruch innerhalb eines Blockkommentars ist Teil des Kommentars und hat keine dieser Funktionen.

### 5.3 Kommentare

```abnf
line-comment   = ( "//" / "#" ) *non-eol
block-comment  = "/*" *( non-star / ( 1*"*" non-star-slash ) ) 1*"*" "/"
eol            = [ line-comment ] newline
```

- Ein **Zeilenkommentar** beginnt mit `//` oder `#` und reicht bis vor den nächsten Zeilenumbruch oder bis zum Dokumentende. Der Zeilenumbruch selbst gehört nicht zum Kommentar und behält seine Trennerfunktion. U+2028 und U+2029 beenden einen Zeilenkommentar nicht.
- Ein **Blockkommentar** beginnt mit `/*` und endet am ersten `*/`, das auf dieses `/*` folgt; `/*/` ist deshalb kein vollständiger Kommentar. Blockkommentare sind nicht schachtelbar. Ein nicht abgeschlossener Blockkommentar ist ein Fehler.
- Kommentare zählen zum Leerraum (`S`) und tragen keine Information zum Wert des Dokuments bei.
- Innerhalb von Strings haben `//`, `/*` und `#` keine Sonderbedeutung.
- Ein Blockkommentar wirkt immer wie ein einzelnes Leerzeichen. Ein Zeilenumbruch in seinem Inneren zählt **nicht** als Trenner nach 7.3: `[1 /* a` ⏎ `b */ 2]` ist ein Fehler.

Da `#` einen Kommentar einleitet, ist eine Shebang-Zeile (`#!…`) am Dokumentanfang ohne Sonderregel gültig.

```xtjson
#!/usr/bin/env xtjson-tool
// Zeilenkommentar
# ebenfalls ein Zeilenkommentar
/* Blockkommentar,
   auch über mehrere Zeilen */
{ "url": "http://example.org/#anker" /* '#' und '//' im String sind kein Kommentar */ }
```

## 6. Dokument, Direktiven, Wurzelobjekt und Werte

### 6.1 Dokument

```abnf
XTJSON-text  = S [ directives item-sep ] ( value / member-list ) S [ line-comment ]
```

Ein Zeilenkommentar am Dokumentende braucht keinen abschließenden Zeilenumbruch.

Ein XTJSON-Dokument beginnt mit optionalen Direktiven (6.4). Auf sie folgt entweder ein einzelner Wert (wie in JSON) oder eine Folge von Membern (`member-list`, 7.1), das implizite Wurzelobjekt. Ein Dokument, das nur aus Leerraum, Kommentaren und Direktiven besteht, ist ein Fehler, so wie ein leerer Text kein JSON-Text ist.

### 6.2 Implizites Wurzelobjekt

Besteht das Dokument aus einer Folge von Membern ohne umschließende `{` `}`, so bezeichnet es das Objekt, das genau diese Member enthält. Es gelten dieselben Regeln wie innerhalb von Klammern: Trenner nach 7.3, abschließendes Komma nach 7.4.

```xtjson
name: "demo"
port: 8080
```

ist gleichbedeutend mit `{"name": "demo", "port": 8080}`.

Regeln:

- Das implizite Wurzelobjekt MUSS mindestens ein Member enthalten. Ein leeres Objekt wird als `{}` geschrieben.
- Die Kurzform gibt es nur auf oberster Ebene. Verschachtelte Objekte brauchen Klammern.
- Mischformen sind ungültig: Auf einen geklammerten Wurzelwert darf nichts mehr folgen (`{a: 1} b: 2` ist ein Fehler), und ein implizites Wurzelobjekt wird nicht mit `}` geschlossen.

**Erkennung.** Ein Parser entscheidet nach dem ersten Token, das auf die Direktiven folgt: Ist es ein String oder ein Bezeichner und ist das nächste Token ein `:`, liegt ein implizites Wurzelobjekt vor. Andernfalls wird ein einzelner Wert gelesen. Da in JSON auf den Wurzelwert nie ein `:` folgt, wird kein JSON-Text umgedeutet.

### 6.3 Werte

```abnf
value        = object / array / string / number /
               %x74.72.75.65 / %x66.61.6C.73.65 /   ; true false
               %x6E.75.6C.6C / %x6E.69.6C           ; null nil
```

Ein Wert ist ein Objekt oder ein Array (Abschnitt 7), ein String (Abschnitt 8), eine Zahl (Abschnitt 9) oder einer der vier Werte `true`, `false`, `null` und `nil`. `true`, `false` und `null` haben die Bedeutung, die sie in JSON haben. `nil` ist eine andere Schreibweise für `null` und bezeichnet denselben Wert.

- **Fest.** `true`, `false`, `null` und `nil` sind vordefiniert. Sie DÜRFEN NICHT umdefiniert, überschrieben oder entfernt werden, und weitere Werte ohne Anführungszeichen gibt es nicht: Weder das Dokument noch die Anwendung können Werte definieren.
- **Groß- und Kleinschreibung zählen.** Die vier Werte werden kleingeschrieben: `True`, `NULL` und `Nil` sind Fehler.
- **Keine anderen Werte ohne Anführungszeichen.** Jeder andere Bezeichner an Wertposition ist ein Fehler (`farbe: rot`, `undefined`, `NaN`). Ein Parser DARF ihn NICHT ersatzweise als String oder auf andere Weise deuten.
- **Namensposition.** An Namensposition sind `true`, `false`, `null` und `nil` Bezeichner wie alle anderen und ergeben gewöhnliche Namen (7.2): `{nil: nil}` hat den Namen `"nil"` und den Wert `null`.
- **Abbildung.** Im JSON-Äquivalent wird `nil` durch `null` ersetzt (Abschnitt 10).

```xtjson
{
  zweiter_vorname: nil
  kinder: null
  verheiratet: false
  nil: "ein gewöhnlicher Name an Namensposition"
}
```

JSON-Äquivalent:

```json
{
  "zweiter_vorname": null,
  "kinder": null,
  "verheiratet": false,
  "nil": "ein gewöhnlicher Name an Namensposition"
}
```

### 6.4 Direktiven

```abnf
directives   = strict-directive [ item-sep extends-directive ]
             / extends-directive [ item-sep strict-directive ]
```

Eine Direktive ist eine Angabe am Dokumentanfang. Es gibt genau zwei Direktiven: `%strict` (6.5) und `%extends` (6.6), zum Beispiel `%strict: true, %extends: './defaults.json'`.

Regeln:

- **Schreibweise.** Eine Direktive beginnt mit `%`, unmittelbar gefolgt von ihrem Namen in Kleinbuchstaben; zusammen bilden sie ein einziges Token, und Leerraum und Kommentare nach dem `%` sind ein Fehler (`% strict`). Es folgen ein `:` und der Wert. Vor und nach dem `:` sind Leerraum und Kommentare wie zwischen beliebigen Tokens erlaubt (5.1), auch Zeilenumbrüche.
- **Position.** Direktiven sind nur auf oberster Ebene erlaubt, vor dem Wurzelwert oder vor dem ersten Member des impliziten Wurzelobjekts. Eine Direktive innerhalb eines Objekts oder Arrays oder nach Beginn des Inhalts ist ein Fehler.
- **Trenner.** Zwei Direktiven sowie die letzte Direktive und der Inhalt des Dokuments MÜSSEN wie zwei Elemente nach 7.3 getrennt werden: durch ein Komma oder durch Leerraum, der einen Zeilenumbruch enthält. `%strict: true [1]` ist ein Fehler.
- **Reihenfolge und Anzahl.** `%strict` und `%extends` können in beliebiger Reihenfolge stehen. Jede von ihnen MUSS höchstens einmal vorkommen; ein zweites `%strict` oder `%extends` ist ein Fehler, auch wenn es denselben Wert angibt.
- **Keine anderen Direktiven.** Jeder andere Text, der mit `%` beginnt, ist ein Fehler (`%include: "a.xtj"`, `%Strict: true`). Ein Parser DARF KEINE weiteren Direktiven kennen oder von der Anwendung annehmen.

### 6.5 Die Direktive `%strict`

```abnf
strict-directive = %x25.73.74.72.69.63.74 S ":" S
                   ( %x74.72.75.65 / %x66.61.6C.73.65 )   ; %strict: true / false
```

`%strict` gibt an, ob das Dokument im Strict-Modus zu lesen ist (Abschnitt 12).

```xtjson
%strict: true

name: 'demo'
port: 8080
```

JSON-Äquivalent:

```json
{ "name": "demo", "port": 8080 }
```

Regeln:

- **Wert.** Der Wert MUSS `true` oder `false` sein. Jeder andere Wert ist ein Fehler (`%strict: 1`, `%strict: 'true'`, `%strict: nil`).
- **`%strict: true`.** Ein Parser MUSS den Inhalt des Dokuments im Strict-Modus lesen, auch wenn die Anwendung ihn nicht verlangt hat.
- **`%strict: false`.** Das Dokument verlangt den Strict-Modus nicht. Hat die Anwendung den Strict-Modus verlangt, widerspricht ihr das Dokument, und ein Parser MUSS es als Fehler ablehnen.
- **Ohne `%strict`.** Ein Parser liest das Dokument im Strict-Modus, wenn die Anwendung ihn verlangt.
- **Keine Wirkung auf den Wert.** Das JSON-Äquivalent hängt nicht von `%strict` ab. Die Direktive entscheidet nur darüber, ob das Dokument angenommen wird.

### 6.6 Die Direktive `%extends`

```abnf
extends-directive = %x25.65.78.74.65.6E.64.73 S ":" S string   ; %extends
```

`%extends` nennt eine Basis für das Dokument: Das Dokument erweitert den Wert einer anderen Quelle, seinen **Basiswert**, nach den Regeln von JSON Merge Patch [RFC7396].

Basiswert, etwa aus einer Datei `defaults.json`:

```json
{
  "name": "demo",
  "server": { "host": "0.0.0.0", "port": 8080, "debug": true },
  "tags": ["a", "b"]
}
```

XTJSON-Dokument:

```xtjson
%extends: './defaults.json'

server: {
  port: 8443
  debug: nil
}
tags: ['c']
```

JSON-Äquivalent:

```json
{
  "name": "demo",
  "server": { "host": "0.0.0.0", "port": 8443 },
  "tags": ["c"]
}
```

Regeln:

- **Wert.** Der Wert MUSS ein String sein. Jeder andere Wert ist ein Fehler (`%extends: nil`, `%extends: ['a.json']`). Der String ist ein Verweis auf die Quelle des Basiswerts; er gehört nicht zum Wert des Dokuments.
- **Verweis.** Diese Spezifikation legt nicht fest, wie der Verweis aufgelöst wird. EMPFOHLEN wird eine URI-Referenz [RFC3986], zum Beispiel ein relativer Pfad wie `'./defaults.json'` oder eine URL wie `'https://example.org/defaults.xtj'`; eine relative Referenz bezieht sich dann auf den Ort des Dokuments.
- **Resolver.** Ein Parser erhält den Basiswert von einem Resolver der Anwendung: einer Funktion, die den Wert des Strings erhält und den Basiswert als JSON-Wert zurückgibt. Woher der Resolver die Quelle liest und in welchem Format die Quelle geschrieben ist, bleibt der Anwendung überlassen; die Quelle muss kein XTJSON-Dokument sein.
- **Unterstützung.** Ein Parser DARF `%extends` unterstützen. Unterstützt er es nicht oder hat ihm die Anwendung keinen Resolver gegeben, ist `%extends` abgeschaltet, und der Parser MUSS ein Dokument mit `%extends` als Fehler ablehnen. Er MUSS das Dokument auch ablehnen, wenn der Resolver einen Fehler meldet oder einen Wert zurückgibt, der kein JSON-Wert ist.
- **Zusammenführung.** Der Wert des Dokuments ist MergePatch(Basiswert, Wert des Inhalts). MergePatch(Ziel, Patch) ist wie in [RFC7396] festgelegt:
  1. Ist Patch kein Objekt, ist das Ergebnis Patch; Ziel wird nicht verwendet.
  2. Andernfalls ist das Ergebnis ein Objekt: eine Kopie von Ziel, wenn Ziel ein Objekt ist, sonst ein leeres Objekt. Für jedes Member von Patch gilt: Ist sein Wert `null`, wird ein Member mit demselben Namen aus dem Ergebnis entfernt; andernfalls erhält das Member mit diesem Namen im Ergebnis den Wert MergePatch(seinen bisherigen Wert oder nichts, Wert des Members von Patch).
- **Folgen.** Member des Basiswerts, die das Dokument nicht nennt, bleiben erhalten, und Objekte werden Member für Member in beliebiger Tiefe zusammengeführt. Arrays, Strings, Zahlen, `true` und `false` ersetzen einen Wert des Basiswerts als Ganzes; Arrays werden nicht zusammengeführt. Ein Member mit dem Wert `null` oder `nil` entfernt das Member mit demselben Namen; ein Member mit dem Wert `null` lässt sich in einem Dokument mit `%extends` daher nicht setzen. Doppelte Namen im Inhalt werden vor der Zusammenführung aufgelöst (7.2).
- **Strict-Modus.** Im Strict-Modus gelten die Verbote zu Namen, String-Werten und zum Wurzelwert auch für das Ergebnis (Abschnitt 12).
- **Verschachtelte Basen.** Der Basiswert kann selbst der Wert eines Dokuments mit `%extends` sein; ihn aufzulösen ist Aufgabe des Resolvers (Abschnitt 13).

## 7. Objekte, Arrays und Trenner

### 7.1 Aufbau

```abnf
object       = "{" S [ member-list S ] "}"
member-list  = member *( item-sep member ) [ S "," ]
member       = name S ":" S value

array        = "[" S [ value-list S ] "]"
value-list   = value *( item-sep value ) [ S "," ]
```

### 7.2 Namen

```abnf
name         = string / name-start *( name-start / DIGIT )
name-start   = ALPHA / "_" / "$" / %xB5 /                 ; Buchstaben aus
               %xC0-D6 / %xD8-F6 / %xF8-FF                ; Latin-1 Supplement
```

- Ein Name ist ein String (Abschnitt 8) oder ein Bezeichner, ein Name ohne Anführungszeichen. Wie jeder andere String darf ein Name in Anführungszeichen über mehrere Zeilen reichen; sein Wert ergibt sich nach 8.3.
- Ein Bezeichner beginnt mit einem ASCII-Buchstaben, `_`, `$` oder einem Buchstaben aus dem Block Latin-1 Supplement: U+00B5 (Mikrozeichen), U+00C0 bis U+00D6, U+00D8 bis U+00F6 und U+00F8 bis U+00FF. Danach sind zusätzlich ASCII-Ziffern erlaubt. Auch ECMAScript lässt diese Buchstaben in Bezeichnern zu [ECMA-262]; die Ordinalzeichen U+00AA und U+00BA und der Mittelpunkt U+00B7, die ECMAScript ebenfalls zulässt, sind nicht erlaubt.
- Als Name steht ein Bezeichner für exakt die geschriebene Zeichenfolge; Escape-Sequenzen gibt es in Bezeichnern nicht, und Namen werden nicht normalisiert: `é` als U+00E9 und als `e` gefolgt von U+0301 sind verschiedene Namen, und der zweite lässt sich nur in Anführungszeichen schreiben.
- Jeder andere Name MUSS in Anführungszeichen stehen: Namen mit Leerzeichen, Bindestrichen, Punkten oder anderen Zeichen (zum Beispiel `€`, `×`, `π` oder kombinierenden Zeichen), Namen, die mit einer Ziffer beginnen, und der leere Name.
- `true`, `false`, `null` und `nil` (6.3) sind als Bezeichner an Namensposition zulässig und ergeben dort gewöhnliche Namen (`"true"`, `"nil"`). An Namensposition steht nie ein Wert, daher ist das eindeutig.
- An Wertposition sind ohne Anführungszeichen nur `true`, `false`, `null` und `nil` erlaubt (6.3). Frei wählbare Werte ohne Anführungszeichen gibt es nicht: `farbe: rot` ist ein Fehler.
- Die Schreibweise ist für die Identität eines Namens unerheblich: `a`, `"a"`, `'a'` und `"\u0061"` bezeichnen denselben Namen.

```xtjson
{
  $schema: "https://example.org/schema.json",
  max_age: 3600,
  "max-age": 3600,
  durchmesser_µm: 180,
  außen: true,
  _intern: true,
  "mit leerzeichen": 1,
  "2fa": false
}
```

**Doppelte Namen.** Wie in [RFC8259] SOLLTEN die Namen innerhalb eines Objekts eindeutig sein. Kommt ein Name in einem Objekt mehrfach vor, gilt das im Dokument zuletzt stehende Member mit diesem Namen; die früheren werden verworfen. Das gilt auch für das implizite Wurzelobjekt. Ein Parser MUSS sich so verhalten und SOLLTE auf doppelte Namen hinweisen. Im Strict-Modus sind doppelte Namen verboten ([Abschnitt 12](#12-strict-modus)).

### 7.3 Trenner

```abnf
item-sep     = ( S "," S ) / S-nl
```

Zwei aufeinanderfolgende Elemente eines Objekts, eines Arrays oder des impliziten Wurzelobjekts MÜSSEN getrennt sein durch

1. genau ein Komma (mit beliebigem Leerraum davor und danach), **oder**
2. Leerraum, der mindestens einen Zeilenumbruch (LF, CR oder CR LF, siehe 5.2) außerhalb von Blockkommentaren enthält (`S-nl`).

Beides zusammen – Komma und Zeilenumbruch – ist Fall 1 und damit gültig. Stehen zwei Elemente in derselben Zeile ohne Komma, ist das ein Fehler.

```xtjson
{
  matrix: [
    1, 2, 3
    4, 5, 6
  ]
  aktiv: true
  name: "x", alias: "y"
}
```

Klarstellungen:

- Mehrere Zeilenumbrüche, Leerzeilen und Kommentare zwischen zwei Elementen sind ein einziger Trenner.
- Kein Trenner sind: ein Zeilenumbruch innerhalb eines Blockkommentars sowie alle Leerraumzeichen, die kein Zeilenumbruch nach 5.2 sind, insbesondere U+2028 und U+2029. Stehen zwischen zwei Elementen nur solche Zeichen oder Blockkommentare, ist das ein Fehler.
- Zwei Kommas hintereinander (`[1,,2]`) und ein führendes Komma (`[,1]`) sind Fehler. Es gibt keine „leeren“ Elemente.
- Ein Zeilenumbruch trennt nur **vollständige** Elemente. Zwischen Name und `:` sowie zwischen `:` und Wert bleibt er bedeutungsloser Leerraum, wie in JSON.
- XTJSON kennt keine Ausdrücke. `[1` ⏎ `-2]` ist deshalb eindeutig ein Array mit den zwei Elementen `1` und `-2`.

### 7.4 Abschließendes Komma

Nach dem letzten Element eines Objekts, eines Arrays oder des impliziten Wurzelobjekts DARF genau ein Komma stehen. Es hat keine Bedeutung. Ein Komma ohne vorangehendes Element ist ein Fehler (`[,]`, `{,}`).

```xtjson
{
  liste: [1, 2, 3,],
  leer: [],
}
```

## 8. Strings

### 8.1 Begrenzer und Zeichen

```abnf
string        = DQUOTE *( unescaped / SQUOTE / escape-seq ) DQUOTE
              / SQUOTE *( unescaped / DQUOTE / escape-seq ) SQUOTE
unescaped     = %x09 / newline / %x20-21 / %x23-26 / %x28-5B / %x5D-10FFFF
                                             ; ohne " ' \ und ohne Steuerzeichen
                                             ; außer HT und Zeilenumbrüchen
```

- Ein String steht in doppelten (`"`) oder in einfachen (`'`) Anführungszeichen. Beide Formen sind gleichwertig und an jeder Stelle erlaubt, an der ein String stehen darf, auch als Name.
- Er endet am ersten nicht maskierten Vorkommen des Zeichens, mit dem er begonnen hat.
- In einem `"`-String darf `'` unmaskiert stehen, in einem `'`-String darf `"` unmaskiert stehen. Der jeweilige Begrenzer MUSS maskiert werden (`\"` bzw. `\'`).
- Ein String darf über mehrere Zeilen reichen: Zeilenumbrüche nach 5.2 und der Tabulator U+0009 dürfen unmaskiert stehen. Der umgekehrte Schrägstrich und alle anderen Steuerzeichen (U+0000 bis U+0008, U+000B, U+000C, U+000E bis U+001F) MÜSSEN wie in JSON maskiert werden.
- Alle anderen Zeichen dürfen wie in JSON unmaskiert stehen, auch U+007F, U+2028, U+2029 und die Nicht-ASCII-Leerraumzeichen aus 5.1.
- Die Zeichenfolgen `//`, `/*` und `#` haben im String keine Sonderbedeutung, und ein Zeilenumbruch im String ist kein Trenner nach 7.3.
- Der Wert eines Strings ergibt sich nach 8.3. Für einen String ohne Zeilenumbruch ist er wie in JSON die Folge seiner Zeichen, nachdem die Escape-Sequenzen (8.2) aufgelöst sind.

### 8.2 Escape-Sequenzen

```abnf
escape-seq     = %x5C ( %x22 / %x27 / %x5C / %x2F /  ; " ' \ /
                        %x62 / %x66 / %x6E / %x72 /  ; b f n r
                        %x74 / %x76 /                ; t v
                        %x30 /                       ; \0, nicht vor einer DIGIT
                        %x78 2HEXDIG /               ; \xHH
                        %x75 4HEXDIG /               ; \uXXXX
                        %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}" /
                                                     ; \u{…}, höchstens 10FFFF, nicht D800-DFFF
                        newline )                    ; Zeilenfortsetzung
```

XTJSON kennt alle Escape-Sequenzen von JSON und zusätzlich sechs weitere aus ECMAScript [ECMA-262]: `\'`, `\v`, `\0`, `\xHH`, `\u{…}` und die Zeilenfortsetzung, ein `\` vor einem Zeilenumbruch. Alle gelten in beiden String-Formen. Die Spalte „Herkunft“ nennt JSON, wenn die Sequenz schon dort gilt, und sonst die ECMAScript-Ausgabe, mit der sie eingeführt wurde.

| Sequenz | Ergebnis | Herkunft |
|---|---|---|
| `\"` | U+0022 Anführungszeichen | JSON |
| `\\` | U+005C umgekehrter Schrägstrich | JSON |
| `\/` | U+002F Schrägstrich | JSON |
| `\b` | U+0008 Rückschritt | JSON |
| `\f` | U+000C Seitenvorschub | JSON |
| `\n` | U+000A Zeilenvorschub | JSON |
| `\r` | U+000D Wagenrücklauf | JSON |
| `\t` | U+0009 Tabulator | JSON |
| `\uXXXX` | UTF-16-Code-Einheit XXXX (vier Hexadezimalziffern) | JSON |
| `\'` | U+0027 Apostroph | ES1 (1997) |
| `\xHH` | U+00HH (zwei Hexadezimalziffern) | ES1 (1997) |
| `\v` | U+000B Vertikaltabulator | ES3 (1999) |
| `\0` | U+0000 Null | ES3 (1999) |
| `\` vor einem Zeilenumbruch | nichts (Zeilenfortsetzung) | ES5 (2009) |
| `\u{…}` | Codepunkt U+0000 bis U+10FFFF (eine oder mehr Hexadezimalziffern) | ES2015 (ES6) |

Regeln:

- **`\xHH` und `\uXXXX`** verlangen genau zwei bzw. genau vier Hexadezimalziffern, groß oder klein geschrieben. Die Buchstaben `x` und `u` selbst sind klein. `\xHH` steht für den Codepunkt U+00HH, nicht für ein Byte. Zeichen außerhalb der BMP werden entweder mit `\u{…}` oder wie in JSON als Surrogatpaar aus zwei `\uXXXX`-Sequenzen geschrieben.
- **`\u{…}`** enthält zwischen den Klammern mindestens eine Hexadezimalziffer, groß oder klein geschrieben; führende Nullen sind erlaubt, `_` und Leerraum nicht. Der Wert DARF NICHT größer als 10FFFF sein. Die Sequenz steht für genau diesen Codepunkt: `\u{1F600}` ist gleichbedeutend mit dem Surrogatpaar `\uD83D\uDE00`, `\u{e4}` mit `\u00E4`. Ein Wert im Surrogatbereich (D800 bis DFFF) ist ein Fehler; ein einzelnes Surrogat lässt sich nur wie in JSON mit `\uXXXX` schreiben.
- **`\0`** DARF NICHT unmittelbar von einer Dezimalziffer gefolgt sein. `\1` bis `\9` sind Fehler. Oktale Escape-Sequenzen gibt es damit nicht.
- **Zeilenfortsetzung.** Ein `\`, auf das unmittelbar ein Zeilenumbruch (LF, CR oder CR LF, siehe 5.2) folgt, trägt nichts zum Wert bei: Weder der umgekehrte Schrägstrich noch der Zeilenumbruch erscheinen darin. Der Zeilenumbruch MUSS unmittelbar auf das `\` folgen; ein Leerzeichen oder Tabulator nach dem `\` ist ein Fehler. Anders als in ECMAScript sind U+2028 und U+2029 auch hier keine Zeilenumbrüche. Wie sich eine Zeilenfortsetzung auf die Einrückung der folgenden Zeile auswirkt, bestimmt 8.3.
- **Jede andere Folge mit `\` ist ein Fehler.** Das gilt insbesondere für `\` vor einem beliebigen sonstigen Zeichen (`\a`, `\-`, `\N`, `\X41`) und für `\` vor einem Leerzeichen oder Tabulator.

```xtjson
[
  'einfach',
  "doppelt",
  'Er sagte "hallo"',
  "Er sagte \"hallo\"",
  'It\'s',
  "It's",
  'Zeile 1\nZeile 2 \u00e4',
  "\x41\v\0",
  "\u{1F600} \u{e4} \u{000041}"
]
```

### 8.3 Zeilenumbrüche in Strings

Ein String, der einen Zeilenumbruch enthält, reicht über mehrere Zeilen. Sein Wert ist dann nicht einfach die Folge seiner Zeichen: Leerraum am Zeilenende wird entfernt, und Einrückung kann entfernt werden. Zeilenfortsetzungen (8.2) verbinden Zeilen ohne Zeilenumbruch.

„Leerraum“ sind in diesem Abschnitt nur unmaskierte Leerzeichen (U+0020) und Tabulatoren (U+0009). Alle anderen Leerraumzeichen aus 5.1 sind hier gewöhnlicher Text. Der Wert eines Strings ergibt sich in vier Schritten:

1. **Zeilen bilden.** Der Text zwischen den Begrenzern wird an jedem Zeilenumbruch nach 5.2 in Zeilen zerlegt, auch am Zeilenumbruch einer Zeilenfortsetzung. Die erste Zeile beginnt nach dem öffnenden Begrenzer, die letzte endet vor dem schließenden. Ein Text ohne Zeilenumbruch besteht aus einer einzigen Zeile. Escape-Sequenzen wie `\n` sind keine Zeilenumbrüche in diesem Sinn. Das `\` einer Zeilenfortsetzung bleibt bis Schritt 4 am Ende seiner Zeile stehen.
2. **Leerraum am Zeilenende entfernen.** Aus jeder Zeile außer der letzten wird der Leerraum an ihrem Ende entfernt. Das geschieht immer. Eine Zeile, die mit dem `\` einer Zeilenfortsetzung endet, hat keinen Leerraum an ihrem Ende; Leerraum vor dem `\` bleibt erhalten. Die letzte Zeile bleibt unverändert, weil sie nicht an einem Zeilenende, sondern am schließenden Begrenzer endet.
3. **Einrückung entfernen.** Dieser Schritt gilt nur, wenn der String mit einer Leerzeile beginnt, das heißt: wenn es mindestens zwei Zeilen gibt und die erste nach Schritt 2 leer ist. Eine Zeile, die das `\` einer Zeilenfortsetzung enthält, ist nicht leer.
   1. Die erste Zeile entfällt.
   2. Die Einrückung einer Zeile ist die Folge der Leerraumzeichen an ihrem Anfang; ihre Länge ist die Anzahl dieser Zeichen. Ein Tabulator zählt als ein Zeichen.
   3. Bestimmt wird die kleinste Einrückung aller nicht leeren Zeilen. Die letzte Zeile zählt dabei immer mit, auch wenn sie leer ist oder nur aus Leerraum besteht.
   4. Aus jeder Zeile werden so viele Zeichen am Anfang entfernt, wie die kleinste Einrückung angibt. Leere Zeilen bleiben leer. Die entfernten Zeichen MÜSSEN in allen Zeilen, aus denen Zeichen entfernt werden, dieselben sein; andernfalls ist der String ein Fehler, etwa wenn eine Zeile mit einem Tabulator und eine andere mit Leerzeichen eingerückt ist.
4. **Zusammensetzen.** Die Zeilen werden mit je einem U+000A verbunden, unabhängig davon, ob der Zeilenumbruch in der Datei als LF, CR oder CR LF geschrieben ist. Danach werden die Escape-Sequenzen aufgelöst; eine Zeilenfortsetzung entfernt dabei ihr `\` zusammen mit dem folgenden U+000A.

Folgen dieser Regeln:

- Ein String ohne Zeilenumbruch wird durch die Schritte 1 bis 3 nicht verändert. Sein Wert ist derselbe wie in JSON.
- Folgt auf den öffnenden Begrenzer bis zum Zeilenumbruch nichts oder nur Leerraum, gehören dieser Leerraum und der Zeilenumbruch nicht zum Wert. Ein Zeilenumbruch vor dem schließenden Begrenzer gehört zum Wert, außer er ist als Zeilenfortsetzung geschrieben.
- Die Stellung des schließenden Begrenzers bestimmt mit, wie viel Einrückung entfernt wird: Steht er so weit links wie der Text, verschwindet die gemeinsame Einrückung ganz; steht er weiter links, bleibt der Unterschied erhalten; steht er am Zeilenanfang, wird nichts entfernt; steht er weiter rechts, bleibt der überschüssige Leerraum vor ihm am Ende des Werts stehen.
- Beginnt der Text in der Zeile des öffnenden Begrenzers, wird keine Einrückung entfernt. Das gilt auch, wenn die erste Zeile nur aus dem `\` einer Zeilenfortsetzung besteht.
- Eine Zeilenfortsetzung verbindet zwei Zeilen. Die Einrückung der folgenden Zeile wird in Schritt 3 wie die jeder anderen Zeile entfernt; Leerraum vor dem `\` bleibt erhalten.
- Leerraum, der am Zeilenende oder am Zeilenanfang erhalten bleiben soll, wird als Escape-Sequenz geschrieben, etwa `\x20` oder `\t`.
- Leerzeilen innerhalb des Textes bleiben als Leerzeilen erhalten und beeinflussen die Einrückung nicht.

In der folgenden Tabelle steht `·` für ein Leerzeichen und `⏎` für einen Zeilenumbruch. Die rechte Spalte zeigt den Wert als JSON-String.

| Geschrieben | Wert | Erläuterung |
|---|---|---|
| `"⏎··a⏎··b⏎··"` | `"a\nb\n"` | gemeinsame Einrückung 2 entfernt |
| `"⏎····a⏎··"` | `"  a\n"` | der schließende Begrenzer steht weiter links |
| `"⏎··a⏎"` | `"  a\n"` | der schließende Begrenzer steht am Zeilenanfang |
| `"⏎··a⏎····"` | `"a\n  "` | der schließende Begrenzer steht weiter rechts |
| `"⏎··a⏎⏎··b"` | `"a\n\nb"` | die Leerzeile zählt nicht mit |
| `"a··⏎··b"` | `"a\n  b"` | kein Beginn mit Leerzeile: nur das Zeilenende wird bereinigt |
| `"⏎a··⏎b\x20⏎"` | `"a\nb \n"` | maskierter Leerraum am Zeilenende bleibt |
| `"a··"` | `"a  "` | kein Zeilenende, nichts entfernt |
| `"⏎··a·\⏎··b⏎··"` | `"a b\n"` | Zeilenfortsetzung: das Leerzeichen vor `\` bleibt, die Einrückung der nächsten Zeile wird entfernt |
| `"⏎··a\⏎··"` | `"a"` | Zeilenfortsetzung vor dem schließenden Begrenzer: kein Zeilenumbruch am Ende |
| `"a\⏎··b"` | `"a  b"` | kein Beginn mit Leerzeile: keine Einrückung entfernt |
| `"\⏎··a"` | `"  a"` | die erste Zeile enthält `\` und ist nicht leer |

```xtjson
{
  sql: "
    SELECT name
      FROM kunden
     WHERE ort = 'Köln'
    "
  hinweis: '
      Zwei Zeichen Einrückung bleiben,
      weil der schließende Begrenzer weiter links steht.
    '
  direkt: "Der Text beginnt in der Zeile des Begrenzers:
    hier wird keine Einrückung entfernt."
  lange_zeile: "
    Eine lange Zeile lässt sich mit \
    Zeilenfortsetzungen über mehrere Zeilen schreiben.\
    "
}
```

JSON-Äquivalent:

```json
{
  "sql": "SELECT name\n  FROM kunden\n WHERE ort = 'Köln'\n",
  "hinweis": "  Zwei Zeichen Einrückung bleiben,\n  weil der schließende Begrenzer weiter links steht.\n",
  "direkt": "Der Text beginnt in der Zeile des Begrenzers:\n    hier wird keine Einrückung entfernt.",
  "lange_zeile": "Eine lange Zeile lässt sich mit Zeilenfortsetzungen über mehrere Zeilen schreiben."
}
```

## 9. Zahlen

```abnf
number   = [ minus ] ( ( radix-int / decimal ) [ suffix ]
                     / ( radix-int / int ) %x6E )   ; n nur nach einer ganzen Zahl (9.5)
```

### 9.1 Dezimalzahlen

```abnf
decimal  = int [ frac ] [ exp ]
int      = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac     = "." digits
exp      = e [ minus / plus ] digits
digits   = DIGIT *( [ "_" ] DIGIT )
```

Ohne `_` und ohne Suffix ist das exakt die Zahlengrammatik von JSON. Insbesondere bleiben ungültig: führende Nullen (`0755`), ein führendes `+`, ein fehlender Ganzzahl- oder Nachkommateil (`.5`, `5.`). `Infinity` und `NaN` sind keine Zahlen; an Wertposition sind sie ein Fehler (6.3).

### 9.2 Hexadezimal, oktal, binär

```abnf
radix-int = zero ( ( %x78 / %x58 ) HEXDIG *( [ "_" ] HEXDIG )       ; 0x 0X
                 / ( %x6F / %x4F ) %x30-37 *( [ "_" ] %x30-37 )     ; 0o 0O
                 / ( %x62 / %x42 ) BIT *( [ "_" ] BIT ) )           ; 0b 0B
```

| Form | Präfix | Ziffern | Beispiel | Wert |
|---|---|---|---|---|
| hexadezimal | `0x` oder `0X` | `0`–`9`, `a`–`f`, `A`–`F` | `0xFF` | 255 |
| oktal | `0o` oder `0O` | `0`–`7` | `0o755` | 493 |
| binär | `0b` oder `0B` | `0`, `1` | `0b1010` | 10 |

- Groß- und Kleinschreibung spielen weder beim Präfix noch bei den Hexadezimalziffern eine Rolle: `0xff`, `0XFF` und `0xFf` sind derselbe Wert. Wegen der Verwechslungsgefahr von `0O` mit `00` wird die Kleinschreibung EMPFOHLEN.
- Nach dem Präfix MUSS mindestens eine Ziffer folgen. Führende Nullen nach dem Präfix sind erlaubt (`0x00FF`).
- Kein Suffix beginnt mit `x`, `X`, `o`, `O`, `b` oder `B` (9.5). Ein Präfix ohne Ziffer wie `0x` ist deshalb immer ein Fehler und nie die Zahl `0` mit einem Suffix.
- Diese Formen bezeichnen ausschließlich **ganze Zahlen**. Nachkommateil und Exponent gibt es nicht; in `0x1e3` ist `e` eine Hexadezimalziffer (Wert 483).
- Ein vorangestelltes `-` ist erlaubt: `-0x10` hat den Wert −16.
- Der Wert ist die mathematische ganze Zahl, die die Ziffernfolge in der jeweiligen Basis darstellt. Sie ist von der gleichwertigen Dezimalzahl nicht zu unterscheiden: `0xFF`, `0o377`, `0b1111_1111` und `255` sind derselbe Wert.
- Eine Schreibweise wie `0755` wird **nicht** als Oktalzahl gelesen; sie bleibt ein Fehler.

### 9.3 Zifferngruppierung

- Zwischen zwei Ziffern DARF genau ein `_` stehen. Es hat keine Bedeutung und wird beim Lesen verworfen.
- Das gilt für alle Ziffernfolgen: Ganzzahlteil, Nachkommateil, Exponent sowie die Ziffern nach `0x`, `0o`, `0b`.
- Ein `_` am Anfang oder Ende einer Ziffernfolge, zwei `_` hintereinander sowie ein `_` neben Präfix, Vorzeichen, `.` oder `e`/`E` sind Fehler.

```xtjson
[
  1_000_000,
  3.141_592_653,
  6.022_140_76e23,
  1e1_0,
  0xDEAD_BEEF,
  0o7_5_5,
  0b1010_0101,
  -0x10
]
```

### 9.4 Wertebereich und Genauigkeit

XTJSON legt wie [RFC8259] und [ECMA-404] keinen Zahlentyp fest; Implementierungen dürfen Bereich und Genauigkeit begrenzen. Für die Interoperabilität gilt wie dort:

- Zahlen SOLLTEN in Betrag und Genauigkeit im Rahmen von IEEE 754 binary64 bleiben.
- Ganze Zahlen im Bereich [−(2⁵³)+1, (2⁵³)−1] sind exakt interoperabel.
- Hexadezimale, oktale und binäre Zahlen stehen häufig für Bitmasken, bei denen jede Stelle zählt. Kann eine Implementierung eine solche Zahl nicht exakt darstellen, MUSS sie einen Fehler melden; sie DARF NICHT runden.
- Für das Ergebnis einer Zahl mit Suffix (9.5) gelten dieselben Empfehlungen wie für jede andere Zahl.

### 9.5 Zahlen-Suffixe

```abnf
suffix      = %x6B / %x6B.62 / %x6D /     ; k kb m
              %x6D.62 / %x6D.73 /         ; mb ms
              %x6D.69.6E / %x73 / %x68 /  ; min s h
              %x70.63.74                  ; pct
```

An eine Zahl darf ein Suffix angehängt werden. Das Suffix steht für eine Umrechnung: Sie wird auf den Wert der Zahl einschließlich des Vorzeichens angewendet und ergibt eine Zahl. Im JSON-Äquivalent steht an der Stelle der Zahl mit Suffix das Ergebnis. Alle Suffixe sind vordefiniert; die Regeln `suffix` und `number` (für `n`) und die Tabelle in diesem Abschnitt führen sie vollständig auf.

**Schreibweise**

- Das Suffix folgt unmittelbar auf die letzte Ziffer. Leerraum, Kommentare und `_` zwischen Zahl und Suffix sind ein Fehler.
- Jedes Suffix hat genau eine Schreibweise, in Kleinbuchstaben. Groß- und Kleinschreibung zählen: `10K`, `64MB` und `5Min` sind Fehler.
- Es gilt die längste Übereinstimmung: `10kb` trägt das Suffix `kb`, nicht `k` gefolgt von `b`; ebenso tragen `10mb`, `10ms` und `10min` die Suffixe `mb`, `ms` und `min`, nicht `m`.
- Das Suffix beendet die Zahl. Ein Buchstabe, eine Ziffer, `_` oder `$` unmittelbar danach gehört nicht dazu, sondern beginnt ein neues Token, das einen Trenner nach 7.3 braucht. `10kbs`, `10k5` und `10mi` sind deshalb Fehler, ebenso `10_k`, weil ein `_` nach einer Ziffer Zifferngruppierung ist (9.3).
- `n` ist nur nach einer ganzen Zahl erlaubt, also nach einer Dezimalzahl ohne Nachkommateil und Exponent oder nach einer hexadezimalen, oktalen oder binären Zahl (`10n`, `-3n`, `0xFFn`). `1.5n`, `1.0n` und `1e3n` sind Fehler.
- Alle anderen Suffixe sind an allen Zahlformen erlaubt, auch nach einem Exponenten und an hexadezimalen, oktalen und binären Zahlen: `1e3k`, `0x10kb`.

**Übersicht der Suffixe**

| Suffix | Umrechnung | Beispiel | Ergebnis |
|---|---|---|---|
| `k` | Zahl mal 1000 | `10k` | `10000` |
| `kb` | Zahl mal 1024 | `4kb` | `4096` |
| `m` | Zahl mal 1000000 | `2m` | `2000000` |
| `mb` | Zahl mal 1048576 | `64mb` | `67108864` |
| `ms` | Zahl geteilt durch 1000 | `100ms` | `0.1` |
| `s` | keine; der Wert bleibt unverändert | `30s` | `30` |
| `min` | Zahl mal 60 | `5min` | `300` |
| `h` | Zahl mal 3600 | `2h` | `7200` |
| `pct` | Zahl geteilt durch 100 | `50pct` | `0.5` |
| `n` | keine; der Wert bleibt unverändert; nur nach einer ganzen Zahl | `10n` | `10` |

- Die Tabelle ist abschließend. Jede andere Schreibweise nach einer Zahl ist ein Fehler (`10q`, `10K`, `12px`).
- Die Suffixe DÜRFEN NICHT umdefiniert, überschrieben oder entfernt werden. Ein Parser DARF KEINE weiteren Suffixe kennen und keine von der Anwendung annehmen.
- Das Ergebnis ist das exakte Produkt oder der exakte Quotient. Im JSON-Äquivalent steht dessen Dezimaldarstellung: `1.5k` ergibt `1500`, `0.5kb` ergibt `512`, `0.1kb` ergibt `102.4`, `-2k` ergibt `-2000`, `2.5m` ergibt `2500000`, `0x10kb` ergibt `16384`, `1.5h` ergibt `5400`, `1ms` ergibt `0.001`, `12.5pct` ergibt `0.125`.
- Bei `s` und `n` ist das Ergebnis der Wert der Zahl selbst: `30s` und `30` bezeichnen denselben Wert. Das Suffix trägt keine Information zum Wert des Dokuments bei.
- `ms`, `s`, `min` und `h` rechnen eine Zeitangabe in Sekunden um.
- Das Ergebnis ist immer eine Zahl. Ein Suffix kann keinen String und keinen anderen Datentyp erzeugen.

Beispiel:

```xtjson
{
  timeout: 30s
  intervall: 5min
  haltbarkeit: 12h
  wartezeit: 250ms
  cache: 64mb
  block: 0x10kb
  halb: 0.5k
  quote: 50pct
  aufschlag: 110pct
  budget: 2.5m
  zaehler: 100n
}
```

JSON-Äquivalent:

```json
{
  "timeout": 30,
  "intervall": 300,
  "haltbarkeit": 43200,
  "wartezeit": 0.25,
  "cache": 67108864,
  "block": 16384,
  "halb": 500,
  "quote": 0.5,
  "aufschlag": 1.1,
  "budget": 2500000,
  "zaehler": 100
}
```

## 10. Abbildung auf JSON

Das **JSON-Äquivalent** eines XTJSON-Dokuments entsteht durch folgende Schritte. Sie definieren zugleich die Bedeutung jedes XTJSON-Dokuments.

1. **Kommentare** werden entfernt. **Leerraumzeichen**, die JSON nicht kennt, werden durch ein Leerzeichen (U+0020) ersetzt.
2. **Implizites Wurzelobjekt:** Die Member werden in `{` `}` eingeschlossen.
3. **Trenner:** Zwischen je zwei aufeinanderfolgenden Elementen steht genau ein Komma. Abschließende Kommas entfallen.
4. **Namen:** Ein Bezeichner an Namensposition wird zum JSON-String mit derselben Zeichenfolge.
5. **Strings:** Ein `'`-String wird zum `"`-String mit demselben Inhalt; unmaskierte `"` werden zu `\"`. Escape-Sequenzen, die JSON nicht kennt, werden in beiden String-Formen ersetzt: `\'` durch `'`, `\v` durch `\u000B`, `\0` durch `\u0000`, `\xHH` durch `\u00HH`, `\u{…}` durch die `\uXXXX`-Sequenz desselben Codepunkts, oberhalb von U+FFFF durch das entsprechende Surrogatpaar. Ein String mit Zeilenumbruch wird zum `"`-String, der seinen Wert nach 8.3 darstellt; Zeilenfortsetzungen entfallen dabei, und Zeichen, die in einem JSON-String nicht unmaskiert stehen dürfen (`"`, `\` und Steuerzeichen wie Zeilenumbruch und Tabulator), werden maskiert.
6. **Zahlen:** Aus Dezimalzahlen werden alle `_` entfernt; die Schreibweise bleibt sonst unverändert. Hexadezimale, oktale und binäre Zahlen werden zur dezimalen Ganzzahl desselben Werts, bei vorangestelltem `-` mit führendem Minuszeichen. Eine Zahl mit Suffix wird durch das Ergebnis der Umrechnung ersetzt, geschrieben als JSON-Zahl (9.5).
7. **`true`, `false`, `null` und `nil`:** Die ersten drei bleiben unverändert; `nil` wird durch `null` ersetzt (6.3).
8. **Direktiven** werden entfernt, jeweils zusammen mit dem Trenner, der auf sie folgt (6.4).
9. **Basiswert:** Enthält das Dokument `%extends`, wird der bis hierher erhaltene JSON-Text als Merge Patch auf den Basiswert angewendet (6.6); das JSON-Äquivalent ist der JSON-Text des Ergebnisses.

Das JSON-Äquivalent ist bis auf Leerraum und die Wahl gleichwertiger Escape-Sequenzen eindeutig; für ein Dokument mit `%extends` gilt das bei gegebenem Basiswert. Enthält es ein Objekt mit doppelten Namen, gilt für dessen Wert die Regel aus 7.2: Das letzte Member gilt. Zwei XTJSON-Dokumente sind **gleichbedeutend**, wenn ihre JSON-Äquivalente denselben Wert bezeichnen. Ein Dokument, das bereits ein JSON-Text ist, ist sein eigenes JSON-Äquivalent (bis auf Leerraum).

Ein Beispiel mit Gegenüberstellung steht in [Anhang B.1](#b1-vollständiges-beispiel).

## 11. Konformität

**Dokument.** Ein Text ist ein konformes XTJSON-Dokument, wenn er nach Abschnitt 4 kodiert ist, der Regel `XTJSON-text` entspricht und es, wenn es `%strict: true` enthält, die Verbote aus Abschnitt 12 einhält. Ein konformes Dokument ohne `%extends` ist **portabel**: Sein Wert hängt nur von seinem Text und von dieser Spezifikation ab, und jeder konforme Parser kann es lesen, sofern keine Grenze und keine Einschränkung der Anwendung greift (Abschnitt 11). Der Wert eines Dokuments mit `%extends` hängt zusätzlich von seinem Basiswert ab, und nur ein Parser mit Resolver kann es lesen (6.6).

**Parser.** Ein konformer XTJSON-Parser

- MUSS jedes konforme XTJSON-Dokument akzeptieren und den Wert seines JSON-Äquivalents liefern – damit auch jeden JSON-Text und jede I-JSON-Nachricht –, soweit nicht eine Grenze oder Einschränkung nach dem vierten Punkt greift oder das Dokument `%extends` enthält und `%extends` abgeschaltet ist (6.6);
- MUSS jeden Text, der kein konformes XTJSON-Dokument ist, als Fehler ablehnen, insbesondere einen mit einem anderen Bezeichner als `true`, `false`, `null` und `nil` an Wertposition oder einer unbekannten Direktive, und DARF KEINE weiteren Syntaxerweiterungen stillschweigend akzeptieren;
- MUSS die Werte `true`, `false`, `null` und `nil` (6.3), die Direktiven aus 6.4 und alle Suffixe aus 9.5 kennen. Er DARF NICHT zulassen, dass sie umdefiniert werden, und DARF KEINE Werte, Direktiven oder Suffixe von der Anwendung annehmen;
- DARF Grenzen für Dokumentgröße, Verschachtelungstiefe, Zahlenbereich und -genauigkeit sowie Stringlänge setzen und semantische Einschränkungen durchsetzen (etwa den Strict-Modus nach Abschnitt 12);
- MUSS der Anwendung den Strict-Modus nach Abschnitt 12 anbieten und MUSS ein Dokument mit `%strict: true` im Strict-Modus lesen (6.5);
- DARF `%extends` mit einem Resolver der Anwendung unterstützen (6.6).

**Erzeuger.** Ein XTJSON-Erzeuger MUSS konforme XTJSON-Dokumente ausgeben. Jeder JSON-Erzeuger, der in UTF-8 ausgibt, ist damit auch ein XTJSON-Erzeuger. Ist der Empfänger ein Programm, SOLLTE JSON ausgegeben werden.

**Konverter.** Ein Konverter von XTJSON nach JSON MUSS das JSON-Äquivalent nach Abschnitt 10 erzeugen; für ein Dokument mit `%extends` braucht er den Basiswert (6.6). Seine Ausgabe MUSS strikt der Grammatik von [RFC8259] entsprechen.

## 12. Strict-Modus

Im **Strict-Modus** setzt ein Parser über Abschnitt 4–9 hinaus die folgenden Verbote durch. Der Strict-Modus gilt, wenn die Anwendung ihn verlangt oder das Dokument `%strict: true` enthält (6.5). Die Verbote gelten für den Inhalt des Dokuments, den Teil nach den Direktiven. Für ein Dokument mit `%extends` gelten die Verbote zu Namen, String-Werten und zum Wurzelwert auch für das Ergebnis seiner Zusammenführung mit seinem Basiswert (6.6).

- Namen und String-Werte DÜRFEN KEINE Surrogate und keine Unicode-Noncharacters enthalten, weder direkt noch als Escape-Sequenz. Ein einzelnes `"\uDEAD"` ist ungültig; ein korrektes Surrogatpaar ist zulässig.
- Ein Objekt DARF KEINE doppelten Namen enthalten. Verglichen wird nach Auflösung aller Escape-Sequenzen und unabhängig von der Schreibweise des Namens (Bezeichner oder String in einer der Formen aus Abschnitt 8).
- Der Wurzelwert MUSS ein Objekt oder ein Array sein. Das implizite Wurzelobjekt erfüllt diese Regel.

Ein Parser im Strict-Modus MUSS Dokumente ablehnen, die gegen eines dieser Verbote verstoßen.

Zahlen SOLLTEN NICHT über Betrag oder Genauigkeit von IEEE 754 binary64 hinausgehen. Für ganze Zahlen außerhalb von [−(2⁵³)+1, (2⁵³)−1] darf keine exakte Verarbeitung erwartet werden; das gilt auch für hexadezimale, oktale und binäre Schreibweise. Solche Werte werden besser als String übertragen. Ein Parser kann das mit einer Grenze für den Zahlenbereich durchsetzen (Abschnitt 11).

**Verhältnis zu I-JSON.** Erfüllt ein Dokument die Verbote und die Empfehlung zu Zahlen, ist sein JSON-Äquivalent eine I-JSON-Nachricht nach [I-JSON]. Der Strict-Modus geht nur beim Wurzelwert über I-JSON hinaus, für den I-JSON ein Objekt oder ein Array nur empfiehlt.

Die Empfehlungen aus [I-JSON] für Protokolle gelten unverändert auch für XTJSON-Dokumente: unbekannte Member ignorieren, Zeitangaben als String nach RFC 3339, Binärdaten als base64url-String.

## 13. Sicherheitsaspekte

- **Kein `eval`.** XTJSON ist keine Teilmenge von JavaScript oder einer anderen Programmiersprache und DARF NICHT durch Auswertung als Programmcode gelesen werden.
- **Ressourcengrenzen.** Tief verschachtelte Strukturen, sehr lange Strings oder Zahlen sowie nicht abgeschlossene Blockkommentare und Strings können Parser überlasten. Parser SOLLTEN Grenzen setzen (Abschnitt 11).
- **Abweichende Interpretation.** Verarbeiten zwei Komponenten dasselbe Dokument unterschiedlich, kann das Prüfungen aushebeln. Das betrifft vor allem doppelte Namen, die andere JSON-Werkzeuge anders behandeln können als in 7.2 festgelegt, Zahlen außerhalb des exakten Bereichs und Dokumente mit `%extends`, deren Wert vom Resolver abhängt. Wo ein Dokument sicherheitsrelevante Entscheidungen steuert, wird der Strict-Modus (Abschnitt 12) EMPFOHLEN.
- **Keine Definitionen.** Die Werte ohne Anführungszeichen, die Direktiven und die Umrechnungen der Suffixe legt allein diese Spezifikation fest; weder das Dokument noch die Anwendung können Werte definieren. Die Bedeutung eines Dokuments ohne `%extends` hängt deshalb nicht von der Konfiguration des Parsers ab, und ein Dokument kann keinen Code mitbringen.
- **`%extends`.** Ein Dokument mit `%extends` lässt den Parser den Resolver der Anwendung mit einem String aus dem Dokument aufrufen. Ein Dokument aus einer nicht vertrauenswürdigen Quelle kann so das Lesen lokaler Dateien oder Anfragen über das Netz auslösen, etwa mit `'/etc/passwd'`, `'file:///…'` oder der Adresse eines Dienstes in einem internen Netz, und deren Inhalt wird Teil des Werts. Resolver SOLLTEN nur Quellen auflösen, die die Anwendung zulässt, SOLLTEN Zyklen erkennen, wenn ein Basiswert selbst aus einem Dokument mit `%extends` stammt, und SOLLTEN Anzahl und Größe der Quellen begrenzen. Wo Dokumente aus nicht vertrauenswürdigen Quellen stammen, SOLLTE `%extends` abgeschaltet oder der Resolver entsprechend eingeschränkt sein.
- **Ähnliche Zeichen in Namen.** Bezeichner dürfen Buchstaben aus dem Block Latin-1 Supplement enthalten. Manche davon ähneln anderen Zeichen, etwa U+00B5 (Mikrozeichen) und U+03BC (griechisches kleines My), und Namen werden Codepunkt für Codepunkt ohne Normalisierung verglichen (7.2). Werkzeuge SOLLTEN auf Namen hinweisen, die sich nur in solchen Zeichen unterscheiden.
- **Verwechslung mit JSON.** Ein XTJSON-Dokument, das als JSON ausgegeben wird, führt bei strikten Empfängern zu Fehlern und bei nachlässigen zu uneinheitlichem Verhalten. Deshalb die Abgrenzung in K5.
- **Kommentare.** Kommentare gehen bei der Abbildung auf JSON verloren und werden von Programmen nicht gesehen. Unsichtbare Zeichen und Zeichen zur Steuerung der Schreibrichtung in Kommentaren und Strings können den angezeigten Text vom verarbeiteten abweichen lassen; Werkzeuge SOLLTEN darauf hinweisen.
- **U+2028 und U+2029.** Manche Editoren stellen diese Zeichen als Zeilenwechsel dar. In XTJSON beenden sie weder einen Zeilenkommentar noch trennen sie Elemente. Text, der in der Anzeige unter einem Zeilenkommentar steht, kann deshalb noch zum Kommentar gehören und wird dann nicht verarbeitet. Werkzeuge SOLLTEN diese Zeichen außerhalb von Strings sichtbar machen oder davor warnen.
- **Strings über mehrere Zeilen.** Leerraum am Zeilenende und gegebenenfalls die Einrückung gehören nicht zum Wert (8.3). Der Wert kann deshalb vom Schriftbild abweichen. Wo jedes Zeichen zählt, etwa bei Schlüsselmaterial oder signierten Texten, wird Leerraum besser als Escape-Sequenz geschrieben.
- **Fehlendes schließendes Anführungszeichen.** Weil ein String über mehrere Zeilen reichen darf, endet ein String mit vergessenem schließendem Anführungszeichen nicht am Zeilenende: Die folgenden Zeilen gehören bis zum nächsten passenden Anführungszeichen zum String. Der Fehler wird dann weit entfernt von seiner Ursache gemeldet, und in seltenen Fällen bleibt das Dokument mit einem anderen Wert gültig. Werkzeuge SOLLTEN die Ausdehnung von Strings über mehrere Zeilen sichtbar machen.

---

## Anhang A – Vollständige Grammatik (ABNF)

Normativ. Die Kernregeln `ALPHA`, `DIGIT`, `HEXDIG`, `BIT` und `DQUOTE` stammen aus [RFC5234]; `HEXDIG` umfasst dort wegen der Groß-/Kleinschreibungsregel auch `a`–`f`.

```abnf
; ---------- Dokument ----------
XTJSON-text    = S [ directives item-sep ] ( value / member-list ) S [ line-comment ]
                                             ; member-list: implizites Wurzelobjekt

; ---------- Direktiven ----------
directives     = strict-directive [ item-sep extends-directive ]
               / extends-directive [ item-sep strict-directive ]
strict-directive  = %x25.73.74.72.69.63.74 S ":" S
                    ( %x74.72.75.65 / %x66.61.6C.73.65 )   ; %strict: true / false
extends-directive = %x25.65.78.74.65.6E.64.73 S ":" S string   ; %extends

; ---------- Werte ----------
value          = object / array / string / number /
                 %x74.72.75.65 / %x66.61.6C.73.65 /  ; true false
                 %x6E.75.6C.6C / %x6E.69.6C          ; null nil (derselbe Wert)

; ---------- Objekte ----------
object         = "{" S [ member-list S ] "}"
member-list    = member *( item-sep member ) [ S "," ]
member         = name S ":" S value
name           = string / name-start *( name-start / DIGIT )
name-start     = ALPHA / "_" / "$" / %xB5 /                 ; Buchstaben aus
                 %xC0-D6 / %xD8-F6 / %xF8-FF                ; Latin-1 Supplement

; ---------- Arrays ----------
array          = "[" S [ value-list S ] "]"
value-list     = value *( item-sep value ) [ S "," ]

; ---------- Trenner ----------
item-sep       = ( S "," S ) / S-nl

; ---------- Leerraum und Kommentare ----------
S              = *( blank / block-comment / eol )
S-nl           = *( blank / block-comment ) eol S
eol            = [ line-comment ] newline
blank          = %x09 / %x0B / %x0C /                ; HT, VT, FF
                 %x20 / %xA0 / %x1680 /              ; Kategorie Zs:
                 %x2000-200A / %x202F /              ;   SP, NBSP und die
                 %x205F / %x3000 /                   ;   übrigen Leerzeichen
                 %x2028 / %x2029 /                   ; LS, PS
                 %xFEFF                              ; ZWNBSP (BOM)
newline        = %x0D.0A / %x0A / %x0D       ; CR LF, LF oder CR
line-comment   = ( "//" / "#" ) *non-eol
block-comment  = "/*" *( non-star / ( 1*"*" non-star-slash ) ) 1*"*" "/"
non-eol        = %x00-09 / %x0B-0C / %x0E-10FFFF   ; alles außer LF und CR
non-star       = %x00-29 / %x2B-10FFFF
non-star-slash = %x00-29 / %x2B-2E / %x30-10FFFF

; ---------- Strings ----------
string         = DQUOTE *( unescaped / SQUOTE / escape-seq ) DQUOTE
               / SQUOTE *( unescaped / DQUOTE / escape-seq ) SQUOTE
unescaped      = %x09 / newline / %x20-21 / %x23-26 / %x28-5B / %x5D-10FFFF
                                             ; ohne " ' \ und ohne Steuerzeichen
                                             ; außer HT und Zeilenumbrüchen
escape-seq     = %x5C ( %x22 / %x27 / %x5C / %x2F /  ; " ' \ /
                        %x62 / %x66 / %x6E / %x72 /  ; b f n r
                        %x74 / %x76 /                ; t v
                        %x30 /                       ; \0, nicht vor einer DIGIT
                        %x78 2HEXDIG /               ; \xHH
                        %x75 4HEXDIG /               ; \uXXXX
                        %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}" /
                                                     ; \u{…}, höchstens 10FFFF, nicht D800-DFFF
                        newline )                    ; Zeilenfortsetzung
SQUOTE         = %x27                        ; '

; ---------- Zahlen ----------
number         = [ minus ] ( ( radix-int / decimal ) [ suffix ]
                           / ( radix-int / int ) %x6E )  ; n nur nach einer ganzen Zahl (9.5)
suffix         = %x6B / %x6B.62 / %x6D /     ; k kb m
                 %x6D.62 / %x6D.73 /         ; mb ms
                 %x6D.69.6E / %x73 / %x68 /  ; min s h
                 %x70.63.74                  ; pct
decimal        = int [ frac ] [ exp ]
int            = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac           = "." digits
exp            = e [ minus / plus ] digits
digits         = DIGIT *( [ "_" ] DIGIT )
radix-int      = zero ( ( %x78 / %x58 ) HEXDIG *( [ "_" ] HEXDIG )       ; 0x 0X
                      / ( %x6F / %x4F ) %x30-37 *( [ "_" ] %x30-37 )     ; 0o 0O
                      / ( %x62 / %x42 ) BIT *( [ "_" ] BIT ) )           ; 0b 0B
digit1-9       = %x31-39
zero           = %x30
minus          = %x2D
plus           = %x2B
e              = %x65 / %x45                 ; e E
```

Hinweise zur Zerlegung in Tokens (informativ):

- Es gilt die längste Übereinstimmung. `0x1e3` ist eine einzige Hexadezimalzahl, und `10min` ist die Zahl `10` mit dem Suffix `min`.
- Zwei Bedingungen gelten zusätzlich zur Grammatik: Auf die Escape-Sequenz `\0` folgt keine Dezimalziffer, und der Wert von `\u{…}` liegt nicht im Bereich D800 bis DFFF.
- Zwei Werte brauchen stets einen Trenner nach 7.3. Zeichenfolgen wie `0755`, `1_`, `0b102`, `123abc`, `10_k`, `10kbs` oder `1.5n` lassen sich deshalb nie als gültige Folge mehrerer Tokens lesen und sind Fehler.
- Ein Bezeichner wird mit der längsten Übereinstimmung gelesen. An Wertposition muss er `true`, `false`, `null` oder `nil` sein: `nullable` und `nil2` sind Fehler, nicht einer dieser Werte mit weiteren Zeichen danach.
- `%strict` und `%extends` sind jeweils ein einziges Token; Leerraum nach dem `%` ist ein Fehler.
- Ein Zeilenkommentar reicht stets bis zum nächsten Zeilenumbruch: `eol` verlangt nach ihm ein `newline`, und `non-eol` schließt nur U+000A und U+000D aus. Nur am Dokumentende darf der Zeilenumbruch fehlen.
- Die Folge CR LF ist immer ein einziger `newline`, nie zwei.
- Für Strings beschreibt die Grammatik nur die Schreibweise. Ihr Wert ergibt sich aus den Schritten in 8.3.
- Drei Anführungszeichen in Folge (`"""` oder `'''`) begrenzen keinen String: Sie sind ein leerer String, auf den unmittelbar der Anfang eines weiteren Strings folgt, und damit immer ein Fehler (7.3).
- Außer dem aktuellen Zeichen braucht ein Parser nur die Information „seit dem letzten Token kam außerhalb eines Blockkommentars ein Zeilenumbruch vor“. Nur am Beginn des Inhalts (6.2) wird ein Token weiter vorausgeschaut.

## Anhang B – Beispiele

### B.1 Vollständiges Beispiel

XTJSON-Dokument:

```xtjson
# Dienstkonfiguration – die Wurzelklammern sind weggelassen
%strict: true

name: 'demo-service'
version: "1.4.0"
$schema: "https://example.org/schema/service.json"

listen: {
  host: "0.0.0.0"
  port: 8080            // der Zeilenumbruch ersetzt das Komma
  proxy: nil            // nil ist dasselbe wie null
  tls: false,           // Kommas bleiben erlaubt
}

/* Zahlen in anderen Basen
   und mit Zifferngruppierung */
limits: {
  max_body_bytes: 10_485_760
  file_mode: 0o644
  feature_mask: 0b1010_0101
  magic: 0xDEAD_BEEF
  cache_bytes: 64mb     // Suffix: mal 1048576
  rate_limit: 5k        // Suffix: mal 1000
  idle_timeout: 5min    // Suffix: mal 60
  "retry-after": 30     // Name mit Bindestrich braucht Anführungszeichen
  banner: 'Willkommen bei demo-service\x21'
}

// String über mehrere Zeilen: die gemeinsame Einrückung gehört nicht zum Wert
motd: "
  Willkommen.
  Wartung: sonntags 02:00 Uhr.
  "

tags: [
  'intern'
  "sagt \"hallo\""
  'sagt "hallo"',
]
```

JSON-Äquivalent:

```json
{
  "name": "demo-service",
  "version": "1.4.0",
  "$schema": "https://example.org/schema/service.json",
  "listen": { "host": "0.0.0.0", "port": 8080, "proxy": null, "tls": false },
  "limits": {
    "max_body_bytes": 10485760,
    "file_mode": 420,
    "feature_mask": 165,
    "magic": 3735928559,
    "cache_bytes": 67108864,
    "rate_limit": 5000,
    "idle_timeout": 300,
    "retry-after": 30,
    "banner": "Willkommen bei demo-service!"
  },
  "motd": "Willkommen.\nWartung: sonntags 02:00 Uhr.\n",
  "tags": ["intern", "sagt \"hallo\"", "sagt \"hallo\""]
}
```

### B.2 Unverändertes JSON

Jeder JSON-Text ist gültig und behält seine Bedeutung:

```xtjson
{"a": [1, 2.5e-3, true, null], "b": {"c": "d\u00e9"}}
```

### B.3 Ungültige Dokumente

In den Tabellen steht `⏎` für einen Zeilenumbruch.

**Aufbau und Trenner**

| Text | Grund |
|---|---|
| *(leer oder nur Kommentare)* | kein Wert; das implizite Wurzelobjekt braucht mindestens ein Member |
| `[1 2]` | zwei Elemente in einer Zeile ohne Komma |
| `a: 1 b: 2` | ebenso, im impliziten Wurzelobjekt |
| `[1,,2]` | zwei Kommas hintereinander |
| `[,]` und `{,}` | Komma ohne vorangehendes Element |
| `{a: 1} b: 2` | Text nach dem Wurzelwert |
| `a: 1 }` | implizites Wurzelobjekt wird nicht mit `}` geschlossen |
| `[abc]` | `abc` ist nicht `true`, `false`, `null` oder `nil`; andere Werte ohne Anführungszeichen gibt es nicht |
| `[True]` und `[Nil]` | Groß- und Kleinschreibung zählen |

**Direktiven**

| Text | Grund |
|---|---|
| `% strict: true` ⏎ `{}` | Leerraum nach dem `%` |
| `%include: "a.xtj"` ⏎ `{}` und `%Strict: true` ⏎ `{}` | unbekannte Direktive; Groß- und Kleinschreibung zählen |
| `%strict: true [1]` | kein Trenner zwischen der Direktive und dem Inhalt |
| `%strict: true` | nur eine Direktive; das Dokument hat keinen Inhalt |
| `a: 1` ⏎ `%strict: true` | Direktive nach dem ersten Member |
| `[%strict: true]` | Direktive nicht auf oberster Ebene |
| `%strict: 1` ⏎ `{}`, `%strict: 'true'` ⏎ `{}` und `%strict: nil` ⏎ `{}` | nicht `true` oder `false` |
| `%strict: true` ⏎ `%strict: true` ⏎ `{}` | `%strict` zweimal |
| `%extends: nil` ⏎ `{}` und `%extends: ['a.json']` ⏎ `{}` | der Wert von `%extends` ist kein String |
| `%extends: 'a.json'` ⏎ `%extends: 'b.json'` ⏎ `{}` | `%extends` zweimal |
| `%extends: 'a.json'` ⏎ `{}`, wenn `%extends` abgeschaltet ist | der Parser hat keinen Resolver |
| `%strict: true` ⏎ `"x"` | Strict-Modus: der Wurzelwert ist kein Objekt und kein Array |
| `%strict: true` ⏎ `{a: 1, a: 2}` | Strict-Modus: doppelter Name |
| `%strict: true` ⏎ `["\uFFFF"]` | Strict-Modus: Noncharacter in einem String |
| `%strict: false` ⏎ `{}`, wenn die Anwendung den Strict-Modus verlangt | das Dokument widerspricht der Anwendung |

**Namen**

| Text | Grund |
|---|---|
| `{2fa: true}` | Bezeichner beginnt mit einer Ziffer |
| `{π: 1}` und `{a×b: 1}` | `π` und `×` sind keine Buchstaben aus ASCII oder Latin-1 Supplement |
| `{Nº: 1}` und `{a·b: 1}` | `º`, `ª` und `·` sind in Bezeichnern nicht erlaubt |
| `{a.b: 1}` | `.` ist im Bezeichner nicht erlaubt |
| `{max-age: 1}` | `-` ist im Bezeichner nicht erlaubt |

**Strings**

| Text | Grund |
|---|---|
| `'It's'` | `'` im `'`-String nicht maskiert |
| `"a` VT `b"` | U+000B nicht maskiert |
| `"a\` SPACE ⏎ `b"` | Leerraum zwischen `\` und Zeilenumbruch |
| `"\a"`, `"\N"`, `"\-"` | unbekannte Escape-Sequenz |
| `"\1"` und `"\01"` | Ziffer nach `\` bzw. nach `\0` |
| `"\x4"` und `"\u12"` | zu wenige Hexadezimalziffern |
| `"\u{110000}"`, `"\u{D800}"` | Codepunkt größer als U+10FFFF bzw. im Surrogatbereich |
| `"\u{}"`, `"\u{1_F600}"`, `"\u{ 41 }"`, `"\U{41}"` | keine Ziffer, `_` oder Leerraum in den Klammern, großes `U` |
| `"abc` | String nicht abgeschlossen |
| `"""a"""` | drei Anführungszeichen begrenzen keinen String: ein leerer String, gefolgt von weiteren Strings ohne Trenner |
| `"⏎` TAB `a⏎··b⏎·"` | die entfernte Einrückung ist nicht in allen Zeilen gleich |

**Leerraum, Zeilenumbrüche und Kommentare**

| Text | Grund |
|---|---|
| `[1` VT `2]`, `[1` U+2028 `2]` | U+000B und U+2028 sind Leerraum, aber keine Trenner |
| `[1,` U+200B `2]` | U+200B (breitenloses Leerzeichen) ist kein Leerraumzeichen |
| `{a: 1 /* x` ⏎ `*/ b: 2}` | Zeilenumbruch im Blockkommentar ist kein Trenner |
| `/* offen` und `/*/` | Blockkommentar nicht abgeschlossen |

**Zahlen**

| Text | Grund |
|---|---|
| `0755` | führende Null; keine Oktalzahl |
| `0x` | keine Ziffer nach dem Präfix |
| `0x_FF` | `_` direkt nach dem Präfix |
| `1__000` | zwei `_` hintereinander |
| `1_` und `1_.5` | `_` nicht zwischen zwei Ziffern |
| `0b102` | `2` ist keine Binärziffer |
| `0o78` | `8` ist keine Oktalziffer |
| `0x1.8` | Nachkommateil bei nicht dezimaler Zahl |
| `- 1` | Leerraum zwischen Vorzeichen und Ziffern |
| `+1`, `.5`, `5.` | wie in JSON ungültig |
| `NaN`, `Infinity` | keine Zahlen; keine Werte ohne Anführungszeichen |
| `10q`, `12px` und `100L` | kein Suffix aus der Tabelle in 9.5 |
| `10K`, `64MB` und `5Min` | Suffixe werden nur in Kleinbuchstaben geschrieben |
| `10 k` und `10_k` | Leerraum oder `_` zwischen Zahl und Suffix |
| `10kbs`, `10k5` und `10mi` | weitere Zeichen nach dem Suffix ohne Trenner |
| `1.5n` und `1e3n` | `n` nur nach einer ganzen Zahl ohne Nachkommateil und Exponent |
| `50%` und `10e` | `%` ist kein Suffix; `e` leitet den Exponenten ein, der Ziffern braucht |

## Anhang C – Bewusst nicht enthalten

Die folgenden, aus anderen JSON-Dialekten bekannten Erweiterungen gehören **nicht** zu XTJSON. Ein konformer Parser lehnt sie ab.

- frei wählbare Werte ohne Anführungszeichen (`farbe: rot`); an Wertposition sind nur `true`, `false`, `null` und `nil` erlaubt
- im Dokument oder von der Anwendung definierte Werte, etwa Aliase, Konstanten oder Variablen
- andere Schreibweisen von `true`, `false`, `null` und `nil` (`True`, `NULL`, `Nil`) und weitere Werte ohne Anführungszeichen wie `undefined`
- das Abschalten eines von der Anwendung verlangten Strict-Modus; `%strict: false` ist dann ein Fehler
- andere Direktiven als `%strict` und `%extends`, Direktiven des Parsers oder der Anwendung, Direktiven innerhalb von Objekten und Arrays oder nach Beginn des Inhalts sowie ein zweites `%strict` oder `%extends`; Versionsangaben im Dokument
- mehrere Basen in einem Dokument und andere Regeln für die Zusammenführung als JSON Merge Patch, etwa das Anhängen an Arrays
- im Dokument oder von der Anwendung definierte Suffixe; weitere Suffixe wie `px` oder `L`; Suffixe in Großbuchstaben und andere Schreibweisen eines Suffixes (`10K`, `64MB`); Leerraum vor dem Suffix; `n` nach einer Zahl mit Nachkommateil oder Exponent; Suffixe, die etwas anderes als eine Zahl ergeben
- Strings mit drei Anführungszeichen als Begrenzer (`"""…"""`, `'''…'''`), Heredocs und Roh-Strings ohne Escape-Sequenzen
- eine Zeilenfortsetzung mit Leerraum zwischen `\` und Zeilenumbruch
- `\` vor beliebigen Zeichen (`\a` für `a`) und oktale Escape-Sequenzen (`\1`, `\012`)
- `+` als Vorzeichen, `.5`, `5.` sowie `Infinity` und `NaN` als Zahlen
- Nachkommateil oder Exponent bei hexadezimalen, oktalen und binären Zahlen
- Oktalzahlen mit bloßer führender Null (`0755`)
- Bezeichner mit anderen Zeichen als ASCII-Buchstaben und -Ziffern, `_`, `$` und den Buchstaben aus Latin-1 Supplement; Escape-Sequenzen und `-` in Bezeichnern; Normalisierung von Namen
- Zeichen als Leerraum, die ECMAScript nicht als Leerraum führt (etwa U+0085, U+180E, U+200B)
- U+2028 und U+2029 als Zeilenumbruch
- implizite Arrays auf oberster Ebene, mehrere Dokumente in einer Datei
- schachtelbare Kommentare
- zusätzliche Datentypen (Datum, Binärdaten, `undefined`), Verweise auf Teile eines Dokuments, Includes an beliebigen Stellen, Ausdrücke

## Anhang D – Entwurfsentscheidungen

Informativ. Festlegungen an Stellen, an denen mehrere Lösungen möglich waren, mit Begründung.

| Thema | Entscheidung | Begründung |
|---|---|---|
| Leeres Dokument | Fehler, nicht `{}` | Eine leere oder abgeschnittene Datei soll auffallen; JSON verhält sich ebenso. |
| Doppelte Namen | das letzte Member gilt; im Strict-Modus verboten | Ein festes Verhalten verhindert, dass zwei Parser dasselbe Dokument verschieden lesen. Ein generelles Verbot würde gültige JSON-Texte ausschließen und K1 verletzen. |
| Zeichen in Bezeichnern | ASCII-Buchstaben, Ziffern, `_`, `$`, `µ` und die Buchstaben U+00C0 bis U+00FF ohne `×` und `÷` | Namen in vielen westeuropäischen Sprachen, etwa `größe` oder `café`, lassen sich ohne Anführungszeichen schreiben, wie in ECMAScript. `ª`, `º` und `·`, die ECMAScript ebenfalls zulässt, bleiben weg: Sie sind keine Buchstaben eines Worts, werden in Namen selten gebraucht und sind leicht mit hochgestellten Zeichen, dem Gradzeichen oder anderen Punkten zu verwechseln. Eine feste Liste aus einem einzigen Unicode-Block braucht keine Unicode-Tabellen und ändert sich nicht mit neuen Unicode-Versionen. Andere Zeichen, auch kombinierende Zeichen, brauchen Anführungszeichen, und Namen werden nicht normalisiert. Namen wie `max-age` stehen in Anführungszeichen. |
| `true`, `false`, `null`, `nil` als Name | erlaubt | An Namensposition eindeutig; vermeidet eine Sonderregel. |
| Zeilenumbruch | LF, CR oder CR LF; CR LF zählt als einer | Eine einzige, überall gleiche Definition für Trenner, Zeilenkommentare und Strings, unabhängig von den Zeilenenden der Datei. |
| Zusätzlicher Leerraum | alle Leerraum- und Zeilenendezeichen von ECMAScript 2026; Trenner ist nur der Zeilenumbruch nach 5.2 | So hängt die Struktur eines Dokuments nicht von Zeichen ab, die Editoren uneinheitlich oder gar nicht darstellen. Anders als in ECMAScript sind U+2028 und U+2029 deshalb keine Zeilenenden. |
| Kategorie Zs | als feste Liste aufgeführt | Parser brauchen keine Unicode-Tabellen, und die Grammatik ändert sich nicht mit neuen Unicode-Versionen. ECMAScript verweist dagegen auf die jeweils aktuelle Kategorie. |
| U+FEFF | überall Leerraum, nicht nur am Dokumentanfang | Folgt aus der Übernahme der ECMAScript-Leerraumzeichen. Eine Sonderregel für das BOM am Dokumentanfang ist damit nicht nötig. |
| Zeilenumbruch im Blockkommentar | zählt nicht als Trenner | Ein Blockkommentar verhält sich überall wie ein Leerzeichen und ändert nie die Struktur. Die Trennerregel ist damit vollständig in ABNF ausdrückbar. |
| Zusätzliche Escape-Sequenzen | nur `\'`, `\v`, `\0`, `\xHH`, `\u{…}` und die Zeilenfortsetzung | `\` vor beliebigen Zeichen gibt es nicht: Ein Tippfehler wie `\N` statt `\n` wird als Fehler gemeldet, statt stillschweigend `N` zu ergeben. |
| Strings über mehrere Zeilen | in beiden String-Formen erlaubt; keine eigene Schreibweise wie `"""` | Eine einzige String-Schreibweise ist leichter zu lernen und zu lesen. Ein unmaskierter Zeilenumbruch in einem String ist in JSON ein Fehler, daher ändert kein JSON-Text seine Bedeutung. |
| Strings: Ende | am ersten nicht maskierten Begrenzer, wie in JSON | Einfache Regel. Ein vergessenes schließendes Anführungszeichen fällt deshalb nicht am Zeilenende auf (Abschnitt 13). |
| Strings: Zeilenenden | CR und CR LF werden zu LF | Der Wert hängt nicht davon ab, mit welchen Zeilenenden die Datei gespeichert ist. |
| Strings: Tabulator und Zeilenumbrüche | unmaskiert erlaubt; alle anderen Steuerzeichen, auch U+000B und U+000C, müssen maskiert werden | Mit Tabulatoren eingerückter Text soll kein Fehler sein. Vertikaltabulator und Seitenvorschub sind in den meisten Editoren unsichtbar und ließen den Wert vom Schriftbild abweichen. |
| Strings: Leerraum am Zeilenende | unmaskierter Leerraum vor einem Zeilenumbruch wird immer entfernt | Unsichtbare Zeichen am Zeilenende sollen den Wert nicht verändern. Vor dem schließenden Begrenzer ist Leerraum sichtbar und bleibt deshalb erhalten. |
| Strings: Einrückung | die kleinste Einrückung wird entfernt, wenn der String mit einer Leerzeile beginnt | Der Text kann mit der umgebenden Struktur eingerückt werden. Wer die Einrückung behalten will, beginnt den Text in der Zeile des öffnenden Begrenzers. |
| Strings: letzte Zeile | zählt bei der kleinsten Einrückung immer mit | Über die Stellung des schließenden Begrenzers lässt sich festlegen, wie viel Einrückung erhalten bleibt. |
| Strings: Leerzeilen | zählen bei der kleinsten Einrückung nicht mit | Sonst wäre die kleinste Einrückung bei jedem Text mit Absätzen null. |
| Strings: Maß der Einrückung | Anzahl der Zeichen; ein Tabulator zählt als eines; die entfernten Zeichen müssen in allen Zeilen gleich sein | Keine Annahme über Tabulatorbreiten. Gemischte Einrückung wird als Fehler gemeldet, statt den Text unbemerkt zu verschieben. |
| Strings: was als Leerraum gilt | nur unmaskierte Leerzeichen und Tabulatoren | Andere Leerraumzeichen können zum Text gehören, etwa U+3000 am Absatzanfang oder U+00A0 am Zeilenende. |
| Strings über mehrere Zeilen als Name | erlaubt | Ein Name ist ein String wie jeder andere. Eine Sonderregel würde die String-Formen je nach Position unterscheiden. |
| Zeilenfortsetzung und Einrückung | das `\` und sein Zeilenumbruch werden erst beim Zusammensetzen entfernt (Schritt 4 in 8.3); vorher wird die Einrückung der folgenden Zeile wie die jeder anderen Zeile entfernt | Eine lange Zeile lässt sich umbrechen und mit dem umgebenden Text einrücken. Leerraum vor dem `\` ist sichtbar und bleibt erhalten. Java-Textblöcke folgen demselben Modell. |
| Zeilenfortsetzung: Leerraum nach `\` | Fehler | Sonst entschiede unsichtbarer Leerraum am Zeilenende darüber, ob der Zeilenumbruch zum Wert gehört. |
| Zeilenfortsetzung: erste Zeile | eine erste Zeile, die das `\` einer Zeilenfortsetzung enthält, ist nicht leer; es wird keine Einrückung entfernt | Das `\` ist bis Schritt 4 ein Zeichen seiner Zeile, wie jede andere Escape-Sequenz. Eine Sonderregel ist nicht nötig. |
| `\u{…}` | kein Wert im Surrogatbereich | Die Schreibweise steht für einen Codepunkt; einzelne Surrogate bleiben der aus JSON übernommenen Form `\uXXXX` vorbehalten. |
| Nicht dezimale Zahlen | exakt oder Fehler | Bei Bitmasken und Adressen zählt jede Stelle; stilles Runden wäre ein schwer zu findender Fehler. |
| Präfixe `0x`/`0o`/`0b` | Groß- und Kleinschreibung gleichwertig | Einheitlich mit `e`/`E` im Exponenten. Kleinschreibung wird empfohlen. |
| Vorzeichen bei nicht dezimalen Zahlen | `-` erlaubt, `+` nicht | Einheitlich mit der JSON-Regel `[ minus ]`. |
| `_` in Zahlen | einzeln, nur zwischen zwei Ziffern | Einfache, leicht prüfbare Regel. |
| Werte ohne Anführungszeichen | nur `true`, `false`, `null` und `nil` | Ein Tippfehler wie `ture` wird als Fehler gemeldet, statt als String gelesen zu werden. |
| `true`, `false`, `null` | fest vordefiniert, nicht änderbar | Sonst könnte ein gültiger JSON-Text seine Bedeutung ändern (K2). |
| `nil` | eine andere Schreibweise für `null`, fest in der Grammatik | Viele Programmiersprachen schreiben den Nullwert als `nil`. `nil` ist in JSON ein Syntaxfehler, deshalb ändert kein JSON-Text seine Bedeutung (K1, K2). |
| Keine Definitionen | weder das Dokument noch die Anwendung können Werte definieren | Der Wert eines Dokuments lässt sich aus seinem Text ablesen, ohne Definitionen aufzulösen, und zwei Parser können dasselbe Dokument nicht verschieden lesen. Der einzige Teil eines Werts, der nicht aus dem Text stammt, ist der Basiswert von `%extends` (6.6), und er wird als Ganzes übernommen. |
| Suffixe: Schreibweise | eine feste Liste in der Grammatik; nur Kleinbuchstaben, genau eine Schreibweise je Suffix | Ein Leser erkennt jedes Suffix ohne eine Liste abweichender Schreibweisen, und ein Parser braucht keine Zeichenregeln für Suffixe. Kein Suffix beginnt mit `a`–`f`, `o`, `x` oder `_`, sodass Hexadezimalziffern, Exponent, Zahlenpräfixe und Zifferngruppierung eindeutig bleiben. Jedes andere Zeichen nach einer Zahl braucht einen Trenner und bleibt ein Fehler; spätere Versionen können deshalb Suffixe hinzufügen, ohne den Wert eines gültigen Dokuments zu ändern. |
| Suffix `m` | Zahl mal 1000000 | Große Zahlen werden ebenso kurz geschrieben wie mit `k`. Die längste Übereinstimmung unterscheidet `m` von `mb`, `ms` und `min`. |
| Suffix `n` | nur nach einer ganzen Zahl, nicht nach einem Nachkommateil oder Exponenten | Wie in ECMAScript, wo `n` ein ganzzahliges Literal (BigInt) kennzeichnet und `1.5n` und `1e3n` ebenfalls Fehler sind. |
| Suffixe: Festlegung | ausschließlich durch diese Spezifikation; keine eigenen Suffixe | Eine Zahl mit Suffix hat bei jedem Parser denselben Wert, und ein Parser führt keine Umrechnungsfunktionen der Anwendung aus. |
| Suffixe ohne Wirkung | `s` und `n` lassen den Wert unverändert | Eine Zeitangabe kann mit ihrer Einheit und eine ganze Zahl in der aus ECMAScript gewohnten Form geschrieben werden, ohne dass sich ihr Wert ändert. |
| Suffix: Ergebnis | immer eine Zahl | Ein Suffix rechnet um; es erzeugt keinen anderen Datentyp. |
| Suffix: Genauigkeit | exaktes Ergebnis | `0.1kb` soll `102.4` und `100ms` soll `0.1` ergeben, unabhängig von der Gleitkommaarithmetik des Parsers. |
| Direktiven: Schreibweise | `%strict` und `%extends`, jeweils mit `:` und ihrem Wert, fest in der Grammatik | `%` kommt in JSON außerhalb von Strings nicht vor, deshalb ändert kein JSON-Text seine Bedeutung (K1, K2). Der `:` entspricht der Schreibweise eines Members. Jeder andere Text nach einem `%` ist ein Fehler; spätere Versionen können deshalb Direktiven hinzufügen, ohne den Wert eines gültigen Dokuments zu ändern. |
| Direktiven: Position | nur auf oberster Ebene, vor dem Inhalt; in beliebiger Reihenfolge | Leser und Parser wissen, ob der Strict-Modus gilt und welche Basis das Dokument erweitert, bevor der Inhalt beginnt. Die Reihenfolge der beiden Direktiven ändert den Wert nicht. |
| Direktiven: welche es gibt | nur `%strict` und `%extends`; Parser und Anwendung können keine hinzufügen | Jedes Dokument wird von jedem Parser, der die Direktiven unterstützt, gleich gelesen. |
| `%extends`: Zweck | ein Dokument erweitert einen Basiswert nach JSON Merge Patch [RFC7396] | Konfigurationsdateien unterscheiden sich oft nur in wenigen Werten von einer gemeinsamen Basis. JSON Merge Patch ist ein veröffentlichter, einfacher Standard; er arbeitet auf dem JSON-Datenmodell, sodass die Basis aus JSON, XTJSON oder einem anderen Format stammen kann und das Ergebnis wieder ein JSON-Wert ist. |
| `%extends`: Auflösung | einem Resolver der Anwendung überlassen; Unterstützung optional | Wie aus einem Verweis ein Wert wird, hängt von der Umgebung ab (Dateien, Netz, Pakete) und von Sicherheitsregeln, die nur die Anwendung kennt. Die Spezifikation legt nur die Zusammenführung fest, sodass das Ergebnis bei gleichem Basiswert mit jedem Parser gleich ist. Ein Parser ohne Resolver meldet einen Fehler, statt die Basis zu übergehen. |
| `%extends`: Wert | ein String; empfohlen wird eine URI-Referenz | Eine URI deckt lokale Dateien ebenso ab wie URLs. Ein String kann jedes Zeichen enthalten. |
| `%extends`: `null` | entfernt ein Member, wie in RFC 7396; das gilt auch für `nil` | `nil` und `null` bezeichnen überall denselben Wert. Eine Abweichung würde das Ergebnis von anderen Umsetzungen von JSON Merge Patch unterscheiden. Ein Member mit dem Wert `null` lässt sich in einem Dokument mit `%extends` daher nicht setzen. |
| `%extends`: Anzahl | höchstens einmal | Mehrere Basen bräuchten Regeln für ihre Reihenfolge und für Konflikte. Ein Basiswert kann selbst aus einem Dokument mit `%extends` stammen. |
| Strict-Modus und `%extends` | die Verbote zu Namen, String-Werten und zum Wurzelwert gelten auch für das Ergebnis | Das JSON-Äquivalent eines Dokuments, das im Strict-Modus gültig ist, bleibt eine I-JSON-Nachricht, gleich was der Basiswert enthält. |
| Strict-Modus: Wurzelwert | ein Objekt oder ein Array | [I-JSON] empfiehlt das nur. Ein einzelner String oder eine einzelne Zahl als Wurzelwert lässt sich später nicht um weitere Member erweitern; im Strict-Modus wird die Empfehlung zu einer Regel, die ein Parser prüfen kann. |
| Strict-Modus: Unterstützung | jeder Parser muss ihn anbieten | Sonst nähme ein Parser ein Dokument mit `%strict: true` an, das ein anderer ablehnt; jedes Dokument bleibt portabel. |
| `%strict`: Wert | `true` oder `false`; höchstens einmal | Ein Schalter hat zwei Zustände. Ein zweites `%strict` könnte das erste nur wiederholen oder ihm widersprechen. |
| `%strict: false` und die Anwendung | ein Fehler, wenn die Anwendung den Strict-Modus verlangt | Ein Dokument kann die Prüfungen der Anwendung verschärfen, aber nicht abschalten. Ein Widerspruch wird gemeldet, statt stillschweigend eine Seite vorzuziehen. |

## Referenzen

**Normativ**

- **[RFC8259]** T. Bray (Hrsg.), „The JavaScript Object Notation (JSON) Data Interchange Format“, STD 90, RFC 8259, Dezember 2017. <https://www.ietf.org/ietf-ftp/rfc/std/std90.txt>
- **[ECMA-404]** Ecma International, „The JSON Data Interchange Syntax“, 2. Ausgabe, Dezember 2017. <https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf>
- **[I-JSON]** T. Bray (Hrsg.), „The I-JSON Message Format“, draft-ietf-json-i-json-06, Januar 2015 (veröffentlicht als RFC 7493). <https://www.ietf.org/archive/id/draft-ietf-json-i-json-06.txt>
- **[ECMA-262]** Ecma International, „ECMAScript 2026 Language Specification“, ECMA-262, 17. Ausgabe, Juni 2026. <https://262.ecma-international.org/17.0/index.html> – maßgeblich nur für die in 5.1 und 8.2 übernommenen Leerraumzeichen und Escape-Sequenzen.
- **[RFC5234]** D. Crocker, P. Overell, „Augmented BNF for Syntax Specifications: ABNF“, STD 68, RFC 5234.
- **[RFC3629]** F. Yergeau, „UTF-8, a transformation format of ISO 10646“, STD 63, RFC 3629.
- **[RFC3986]** T. Berners-Lee, R. Fielding, L. Masinter, „Uniform Resource Identifier (URI): Generic Syntax“, STD 66, RFC 3986.
- **[RFC7396]** P. Hoffman, J. Snell, „JSON Merge Patch“, RFC 7396, Oktober 2014; ersetzt RFC 7386 mit demselben Algorithmus.
- **[RFC2119]**, **[RFC8174]** Schlüsselwörter zur Kennzeichnung von Anforderungsstufen, BCP 14.

**Informativ**

- ECMA-262, 1. Ausgabe (Juni 1997), 3. Ausgabe (Dezember 1999), 5. Ausgabe (Dezember 2009) und 6. Ausgabe (Juni 2015, „ECMAScript 2015“) – für die Angaben in den Spalten „Herkunft“; in den Tabellen als ES1, ES3, ES5 und ES2015 bezeichnet.
- RFC 3339, „Date and Time on the Internet: Timestamps“.
- RFC 4648, „The Base16, Base32, and Base64 Data Encodings“.

## Änderungen

**Entwurf 0.7**

- 6.3: Benannte Werte entfallen. Werte ohne Anführungszeichen sind nur `true`, `false`, `null` und das neue `nil`, eine andere Schreibweise für `null`; sie stehen direkt in der Regel `value`. Abschnitt 6.3 übernimmt die Regeln aus 6.4.
- 6.4: „Direktiven“ (bisher 6.5). Es gibt genau die Direktiven `%strict` und `%extends`, fest in der Grammatik; jede kommt höchstens einmal vor, in beliebiger Reihenfolge. Die Direktiven `%define` und `%version` entfallen.
- 6.5: „Die Direktive `%strict`“ (bisher 6.8); ihr Wert ist `true` oder `false`.
- 6.6 (neu): `%extends` erweitert einen Basiswert nach JSON Merge Patch [RFC7396]. Ein Resolver der Anwendung liefert den Basiswert zum String der Direktive. Die Unterstützung ist optional; ohne Resolver ist ein Dokument mit `%extends` ein Fehler. Die Abschnitte 6.7 und 6.8 entfallen.
- 7.2: Bezeichner dürfen zusätzlich `µ` (U+00B5) und die Buchstaben U+00C0 bis U+00FF aus Latin-1 Supplement außer `×` und `÷` enthalten. Die Regel `identifier` entfällt; ihre Zeichen sind Teil der Regel `name`.
- 9.5: Die Suffixe stehen fest in der Grammatik (Regel `suffix` und `n` in der Regel `number`). Die Regeln zu den Zeichen eines Suffixes entfallen; ein Zeichen direkt nach einem Suffix beginnt ein neues Token.
- 9.5: Jedes Suffix hat eine einzige Schreibweise, in Kleinbuchstaben. Die Suffixe `K`, `Kb`, `kB`, `KB`, `Mb`, `mB`, `MB`, `px` und `L` entfallen.
- 9.5: Neues Suffix `m` (mal 1000000).
- 9.5: `n` ist nur nach einer ganzen Zahl erlaubt, nicht nach einer Zahl mit Nachkommateil oder Exponent.
- 6.1, 8.2, 9, Anhang A: Die Grammatik ist vereinfacht. Die Escape-Sequenzen stehen direkt in `escape-seq`, die hexadezimalen, oktalen und binären Zahlen in `radix-int`; die Regeln `root-members`, `named-value`, `identifier` und die Hilfsregeln der Escape-Sequenzen und Suffixe entfallen.
- 10, 11, 12, 13: Das JSON-Äquivalent eines Dokuments mit `%extends` hängt von seinem Basiswert ab, und ein solches Dokument ist nur zusammen mit ihm portabel. Der Strict-Modus prüft auch das Ergebnis der Zusammenführung. Neue Sicherheitsaspekte zu Resolvern und zu ähnlichen Zeichen in Namen. Die Grenze für die Größe des Werts nach dem Ersetzen benannter Werte und die Regeln für die Werte von Direktiven entfallen.
- 1, 2, 3, 5.1, 9.1 und Anhänge B bis D sind an diese Änderungen angepasst; Abschnitt 6 heißt jetzt „Dokument, Direktiven, Wurzelobjekt und Werte“.

**Entwurf 0.6**

- 6.5 (neu): Direktiven. Eine Direktive am Dokumentanfang beginnt mit `%`, unmittelbar gefolgt von ihrem Namen und `:`, und dann einem Wert, wahlweise mit vorangestelltem Bezeichner und `=`. Direktiven werden wie Elemente getrennt. Es gibt genau die Direktiven `%define`, `%version` und `%strict`; jede andere Direktive ist ein Fehler. Die Werte von Direktiven halten immer die Verbote aus Abschnitt 12 zu Namen, String-Werten und doppelten Namen ein, und eine Direktive wirkt sich nicht auf die Direktiven vor ihr aus.
- 6.4, 6.6 (neu): Benannte Werte werden nur im Dokument definiert, mit `%define`; die Anwendung kann keine benannten Werte mehr definieren. Einem benannten Wert kann ein Objekt oder ein Array zugeordnet werden. Eine Definition kann die benannten Werte verwenden, die vor ihr definiert sind; eine zweite Definition desselben benannten Werts ist ein Fehler.
- 6.7 (neu): `%version` gibt die Version dieser Spezifikation an und, mit einem Bezeichner, Versionen von anderem, etwa eines Schemas. Ihr Wert ist ein String oder eine Zahl, auch mit Suffix oder als benannter Wert.
- 6.8 (neu): `%strict: true` lässt einen Parser den Inhalt des Dokuments im Strict-Modus lesen. `%strict: false` ist ein Fehler, wenn die Anwendung den Strict-Modus verlangt.
- 6.1, 6.2: Ein Dokument beginnt mit optionalen Direktiven. Abschnitt 6 heißt jetzt „Dokument, Direktiven, Wurzelobjekt und Werte“.
- 11, 12: Jedes konforme Dokument ist portabel. Parser dürfen die Größe des Werts nach dem Ersetzen der benannten Werte begrenzen. Aus dem I-JSON-Profil wird der Strict-Modus, den jeder Parser anbieten muss. Im Strict-Modus muss der Wurzelwert ein Objekt oder ein Array sein. Abschnitt 12 heißt jetzt „Strict-Modus“.
- 1, 2, 3, 7.2, 10, 13 und Anhänge A bis D sind an diese Änderungen angepasst.

**Entwurf 0.5**

- 8: Es gibt nur noch eine Art von String, in `"` oder in `'`. Jeder String darf über mehrere Zeilen reichen; Zeilenumbrüche (LF, CR, CR LF) und Tabulatoren dürfen unmaskiert stehen, alle anderen Steuerzeichen, auch U+000B und U+000C, müssen weiterhin maskiert werden. Die Regeln zum Leerraum am Zeilenende und zum Entfernen der Einrückung (8.3) gelten für jeden String. Strings mit `"""` und `'''` gibt es nicht mehr; eine solche Schreibweise ist ein Fehler.
- 8.2: Neue Escape-Sequenz: Ein `\` unmittelbar vor einem Zeilenumbruch (Zeilenfortsetzung) trägt nichts zum Wert bei. Leerraum zwischen `\` und Zeilenumbruch ist ein Fehler. Abschnitt 8.3 legt fest, wie sich eine Zeilenfortsetzung auf die Einrückung der folgenden Zeile auswirkt.
- 6.2, 7.2: Jeder String ist als Name erlaubt, auch einer, der über mehrere Zeilen reicht.
- Die Abschnitte 8.1 und 8.3 heißen jetzt „Begrenzer und Zeichen“ und „Zeilenumbrüche in Strings“.
- 1, 2, 3, 5.1, 5.2, 10, 13 und die Anhänge A bis D sind an diese Änderungen angepasst.

**Entwurf 0.4**

- 6.4: Eine eigene Definition kann einem benannten Wert kein Objekt und kein Array mehr zuordnen; zulässig sind String, Zahl, `true`, `false` und `null`.
- 9.5: Suffixe legt nur noch diese Spezifikation fest; eigene Suffixe der Anwendung gibt es nicht mehr.
- 9.5: Ein Suffix besteht aus denselben Zeichen wie ein Bezeichner und ist nicht mehr auf zwei Zeichen begrenzt; es beginnt weiterhin nicht mit `a`–`f`, `o` oder `x`, in beiden Schreibweisen, und auch nicht mit `_`. `%` ist in einem Suffix nicht mehr erlaubt; Ziffern und, außer am Anfang, `_` sind es jetzt.
- 9.5: Neue Suffixe `ms` (geteilt durch 1000), `min` (mal 60), `h` (mal 3600) und `pct` (geteilt durch 100) sowie `s`, `px`, `L` und `n` (ohne Wirkung auf den Wert). Neue Übersichtstabelle aller Suffixe.
- 2, 3, 10, 11, 13: Der Begriff „Definition“ bezieht sich nur noch auf benannte Werte. Ein konformes Dokument verwendet nur Suffixe aus 9.5; ob ein Dokument portabel ist, hängt nur noch von seinen benannten Werten ab.
- Anhänge A bis D sind an diese Änderungen angepasst.

**Entwurf 0.3**

- Durchsicht ohne Änderung der Syntax; Formulierungen präzisiert.
- Abschnitt 7.2 heißt jetzt „Namen“. Der Begriff „Bezeichner“ ist in Abschnitt 2 definiert.
- 5.1: Leerraum ist auch zwischen Zahl und Suffix ein Fehler; die Aussage zu „Literalen“ ist an die benannten Werte angepasst.
- 6.2: Nur ein einzeiliger String oder ein Bezeichner kann ein implizites Wurzelobjekt einleiten.
- 6.4: Definitionen gelten unverändert für das gesamte Dokument.
- 7.2 und 10: Die Regel „das letzte Member gilt“ ist auf die Reihenfolge im Dokument bezogen, gilt ausdrücklich auch im impliziten Wurzelobjekt und für das JSON-Äquivalent.
- 8.3: Die Bedingung an gleiche Einrückung betrifft nur Zeilen, aus denen Zeichen entfernt werden.
- 9.1, 9.5, 11, 13: kleinere Klarstellungen zu Suffixen, zur Genauigkeit eigener Umrechnungsfunktionen, zu Erzeugern und zu doppelten Namen.
- Die Spezifikation liegt zusätzlich auf Englisch vor (`xtjson-spec-en.md`); beide Fassungen beschreiben dieselbe Syntax und dasselbe Verhalten.

**Entwurf 0.2**

- Neu: benannte Werte (6.3, 6.4). Ein Bezeichner an Wertposition ist ein Alias für einen JSON-Wert. `true`, `false` und `null` sind fest vordefiniert; weitere benannte Werte definiert die Anwendung im Parser. Nicht definierte benannte Werte sind ein Fehler.
- Neu: Zahlen-Suffixe aus einem oder zwei Zeichen (9.5). Vordefiniert sind `k`/`K` (mal 1000), `kb`/`Kb`/`kB`/`KB` (mal 1024) und `mb`/`Mb`/`mB`/`MB` (mal 1048576); weitere Suffixe definiert die Anwendung zusammen mit einer Umrechnungsfunktion. Nicht definierte Suffixe sind ein Fehler. Ein Suffix beginnt nicht mit `a`–`f`, `o` oder `x`, in beiden Schreibweisen.
- Die Grammatik führt `true`, `false` und `null` nicht mehr als eigene Regeln, sondern als `named-value`.
- Konformität: neue Begriffe „gültig bezüglich einer Menge von Definitionen“ und „portabel“; neue Pflichten des Parsers zu Definitionen (11).
- Abschnitt 6 heißt jetzt „Dokument, Wurzelobjekt und Werte“.
- Anhang B.3: Das Beispiel „mehrzeiliger String als Name“ stand in der falschen Tabelle.

**Entwurf 0.1** – erste Fassung.
