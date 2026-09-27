# Entwicklung

## Überblick

Eine Single-Page-Anwendung ohne Framework. Der Browser liest die CSV aus der Zeiterfassung,
bereinigt, speichert im `localStorage` und erzeugt Word und Druck. nginx liefert statische
Dateien aus und leitet `/ki/` an Ollama weiter.

Es gibt zwei Betriebsarten: allein im Browser und mit dem Server unter `server/`. Mit ihm melden sich Azubis an, der Stand geht
zusätzlich in Postgres, und Ausbilder sehen die Hefte ihrer Gruppe. Ohne ihn stellt die Seite
keine Anfrage dorthin. Betrieb, Abgleich und Schnittstelle: [docs/SERVER.md](SERVER.md).

```text
CSV ─► csv.js ─► quellen.js ─┬─► Tage ─► entwurf.js + bereinigung.js ─► Tagesentwurf
                             └─► unsicher: zuordnung.js (Dialog)
                                                     │
                            Bearbeiten, Fertig     ◄─┤─► optional ki-*.js (Ollama)
                                                     │
                                       word.js (DOCX) / druck.js (Druck, PDF)
```

## Build

`build.js` setzt `src/` zusammen:

1. Der Lizenzkopf (`LIZENZKOPF` in `build.js`) als CSS-Kommentar, dann
   `src/css/*.css` hintereinander, Schriften aus `src/fonts/` als data-URI.
   Der Kopf muss bleiben: Die SIL Open Font License verlangt, dass ihr Hinweis
   die eingebettete Schrift begleitet (Wortlaut in `src/fonts/OFL.txt`).
   Ein HTML-Kommentar ginge dafür nicht, der ist in der fertigen Datei verboten.
2. `src/js/**/*.js` in der Reihenfolge der Liste in `build.js`, gemeinsam in
   **einer** Funktion mit `"use strict"`.
3. Beides an die Marken `<!-- build:css -->` und `<!-- build:js -->` in
   `src/index.html`; übrige HTML-Kommentare fallen weg.
4. `src/beispiel.csv` wird als `BEISPIEL_CSV` vor die Skripte gesetzt.
5. `<!-- build:docx -->` wird zu `<script src="vendor/docx.js">`
   (`dist/index.html`) bzw. zur eingebetteten Bibliothek
   (`dist/Berichtsheft.html`).

**Wichtig:** Die JS-Dateien sind keine Module. Sie teilen sich einen
Gültigkeitsbereich; jede Funktion ist überall sichtbar. Funktionsdeklarationen
dürfen in beliebiger Reihenfolge stehen, aber Code, der beim Laden läuft
(`var X = …` mit Abhängigkeiten, `addEventListener`), braucht das, was vor ihm
steht. `start.js` läuft zuletzt.

Änderungen immer in `src/`, danach `npm run build`. `dist/` nie von Hand
bearbeiten.

## Dateien in `src/js`

Die Ordner ordnen nach Aufgabe; für den Build zählt allein die Liste `JS` in `build.js`.

**`kern/`**

| Datei | Inhalt |
| --- | --- |
| `grundlagen.js` | Zustand (`tage`, `wochen`, `aktiveWoche` …), Konstanten, Datums- und Texthelfer, Feiertage je Bundesland (dieselben Regeln in `server/feiertage.js`) |
| `zustand.js` | Stand je Tag/Woche, Schulplan (`tagArt()`), Stammdaten, Speichern, Zeitstempel für den Abgleich, Fußleistenmeldung `sage()` (bei offenem Dialog auch im Dialog) |
| `sicherung.js` | Sicherung als JSON speichern und laden, Rückfrage `frage()` |
| `bedienung.js` | Menüs und Tastatur |
| `start.js` | Testzugänge (`window.__…`), Wiederherstellen des letzten Stands, Start des Rundgangs (am Handy nicht, `amHandy`) |

**`import/`**

| Datei | Inhalt |
| --- | --- |
| `csv.js` | Zeichensatz (`csvDekodieren()`), Trennzeichen, Felder; Datum, Uhrzeit und Dauer lesen |
| `bereinigung.js` | `saeubern()`: Regeln für Tickets, Geräte, Personen, Kunden, Notizsprache |
| `quellen.js` | Spalten erkennen (`FELDER`, `spaltenZuordnen()`), Kopfzeile finden, `csvAnalysieren()`, `buchungenLesen()`, `tageAusBuchungen()` |
| `entwurf.js` | `rohtext()`: aus Buchungen wird der Tagesentwurf |
| `import.js` | Datei laden, Zusammenführen mit dem Stand (`importAnwenden()`), „Spalten prüfen“, Ziehen und Ablegen |
| `zuordnung.js` | Dialog „Spalten zuordnen“ mit Vorschau |
| `beispiel.js` | „Beispiel ansehen“: ausgedachtes Heft aus `src/beispiel.csv` (Stammdaten in `BEISPIEL_STAMM`) |

