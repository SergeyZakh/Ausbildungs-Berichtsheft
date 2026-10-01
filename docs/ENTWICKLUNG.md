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
| `zustand.js` | Stand je Tag/Woche (`wochenBilanz()`: was eine Woche noch braucht), Schulplan (`tagArt()`), Blockwoche (`blockwoche()`, `tagImWochenfeld()`), nächster offener Tag (`naechsterOffenerTag()`), Stammdaten, Speichern, Zeitstempel für den Abgleich, Meldung `sage()`: am Rechner in der Fußleiste, nach acht Sekunden leise; am Handy schwebend über dem Inhalt, nach vier Sekunden weg (mit Knopf nach acht, eine Warnung erst mit ×, Tippen oder Wischen, `notizSchliessen()`); bei offenem Dialog auch im Dialog |
| `sicherung.js` | Sicherung als JSON speichern und laden, Rückfrage `frage()` |
| `bedienung.js` | Menüs und Tastatur; die Taste jedes Reiters steht am Rechner in seiner Ecke (`tasteZeigen()` in `reiter.js`) |
| `start.js` | Testzugänge (`window.__…`), Wiederherstellen des letzten Stands, beim ersten Start die Einrichtung (Azubis) oder der Rundgang (Ausbilder, am Handy nicht, `amHandy`) |

**`import/`**

| Datei | Inhalt |
| --- | --- |
| `csv.js` | Zeichensatz (`csvDekodieren()`), Trennzeichen, Felder; Datum, Uhrzeit und Dauer lesen |
| `bereinigung.js` | `saeubern()`: Regeln für Tickets, Geräte, Personen, Kunden, Notizsprache |
| `quellen.js` | Spalten erkennen (`FELDER`, `spaltenZuordnen()`), Kopfzeile finden, `csvAnalysieren()`, `buchungenLesen()`, `tageAusBuchungen()` |
| `entwurf.js` | `rohtext()`: aus Buchungen wird der Tagesentwurf |
| `schule.js` | Berufsschultag in der Zeiterfassung erkennen und erst nach Bestätigung setzen (`schultagAusBuchungen()`, `faecherListe()`, `schultageUebernehmen()`), Fächer je Zeile (`schulZeilen()`), Themen mehrerer Schultage einer Woche zusammenführen (`schulwochenZusammenfuehren()`) |
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
| `reiter.js` | `zeichnen()`, Reiterzeile: je Werktag ein Reiter, dazu der Reiter „Woche“, am Handy alle in einer Zeile (ein leeres Wochenende schmal, `.leerwe`); in einer Blockwoche nur der Reiter „Blockwoche“, der die Tage der Woche als Menü öffnet |
| `ansicht-tag.js` | Bausteine der Karten (`sektion()` mit kurzem Titel fürs Handy, `mitRueckfrage()`) und der Tagbereich: eine Karte je Tag (`textSektion()`, im Kopf Datum, Art und Stunden aus `tagFelder()`, über dem Text das Feld des Vordrucks), Buchungen mit Plus zum Übernehmen, KI-Knopf, Startkarte ohne Woche; ein freier Tag hat nur seinen Kopf (`artSektion()`) |
| `wochenblatt.js` | Reiter „Woche“: das Blatt (`blattVorschau()`), in dem jedes Feld beschreibbar ist, auch der Text jedes Tages, darüber eine ruhige Zeile; am Handy öffnet ein Tipp das Feld groß (`schreibblattOeffnen()`); `seitenspalte()` nur noch beim Ausbilder |
| `schulwoche.js` | Themen einer Blockwoche (`schulwocheFeld()`: Feld, Karte und die Knöpfe am Feld im Blatt) und die Tage der Blockwoche mit ihrer Art (`blockTageMenue()`) |
| `stammdaten.js` | Dialog „Deine Daten“ (Reiter Ausbildung, Schule, Vordruck, Deckblatt, KI, Löschen), Verbindungsprüfung, Löschen und Verwerfen |
| `berufe.js` | Ausbildungsberuf: eigene Liste beim Tippen (nach Bereichen, `BERUFE`), danach die Fachrichtung zum Antippen; gespeichert in `f-beruf` als „Fachinformatiker/in – Systemintegration“ (`berufsfeld()`, `berufTeilen()`) |
| `zeitraum.js` | Blockunterricht und Schulferien als Marken, Kalender zum Wählen (`zeitraumOeffnen()`), Zusammenlegen überlappender Zeiträume |
| `farbe.js` | Knopf hell/dunkel in der Kopfleiste; der Wechsel als Kreisblende vom Knopf aus (View Transitions), ohne die Übergänge einzelner Elemente |
| `rundgang.js` | Rundgang der Ausbilder beim ersten Start und über **?**; Azubis bekommen stattdessen die Einrichtung |
| `einrichtung.js` | Einrichtung beim ersten Start: die Angaben fürs Wochenblatt in sechs Schritten, jede Eingabe geht sofort in das Feld von „Deine Daten“ (`data-feld`) |
| `hinweise.js` | Hinweis über den Reitern: Ergebnis des letzten Imports mit „Spalten prüfen“ (`importKarte`, bleibt bis „Passt“ oder ×), Tipp fürs iPhone, fällige Sicherung, was beim Öffnen fehlt (`offeneWochen()`); am Handy jeweils die kurze Fassung (`kurz`) |
| `uebersicht.js` | Dialog „Übersicht“: je Ausbildungsjahr ein Raster der Werktage wie bei GitHub (`jahresRaster()`) und die Tage je Art (`uebersichtDaten()`) |

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
`leiste.css` (Kopfleiste: am Rechner die Woche als Titel mit `langSpanne()`, am Handy und beim
Ausbilder als Knopf mit `kurzSpanne()`; Wochenbalken, Reiter), `tag.css` (Tagbereich, Sektionen, Wochenansicht,
Eingaben, Meldungen), `dialoge.css` (Monatsraster, „Deine Daten“, Zuordnung, Rundgang),
`handy.css` (alle `@media`-Regeln für Handy und Tablet; dort stehen die Tagesreiter in einer Zeile
mit der Woche breit darunter, und im Kopf der Tageskarte `.tagkarte` steht das Datum allein, darunter Art, Stunden und „Fertig“ in einer Zeile, damit das Schreibfeld auch mit
offener Tastatur Platz hat; eine Fußleiste gibt es dort nicht, die Meldung schwebt als Karte über dem Inhalt, ohne Speicherstand und Signatur; die Regeln greifen auch beim Drucken, denn A4 ist schmaler als 820 px,
also dort keine Klassen aus dem Blatt wie `.tagkopf`, `.kasten` oder `.tagestabelle` verwenden),
`ausbilder.css` (Konto und Ausbilderansicht),
`blatt.css` (der Drucksatz des Vordrucks).

