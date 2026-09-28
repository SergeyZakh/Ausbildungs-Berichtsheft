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
| `zustand.js` | Stand je Tag/Woche (`wochenBilanz()`: was eine Woche noch braucht), Schulplan (`tagArt()`), Blockwoche (`blockwoche()`, `tagImWochenfeld()`), nächster offener Tag (`naechsterOffenerTag()`), Stammdaten, Speichern, Zeitstempel für den Abgleich, Fußleistenmeldung `sage()` (bei offenem Dialog auch im Dialog, am Handy nach acht Sekunden leise) |
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
| `ansicht-woche.js` | Wochenbalken, Monatsraster, Navigation durch jede Kalenderwoche, nach „Fertig“ weiter zum nächsten offenen Tag (`weiterNachFertig()`) |
| `reiter.js` | `zeichnen()`, Reiterzeile: je Werktag ein Reiter, dazu der Reiter „Woche“; in einer Blockwoche nur der Reiter „Blockwoche“ |
| `ansicht-tag.js` | Bausteine der Karten (`sektion()` mit kurzem Titel fürs Handy, `mitRueckfrage()`) und der Tagbereich: Text, Buchungen mit Plus zum Übernehmen, KI-Knopf, Startkarte ohne Woche |
| `wochenblatt.js` | Reiter „Woche“: Angaben, Blattvorschau (`blattVorschau()`), rechts `seitenspalte()` – eine Karte „Wochenblatt“ mit Umfang, Vordruck (`vordruckSchalter()`), KI und Herunterladen |
| `schulwoche.js` | Themen einer Blockwoche (`schulwocheSektion()`), die Tage der Blockwoche mit ihrer Art, Fächer zum Antippen über Schultexten (`faecherLeiste()`) |
| `stammdaten.js` | Dialog „Deine Daten“, Verbindungsprüfung, Löschen und Verwerfen |
| `zeitraum.js` | Blockunterricht und Schulferien als Marken, Kalender zum Wählen (`zeitraumOeffnen()`), Zusammenlegen überlappender Zeiträume |
| `farbe.js` | Knopf hell/dunkel in der Kopfleiste; der Wechsel als Kreisblende vom Knopf aus (View Transitions), ohne die Übergänge einzelner Elemente |
| `rundgang.js` | Rundgänge beim ersten Start, für Azubis und für Ausbilder |
| `hinweise.js` | Hinweis über den Reitern: Tipp fürs iPhone, fällige Sicherung, was beim Öffnen fehlt (`offeneWochen()`) |
| `uebersicht.js` | Dialog „Übersicht“: je Ausbildungsjahr ein Kästchen pro Woche und die Tage je Art (`uebersichtDaten()`) |

**`ausgabe/`**

| Datei | Inhalt |
| --- | --- |
| `word.js` | Word-Dokument mit der Bibliothek `docx`; beide Vordrucke, `tagesZeilen()` für die tägliche Notierung |
| `druck.js` | Druckblätter beider Vordrucke, Messen und Aufteilen voller Wochen (`druckAufteilen()`) |
| `export.js` | Kontrolle vor dem Export, Downloads, Exportknöpfe |

**`konto/`** (nur mit Berichtsheft-Server)

| Datei | Inhalt |
| --- | --- |
| `konto.js` | Anmelden, Abgleich mit dem Server (`kontoPaket()`, `kontoUebernehmen()`), Anzeige „im Konto gesichert“; ohne Server still |
| `ausbilder.js` | Ansicht für Ausbilder: Auswahl, Heft eines Azubis mit Monatsraster und Blattvorschau, Export über `mitAzubiStand()`, Gruppe |

## Dateien in `src/css`

Reihenfolge wie in der Liste `CSS` in `build.js`: `basis.css` (Farben als Variablen, der dunkle
Modus tauscht sie unter `prefers-color-scheme: dark`; Schrift, Grundgerüst),
`leiste.css` (Kopfleiste, Wochenbalken, Reiter), `tag.css` (Tagbereich, Sektionen, Wochenansicht,
Eingaben, Meldungen), `dialoge.css` (Monatsraster, „Deine Daten“, Zuordnung, Rundgang),
`handy.css` (alle `@media`-Regeln für Handy und Tablet; dort stehen die Tagesreiter in einer Zeile
mit der Woche breit darunter, und der Tageskopf `.artkopf` mit Datum, Art und Stunden in einer Zeile, damit das Schreibfeld auch mit
offener Tastatur Platz hat; die Regeln greifen auch beim Drucken, denn A4 ist schmaler als 820 px,
also dort keine Klassen aus dem Blatt wie `.tagkopf`, `.kasten` oder `.tagestabelle` verwenden),
`ausbilder.css` (Konto und Ausbilderansicht),
`blatt.css` (der Drucksatz des Vordrucks).