**`ki/`**

| Datei | Inhalt |
| --- | --- |
| `ki-vorlage.js` | `taetigkeiten()`, `fuersModell()`: die bereinigten Tätigkeiten als Liste für das Modell |
| `ki.js` | Prompt, Anfrage an Ollama, `zusammenlegen()`, `kiTagKuerzen()` |
| `ki-lauf.js` | Lauf über mehrere Tage mit Fortschritt und Abbruch |

**`ansicht/`**

| Datei | Inhalt |
| --- | --- |
| `ansicht-woche.js` | Wochenbalken, Monatsraster, Navigation durch jede Kalenderwoche |
| `reiter.js` | `zeichnen()`, Reiterzeile: je Werktag ein Reiter, dazu der Reiter „Woche“ |
| `ansicht-tag.js` | Bausteine der Karten (`sektion()`, `mitRueckfrage()`) und der Tagbereich: Text, Buchungen, KI-Knopf |
| `wochenblatt.js` | Reiter „Woche“: Angaben, Blattvorschau (`blattVorschau()`), rechts `seitenspalte()` – eine Karte „Wochenblatt“ mit Umfang, KI und Herunterladen |
| `stammdaten.js` | Dialog „Deine Daten“, Verbindungsprüfung, Löschen und Verwerfen |
| `rundgang.js` | Rundgänge beim ersten Start, für Azubis und für Ausbilder |

**`ausgabe/`**

| Datei | Inhalt |
| --- | --- |
| `word.js` | Word-Dokument mit der Bibliothek `docx` |
| `druck.js` | Druckblätter, Messen und Aufteilen voller Wochen |
| `export.js` | Kontrolle vor dem Export, Downloads, Exportknöpfe |

**`konto/`** (nur mit Berichtsheft-Server)

| Datei | Inhalt |
| --- | --- |
| `konto.js` | Anmelden, Abgleich mit dem Server (`kontoPaket()`, `kontoUebernehmen()`), Anzeige „im Konto gesichert“; ohne Server still |
| `ausbilder.js` | Ansicht für Ausbilder: Auswahl, Heft eines Azubis mit Monatsraster und Blattvorschau, Export über `mitAzubiStand()`, Gruppe |

## Dateien in `src/css`

Reihenfolge wie in der Liste `CSS` in `build.js`: `basis.css` (Farben, Schrift, Grundgerüst),
`leiste.css` (Kopfleiste, Wochenbalken, Reiter), `tag.css` (Tagbereich, Sektionen, Wochenansicht,
Eingaben, Meldungen), `dialoge.css` (Monatsraster, „Deine Daten“, Zuordnung, Rundgang),
`handy.css` (alle `@media`-Regeln für Handy und Tablet; dort stehen die Tagesreiter in einer Zeile
und der Tageskopf `.artkopf` mit Datum, Art und Stunden ebenfalls, damit das Schreibfeld auch mit
offener Tastatur Platz hat), `ausbilder.css` (Konto und Ausbilderansicht),
`blatt.css` (der Drucksatz des Vordrucks).

## Datenmodell

`localStorage["berichtsheft-v1"]`:

```text
stamm   Stammdaten und Einstellungen; Schlüssel = Feld-ID ohne "f-"
        (kiAdresse ↔ f-ki-adresse); schultage "Di, Mi", schulbloecke als Text
tage    "JJJJ-MM-TT" → {
          text        was im Feld steht
          art         "", Berufsschule, Urlaub, Krank, Feiertag, Betriebsversammlung
          artVonHand  true = Art am Tag gewählt, auch "" (Arbeitstag); der Schulplan gilt dann nicht
          stunden     aus dem Import, nur Anzeige
          von, bis, pausen, pauseMinuten
          posten      die Buchungen (fallen bei vollem Speicher weg)
          entwurf     der erzeugte Entwurf        ─┐
          vorKi       Text vor der Modellkürzung    ├─ Herkunft des Texts
          kiText      Ausgabe des Modells          ─┘
          geprueft    true = ausdrücklich übernommen
          geaendert   ISO-Zeit der letzten Änderung im Nachweis (für den Abgleich)
        }
wochen  Montag → { abteilung, unterweisungen }
kunden  Kundennamen aus dem letzten Import
stand   { woche, tag } zuletzt geöffnet
geaendert { stamm, jeWoche }  letzte Änderung der Stammdaten; je Montag die der Wochenangaben
```