**Maße** stehen als Variablen oben in `basis.css`, und jede Regel nimmt eine dieser Stufen:

| Was | Stufen |
| --- | --- |
| Schrift | `--schrift-fein` 11, `-klein` 12, `-text` 13,5 (am Handy 14), `-gross` 15, `-titel` 18, `-kopf` 22 px; `--schrift-marke` 9 px nur für Buchstaben in Marken |
| Abstände (padding, margin, gap) | `--luft-1` bis `--luft-8`: 4, 8, 12, 16, 20, 24, 32, 40 px; 1 und 2 px nur für Haarlinien |
| Ecken | `--rund-klein` 8 px (Felder), `--rund` 12 px (Karten, Dialoge), `--rund-voll` (Knöpfe, Pillen), Kreise mit 50 % |
| Sperrung | `--sperrung` für Versal-Beschriftungen, `--sperrung-eng` für große Überschriften |
| Schriftstärke | 400 und 600 |

Was man klickt, ist rund (Textknöpfe als Pille, Symbolknöpfe als Kreis); was man ausfüllt oder
liest, hat Ecken. **Fenster** sind gleich gebaut: im Kopf der Titel links und ein × (`.dlg-x`)
rechts, im Fuß die Knöpfe rechts mit der Hauptaktion ganz außen, ein Hinweis links davon. Das ×
schließt jedes `<dialog>` wie Escape (`bedienung.js`); was dabei geschehen muss, hängt am
`close`-Ereignis des Fensters. Ohne × bleibt nur „Bitte anmelden“. Felder in Fenstern sind 40 px
hoch, in der Einrichtung 44 px. **Fokus:** Knöpfe und Marken zeigen eine Linie mit Abstand, Felder
eine dunkle Kante mit weichem Ring (`--fokus-ring`); nur das Schreibfeld des Tages hat eine Kante
oben. **Bewegung:** Fenster, Menüs und Popover erscheinen mit `auftauchen` (kurz von unten); unter
`prefers-reduced-motion` ohne. Ein Wert neben den Stufen braucht einen Kommentar, warum. `blatt.css` rechnet in
pt und mm des Vordrucks und bleibt davon ausgenommen.

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