## Datenmodell

`localStorage["berichtsheft-v1"]`:

```text
stamm   Stammdaten und Einstellungen; Schlüssel = Feld-ID ohne "f-"
        (kiAdresse ↔ f-ki-adresse); schultage "Di, Mi", schulbloecke und
        schulferien als Text; vordruck "" (wöchentlich) oder "taeglich"
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
wochen  Montag → { abteilung, unterweisungen, schule, schuleGeprueft }
        schule          Themen der Berufsschule für die ganze Woche (Blockwoche)
        schuleGeprueft  true = diese Themen sind übernommen
kunden  Kundennamen aus dem letzten Import
stand   { woche, tag } zuletzt geöffnet
geaendert { stamm, jeWoche }  letzte Änderung der Stammdaten; je Montag die der Wochenangaben
hinweise { gesichert, sicherungSpaeter, homeBildschirm }  nur dieser Browser, nie im Konto:
        letzte Sicherung, „Später“ bei der Erinnerung, Tipp fürs iPhone weggeklickt
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

`localStorage["berichtsheft-farbe"]`: `"hell"` oder `"dunkel"`, wenn der Knopf in der Kopfleiste vom
Gerät abweicht; sonst fehlt der Eintrag, und die Seite folgt `prefers-color-scheme`. Ein kleines
Skript im Kopf von `index.html` setzt daraus `data-farbe` am `html`-Element, bevor etwas gezeichnet
wird. `basis.css` führt die dunklen Farben deshalb zweimal (für das Gerät und für `data-farbe`);
`test/hinweise.js` prüft, dass beide gleich sind. Beim Umschalten sind die Übergänge einzelner
Elemente aus (Klasse `farbwechsel`): Sonst blendeten Knöpfe über 0,15 s über, während Text und Kanten
sprangen. Darüber zieht eine View Transition die neue Farbe als Kreis vom Knopf auf; ohne diese
Schnittstelle oder mit „Bewegung reduzieren“ wechselt die Seite in einem Schritt.

### Stand eines Tages (`tagStand()`)

| Stand | Bedeutung | Farbe |
| --- | --- | --- |
| `leer` | kein Text | – |
| `roh` | `text === entwurf` | rot, Marke „E“ |
| `ki` | `text === kiText` | rot, Marke „KI“ |
| `eigen` | selbst geschrieben, nicht übernommen | rot, Marke „!“ |
| `fertig` | `geprueft` | grün, Haken |

Jede Änderung am Text hebt `geprueft` auf. Übernommene Tage sind
schreibgeschützt, bis man **Bearbeiten** drückt.

### Stand einer Woche (`wochenStand()`)

Dieselben Regeln wie beim Ausbilder (`wochenUebersicht()` in `server/stand.js`); `test/lauf.js`
vergleicht beide Seiten Fall für Fall.

- Urlaub, Krank und Feiertag sind frei und brauchen keinen Text.
- Berufsschule und Betriebsversammlung brauchen Text wie ein Arbeitstag, sie haben ein eigenes
  Feld im Vordruck.
- Ein Werktag im Ausbildungszeitraum ohne Text ist eine Lücke, ob ganz ohne Eintrag oder mit
  geleertem Text. Ein gesetzlicher Feiertag ohne Text fehlt nicht, Tage in der Zukunft auch nicht.
- Hat die Woche Themen für die Berufsschule (`wochen.schule`), steht jeder Werktag ohne eigenen
  Text, der nicht frei ist, unter ihnen und hat ihren Stand (`tagImWochenfeld()`). Das gilt für
  jeden solchen Tag, nicht nur für Schultage laut Plan: Der Server kennt den Plan nicht.

### Schulplan (`tagArt()`, `schultagLautPlan()`)

Unter „Deine Daten → Schule“ stehen feste Schultage (Mo–Fr), Blockunterricht und Schulferien als
Zeiträume (`schulbloeckeLesen()`: `02.03.–20.03.2026; 04.05.2026–22.05.2026`, auch ISO-Daten und ein
einzelner Tag). In den Ferien entfallen die festen Schultage; ein Block gilt auch dort.
Getippt werden Blöcke und Ferien nicht mehr: `zeitraum.js` zeigt sie als Marken mit ×, und „Im
Kalender wählen“ öffnet ein Monatsraster (am Rechner zwei Monate, am Handy einer). Oben stehen die
zwei Schritte (erster Tag, letzter Tag, dazu die Werktage ohne Feiertage), ein Zeitraum ist ein helles
Band mit dunklen Kreisen an Anfang und Ende. Erster Tag, letzter Tag, in beliebiger Richtung;
Überlappendes wird ein Zeitraum (`zeitraeumeOrdnen()`). Gespeichert wird
weiter der Text in `f-schulbloecke` und `f-schulferien`, den ältere Stände und das Konto kennen; was
darin unlesbar ist, steht als rote Marke da, bis man es entfernt. `tagArt()` liefert für einen Tag die gespeicherte Art oder, wenn der Tag nichts
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

### Blockwoche (`blockwoche()`, `schulwoche.js`)

Der wöchentliche Vordruck hat für die Berufsschule ein Feld je Woche. Ist in einer Woche jeder
Werktag Berufsschule oder frei, gibt es deshalb statt der sieben Tagesreiter nur den Reiter
„Blockwoche“ und im Reiter „Woche“ oben ein Feld für die Themen der ganzen Woche, darunter die fünf
Tage mit ihrer Art. Einmal schreiben, einmal „Fertig“: Die Woche ist dann 5/5.

`blockwoche()` verlangt:

- den wöchentlichen Vordruck: Der tägliche braucht eine Zeile je Tag, dort bleiben die Reiter;
- keinen Tag mit eigenem Text: Geschriebenes bleibt, wo es steht, die Woche bleibt tageweise;
- jeden Werktag Berufsschule (gespeichert oder laut Plan) oder frei: Urlaub, Krank, Feiertag
  (gespeichert oder gesetzlich ohne Eintrag), außerhalb der Ausbildung;
- mindestens zwei Schultage: Ein fester Schultag in einer Urlaubswoche ist kein Block.

Wer in der Liste der Tage „Arbeitstag“ wählt (`artVonHand`), macht die Woche wieder tageweise; die
Themen bleiben im Reiter „Woche“ stehen und decken weiter die Tage ohne eigenen Text. Ein solcher
Tag sagt das in der Tagesansicht (`wochenfeldHinweis()`).

Die Themen stehen in `wochen[montag].schule`, übernommen mit `schuleGeprueft`, und gehen mit
Abteilung und Unterweisungen ins Konto (`wocheKennung()` enthält beide). Eine Woche mit Themen
gehört zu `wochen` (`wochenNeu()`), auch ohne einen Tageseintrag: Sonst fehlte sie im Gesamtheft.

### Fächer zum Antippen (`faecherLeiste()`)

Über jedem Text an einem Tag „Berufsschule“ und über den Themen einer Blockwoche stehen die
Fächer als Knöpfe. Sie kommen aus dem Geschriebenen: jede Zeile „Fach: Thema“ an Schultagen und in
Blockwochen (`fachAusZeile()`, höchstens vier Wörter vor dem Doppelpunkt), zuletzt benutzte zuerst,
höchstens acht. Ein Tipp schreibt „Fach: “ als neue Zeile; steht das Fach schon da, kommt ein Komma
ans Ende seiner Zeile. Im leeren Feld schreibt „Fächer wie am …“ alle Fächer des letzten Schultexts
davor untereinander. Einrichten muss man nichts; der Platzhalter zeigt „LF5: Subnetting und VLANs“,
damit es beim nächsten Mal Knöpfe gibt.

### Weiter nach „Fertig“ (`naechsterOffenerTag()`)

„Fertig“ am Tag und bei den Themen einer Blockwoche springt zum nächsten Tag, der noch etwas
braucht (`tagBrauchtNoch()`, die Regeln von `wochenBilanz()`), auch in eine andere Woche. Gesucht
wird bis heute oder bis zum letzten Eintrag (`offenerTagAb()`), und nur nach vorn: Wer den heutigen
Tag fertig macht und ältere Lücken hat, soll nicht an den Anfang der Ausbildung geworfen werden.
Dann nennt die Meldung „Danach ist nichts mehr offen“ und bietet den frühesten offenen Tag als
Knopf an (`ersterOffenerTag()`). Nach einem Sprung führt „Zurück“ hinter der Meldung wieder her.

### Hinweise und Übersicht (`hinweise.js`, `uebersicht.js`)

Über den Reitern steht höchstens ein Hinweis, der wichtigste zuerst; wer einen wegklickt, hat für die
Sitzung Ruhe. `hinweiseZeigen()` läuft bei jedem `zeichnen()` und blendet einen unveränderten Hinweis
nicht neu ein.

1. **Tipp fürs iPhone** (Safari, nicht als App, ohne Konto, über http): Safari löscht Seitendaten
   nach sieben Tagen Safari-Nutzung ohne Besuch der Seite, vom Home-Bildschirm aus nicht. Dort hat die
   Seite aber einen eigenen Speicher und beginnt leer, deshalb der Weg über die Sicherung. Die Meta-
   Angaben `apple-mobile-web-app-capable` und das Symbol stehen in `index.html`. Weggeklickt bleibt er
   weg (`hinweise.homeBildschirm`).
2. **Sicherung fällig** (ohne Konto): Die letzte Sicherung (`hinweise.gesichert`, gesetzt von
   `sicherungSpeichern()`) oder ohne sie die erste Änderung liegt `SICHERUNG_TAGE` (14) zurück, und
   seitdem hat sich ein Tag geändert (`geaendert`). „Später“ schiebt um dieselbe Zeit.
3. **Was fehlt noch?** Nur, wenn beim Öffnen etwas fehlte; nach einem Import oder dem Beispiel käme er
   sonst sofort. `offeneWochen()` geht vom Ausbildungsbeginn (ohne ihn vom ersten Eintrag) bis vor die
   laufende Woche und fragt je Woche `wochenBilanz()`: Tage ohne Text, ungelesene Tage und der erste
   davon, nach denselben Regeln wie `wochenStand()`. Der Sprung führt auf diesen Tag.

Die **Übersicht** (Menü ⋯) zeigt je Ausbildungsjahr (Grenzen ab dem Ausbildungsbeginn, das Jahr einer
Woche nach ihrem Montag wie im Vordruck) ein Kästchen pro Woche: fertig, nicht gegengelesen, Text
fehlt, nichts nötig, kommt noch. Darunter die Tage je Art bis heute nach `tagArt()`, also mit
Schultagen laut Plan; ein leerer gesetzlicher Feiertag zählt als Feiertag.

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
| Berufsschule | Themen einer Blockwoche ohne Wochentag davor, dann Tage mit Art „Berufsschule“ |

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

**Tägliche Notierung:** der zweite Vordruck der IHK, gewählt mit `stamm.vordruck = "taeglich"`
(„Deine Daten → Verarbeitung“ oder der Schalter neben der Vorschau). `tagesZeilen()` in `word.js`
liefert je Tag eine Zeile mit Datum und Art, Montag bis Freitag immer, das Wochenende nur mit
Eintrag, zuletzt die Themen einer Blockwoche (die Tage darunter stehen als „Berufsschule“) und die
Unterweisungen der Woche. Stunden stehen auch hier nicht im Blatt: Die IHK fragt
nach Tätigkeiten, nicht nach Stunden.
`wochenSeite()` und `druckBlatt()` wählen den Vordruck selbst, auch beim Ausbilder, der die
Stammdaten des Azubis mitbringt. Im Druck teilt `druckAufteilen()` eine volle Woche zeilenweise auf
wie beim wöchentlichen Blatt; in Word wiederholt sich die Kopfzeile der Tabelle auf jeder Seite.
Das Deckblatt nennt den Vordruck (`notierungTitel()`).

**Kontrolle vor dem Export:** Tage mit nicht übernommenem Text oder mehr als
Stichpunkten je Tag werden aufgelistet, ebenso nicht übernommene Themen einer Blockwoche und ein fehlendes
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
| `test/lauf.js` | Oberfläche von Import bis Word und Druck, Import-Zusammenführung, Rundgang, Löschen; Feiertage und Wochenstand gleich wie auf dem Server, auch in Blockwochen |
| `test/sicherung.js` | Sicherung speichern, in einem leeren Browser und in Firefox laden, Rückfrage beim Ersetzen, fremde Datei, Stempel aus älteren Sicherungen |
| `test/schulplan.js` | Feste Schultage, Blockunterricht und Schulferien: welche Tage der Plan trifft (Feiertag, Wochenende, Vertragslaufzeit, Tage mit Buchungen, Ferien), Kalender für Zeiträume (auch am Handy), Marken, Zusammenlegen, Unlesbares aus alten Ständen, Speichern erst beim Schreiben, „Arbeitstag“ von Hand übersteht Neuladen und Import, Beispiel |
| `test/vordruck.js` | Tägliche Notierung: Umschalten neben der Vorschau, Zeilen je Tag ohne Stunden, Unterweisungen, Word, Gesamtheft, Druck, Aufteilen einer vollen Woche, Wahl übersteht Neuladen |
| `test/blockwoche.js` | Blockwoche erkennen (Feiertag darin, ein einzelner Schultag, eigener Tagestext, Arbeitstag von Hand, tägliche Notierung), Themen schreiben und übernehmen, Stand 5/5, Wochenblatt und tägliches Blatt, Neuladen; Fächer zum Antippen und „Fächer wie am …“; „Fertig“ springt nur nach vorn weiter, „Zurück“, sonst Knopf zum frühesten offenen Tag; am Handy |
| `test/hinweise.js` | Hinweise beim Öffnen (was fehlt, Sicherung fällig, iPhone), Übersicht mit Tagen je Art und Ausbildungsjahr, Buchung übernehmen, Start ohne Woche, Legende, dunkler Modus vom Gerät und per Knopf (gleiche Farben), leise Meldung und kurzer Titel am Handy |
| `test/handy.js` | Bei 390 und 320 px: keine Sperre, nichts ragt über den Rand, Kopfleiste in zwei Zeilen ohne Lücke, Woche in voller Breite, Meldung höchstens zwei Zeilen, Knöpfe im Zuordnungsdialog nicht auf dem scrollenden Bereich |

Die Tests der zweiten Betriebsart (`server/test/testen.sh` und `server/test/betrieb.sh`, beide
mit Docker) stehen in [SERVER.md, Abschnitt Tests](SERVER.md#tests).

Die Tests laufen gegen `dist/` und nutzen die Zugänge `window.__saeubern`,
`window.__csvAnalysieren` usw. aus `start.js`. Gemeinsame Helfer stehen in
`test/hilfen.js`.

Die Tests öffnen die Seite über http: `h.starteBrowser()` startet einen kleinen Webserver für
`dist/` auf einem freien Port, `h.oeffnen()` nimmt dessen Adresse (`h.SEITE`). Über `file://`
verlor Chromium in CI gelegentlich, was die Seite direkt vor dem Neuladen gespeichert hatte
(Bundesland, geladene Sicherung, untergeschobener Tag); lokal trat das nie auf. Bei `file://`
bleiben nur Tests, die genau das prüfen, mit `h.DATEI_SEITE` bzw. `h.EINZELDATEI`: die
Einzeldatei (`test/lokal.js`), das Neuladen bei leerem Speicher (Rundgang in `test/lauf.js`) und die
Suche nach dem Sprachmodell (`test/ki.js`). Solche Seiten öffnet `h.oeffnen()` zweimal:
`ohneRundgang()` schreibt schon beim Dokumentstart in den Speicher. Das ist genau der frühe Zugriff,
der den Speicher abkoppeln kann, und `speicherNeuLaden()` sieht dann keinen leeren Speicher. Ohne
das zweite Öffnen verlor ein Test in rund 13 % der Läufe beim nächsten Neuladen seine Daten.

Testdaten sind ausgedacht; echte Namen, Kunden oder Firmendaten gehören weder in `test/` noch in
`src/beispiel.csv`.

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