`geaendert` setzt niemand von Hand: `zeitstempelPflegen()` in `zustand.js` vergleicht vor dem
Speichern mit dem zuletzt gesicherten Stand und stempelt, was sich im Nachweis geändert hat.
Ältere Stände ohne Stempel bekommen beim ersten Speichern einen. `start.js` liest die Stempel beim
Laden zurück (`stempelLaden()`); ohne sie galt nach jedem Neuladen alles als eben geändert und
überschrieb im Konto, was ein anderes Gerät inzwischen geschrieben hatte.

Jede Woche hat ihren eigenen Stempel, wie jeder Tag. Vor 0.1.0 gab es einen für alle Wochen
(`geaendert.wochen`); beim Laden erbt ihn jede Woche. Eine Woche, die `wocheDaten()` nur zum
Ansehen leer angelegt hat, bekommt keinen Stempel und geht nicht ins Konto.

**Abgekoppelter Speicher bei `file://`:** Chromium hängt das erste Dokument eines neuen Tabs
gelegentlich an einen leeren Speicher, der mit dem Tab verschwindet: Die Seite sieht den
gespeicherten Stand nicht, und was sie schreibt, ist nach dem Schließen weg. Es trifft Seiten, die
gleich beim Laden auf den Speicher zugreifen: Eine kleine Testseite traf es in 2–4 % der Tabs, mit
Headless-Shell und vollem Chromium, in Wegwerf-Kontexten wie in einem laufenden Profil. Das
Werkzeug greift erst nach seinem großen Skript zu und war in 250 Versuchen nicht betroffen. Über
http und im zweiten Dokument desselben Tabs trat es nie auf. Vorsorglich lädt `speicherNeuLaden()`
in `grundlagen.js` bei `file://` einmal neu, wenn der Speicher beim Öffnen ganz leer ist, und hält
die Seite bis dahin verborgen; nach einem Neuladen nie, sonst entstünde eine Schleife. Ein wirklich
leerer Speicher beim ersten Start kostet so ein Neuladen.

`localStorage["berichtsheft-konto"]`: `{ seit, gesendet, person }` je Konto. `seit` ist die Uhr der
Datenbank beim letzten Abgleich und steuert, was herunterkommt; `gesendet` die Browseruhr beim letzten
erfolgreichen Hochladen und steuert, was hochgeht. Mit nur einer Marke gingen Eingaben verloren, die
während eines Abgleichs entstanden oder deren Rechneruhr nachging.

`localStorage["berichtsheft-onboarding"] = "1"`: Rundgang gesehen; `berichtsheft-onboarding-ausbilder`
dasselbe für den Rundgang der Ausbilder (`RUNDGANG_AUSBILDER`). Er startet erst, wenn `kontoStarten()`
die Rolle kennt.

`localStorage["berichtsheft-zuordnungen"]`: bestätigte Zuordnungen je Kopfzeile,
`Signatur → { felder, reihenfolge }`.

### Stand eines Tages (`tagStand()`)

| Stand | Bedeutung | Farbe |
| --- | --- | --- |
| `leer` | kein Text | – |
| `roh` | `text === entwurf` | gelb (`--offen`), Marke „E“ |
| `ki` | `text === kiText` | gelb, Marke „KI“ |
| `eigen` | selbst geschrieben, nicht übernommen | gelb, Marke „!“ |
| `fertig` | `geprueft` | grün, Haken |

Jede Änderung am Text hebt `geprueft` auf. Übernommene Tage sind
schreibgeschützt, bis man **Bearbeiten** drückt.

Rot (`--acht`) steht nicht für einen Stand, sondern für ein Problem: ein Text, der nicht aufs Blatt
passt, Warnungen, der Bereich „Gefahr“. Nach einem Import ist fast jeder Tag noch zu lesen; in Rot
stand dann die ganze Woche in Alarmfarbe, und „wird im Blatt eng“ ging darin unter. Der gewählte
Reiter trägt einen dunklen Rahmen, bei jedem Stand gleich; seine Farbe bleibt die seines Stands.

### Stand einer Woche (`wochenStand()`)