`localStorage["berichtsheft-onboarding"] = "1"`: Einrichtung gesehen (`EINRICHTUNG_GESEHEN`; früher
hieß so der Rundgang der Azubis, wer ihn kannte, bekommt die Einrichtung nicht);
`berichtsheft-onboarding-ausbilder` dasselbe für den Rundgang der Ausbilder (`RUNDGANG_GESEHEN`).
Beides startet erst, wenn `kontoStarten()` die Rolle kennt.

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
  Im Monatsraster sind solche Tage ganz ohne Eintrag blassrot (`fehlenderWerktag()`), auch in
  Wochen ohne Daten.
- Hat die Woche Themen für die Berufsschule (`wochen.schule`), steht jeder Werktag ohne eigenen
  Text, der nicht frei ist, unter ihnen und hat ihren Stand (`tagImWochenfeld()`). Das gilt für
  jeden solchen Tag, nicht nur für Schultage laut Plan: Der Server kennt den Plan nicht.

### Einrichtung beim ersten Start (`einrichtung.js`)

Statt eines Rundgangs über eine leere Seite fragt das Werkzeug Azubis beim ersten Start in sechs Schritten,
was im Kopf jedes Wochenblatts steht: Willkommen (mit „Beispiel ansehen“ und „Sicherung laden“),
Vor- und Nachname/Beruf/Betrieb, Beginn/Ende und Bundesland, Berufsschule (feste Schultage, Blockunterricht im
Kalender), Vordruck, zuletzt „Zeiterfassung laden (CSV)“ oder „Selbst schreiben“. Pflicht sind die
Angaben aus `PFLICHT` in `stammdaten.js`; „Weiter“ nennt, was fehlt, und ein Ende vor dem Beginn.

- Die Felder der Einrichtung sind eigene (`w-…`), jedes nennt in `data-feld` sein Feld in „Deine
  Daten“. Jede Eingabe geht sofort dorthin und löst dort `input` aus; gespeichert und abgeglichen
  wird wie beim Tippen im Dialog. Schultage schreiben `f-schultage`, der Blockunterricht nutzt die
  Marken und den Kalender aus `zeitraum.js`.
- Vor- und Nachname sind hier und in „Deine Daten“ zwei Felder; gespeichert wird nur `f-name` als
  „Nachname, Vorname“ (`nameZusammen()`, `nameTeilen()` in `stammdaten.js`). Ein älterer Name ohne
  Komma teilt sich am letzten Leerzeichen. Die Pflichtangabe gilt erst mit beiden Teilen
  (`pflichtFehlt()`).
- Sie kommt nur, wenn noch nichts eingetragen ist (`einrichtungNoetig()`: keine Tage, kein Name,
  kein Beginn), nicht für Ausbilder, und erst nach `kontoStarten()`: Mit Konto bringt der Abgleich
  vorher mit, was schon eingetragen ist. Am Handy steht sie im Vollbild.
- „Später“, Escape und jeder Ausgang merken sie als gesehen (`berichtsheft-onboarding`). Fehlen
  dann noch Pflichtangaben, bietet die Startkarte „Jetzt einrichten“ an (`angabenFehlen()`).

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
„Blockwoche“. Ein Klick darauf öffnet die fünf Tage mit ihrer Art als Menü (`blockTageMenue()`),
etwa für einen Tag, an dem man krank war; es bleibt offen, solange es eine Blockwoche bleibt. Die
Themen der ganzen Woche schreibt man am Rechner direkt in den Kasten „Berufsschule“ des Blatts,
„Fertig“ sitzt unten rechts an diesem Feld. Einmal schreiben, einmal „Fertig“: Die Woche ist dann 5/5.
Über dem Feld steht nichts, weder Vorschläge noch Erklärungen; der Reiter sagt schon, dass es eine
Blockwoche ist.

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

### Reiter „Woche“ (`wochenblatt.js`)

Im Reiter steht das Blatt aus demselben Drucksatz wie das PDF, ohne Karte darum. Eine Leiste
darüber mit Stand, erstem offenem Tag, „passt auf ein Blatt“ und „Woche als Word · PDF“ gab es,
sie war zu viel: Der Stand steht in der Kopfleiste und in den Reitern, der Export unter
„Exportieren“. Über dem Blatt steht nur eine ruhige Zeile (`.blattzeile`): „✎ Ins Blatt klicken
und schreiben“ (am Handy „tippen“), „Montag, Dienstag …: der ganze Tag“ (nur, wenn Tage im Blatt
stehen), ein Tag, der noch etwas braucht, aber ohne Text gar nicht im Blatt steht („Donnerstag
ohne Text ›“, `fehltZeigen()`), die KI für die Woche und, nur wenn es so ist, „passt nicht auf ein
Blatt: 2 Blätter“.

