# XTJSON

**Spezifikation, Entwurf 0.5** · Stand: 16. November 2026

## Inhalt

1. [Einleitung](#1-einleitung)
2. [Konventionen und Begriffe](#2-konventionen-und-begriffe)
3. [Kompatibilität](#3-kompatibilität)
4. [Kodierung](#4-kodierung)
5. [Leerraum, Zeilenumbrüche und Kommentare](#5-leerraum-zeilenumbrüche-und-kommentare)
6. [Dokument, Wurzelobjekt und Werte](#6-dokument-wurzelobjekt-und-werte)
7. [Objekte, Arrays und Trenner](#7-objekte-arrays-und-trenner)
8. [Strings](#8-strings)
9. [Zahlen](#9-zahlen)
10. [Abbildung auf JSON](#10-abbildung-auf-json)
11. [Konformität](#11-konformität)
12. [I-JSON-Profil](#12-i-json-profil)
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
| E12 | Benannte Werte: Bezeichner als Wert, vom Parser definierte Aliase für JSON-Werte (`nil`) | [6.4](#64-benannte-werte) |
| E13 | Zahlen-Suffixe (`10k`, `64mb`, `50pct`) | [9.5](#95-zahlen-suffixe) |

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
| Bezeichner | eine Zeichenfolge nach der Regel `identifier` (7.2); an Namensposition ein Name, an Wertposition ein benannter Wert |
| Leerraumzeichen | eines der Zeichen aus der Tabelle in 5.1 |
| Zeilenumbruch | U+000A, U+000D oder die Folge U+000D U+000A (5.2) |
| maskiert, unmaskiert | maskiert: als Escape-Sequenz nach 8.2 geschrieben; unmaskiert: als das Zeichen selbst geschrieben |
| Zeilenfortsetzung | ein `\` unmittelbar vor einem Zeilenumbruch in einem String; sie trägt nichts zum Wert bei (8.2) |
| Definition | die Zuordnung eines benannten Werts zu einem JSON-Wert (6.4) |
| vordefiniert | durch diese Spezifikation festgelegt und nicht änderbar |
| eigene Definition | eine Definition, die die Anwendung dem Parser mitgibt |
| JSON-Äquivalent | der JSON-Text, auf den ein XTJSON-Dokument nach [Abschnitt 10](#10-abbildung-auf-json) abgebildet wird |

## 3. Kompatibilität

Dieser Abschnitt ist normativ. Er legt fest, was „voll kompatibel“ zu [RFC8259] (STD 90), [ECMA-404] und [I-JSON] bedeutet.

**K1 – Syntaktische Obermenge.** Jeder in UTF-8 kodierte JSON-Text nach [RFC8259] und [ECMA-404] ist ein gültiges XTJSON-Dokument. Dasselbe gilt für jede I-JSON-Nachricht nach [I-JSON].

**K2 – Bedeutungserhalt.** Ein JSON-Text bezeichnet als XTJSON-Dokument denselben Wert wie als JSON-Text. Keine Erweiterung ändert die Bedeutung eines Textes, der bereits gültiges JSON ist.

**K3 – Unverändertes Datenmodell.** Jedes XTJSON-Dokument besitzt, bezogen auf die Definitionen, mit denen es gelesen wird (6.4), ein JSON-Äquivalent ([Abschnitt 10](#10-abbildung-auf-json)), das seinen Wert festlegt. Benannte Werte und Zahlen-Suffixe sind nur andere Schreibweisen für JSON-Werte. Ein Wert, der sich in JSON nicht darstellen lässt, lässt sich auch in XTJSON nicht darstellen.

**K4 – Übernommene Semantik.** Alles, was diese Spezifikation nicht ausdrücklich erweitert, gilt wie in [RFC8259]: die Bedeutung von `true`, `false` und `null`, die Escape-Sequenzen von JSON, der Umgang mit Zahlenbereich und -genauigkeit, die Bedeutungslosigkeit der Member-Reihenfolge und der String-Vergleich.

**K5 – Abgrenzung.** Ein XTJSON-Dokument, das mindestens eine der Erweiterungen E1–E13 nutzt, ist **kein** JSON-Text. Daraus folgt:

- Solche Dokumente DÜRFEN NICHT mit dem Medientyp `application/json` gekennzeichnet oder an Empfänger gesendet werden, die JSON erwarten.
- Ein XTJSON-Parser ist kein konformer Prozessor im Sinne von [ECMA-404], weil dieser nicht konforme Eingaben nicht akzeptieren soll. Er ist jedoch ein zulässiger Parser im Sinne von [RFC8259] Abschnitt 9, der Parsern Erweiterungen ausdrücklich gestattet.
- Wer JSON erzeugt, MUSS strikt die JSON-Grammatik einhalten ([RFC8259] Abschnitt 10). Die Brücke bildet die Abbildung in Abschnitt 10.

Informativ – warum K1 und K2 gelten: Jede Erweiterung belegt ausschließlich Schreibweisen, die in JSON ein Syntaxfehler sind. `/`, `#`, `'` sowie die zusätzlichen Leerraumzeichen (5.1) kommen in JSON außerhalb von Strings nicht vor; die zusätzlichen Escape-Sequenzen sind in JSON ungültige `\`-Folgen; ein unmaskierter Zeilenumbruch oder Tabulator in einem String ist in JSON ungültig; ein Name ohne Anführungszeichen, ein Komma vor einer schließenden Klammer, ein `:` nach dem Wurzelwert, zwei Elemente ohne Komma sowie `0x`, `0o`, `0b` und `_` in Zahlen sind in JSON ungültig; ebenso ein Bezeichner an Wertposition außer `true`, `false` und `null` und ein Suffix direkt nach einer Zahl. Die drei Literale von JSON sind fest vordefiniert und nicht änderbar, und kein Suffix beginnt mit `e` oder `E`, sodass der Exponent einer JSON-Zahl nie als Suffix gelesen wird. Ein String ohne Zeilenumbruch behält seinen JSON-Wert, weil die Regeln aus 8.3 nur Strings verändern, die über mehrere Zeilen reichen. Die Zeilenumbruch-Regel (E5) greift nur dort, wo JSON zwingend ein Komma verlangt; überall sonst bleibt ein Zeilenumbruch bedeutungsloser Leerraum.

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

## 6. Dokument, Wurzelobjekt und Werte

### 6.1 Dokument

```abnf
XTJSON-text  = S ( value / root-members ) S [ line-comment ]
root-members = member-list
```

Ein Zeilenkommentar am Dokumentende braucht keinen abschließenden Zeilenumbruch.

Ein XTJSON-Dokument ist entweder ein einzelner Wert (wie in JSON) oder ein implizites Wurzelobjekt. Ein Dokument, das nur aus Leerraum und Kommentaren besteht, ist ein Fehler, so wie ein leerer Text kein JSON-Text ist.

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

**Erkennung.** Ein Parser entscheidet nach dem ersten Token: Ist es ein String oder ein Bezeichner und ist das nächste Token ein `:`, liegt ein implizites Wurzelobjekt vor. Andernfalls wird ein einzelner Wert gelesen. Da in JSON auf den Wurzelwert nie ein `:` folgt, wird kein JSON-Text umgedeutet.

### 6.3 Werte

```abnf
value        = object / array / string / number / named-value
named-value  = identifier
```

Ein Wert ist ein Objekt oder ein Array (Abschnitt 7), ein String (Abschnitt 8), eine Zahl (Abschnitt 9) oder ein benannter Wert (6.4). Die Literale `true`, `false` und `null` von JSON sind in XTJSON benannte Werte mit fester Bedeutung.

### 6.4 Benannte Werte

Ein benannter Wert ist ein Bezeichner (7.2) an Wertposition. Er besteht damit aus denselben Zeichen wie ein Name ohne Anführungszeichen. Er steht für den JSON-Wert, den ihm eine Definition zuordnet.

- **Vordefiniert** sind genau drei benannte Werte: `true`, `false` und `null`, mit der Bedeutung, die sie in JSON haben. Sie DÜRFEN NICHT umdefiniert, überschrieben oder entfernt werden.
- **Eigene Definitionen.** Die Anwendung kann dem Parser weitere benannte Werte mitgeben. Jede Definition ordnet einem Bezeichner genau einen JSON-Wert zu: einen String, eine Zahl, `true`, `false` oder `null`. Ein Objekt oder ein Array DARF NICHT zugeordnet werden.
- **Alias, kein Datentyp.** Im JSON-Äquivalent steht an der Stelle des benannten Werts der zugeordnete JSON-Wert. Ein benannter Wert ist nur eine andere Schreibweise für diesen Wert; neue Datentypen entstehen nicht.
- **Groß- und Kleinschreibung zählen.** `nil`, `Nil` und `NIL` sind drei verschiedene benannte Werte, und `True` ist nicht `true`.
- **Nicht definiert ist ein Fehler.** Ein Bezeichner an Wertposition, für den es keine Definition gibt, ist ein Fehler. Ein Parser DARF ihn NICHT ersatzweise als String oder auf andere Weise deuten.
- **Namensposition.** An Namensposition ist ein Bezeichner immer ein Name und nie ein benannter Wert (7.2): `{nil: nil}` hat den Namen `"nil"`.
- **Nicht Teil des Dokuments.** Definitionen gehören zur Konfiguration des Parsers. Ein Dokument kann selbst keine benannten Werte festlegen. Die Definitionen gelten unverändert für das gesamte Dokument.

Beispiele für eigene Definitionen:

| Benannter Wert | JSON-Wert |
|---|---|
| `nil` | `null` |
| `zero` | `0` |
| `unbekannt` | `"keine Angaben"` |

Mit diesen drei Definitionen gelesen:

```xtjson
{
  zweitname: nil
  kinder: zero
  beruf: unbekannt
  nil: "an Namensposition ein gewöhnlicher Name"
}
```

JSON-Äquivalent:

```json
{
  "zweitname": null,
  "kinder": 0,
  "beruf": "keine Angaben",
  "nil": "an Namensposition ein gewöhnlicher Name"
}
```

Ohne diese Definitionen ist dasselbe Dokument ein Fehler.

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
name         = string / identifier
identifier   = id-start *id-continue
id-start     = ALPHA / "_" / "$"
id-continue  = ALPHA / DIGIT / "_" / "$"
```

- Ein Name ist ein String (Abschnitt 8) oder ein Bezeichner. Wie jeder andere String darf ein Name über mehrere Zeilen reichen; sein Wert ergibt sich nach 8.3.
- Ein Bezeichner beginnt mit einem ASCII-Buchstaben, `_` oder `$`; danach sind zusätzlich ASCII-Ziffern erlaubt. Als Name steht er für exakt die geschriebene Zeichenfolge; Escape-Sequenzen gibt es in Bezeichnern nicht.
- Jeder andere Name MUSS in Anführungszeichen stehen: Namen mit Leerzeichen, Bindestrichen, Punkten oder Nicht-ASCII-Zeichen, Namen, die mit einer Ziffer beginnen, und der leere Name.
- `true`, `false`, `null` und alle anderen benannten Werte (6.4) sind als Bezeichner an Namensposition zulässig und ergeben dort gewöhnliche Namen (`"true"`, `"nil"`). An Namensposition steht nie ein Wert, daher ist das eindeutig.
- An Wertposition ist ein Bezeichner ein benannter Wert (6.4). Frei wählbare Werte ohne Anführungszeichen gibt es nicht: `farbe: rot` ist nur gültig, wenn `rot` definiert ist.
- Die Schreibweise ist für die Identität eines Namens unerheblich: `a`, `"a"`, `'a'` und `"\u0061"` bezeichnen denselben Namen.

```xtjson
{
  $schema: "https://example.org/schema.json",
  max_age: 3600,
  "max-age": 3600,
  _intern: true,
  "mit leerzeichen": 1,
  "2fa": false
}
```

**Doppelte Namen.** Wie in [RFC8259] SOLLTEN die Namen innerhalb eines Objekts eindeutig sein. Kommt ein Name in einem Objekt mehrfach vor, gilt das im Dokument zuletzt stehende Member mit diesem Namen; die früheren werden verworfen. Das gilt auch für das implizite Wurzelobjekt. Ein Parser MUSS sich so verhalten und SOLLTE auf doppelte Namen hinweisen. Im I-JSON-Profil sind doppelte Namen verboten ([Abschnitt 12](#12-i-json-profil)).

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
escape-seq       = %x5C ( char-escape / null-escape / hex-escape /
                          unicode-escape / codepoint-escape / newline )
codepoint-escape = %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}"
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
number   = [ minus ] ( hex-int / oct-int / bin-int / decimal ) [ suffix ]
```

### 9.1 Dezimalzahlen

```abnf
decimal  = int [ frac ] [ exp ]
int      = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac     = "." digits
exp      = e [ minus / plus ] digits
digits   = DIGIT *( [ "_" ] DIGIT )
```

Ohne `_` und ohne Suffix ist das exakt die Zahlengrammatik von JSON. Insbesondere bleiben ungültig: führende Nullen (`0755`), ein führendes `+`, ein fehlender Ganzzahl- oder Nachkommateil (`.5`, `5.`). `Infinity` und `NaN` sind keine Zahlen; als Bezeichner sind sie benannte Werte und ohne Definition ein Fehler (6.4).

### 9.2 Hexadezimal, oktal, binär

```abnf
hex-int  = %x30 ( %x78 / %x58 ) HEXDIG    *( [ "_" ] HEXDIG )      ; 0x 0X
oct-int  = %x30 ( %x6F / %x4F ) oct-digit *( [ "_" ] oct-digit )   ; 0o 0O
bin-int  = %x30 ( %x62 / %x42 ) BIT       *( [ "_" ] BIT )         ; 0b 0B
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
suffix        = suffix-start *id-continue
suffix-start  = %x67-6E / %x70-77 / %x79-7A /     ; g-n p-w y z
                %x47-4E / %x50-57 / %x59-5A /     ; G-N P-W Y Z
                "$"
```

An eine Zahl darf ein Suffix angehängt werden. Das Suffix steht für eine Umrechnung: Sie wird auf den Wert der Zahl einschließlich des Vorzeichens angewendet und ergibt eine Zahl. Im JSON-Äquivalent steht an der Stelle der Zahl mit Suffix das Ergebnis. Alle Suffixe sind vordefiniert; die Tabelle in diesem Abschnitt führt sie vollständig auf.

**Schreibweise**

- Das Suffix folgt unmittelbar auf die letzte Ziffer. Leerraum, Kommentare und `_` zwischen Zahl und Suffix sind ein Fehler.
- Ein Suffix besteht aus denselben Zeichen wie ein Bezeichner (7.2): Es beginnt mit einem ASCII-Buchstaben oder `$`; danach sind zusätzlich ASCII-Ziffern und `_` erlaubt. Seine Länge ist nicht begrenzt.
- Zusätzlich gilt: Kein Suffix beginnt mit `a` bis `f` (Hexadezimalziffern; `e` leitet zudem den Exponenten ein) oder mit `o` oder `x` (Zahlenpräfixe `0o` und `0x`), jeweils in beiden Schreibweisen.
- Groß- und Kleinschreibung zählen: `k` und `K` sind zwei verschiedene Suffixe, ebenso `mb`, `Mb`, `mB` und `MB`. `L` ist ein Suffix, `l` ist keines.
- Es gilt die längste Übereinstimmung: Zum Suffix gehören alle Buchstaben, Ziffern, `_` und `$`, die unmittelbar auf sein erstes Zeichen folgen. `10kb` trägt das Suffix `kb`, nicht `k` gefolgt von `b`. `10kbs` trägt das Suffix `kbs` und `10k5` das Suffix `k5`; beide gibt es nicht.
- Anders als ein Bezeichner beginnt ein Suffix nicht mit `_`. Ein `_` unmittelbar nach einer Ziffer ist deshalb immer Zifferngruppierung (9.3) oder ein Fehler: `1_0` ist die Zahl 10, `10_k` ist ein Fehler.
- Suffixe sind an allen Zahlformen erlaubt, auch nach einem Exponenten und an hexadezimalen, oktalen und binären Zahlen: `1e3k`, `0x10kb`.

**Übersicht der Suffixe**

| Suffix | Umrechnung | Beispiel | Ergebnis |
|---|---|---|---|
| `k`, `K` | Zahl mal 1000 | `10k` | `10000` |
| `kb`, `Kb`, `kB`, `KB` | Zahl mal 1024 | `4kb` | `4096` |
| `mb`, `Mb`, `mB`, `MB` | Zahl mal 1048576 | `64mb` | `67108864` |
| `ms` | Zahl geteilt durch 1000 | `100ms` | `0.1` |
| `s` | keine; der Wert bleibt unverändert | `30s` | `30` |
| `min` | Zahl mal 60 | `5min` | `300` |
| `h` | Zahl mal 3600 | `2h` | `7200` |
| `pct` | Zahl geteilt durch 100 | `50pct` | `0.5` |
| `px` | keine; der Wert bleibt unverändert | `12px` | `12` |
| `L` | keine; der Wert bleibt unverändert | `100L` | `100` |
| `n` | keine; der Wert bleibt unverändert | `10n` | `10` |

- Die Tabelle ist abschließend. Ein Suffix, das nicht in ihr steht, ist ein Fehler (`10q`, `10m`, `10MS`).
- Die Suffixe DÜRFEN NICHT umdefiniert, überschrieben oder entfernt werden. Ein Parser DARF KEINE weiteren Suffixe kennen und keine von der Anwendung annehmen.
- Das Ergebnis ist das exakte Produkt oder der exakte Quotient. Im JSON-Äquivalent steht dessen Dezimaldarstellung: `1.5k` ergibt `1500`, `0.5kb` ergibt `512`, `0.1kb` ergibt `102.4`, `-2k` ergibt `-2000`, `0x10kb` ergibt `16384`, `1.5h` ergibt `5400`, `1ms` ergibt `0.001`, `12.5pct` ergibt `0.125`.
- Bei `s`, `px`, `L` und `n` ist das Ergebnis der Wert der Zahl selbst: `12px` und `12` bezeichnen denselben Wert. Das Suffix trägt keine Information zum Wert des Dokuments bei.
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
  halb: 0.5K
  quote: 50pct
  aufschlag: 110pct
  breite: 320px
  zaehler: 100L
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
  "breite": 320,
  "zaehler": 100
}
```

## 10. Abbildung auf JSON

Das **JSON-Äquivalent** eines XTJSON-Dokuments entsteht durch folgende Schritte. Sie definieren zugleich die Bedeutung jedes XTJSON-Dokuments. Enthält das Dokument benannte Werte, gilt das JSON-Äquivalent bezogen auf die Definitionen, mit denen das Dokument gelesen wird.

1. **Kommentare** werden entfernt. **Leerraumzeichen**, die JSON nicht kennt, werden durch ein Leerzeichen (U+0020) ersetzt.
2. **Implizites Wurzelobjekt:** Die Member werden in `{` `}` eingeschlossen.
3. **Trenner:** Zwischen je zwei aufeinanderfolgenden Elementen steht genau ein Komma. Abschließende Kommas entfallen.
4. **Namen:** Ein Bezeichner an Namensposition wird zum JSON-String mit derselben Zeichenfolge.
5. **Strings:** Ein `'`-String wird zum `"`-String mit demselben Inhalt; unmaskierte `"` werden zu `\"`. Escape-Sequenzen, die JSON nicht kennt, werden in beiden String-Formen ersetzt: `\'` durch `'`, `\v` durch `\u000B`, `\0` durch `\u0000`, `\xHH` durch `\u00HH`, `\u{…}` durch die `\uXXXX`-Sequenz desselben Codepunkts, oberhalb von U+FFFF durch das entsprechende Surrogatpaar. Ein String mit Zeilenumbruch wird zum `"`-String, der seinen Wert nach 8.3 darstellt; Zeilenfortsetzungen entfallen dabei, und Zeichen, die in einem JSON-String nicht unmaskiert stehen dürfen (`"`, `\` und Steuerzeichen wie Zeilenumbruch und Tabulator), werden maskiert.
6. **Zahlen:** Aus Dezimalzahlen werden alle `_` entfernt; die Schreibweise bleibt sonst unverändert. Hexadezimale, oktale und binäre Zahlen werden zur dezimalen Ganzzahl desselben Werts, bei vorangestelltem `-` mit führendem Minuszeichen. Eine Zahl mit Suffix wird durch das Ergebnis der Umrechnung ersetzt, geschrieben als JSON-Zahl (9.5).
7. **Benannte Werte:** `true`, `false` und `null` bleiben unverändert. Jeder andere benannte Wert wird durch den JSON-Wert ersetzt, den ihm seine Definition zuordnet (6.4).

Das JSON-Äquivalent ist bis auf Leerraum und die Wahl gleichwertiger Escape-Sequenzen eindeutig. Enthält es ein Objekt mit doppelten Namen, gilt für dessen Wert die Regel aus 7.2: Das letzte Member gilt. Zwei XTJSON-Dokumente sind **gleichbedeutend**, wenn ihre JSON-Äquivalente denselben Wert bezeichnen. Ein Dokument, das bereits ein JSON-Text ist, ist sein eigenes JSON-Äquivalent (bis auf Leerraum).

Ein Beispiel mit Gegenüberstellung steht in [Anhang B.1](#b1-vollständiges-beispiel).

## 11. Konformität

**Dokument.** Ein Text ist ein konformes XTJSON-Dokument, wenn er nach Abschnitt 4 kodiert ist, der Regel `XTJSON-text` entspricht und jedes seiner Zahlen-Suffixe in der Tabelle in 9.5 steht. Ein konformes Dokument ist **gültig bezüglich einer Menge von Definitionen**, wenn jeder seiner benannten Werte darin definiert ist. Es ist **portabel**, wenn es nur vordefinierte benannte Werte verwendet; ein portables Dokument ist mit jedem konformen Parser lesbar.

**Parser.** Ein konformer XTJSON-Parser

- MUSS jedes konforme XTJSON-Dokument, das bezüglich seiner Definitionen gültig ist, akzeptieren und den Wert seines JSON-Äquivalents liefern – damit auch jeden JSON-Text und jede I-JSON-Nachricht –, soweit nicht eine Grenze oder Einschränkung nach dem vierten Punkt greift;
- MUSS jeden Text, der kein konformes XTJSON-Dokument ist oder einen nicht definierten benannten Wert enthält, als Fehler ablehnen und DARF KEINE weiteren Syntaxerweiterungen stillschweigend akzeptieren;
- MUSS die vordefinierten benannten Werte und alle Suffixe aus 9.5 kennen, DARF NICHT zulassen, dass sie umdefiniert werden oder dass weitere Suffixe hinzukommen, und MUSS eigene Definitionen zurückweisen, die gegen 6.4 verstoßen. Er SOLLTE der Anwendung ermöglichen, eigene benannte Werte zu definieren. Ohne Zutun der Anwendung sind nur die vordefinierten benannten Werte aktiv;
- DARF Grenzen für Dokumentgröße, Verschachtelungstiefe, Zahlenbereich und -genauigkeit sowie Stringlänge setzen und semantische Einschränkungen durchsetzen (etwa im I-JSON-Modus nach Abschnitt 12);
- SOLLTE einen I-JSON-Modus nach Abschnitt 12 anbieten.

**Erzeuger.** Ein XTJSON-Erzeuger MUSS konforme XTJSON-Dokumente ausgeben. Jeder JSON-Erzeuger, der in UTF-8 ausgibt, ist damit auch ein XTJSON-Erzeuger. Ist der Empfänger ein Programm, SOLLTE JSON ausgegeben werden. Eigene benannte Werte SOLLTEN nur ausgegeben werden, wenn feststeht, dass der Empfänger dieselben Definitionen verwendet.

**Konverter.** Ein Konverter von XTJSON nach JSON MUSS das JSON-Äquivalent nach Abschnitt 10 erzeugen, bezogen auf die ihm mitgegebenen Definitionen; seine Ausgabe MUSS strikt der Grammatik von [RFC8259] entsprechen.

## 12. I-JSON-Profil

Ein XTJSON-Dokument ist **I-JSON-konform**, wenn sein JSON-Äquivalent eine gültige I-JSON-Nachricht nach [I-JSON] ist. Maßgeblich sind dabei auch die Werte, die sich aus benannten Werten und Zahlen-Suffixen ergeben. Das bedeutet über Abschnitt 4–9 hinaus:

- Namen und String-Werte DÜRFEN KEINE Surrogate und keine Unicode-Noncharacters enthalten, weder direkt noch als Escape-Sequenz. Ein einzelnes `"\uDEAD"` ist ungültig; ein korrektes Surrogatpaar ist zulässig.
- Ein Objekt DARF KEINE doppelten Namen enthalten. Verglichen wird nach Auflösung aller Escape-Sequenzen und unabhängig von der Schreibweise des Namens (Bezeichner oder String in einer der Formen aus Abschnitt 8).
- Zahlen SOLLTEN NICHT über Betrag oder Genauigkeit von IEEE 754 binary64 hinausgehen. Für ganze Zahlen außerhalb von [−(2⁵³)+1, (2⁵³)−1] darf keine exakte Verarbeitung erwartet werden; das gilt auch für hexadezimale, oktale und binäre Schreibweise. Solche Werte werden besser als String übertragen.
- Der Wurzelwert SOLLTE ein Objekt oder ein Array sein. Das implizite Wurzelobjekt erfüllt diese Empfehlung.

Ein Parser im I-JSON-Modus MUSS Dokumente ablehnen, die gegen eines der beiden Verbote (DARF KEINE) verstoßen.

Die Empfehlungen aus [I-JSON] für Protokolle gelten unverändert auch für XTJSON-Dokumente: unbekannte Member ignorieren, Zeitangaben als String nach RFC 3339, Binärdaten als base64url-String.

## 13. Sicherheitsaspekte

- **Kein `eval`.** XTJSON ist keine Teilmenge von JavaScript oder einer anderen Programmiersprache und DARF NICHT durch Auswertung als Programmcode gelesen werden.
- **Ressourcengrenzen.** Tief verschachtelte Strukturen, sehr lange Strings oder Zahlen sowie nicht abgeschlossene Blockkommentare und Strings können Parser überlasten. Parser SOLLTEN Grenzen setzen (Abschnitt 11).
- **Abweichende Interpretation.** Verarbeiten zwei Komponenten dasselbe Dokument unterschiedlich, kann das Prüfungen aushebeln. Das betrifft vor allem doppelte Namen, die andere JSON-Werkzeuge anders behandeln können als in 7.2 festgelegt, und Zahlen außerhalb des exakten Bereichs. Wo ein Dokument sicherheitsrelevante Entscheidungen steuert, wird das I-JSON-Profil EMPFOHLEN.
- **Definitionen.** Die Bedeutung eines Dokuments mit eigenen benannten Werten hängt von den Definitionen des Parsers ab. Zwei Parser mit unterschiedlichen Definitionen lesen dasselbe Dokument verschieden, oder einer lehnt es ab. Eigene Definitionen sind deshalb Teil der Schnittstelle zwischen Autor und Anwendung und SOLLTEN dokumentiert werden. Die Umrechnungen der Suffixe legt allein diese Spezifikation fest; ein Dokument kann weder Definitionen noch Code mitbringen.
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
XTJSON-text    = S ( value / root-members ) S [ line-comment ]
root-members   = member-list                 ; implizites Wurzelobjekt

; ---------- Werte ----------
value          = object / array / string / number / named-value
named-value    = identifier                  ; true, false, null und
                                             ; eigene Definitionen (6.4)

; ---------- Objekte ----------
object         = "{" S [ member-list S ] "}"
member-list    = member *( item-sep member ) [ S "," ]
member         = name S ":" S value
name           = string / identifier
identifier     = id-start *id-continue
id-start       = ALPHA / "_" / "$"
id-continue    = ALPHA / DIGIT / "_" / "$"

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
escape-seq     = %x5C ( char-escape / null-escape / hex-escape /
                        unicode-escape / codepoint-escape / newline )
                                             ; \ vor newline: Zeilenfortsetzung
char-escape    = %x22 / %x27 / %x5C / %x2F /         ; " ' \ /
                 %x62 / %x66 / %x6E / %x72 /         ; b f n r
                 %x74 / %x76                         ; t v
null-escape    = %x30                        ; \0, nicht vor einer DIGIT
hex-escape     = %x78 2HEXDIG                ; \xHH
unicode-escape = %x75 4HEXDIG                ; \uXXXX
codepoint-escape = %x75 "{" *"0" ( 1*5HEXDIG / ( "10" 4HEXDIG ) ) "}"
                                             ; \u{…}, höchstens 10FFFF, nicht D800-DFFF
SQUOTE         = %x27                        ; '

; ---------- Zahlen ----------
number         = [ minus ] ( hex-int / oct-int / bin-int / decimal ) [ suffix ]
suffix         = suffix-start *id-continue   ; nur die Suffixe aus 9.5
suffix-start   = %x67-6E / %x70-77 / %x79-7A /       ; g-n p-w y z
                 %x47-4E / %x50-57 / %x59-5A /       ; G-N P-W Y Z
                 "$"
decimal        = int [ frac ] [ exp ]
int            = zero / ( digit1-9 *( [ "_" ] DIGIT ) )
frac           = "." digits
exp            = e [ minus / plus ] digits
digits         = DIGIT *( [ "_" ] DIGIT )
hex-int        = zero ( %x78 / %x58 ) HEXDIG    *( [ "_" ] HEXDIG )     ; 0x 0X
oct-int        = zero ( %x6F / %x4F ) oct-digit *( [ "_" ] oct-digit )  ; 0o 0O
bin-int        = zero ( %x62 / %x42 ) BIT       *( [ "_" ] BIT )        ; 0b 0B
oct-digit      = %x30-37
digit1-9       = %x31-39
zero           = %x30
minus          = %x2D
plus           = %x2B
e              = %x65 / %x45                 ; e E
```

Hinweise zur Zerlegung in Tokens (informativ):

- Es gilt die längste Übereinstimmung. `0x1e3` ist eine einzige Hexadezimalzahl.
- Drei Bedingungen gelten zusätzlich zur Grammatik: Auf `null-escape` folgt keine Dezimalziffer, der Wert in `codepoint-escape` liegt nicht im Bereich D800 bis DFFF, und jedes `suffix` steht in der Tabelle in 9.5.
- Zwei Werte brauchen stets einen Trenner nach 7.3. Zeichenfolgen wie `0755`, `1_`, `0b102`, `123abc` oder `10_k` lassen sich deshalb nie als gültige Folge mehrerer Tokens lesen und sind Fehler.
- Ob ein `named-value` definiert ist, entscheidet nicht die Grammatik, sondern die Menge der Definitionen (6.4).
- Ein Zeilenkommentar reicht stets bis zum nächsten Zeilenumbruch: `eol` verlangt nach ihm ein `newline`, und `non-eol` schließt nur U+000A und U+000D aus. Nur am Dokumentende darf der Zeilenumbruch fehlen.
- Die Folge CR LF ist immer ein einziger `newline`, nie zwei.
- Für Strings beschreibt die Grammatik nur die Schreibweise. Ihr Wert ergibt sich aus den Schritten in 8.3.
- Drei Anführungszeichen in Folge (`"""` oder `'''`) begrenzen keinen String: Sie sind ein leerer String, auf den unmittelbar der Anfang eines weiteren Strings folgt, und damit immer ein Fehler (7.3).
- Außer dem aktuellen Zeichen braucht ein Parser nur die Information „seit dem letzten Token kam außerhalb eines Blockkommentars ein Zeilenumbruch vor“. Nur am Dokumentanfang wird ein Token weiter vorausgeschaut (6.2).

## Anhang B – Beispiele

### B.1 Vollständiges Beispiel

XTJSON-Dokument:

```xtjson
# Dienstkonfiguration – die Wurzelklammern sind weggelassen
name: 'demo-service'
version: "1.4.0"
$schema: "https://example.org/schema/service.json"

listen: {
  host: "0.0.0.0"
  port: 8080            // der Zeilenumbruch ersetzt das Komma
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
  "listen": { "host": "0.0.0.0", "port": 8080, "tls": false },
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

In den Tabellen steht `⏎` für einen Zeilenumbruch. Die Tabellen gelten für einen Parser ohne eigene Definitionen.

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
| `[abc]` | der benannte Wert `abc` ist nicht definiert |
| `[True]` | `True` ist nicht definiert; Groß- und Kleinschreibung zählen |

**Namen**

| Text | Grund |
|---|---|
| `{2fa: true}` | Bezeichner beginnt mit einer Ziffer |
| `{größe: 1}` | Nicht-ASCII-Zeichen im Bezeichner |
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
| `NaN`, `Infinity` | keine Zahlen; als benannte Werte nicht definiert |
| `10q`, `10m` und `10MS` | kein Suffix aus der Tabelle in 9.5; Groß- und Kleinschreibung zählen |
| `10 k` und `10_k` | Leerraum oder `_` zwischen Zahl und Suffix |
| `10kbs` und `10k5` | die Suffixe `kbs` und `k5` gibt es nicht |
| `50%` | `%` ist in einem Suffix nicht erlaubt |
| `10ab` und `10e` | `a` bis `f` können kein Suffix einleiten; `e` leitet den Exponenten ein |
| `10x` und `10oz` | `x` und `o` können kein Suffix einleiten |

## Anhang C – Bewusst nicht enthalten

Die folgenden, aus anderen JSON-Dialekten bekannten Erweiterungen gehören **nicht** zu XTJSON. Ein konformer Parser lehnt sie ab.

- frei wählbare Werte ohne Anführungszeichen (`farbe: rot`); ein Bezeichner an Wertposition ist nur als definierter benannter Wert gültig
- Objekte und Arrays als benannte Werte
- Definitionen innerhalb des Dokuments: Ein Dokument kann keine benannten Werte und keine Suffixe festlegen
- eigene Suffixe der Anwendung; Suffixe mit anderen Zeichen als denen eines Bezeichners (`50%`) oder mit Leerraum vor dem Suffix; Suffixe, die etwas anderes als eine Zahl ergeben
- Strings mit drei Anführungszeichen als Begrenzer (`"""…"""`, `'''…'''`), Heredocs und Roh-Strings ohne Escape-Sequenzen
- eine Zeilenfortsetzung mit Leerraum zwischen `\` und Zeilenumbruch
- `\` vor beliebigen Zeichen (`\a` für `a`) und oktale Escape-Sequenzen (`\1`, `\012`)
- `+` als Vorzeichen, `.5`, `5.` sowie `Infinity` und `NaN` als Zahlen
- Nachkommateil oder Exponent bei hexadezimalen, oktalen und binären Zahlen
- Oktalzahlen mit bloßer führender Null (`0755`)
- Unicode-Bezeichner, Escape-Sequenzen in Bezeichnern und `-` in Bezeichnern
- Zeichen als Leerraum, die ECMAScript nicht als Leerraum führt (etwa U+0085, U+180E, U+200B)
- U+2028 und U+2029 als Zeilenumbruch
- implizite Arrays auf oberster Ebene, mehrere Dokumente in einer Datei
- schachtelbare Kommentare
- zusätzliche Datentypen (Datum, Binärdaten, `undefined`), Verweise, Includes, Ausdrücke

## Anhang D – Entwurfsentscheidungen

Informativ. Festlegungen an Stellen, an denen mehrere Lösungen möglich waren, mit Begründung.

| Thema | Entscheidung | Begründung |
|---|---|---|
| Leeres Dokument | Fehler, nicht `{}` | Eine leere oder abgeschnittene Datei soll auffallen; JSON verhält sich ebenso. |
| Doppelte Namen | das letzte Member gilt; im I-JSON-Profil verboten | Ein festes Verhalten verhindert, dass zwei Parser dasselbe Dokument verschieden lesen. Ein generelles Verbot würde gültige JSON-Texte ausschließen und K1 verletzen. |
| Zeichen in Bezeichnern | ASCII-Buchstaben, Ziffern, `_`, `$` | Braucht keine Unicode-Tabellen und vermeidet verwechselbare Zeichen. Namen wie `max-age` stehen in Anführungszeichen. |
| `true`/`false`/`null` als Name | erlaubt | An Namensposition eindeutig; vermeidet eine Sonderregel. |
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
| Benannte Werte | nur definierte Bezeichner, kein freier Text | Ein Tippfehler wie `ture` wird als Fehler gemeldet, statt als String gelesen zu werden. |
| Benannte Werte: Ergebnis | ein String, eine Zahl, `true`, `false` oder `null`; kein Objekt und kein Array | Ein benannter Wert ist ein Alias für einen einfachen Wert. Der Aufbau eines Dokuments aus Objekten und Arrays steht so vollständig im Dokument selbst und hängt nicht von den Definitionen ab. |
| `true`, `false`, `null` | fest vordefiniert, nicht änderbar | Sonst könnte ein gültiger JSON-Text seine Bedeutung ändern (K2). |
| Suffix: erlaubte Zeichen | dieselben wie in einem Bezeichner; am Anfang jedoch nicht `_` und nicht `a`–`f`, `A`–`F`, `o`, `O`, `x`, `X` | Eine einzige Zeichenregel für Namen, benannte Werte und Suffixe. `a`–`f` scheiden als erstes Zeichen aus, weil sie Hexadezimalziffern sind und `e` den Exponenten einleitet; `o` und `x`, weil sie Zahlenpräfixe einleiten. Ein vergessener Ziffernteil (`0x`) bleibt so ohne Sonderregel ein Fehler. |
| Suffix: `_` am Anfang | nicht erlaubt | Ein `_` nach einer Ziffer gehört so immer zur Zifferngruppierung. `1_0` lässt sich nicht als `1` mit dem Suffix `_0` lesen, und die Regeln aus 9.3 gelten ohne Ausnahme. |
| Suffixe: Festlegung | ausschließlich durch diese Spezifikation; keine eigenen Suffixe | Eine Zahl mit Suffix hat bei jedem Parser denselben Wert, und ein Parser führt keine Umrechnungsfunktionen der Anwendung aus. |
| Suffixe ohne Wirkung | `s`, `px`, `L` und `n` lassen den Wert unverändert | Eine Zahl kann mit ihrer Einheit oder in einer aus anderen Sprachen gewohnten Form geschrieben werden, ohne dass sich ihr Wert ändert. |
| Suffix: Ergebnis | immer eine Zahl | Ein Suffix rechnet um; es erzeugt keinen anderen Datentyp. |
| Suffix: Genauigkeit | exaktes Ergebnis | `0.1kb` soll `102.4` und `100ms` soll `0.1` ergeben, unabhängig von der Gleitkommaarithmetik des Parsers. |
| Definitionen | Teil der Konfiguration des Parsers, nicht des Dokuments | Ein Dokument kann weder Bedeutungen ändern noch Code einschleusen. Ohne eigene Definitionen verhalten sich alle Parser gleich. |

## Referenzen

**Normativ**

- **[RFC8259]** T. Bray (Hrsg.), „The JavaScript Object Notation (JSON) Data Interchange Format“, STD 90, RFC 8259, Dezember 2017. <https://www.ietf.org/ietf-ftp/rfc/std/std90.txt>
- **[ECMA-404]** Ecma International, „The JSON Data Interchange Syntax“, 2. Ausgabe, Dezember 2017. <https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf>
- **[I-JSON]** T. Bray (Hrsg.), „The I-JSON Message Format“, draft-ietf-json-i-json-06, Januar 2015 (veröffentlicht als RFC 7493). <https://www.ietf.org/archive/id/draft-ietf-json-i-json-06.txt>
- **[ECMA-262]** Ecma International, „ECMAScript 2026 Language Specification“, ECMA-262, 17. Ausgabe, Juni 2026. <https://262.ecma-international.org/17.0/index.html> – maßgeblich nur für die in 5.1 und 8.2 übernommenen Leerraumzeichen und Escape-Sequenzen.
- **[RFC5234]** D. Crocker, P. Overell, „Augmented BNF for Syntax Specifications: ABNF“, STD 68, RFC 5234.
- **[RFC3629]** F. Yergeau, „UTF-8, a transformation format of ISO 10646“, STD 63, RFC 3629.
- **[RFC2119]**, **[RFC8174]** Schlüsselwörter zur Kennzeichnung von Anforderungsstufen, BCP 14.

**Informativ**

- ECMA-262, 1. Ausgabe (Juni 1997), 3. Ausgabe (Dezember 1999), 5. Ausgabe (Dezember 2009) und 6. Ausgabe (Juni 2015, „ECMAScript 2015“) – für die Angaben in den Spalten „Herkunft“; in den Tabellen als ES1, ES3, ES5 und ES2015 bezeichnet.
- RFC 3339, „Date and Time on the Internet: Timestamps“.
- RFC 4648, „The Base16, Base32, and Base64 Data Encodings“.

## Änderungen

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