Dieselben Regeln wie beim Ausbilder (`wochenUebersicht()` in `server/stand.js`); `test/lauf.js`
vergleicht beide Seiten Fall für Fall.

- Urlaub, Krank und Feiertag sind frei und brauchen keinen Text.
- Berufsschule und Betriebsversammlung brauchen Text wie ein Arbeitstag, sie haben ein eigenes
  Feld im Vordruck.
- Ein Werktag im Ausbildungszeitraum ohne Text ist eine Lücke, ob ganz ohne Eintrag oder mit
  geleertem Text. Ein gesetzlicher Feiertag ohne Text fehlt nicht, Tage in der Zukunft auch nicht.

### Schulplan (`tagArt()`, `schultagLautPlan()`)

Unter „Deine Daten → Schule“ stehen feste Schultage (Mo–Fr) und Blockunterricht als Zeiträume
(`schulbloeckeLesen()`: `02.03.–20.03.2026; 04.05.2026–22.05.2026`, auch ISO-Daten und ein
einzelner Tag). `tagArt()` liefert für einen Tag die gespeicherte Art oder, wenn der Tag nichts
Eigenes hat (keine Art, kein Text, keine Buchungen, keine Stunden, nicht `artVonHand`), laut Plan
„Berufsschule“. Feiertage und Tage außerhalb der Vertragslaufzeit sind nie Schultage.

- Nur leere Tage: Ein Tag mit Buchungen kann in den Schulferien liegen. Den ändert der Plan nicht,
  auch nicht beim Import.
- Gespeichert wird die Art erst, wenn am Tag geschrieben oder gewählt wird. Tagesansicht und
  Reiter lesen `tagArt()`; Stand, Lücken, Export und Server lesen die gespeicherte Art. Ein leerer
  Schultag ist so dieselbe Lücke wie ein leerer Arbeitstag, und `server/stand.js` braucht keinen Plan.
- Wer an einem Tag „Arbeitstag“ wählt, setzt `artVonHand`. Ohne die Marke stünde der leere Tag
  gleich wieder auf dem Plan, und ein neuer Import setzte einen Feiertag zurück.
- Die Schalter im Dialog spiegeln das versteckte Feld `f-schultage`; nur das wird gespeichert und
  mit dem Konto abgeglichen.

### Spalten erkennen (`csvAnalysieren()`)

1. **Zeichensatz:** UTF-16 an der Bytefolge, sonst streng UTF-8, bei Fehlern Windows-1252.
2. **Trennzeichen:** das häufigste aus `;`, `,` und Tabulator in den ersten Zeilen.
3. **Kopfzeile:** unter den ersten zehn Zeilen die, zu der die meisten Felder passen
   (Titel- und Filterzeilen darüber fallen weg).
4. **Felder:** Jedes Feld in `FELDER` hat Namen auf Deutsch und Englisch und
   Ausschlusswörter. Punkte: exakter Name > Namensanfang > einzelnes Wort; die
   besten Paare zuerst, jede Spalte einmal. So wird `Start Date` Datum statt
   Beginn und `Billable Hours` keine Dauer.
5. **Datum mit Schrägstrich:** Die Reihenfolge ergibt sich aus allen Werten
   (`13/…` = Tag/Monat). Bleibt sie offen, wird gefragt.
6. **Sicher** ist eine Datei mit Datum, einer Textspalte, Dauer oder Beginn und
   Ende und fast nur lesbaren Daten. Sonst öffnet sich der Dialog; die bestätigte
   Zuordnung gilt künftig für dieselbe Kopfzeile.

`PROFILE` erkennt bekannte Werkzeuge nur für die Meldung, nicht für die Logik.
Ein neues Format braucht meist nur weitere Namen in `FELDER` und eine
Testdatei unter `test/daten/formate/`.

### Import (`importAnwenden()`)

Ein Import ergänzt das Heft. Tage aus dem neuen Export werden neu aufgebaut;
vom gespeicherten Stand bleibt nur, was jemand selbst geschrieben hat – also
Text, der weder dem alten Entwurf noch der alten Modellausgabe entspricht.
Sonst gingen neu hinzugekommene Buchungen verloren.

Der Stand vor dem Import wird gemerkt: **Spalten prüfen** in der Fußleiste stellt
ihn wieder her und importiert mit der geänderten Zuordnung neu.

## Entwurf und Bereinigung

### Vom Export zum Entwurf