Mit dem wöchentlichen Vordruck (`imBlattSchreiben()`) ist jedes Feld im Blatt eines zum Schreiben,
am Rechner wie am Handy. Die Felder für Abteilung, Unterweisungen und die Themen der Woche liegen
als `.blattfeld` genau auf ihrem Kasten (`data-feld` im Drucksatz), dazu eines über den Zeilen
jedes Tages mit Text (`.feld-tag`, `data-datum` an Kopf und Zeilen, `tageAuflegen()`). Gesetzt
werden sie nach jedem Zeichnen und bei jeder Größenänderung (`felderSetzen()`, `feldOrt()`), in
Schrift und Zeilenabstand des Blatts und mit dem Einzug hinter dem Punkt: Beim Schreiben liegt
der Text auf den gedruckten Zeilen, nur die Punkte fehlen. Stehen in einem Kasten der Woche auch
Tage (Berufsschule, Betriebsversammlung), endet sein Feld über dem ersten. Solange man nicht
schreibt, sind die Felder durchsichtig und ohne Rahmen: Man sieht das Blatt, wie es gedruckt wird.
Beim Drüberfahren tönt ein Feld sich leicht grau, ein leeres sagt in blassem Grau „Hier schreiben
…“. Wo man schreiben kann, sagt die Zeile darüber. Ein gelber Rahmen mit Fläche um jedes Feld war
zu laut, ein feiner grauer gestrichelter danach immer noch Unruhe über dem Vordruck. Das Blatt
ist auch im Dunkeln weiß, die Farben der Felder sind deshalb fest; die Regel `.tagpanel textarea`
darf sie nicht erreichen (sonst wurde das Feld beim Schreiben im Dunkeln schwarz). Beim Schreiben
wird das Feld weiß und wächst mit dem Text (`wachsen()`); das Blatt dahinter zeichnet sich nach
einer Pause neu.

Text im Tagesfeld geht über `tagTextSetzen()` wie im Tag selbst: Jede Änderung hebt „Fertig“ auf.
Solange man darin schreibt, steht „Fertig“ unter dem Feld, wenn der Tag noch offen ist (der Knopf
hält den Fokus, sonst verschwände er vor dem Klick). Auch übernommene Themen einer Blockwoche
bleiben im Blatt beschreibbar, ohne „Bearbeiten“; wer schreibt, hebt die Übernahme auf. Nur die
Karte (tägliche Notierung) ist nach „Fertig“ schreibgeschützt. Ein Tageskopf im Blatt öffnet den
ganzen Tag (Art, Stunden, Buchungen); beim Drüberfahren zeigt er „ganzer Tag ›“, und ein Tag, der
noch etwas braucht, trägt nur in der Vorschau „● noch gegenlesen · öffnen ›“ (`tageMarkieren()`).

Am Handy (unter 820 px, dieselbe Grenze wie `handy.css`) ist das Blatt auf ein Drittel
verkleinert; darin zu tippen hieße, in Fünf-Pixel-Schrift zu schreiben. Die Felder nehmen dort
keinen Tipp an (`pointer-events: none`), ein Tipp auf die Hülle öffnet das Feld groß
(`schreibblattOeffnen()`, `#dlg-schreiben`). Am Handy liegt der Dialog durchsichtig über dem ganzen
sichtbaren Bereich (`schreibblattLage()`: Lage und Höhe aus `visualViewport`, ohne Übergang
nachgezogen); darin ein Schleier und unten das Blatt. Mit offener Tastatur ist der sichtbare Bereich
kleiner, das Blatt sitzt damit immer direkt darüber. Wischen auf Dialog und Schleier schiebt die
Seite dahinter nicht (`touch-action: none`, nur im Textfeld `pan-y`): Vorher hing das Blatt an
einem weich nachgezogenen Abstand zur Tastatur, iOS schob die Seite mit, und unten blieb eine
Lücke. Oben stehen der Titel und „Fertig“, darunter, wohin der Text im Blatt kommt („Kommt ins
Blatt unter …“). Geschrieben wird trotzdem ins Feld im Blatt, dessen Eingabe speichert und neu
zeichnet. „Fertig“ schließt; ist der Tag oder sind die Themen noch offen, übernimmt es sie auch,
über den Knopf am Feld im Blatt. Wer nur nachsehen will, wischt das Feld am Griff nach unten,
tippt daneben oder drückt Escape; das übernimmt nichts.

Herein und hinaus ist dieselbe Bewegung, nur umgekehrt: Klasse `.da` (Blatt von unten, schnell an
und lang auslaufend, .42 s; Schleier blendet ein), Klasse `.geht` (sanft an, schnell weg, .28 s),
zu ist es erst danach (`schreibblattZu()`). Damit der Browser einen Anfang sieht, wird der Zustand
„unten“ nach `showModal()` einmal berechnet, bevor `.da` kommt. Der Fokus geht dabei an den Dialog
selbst (`autofocus`, `preventScroll`), und der Dialog ist kein Scrollbereich (`overflow: clip`):
Ging der Fokus an „Fertig“, schob der Browser den Knopf sofort ins Bild, und das Hereinfahren war
weg; so sprang das Feld ruckartig auf. Am Touchgerät holt das Öffnen auch nicht die Tastatur, erst
ein Tipp ins Textfeld: Sonst fuhren Tastatur, Seite und Feld gleichzeitig los. Beim Wischen folgt
das Blatt dem Finger, der Schleier wird heller; weit oder schnell genug nach unten fährt es hinaus,
sonst schnappt es zurück. Nach oben gibt es höchstens 40 px nach; darunter hängt eine Schürze in der
Farbe des Blatts (`.schreiben-blatt::after`), sonst schien dort die Seite durch. Mit „Bewegung reduzieren“ geht es sofort zu. Bei einem Tag öffnet „Ganzen Tag öffnen ›“ den Tag. Auch „Donnerstag ohne
Text ›“ öffnet sich so, am Rechner wie am Handy: Im Blatt hat der Tag noch kein Feld; sobald er
Text hat, steht er dort. Früher standen am Handy Karten über dem Blatt, man sah das Blatt erst
nach dem Scrollen; ein erster Versuch mit einem Fenster oben und einer Knopfleiste darunter sah
nicht aus wie die Vorschau, auf die man sich geeinigt hatte. Weil die Anordnung nicht mehr von der
Breite abhängt, baut die Woche beim Drucken (Seite so breit wie A4) auch nichts mehr um. Über dem
Blatt steht am Handy nur „✎ Ins Blatt tippen und schreiben“, leere Felder sagen „✎ antippen und
schreiben“.

Nur die tägliche Notierung hat keine festen Kästen für Abteilung und Unterweisungen: Dort stehen
sie als Karten über dem Blatt, die KI und „passt nicht“ darunter.

### Weiter nach „Fertig“ (`naechsterOffenerTag()`)

„Fertig“ am Tag und bei den Themen einer Blockwoche springt zum nächsten Tag derselben Woche, der
noch etwas braucht (`tagBrauchtNoch()`, die Regeln von `wochenBilanz()`); nach einem Sprung führt
„Zurück“ hinter der Meldung wieder her. In eine andere Woche springt es nicht: Wer am Freitag
„Fertig“ drückt, will die Woche noch ansehen. Stattdessen bietet die Meldung einen Knopf an
(`stelleKurz()`): „Hin: Mi 09.09.“ zu einem offenen Tag davor in derselben Woche, sonst „Die Woche
ist fertig“ mit „Weiter: Mo 14.09.“. Gesucht wird bis heute oder bis zum letzten Eintrag
(`offenerTagAb()`), und nur nach vorn: Ist danach nichts mehr offen, nennt die Meldung „Danach ist
nichts mehr offen“ und bietet den frühesten offenen Tag als Knopf an (`ersterOffenerTag()`).

### Hinweise und Übersicht (`hinweise.js`, `uebersicht.js`)

Über den Reitern steht höchstens ein Hinweis, der wichtigste zuerst; wer einen wegklickt, hat für die
Sitzung Ruhe. `hinweiseZeigen()` läuft bei jedem `zeichnen()` und blendet einen unveränderten Hinweis
nicht neu ein.