- Jede Buchung wird eine Zeile `Projekt: Beschreibung`, chronologisch, ohne Uhrzeit.
- Das Projekt steht nur davor, wenn es etwas beiträgt: nicht bei Nummern
  (`LS KW37 32600222`), nicht bei Einträgen aus **Projektnamen nicht
  voranstellen** (Vorgabe `Ausbildung, intern`), nicht wenn es schon in der
  Beschreibung steht.
- Doppelte Zeilen erscheinen einmal; Zeilen, die nur aus Statusnotizen
  bestehen, fallen weg.
- **Nicht ins Heft übernehmen** schließt Projekte oder Tätigkeiten ganz aus.
- Mehr als `ENTWURF_MAX` (10) Zeilen werden zu gleich großen Gruppen
  benachbarter Buchungen zusammengezogen.

Nach Dauer wird bewusst nicht gefiltert: Wichtigkeit steckt nicht in der Uhr.

### Was die Bereinigung ersetzt

| Was | aus dem Export | im Heft |
| --- | --- | --- |
| Ticketnummern | `Ticket #149725 gelöst` | `Ticket gelöst` |
| Geräte | `NB1234`, `PC-07`, `SRV-DC01`, `ABCSRVEX04` | `Notebook`, `PC`, `Server`, `Server` |
| Anrede mit Namen | `Rücksprache mit Herr Weber` | `Rücksprache mit einem Kollegen` |
| Vorname | `Unterstützung von Michael` | `Unterstützung von einem Kollegen` |
| mehrere Personen | `mit Frau Bauer und Herr Klein` | `mit Kollegen` |
| Kunde (aus der Kundenspalte) | `Support Meyer AG` | `Support Kunde` |
| Erwähnungen, Mailadressen | `@mweber`, `info@firma.de` | entfernt |
| Zeiten und Datum | `08:00 – 16:30`, `am 12.09.2026` | entfernt |
| Notizsprache | `Kunde Call`, `Weekly`, `f.`, `bzgl.` | `Kundengespräch per Telefon`, `wöchentliche Teambesprechung`, `für`, `bezüglich` |
| Trennzeichen | `Setup - Installation \| Test` | `Setup, Installation, Test` |
| Statusnotizen | `ERLEDIGT: …`, `… (ok)` | entfernt |

Eine Präposition direkt vor einer entfernten Kennung geht mit weg
(`Fehler an PC11 behoben` → `Fehler behoben`).

### Wo die Regeln absichtlich eng sind

| Regel | Damit bleibt stehen |
| --- | --- |
| Zahlen nur mit Ticketwort davor oder in Klammern | `AES256`, `ISO9001`, `RFC1918` |
| Gerätekürzel nur direkt an der Ziffer, Jahreszahlen ausgenommen | `Windows 10`, `RAID 5`, `Office-365`, `WS2019` |
| Namen nur mit Anrede, Titel oder bekanntem Vornamen | `Bestellung bei Wortmann` |
| Firmierungen schützen | `Friedrich Brandt GmbH` |
| Alltagswörter sind keine Nachnamen | `Anna Konferenz` |
| Abgekürzte Anrede nur mit Punkt | `MS Office`, `HR Abteilung` |
| Bindestriche im Wort bleiben | `E-Mail`, `IT-Einrichtung` |

Bewusst in Kauf genommen: Ein bekannter Vorname allein wird zu `Kollege`,
auch wenn ein System so heißt (`Lena Server aufgesetzt`). Namen, die keine
Regel erkennt, trägt man unter **Namen und Kürzel entfernen** ein; ein Kürzel
dort nimmt auch die Nummer dahinter mit (`PRJ-1234`).

**Jede Regeländerung braucht Fälle in `test/korpus.js`**, vor allem in
`BLEIBT_EXAKT`: Eine zu gierige Regel fällt sonst erst auf, wenn im Heft Unsinn
steht.

## Sprachmodell

Einstellungen: **Adresse** (leer = Funktion aus), **Modell** (leer = das erste,
das `/api/tags` meldet; es wird dann ins Feld geschrieben) und **Eigene Anweisungen** (höchstens
`KI_ANWEISUNGEN_MAX` Zeichen). `kiSystem()` hängt die Anweisungen an den
Prompt an und wiederholt danach, dass Format und das Verbot, etwas zu
erfinden, vorgehen – ersetzt wird der Prompt nie.

Ablauf je Tag (`kiTagKuerzen()`):

1. `fuersModell()` bereinigt den Text erneut und gibt die Tätigkeiten als
   Liste aus – wie viele es sind, spielt keine Rolle.