Am Handy steht jeder Hinweis in seiner kurzen Fassung (`kurz` im Hinweis, `.hinweis.kurz`): eine,
höchstens zwei Zeilen und ein Knopf, etwa „Tipp: Über Teilen → „Zum Home-Bildschirm“, sonst löscht
Safari nach 7 Tagen. Wie?“. Die langen nahmen dort den halben Bildschirm, der Tipp fürs iPhone
allein sechs Zeilen und zwei Knöpfe. „Wie?“ oder „Mehr“ zeigt die lange Fassung (`hinweisGross`);
nach einem Import stehen „Übernehmen“, „Alles Betrieb“ und „Spalten prüfen“ in einer Zeile unter
den Tagen.

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
Woche nach ihrem Montag wie im Vordruck) ein Raster wie die Aktivität bei GitHub (`jahresRaster()`):
eine Spalte je Woche, die Zeilen Mo–Fr, oben die Monate (eine Woche gehört zum Monat ihres
Donnerstags). Jedes Feld ist ein Werktag mit derselben Rechnung wie im Monatsraster (`tagFeld()`:
fertig, nicht gegengelesen, Text fehlt, frei, kommt noch); ein Klick öffnet den Tag. In der Zeile des
Titels stehen die Tage je Art bis heute nach `tagArt()`, also mit Schultagen laut Plan (ein leerer
gesetzlicher Feiertag zählt als Feiertag), und wie viele Wochen fertig sind. Am Rechner passen drei
Jahre ohne Scrollen auf 1366 × 768 (`test/hinweise.js`); am Handy scrollt das Raster seitlich.

### Spalten erkennen (`csvAnalysieren()`)

1. **Zeichensatz:** UTF-16 an der Bytefolge, sonst streng UTF-8, bei Fehlern Windows-1252.
2. **Trennzeichen:** das häufigste aus `;`, `,` und Tabulator in den ersten Zeilen.
3. **Kopfzeile:** unter den ersten zehn Zeilen die, zu der die meisten Felder passen
   (Titel- und Filterzeilen darüber fallen weg). Steht in dieser Zeile ein Datum und eine Uhrzeit
   oder Zahl, ist es eine Buchung (`siehtNachDatenAus()`): Hat die Zeile davor gleich viele
   Spalten, ist sie die Kopfzeile, sonst hat die Datei keine. Dann zählt jede Zeile als Buchung,
   `spaltenNachInhalt()` schlägt Datum, Beginn, Ende, Dauer und Beschreibung vor, und es wird
   immer gefragt. Gemerkt wird unter `ohne kopf|<Spaltenzahl>`.
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

Der Stand vor dem Import wird gemerkt: **Spalten prüfen** in der Karte über den Reitern stellt
ihn wieder her und importiert mit der geänderten Zuordnung neu.

### Berufsschule aus der Zeiterfassung (`schule.js`)

Manche Betriebe lassen den Schultag wie jeden anderen buchen, die Fächer in der Beschreibung.
Der Import **schlägt** einen Tag als Berufsschule vor (`importAnwenden()`), wenn **jede** seiner
Buchungen schulisch ist (Projekt oder Tätigkeit heißt „Berufsschule“, „Schule“, „Berufskolleg“, „BS“, „Unterricht“,
oder die Beschreibung ist eine Fächerliste) **und** ein zweites Zeichen dazukommt: das Stichwort,
mindestens drei Fächer oder der Schulplan (`schultagLautPlan()`).

Eine **Fächerliste** (`faecherListe()`) besteht nur aus Teilen „Etikett: Thema“, getrennt durch
Zeilenumbrüche oder durch Komma und Semikolon vor einem neuen Etikett. Das Etikett ist ein Kürzel
(`AEUP`, `LF4`, `WiSo`), „Lernfeld 4“ oder ein ausgeschriebenes Fach aus `SCHUL_FAECHER`. So bleibt
„Support: Drucker, Netzwerk: Switch“ ein Arbeitstag, und „AD: …, PC: …“ mit nur zwei Kürzeln auch.
Ein Feiertag geht vor, ein Tag mit Schule und Betrieb bleibt Arbeitstag.

Gesetzt wird nichts von selbst: Ein falscher Treffer machte aus einem Arbeitstag Schule, mit anderem
Feld im Vordruck, und wer den Import nicht genau ansah, merkte es nicht (0.3 und 0.4 taten das).
Die Vorschläge stehen in der Karte nach dem Import (`importHinweis()` in `hinweise.js`) mit Haken,
Tag und Fächern. „Als Berufsschule übernehmen“ (`schultageUebernehmen()`) setzt die angehakten Tage
auf Berufsschule, „Alles Betrieb“ und abgewählte Tage bleiben Arbeitstage (`schultageAblehnen()`).
Beides gilt als von Hand gewählt (`artVonHand`): Derselbe Export fragt beim nächsten Mal nicht
wieder. Schließt man die Karte ohne Wahl, bleiben die Tage Arbeitstage und der nächste Import fragt
erneut. Das Beispiel übernimmt seinen Donnerstag gleich. `artVonHand` geht nicht ins Konto: Auf
einem zweiten Gerät fragt derselbe Export deshalb noch einmal, ein falscher Treffer entsteht nicht.

Der Entwurf eines Schultags (`tagesEntwurf()`, `schulZeilen()`) hat je Fach eine Zeile, ohne
Projekt davor und ohne ein „Berufsschule:“ am Anfang. Im **wöchentlichen Vordruck** hat die
Berufsschule ein Feld je Woche: Haben mindestens zwei importierte Schultage einer Woche noch ihren
Entwurf, kommen ihre Fächer in `wochen[montag].schule` (gleiche Fächer in eine Zeile, gleiche
Themen einmal), und die Tage bleiben ohne Text; sie zählen unter den Themen der Woche wie in einer
Blockwoche. Ersetzt werden nur leere Themen oder solche, die noch genau so dastehen, wie der letzte
Import sie gebaut hätte; `schuleGeprueft` fällt nur weg, wenn sich etwas ändert. Ein einzelner
Schultag und jeder Tag der täglichen Notierung behalten ihren Text.

Beim erneuten Import gewinnt die von Hand gewählte Art, auch eine übernommene Berufsschule.
„Berufsschule“ ohne `artVonHand` stammt aus 0.3 oder 0.4, die sie beim Import selbst setzten: Solche
Tage fallen auf die erkannte Art zurück und werden, falls sie passen, wieder Vorschläge. Die KI
lässt eine Fächerliste aus (`schulEntwurf()` in `kiTageDerWoche()`).

## Entwurf und Bereinigung

### Vom Export zum Entwurf

- Jede Buchung wird eine Zeile `Projekt: Beschreibung`, chronologisch, ohne Uhrzeit.
  An einem erkannten Berufsschultag stattdessen je Fach eine Zeile (siehe oben, `schule.js`).
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
(„Deine Daten → Vordruck“ oder die Einrichtung). `tagesZeilen()` in `word.js`
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
| `test/import.js` | Formate unter `test/daten/formate/`, Werte, Zeichensatz, Zuordnungsdialog, gemerkte Zuordnung, Berufsschultage aus Kimai als Vorschlag (Komma, Zeilen, Schulplan, übernehmen, abwählen, „Alles Betrieb“, Zusammenführen, erneuter Import, alte selbst gesetzte Schultage), CSV ohne Kopfzeile, Beispiel |
| `test/vorbehandlung.js` | Bereinigung gegen `test/korpus.js`, Vorlage für das Modell |
| `test/ki.js` | Anbindung gegen einen nachgebauten Ollama: Prompt, Warnungen, Fehler, Wochenlauf, Abbruch; Anfragen nur an das eigene Ollama |
| `test/lauf.js` | Oberfläche von Import bis Word und Druck, Import-Zusammenführung, Einrichtung beim ersten Start (Vor- und Nachname, Berufsliste und Fachrichtung), Löschen; Feiertage und Wochenstand gleich wie auf dem Server, auch in Blockwochen |
| `test/sicherung.js` | Sicherung speichern, in einem leeren Browser und in Firefox laden, Rückfrage beim Ersetzen, fremde Datei, Stempel aus älteren Sicherungen |
| `test/schulplan.js` | Feste Schultage, Blockunterricht und Schulferien: welche Tage der Plan trifft (Feiertag, Wochenende, Vertragslaufzeit, Tage mit Buchungen, Ferien), Kalender für Zeiträume (auch am Handy), Marken, Zusammenlegen, Unlesbares aus alten Ständen, Speichern erst beim Schreiben, „Arbeitstag“ von Hand übersteht Neuladen und Import, Beispiel |
| `test/vordruck.js` | Tägliche Notierung: Umschalten unter „Deine Daten“, neben der Vorschau kein zweiter Schalter und keine Knöpfe, Zeilen je Tag ohne Stunden, Unterweisungen, Word, Gesamtheft, Druck, Aufteilen einer vollen Woche, Wahl übersteht Neuladen |
| `test/blockwoche.js` | Blockwoche erkennen (Feiertag darin, ein einzelner Schultag, eigener Tagestext, Arbeitstag von Hand, tägliche Notierung), die Tage als Menü hinter dem Reiter, Themen schreiben und mit „Fertig“ am Feld übernehmen, übernommen im Blatt weiter beschreibbar, Stand 5/5, Wochenblatt und tägliches Blatt, Neuladen; nichts über dem Schreibfeld; „Fertig“ springt nur nach vorn weiter, „Zurück“, sonst Knopf zum frühesten offenen Tag; am Handy die Themen im Blatt, groß zum Schreiben, Escape schließt ohne, „Fertig“ mit Übernahme |
| `test/hinweise.js` | Hinweise beim Öffnen (was fehlt, Sicherung fällig, iPhone, am Handy kurz, „Wie?“ zeigt alles), Übersicht mit Tagen je Art und Ausbildungsjahr, Buchung übernehmen, Start ohne Woche, Legende, dunkler Modus vom Gerät und per Knopf (gleiche Farben), am Handy schwebende Meldung (geht nach vier Sekunden, Warnung bleibt, Tippen und Wischen schließen) und kurzer Titel; Reiter „Woche“ am Rechner: Felder auf ihren Kästen im Blatt, keine Leiste darüber, Marke am offenen Tag, ins Blatt schreiben, jeder Tag ein Feld über seinen Zeilen, darin schreiben und „Fertig“, Tageskopf öffnet den Tag, Tag ohne Text über dem Blatt öffnet sich groß, schmales Fenster bleibt Blatt, Blatt scrollt bis unter die Reiter; am Handy öffnet ein Tag im Blatt sich groß von unten, daneben tippen schließt nur, „Fertig“ übernimmt |
| `test/handy.js` | Bei 390 und 320 px: Einrichtung im Vollbild, keine Sperre, nichts ragt über den Rand, Kopfleiste in zwei Zeilen ohne Lücke, Woche in voller Breite, Inhalt bis unten und Meldung schwebend ganz lesbar, Reiter in einer Zeile, Woche als Blatt in voller Breite mit den Feldern darin, ohne Leiste und Karten, ein Tipp öffnet das Feld groß von unten, Import-Karte kurz mit Knöpfen in einer Zeile, Knöpfe im Zuordnungsdialog nicht auf dem scrollenden Bereich |

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
Einzeldatei (`test/lokal.js`), das Neuladen bei leerem Speicher (Einrichtung in `test/lauf.js`) und die
Suche nach dem Sprachmodell (`test/ki.js`). Solche Seiten öffnet `h.oeffnen()` zweimal:
`ohneRundgang()` schreibt schon beim Dokumentstart in den Speicher. Das ist genau der frühe Zugriff,
der den Speicher abkoppeln kann, und `speicherNeuLaden()` sieht dann keinen leeren Speicher. Ohne
das zweite Öffnen verlor ein Test in rund 13 % der Läufe beim nächsten Neuladen seine Daten.