2. Eine Anfrage mit `kiPrompt(n)`: höchstens n Zeilen ohne Punkt am Ende,
   die den Tag zusammenfassen. `temperature 0.2`, `top_p 0.8`, `top_k 20`,
   fester `seed`.
3. `zusammenlegen()` bringt die Antwort auf n Absätze:
   Verschmolzen wird immer das Nachbarpaar mit der kleinsten Zeichensumme,
   abgeschnitten wird nichts. `ohneSchlusspunkt()` nimmt Punkt, Semikolon
   und Komma am Zeilenende weg.
4. Das Ergebnis geht ins Feld, der alte Text steht in `vorKi`, die Freigabe
   des Tages fällt weg.

**n = Stichpunkte je Tag** (`stichpunkteJeTag()` in `grundlagen.js`): steht in
„Deine Daten → KI“, 1 bis 6, Vorgabe 4. Jeder Betrieb hat eigene Vorgaben; mehr
als sechs Zeilen fasst ein Tag im Vordruck nicht. Dieselbe Zahl gilt für die
Meldung „wird eng“ im Textfeld und die Kontrolle vor dem Export.

Das Beispiel im Prompt legt `zusammenlegen()` selbst auf n Zeilen zusammen,
damit es der verlangten Zahl nie widerspricht. Es zeigt auch das Maß, das der
Ausbilder für „zusammengefasst“ vorgegeben hat: zwei Ubuntu- und eine
Debian-Installation werden „Installation Ubuntu 2x und Installation Debian 1x“ –
gezählt statt aufgezählt, ohne Geräte.

**Allgemein statt ausführlich:** Gefragt sind Arbeitsbereiche („Softwareinstallation“,
„Netzwerkanalyse“), höchstens sechs Wörter je Zeile, ohne Programme, Versionen, Ports, Ticketnummern,
Räume und Kunden. Hersteller- und Werkzeugnamen ersetzt das Modell durch die Gattung
(Fernwartung, Ticketsystem, Fernüberwachung); Betriebssysteme und verbreitete Technik (Windows,
Linux, VPN, RAID, Active Directory) bleiben stehen, sie benennen das Gelernte. Vorher verlangte der
Prompt, Namen unverändert abzuschreiben, und das Beispiel war selbst ausführlich: Gemessen an sieben
Tagen aus den Testdaten (`qwen3.5:4b`) kamen im Schnitt 10,7 Wörter je Zeile samt „Port 443 TCP“ und
Stockwerken, danach 4,9. Die Zählzeile des Ausbilders ist länger und bleibt. Kein Thema mit
Doppelpunkt vorne: Das Modell schrieb sonst „Serverwartung: …“ ab. `taetigkeiten()` wirft nur wortgleiche
Zeilen zusammen; ähnliche Zeilen kommen einzeln an, damit das Modell zählen kann.

Keine Punkte am Ende und die Vorgabe vier: So hat es der Ausbilder verlangt
(September 2026), sechs waren ihm zu viel.

Während des Laufs (`ki-lauf.js`) wird der Tagbereich nicht neu aufgebaut:
`kiKnoepfeSperren()` sperrt die vorhandenen KI-Knöpfe, den Fortschritt setzt
`zeichneFortschritt()` direkt ins Feld. Neu gezeichnet wird erst, wenn ein Tag
gekürzt wurde; nach Abbruch holt `kiKnopfZurueck()` nur den Knopf zurück.
Sonst sieht jeder Klick aus, als lade die Seite neu.

**Warum die Deckelung im Code steht und nicht im Prompt:** an Tagen mit 14
und 22 Positionen (Kimai-Exporte haben solche Tage) liefert kein Modell die
verlangte Zahl. Gemessen mit `qwen2.5:7b-instruct` und `qwen3.5:4b` über acht
Prompt- und Strukturvarianten – flache Liste, nach Projekt gruppiert, Zielzahl
vorn und hinten, Wortgrenze, Zeichenbudget, zweiter Durchgang – kamen 8, 8, 8,
9, 9, 12, 13 und 19 Absätze zurück. Die Zahl richtet sich nach den Themen des
Tages, nicht nach der Anweisung.

Die Textmenge ist dabei kein Problem: Das 7b-Modell braucht für einen
22-Positionen-Tag rund 510 Zeichen, es verteilt sie nur auf zehn Absätze, und
jeder Absatz kostet im Vordruck eine Zeile. Nach dem Zusammenlegen sind es
sechs Absätze, Bedarf 6 von 6, längste Zeile 123 Zeichen. Mit `qwen3.5:4b`
reicht es nicht (rund 970 Zeichen, Bedarf 10) – kleine Modelle schreiben zu
viel, dagegen hilft auch Zusammenlegen nicht.