Testdaten sind ausgedacht; echte Namen, Kunden oder Firmendaten gehören weder in `test/` noch in
`src/beispiel.csv`.

## Bilder in README und Anleitung

`docs/bilder/*.png` (im README und in `docs/START.md`) entstehen aus dem Beispielheft, damit sie
nach Oberflächenänderungen gleich aussehen:

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
| Download | `.github/workflows/release.yml`: Ein Tag `v*` legt ein Release mit `Berichtsheft.html` an. Ohne Tag von Hand startet man den Workflow unter *Actions → Release → Run workflow* auf `main` mit der Version aus `package.json`; dann legt er den Tag selbst an. |
| Updates | `.github/dependabot.yml` schlägt monatlich neue npm-Pakete, Images und Actions vor, je Bereich in einem gesammelten Pull Request. Die selbst gebauten Images `berichtsheft` und `berichtsheft-server` sind ausgenommen. |

Neue Fassung:

1. `version` in `package.json` und `server/package.json` und `image:` in beiden
   `docker-compose*.yml` anheben.
2. In `CHANGELOG.md` „Unveröffentlicht“ in die neue Version mit Datum umbenennen und
   den Vergleichslink am Ende ergänzen.
3. `npm run build && npm test`, dazu `bash server/test/testen.sh` und `bash server/test/betrieb.sh`
   (der Betriebstest mit Keycloak läuft nicht in der CI).
4. Committen, dann `git tag vX.Y.Z && git push origin main vX.Y.Z`. Wer keine Tags pushen darf,
   startet stattdessen den Workflow „Release“ mit der Version.

Der Speicheraufbau (`berichtsheft-v1`) muss abwärtskompatibel bleiben: Ältere
Stände und Sicherungen werden beim Laden gelesen, nicht verworfen. Wer das
Format grundlegend ändert, braucht einen neuen Schlüssel und einen Umzug in
`grundlagen.js`.