Nachmessung mit vier Zeilen (`qwen2.5:7b-instruct`, neun echte Tage mit 6 bis
12 Positionen): Das Modell lieferte jedes Mal genau vier Absätze, keinen mit
Punkt am Ende, 256 bis 480 Zeichen. An zwei Tagen war eine Zeile länger als
`ZEICHEN_JE_ZEILE` (196 und 202 Zeichen); dort meldet der Export „wird eng“
mit Bedarf 5 von 4. Tage mit 14 und mehr Positionen waren nicht dabei.

Was dagegen ersatzlos weg ist: die zweite, strengere Anfrage bei falscher
Zeilenzahl, das Nachkürzen zu langer Zeilen in weiteren Modellrunden und die
Meldung über auffällige Wörter, die im Ergebnis fehlen. Die Wortprüfung hat in
vier echten Läufen kein einziges Mal angeschlagen – die Modelle ließen keine
Namen weg. Seit dem allgemeinen Prompt sollen sie das bewusst, eine Wortprüfung wäre jetzt falsch.

Zeitgrenzen: Verbindungsprüfung über `/api/tags` 8 s, Anfrage 220 s. Der
Wochenlauf arbeitet die Tage nacheinander ab und lässt sich abbrechen.

## Ausgabe

`wochenTexte()` verteilt eine Woche auf die drei Felder des Vordrucks:

| Feld | Inhalt |
| --- | --- |
| Betriebliche Tätigkeit | Arbeitstage mit Text; Urlaub, Krank, Feiertag mit ihrem Grund |
| Unterweisungen … | Text aus dem Wochenreiter, Tage mit Art „Betriebsversammlung“ |
| Berufsschule | Tage mit Art „Berufsschule“ |

Jede Textzeile wird ein Stichpunkt, durchgehend in normaler Schrift; fett
ist nur der Wochentag darüber. Punkt, Semikolon und Komma am Zeilenende fallen weg
(`ohneSchlusspunkt()`), Abkürzungen wie „usw.“ oder „z. B.“ behalten ihren
Punkt. Das gilt für jeden Text, auch den selbst geschriebenen; im Eingabefeld
bleibt er unverändert. Zeiten und Stunden erscheinen nicht.

**Kopfleiste** von links nach rechts: Nr., Ausbildungsjahr, Ausbildungswoche,
Ausbildungsabteilung, Name – in Word (`kopfLeiste()`) und Druck
(`druckBlattSeite()`) gleich. Das Ausbildungsjahr kommt aus dem
Ausbildungsbeginn, ersatzweise aus dem eingetragenen Lehrjahr.

**Dichte:** Nach der Textmenge wählt `dichte()` eine von drei Stufen
(`MASSE` in Word, `.dicht-1/2` im Druck-CSS).

**Word:** Jedes Wochenblatt ist ein eigener Abschnitt mit Kopfzeile für
Folgeseiten. Das Gesamtheft beginnt mit Deckblatt und Ausbildungsgang.

**Druck:** Passt eine Woche gemessen nicht auf ein Blatt (`#messung`,
`SATZ_HOEHE_MM`), teilt `druckBlatt()` den Kasten „Betriebliche Tätigkeit“
auf mehrere Blätter; Schlussfelder und Unterschriften stehen auf dem letzten.

**Vorschau:** Der Wochenreiter zeigt das Blatt aus `druckBlattSicher()`,
verkleinert per `transform`. Dieselbe Quelle wie der Druck, also auch
dieselbe Aufteilung auf mehrere Blätter.

**Kontrolle vor dem Export:** Tage mit nicht übernommenem Text oder mehr als
Stichpunkten je Tag werden aufgelistet, ebenso ein fehlendes
Ausbildungsjahr (sonst stünde im Kopf nur „2 /“); exportieren lässt sich trotzdem.

## Tests

```bash
npx playwright install chromium firefox   # einmalig
npm run build
npm test
```

| Datei | Prüft |
| --- | --- |
| `test/lokal.js` | Einzeldatei: offline, keine fremden Adressen, Bibliothek im Klartext; Import, Word, PDF, Sicherung und Beispiel ohne eine Anfrage nach draußen (mit Gegenprobe) |
| `test/import.js` | Formate unter `test/daten/formate/`, Werte, Zeichensatz, Zuordnungsdialog, gemerkte Zuordnung, Beispiel |
| `test/vorbehandlung.js` | Bereinigung gegen `test/korpus.js`, Vorlage für das Modell |
| `test/ki.js` | Anbindung gegen einen nachgebauten Ollama: Prompt, Warnungen, Fehler, Wochenlauf, Abbruch; Anfragen nur an das eigene Ollama |
| `test/lauf.js` | Oberfläche von Import bis Word und Druck, Import-Zusammenführung, Rundgang, Löschen; Feiertage und Wochenstand gleich wie auf dem Server |
| `test/sicherung.js` | Sicherung speichern, in einem leeren Browser und in Firefox laden, Rückfrage beim Ersetzen, fremde Datei, Stempel aus älteren Sicherungen |
| `test/schulplan.js` | Feste Schultage und Blockunterricht: welche Tage der Plan trifft (Feiertag, Wochenende, Vertragslaufzeit, Tage mit Buchungen), Speichern erst beim Schreiben, „Arbeitstag“ von Hand übersteht Neuladen und Import, Beispiel |
| `test/handy.js` | Bei 390 und 320 px: keine Sperre, nichts ragt über den Rand, Woche in voller Breite, Meldung höchstens zwei Zeilen, Knöpfe im Zuordnungsdialog nicht auf dem scrollenden Bereich |

Die Tests der zweiten Betriebsart (`server/test/testen.sh` und `server/test/betrieb.sh`, beide
mit Docker) stehen in [SERVER.md, Abschnitt Tests](SERVER.md#tests).

Die Tests laufen gegen `dist/` und nutzen die Zugänge `window.__saeubern`,
`window.__csvAnalysieren` usw. aus `start.js`. Gemeinsame Helfer stehen in
`test/hilfen.js`. Seiten mit `file://` öffnen die Tests mit `h.oeffnen()` zweimal: `ohneRundgang()`
schreibt schon beim Dokumentstart in den Speicher. Das ist genau der frühe Zugriff, der den
Speicher abkoppeln kann, und `speicherNeuLaden()` sieht dann keinen leeren Speicher. Ohne das
zweite Öffnen verlor ein Test in rund 13 % der Läufe beim nächsten Neuladen seine Daten (so wackelte
`test/sicherung.js`). Testdaten sind ausgedacht; echte Namen, Kunden oder
Firmendaten gehören weder in `test/` noch in `src/beispiel.csv`.

## Bilder im README

`docs/bilder/*.png` entstehen aus dem Beispielheft, damit sie nach
Oberflächenänderungen gleich aussehen:

```bash
npm run build
node docs/bilder/aufnehmen.js
```

`docs/bilder/server/*.png` (Anmeldung, Azubi mit Konto, Ausbilder) nimmt der Betriebstest auf:
`bash server/test/betrieb.sh --bilder`.

## Veröffentlichen

| Was | Wie |
| --- | --- |
| Tests | `.github/workflows/tests.yml` bei jedem Push und Pull Request |
| Demo | `.github/workflows/pages.yml` baut `dist/` bei jedem Push auf `main` nach GitHub Pages. Einmalig in den Repo-Einstellungen: *Pages → Source → GitHub Actions*. |
| Download | `.github/workflows/release.yml`: Ein Tag `v*` legt ein Release mit `Berichtsheft.html` an. |
| Updates | `.github/dependabot.yml` schlägt monatlich neue npm-Pakete, Images und Actions vor, je Bereich in einem gesammelten Pull Request. Die selbst gebauten Images `berichtsheft` und `berichtsheft-server` sind ausgenommen. |

Neue Fassung:

1. `version` in `package.json` und `server/package.json` und `image:` in beiden
   `docker-compose*.yml` anheben.
2. In `CHANGELOG.md` „Unveröffentlicht“ in die neue Version mit Datum umbenennen und
   den Vergleichslink am Ende ergänzen.
3. `npm run build && npm test`, dazu `bash server/test/testen.sh` und `bash server/test/betrieb.sh`
   (der Betriebstest mit Keycloak läuft nicht in der CI).
4. Committen, dann `git tag vX.Y.Z && git push origin main vX.Y.Z`.

Der Speicheraufbau (`berichtsheft-v1`) muss abwärtskompatibel bleiben: Ältere
Stände und Sicherungen werden beim Laden gelesen, nicht verworfen. Wer das
Format grundlegend ändert, braucht einen neuen Schlüssel und einen Umzug in
`grundlagen.js`.
