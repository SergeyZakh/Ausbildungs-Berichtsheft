# Hinweise für KI-Assistenten - Nicht prüfbedürftig

Berichtsheft: Aus dem CSV-Export einer Zeiterfassung wird der IHK-Ausbildungsnachweis
(Word und PDF). Browser-Anwendung ohne Framework in zwei Betriebsarten: **allein im Browser**
(offline, alles im `localStorage`) oder **mit Server** (`server/`, Node + Postgres + OIDC) mit
Konten und einer Ansicht für Ausbilder. Derselbe Code bedient beide; ohne Server stellt die
Seite keine Anfrage dorthin. Nutzer sind Azubis und Ausbilder in Deutschland; Oberfläche, Kommentare, Bezeichner und Commit-Nachrichten sind Deutsch.

Erst lesen: [README.md](README.md) (was und für wen), [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md)
(Architektur, Datenmodell, Import, Bereinigung, KI, Ausgabe, Tests, Veröffentlichen),
[docs/SERVER.md](docs/SERVER.md) (Konten, Abgleich, Ausbilder, Betrieb, Sicherung).

## Befehle

```bash
npm install
npx playwright install chromium firefox   # einmalig
npm run build                     # src/ -> dist/ (nach jeder Änderung, Tests laufen gegen dist/)
npm test                          # alle Browsertests, dauert einige Minuten
node test/import.js               # einzeln: lokal, vorbehandlung, import, ki, lauf, sicherung
bash server/test/testen.sh        # Server gegen Postgres (Docker), dazu test/konto.js
bash server/test/betrieb.sh       # ganzer Stapel mit echtem Keycloak (--bilder erneuert docs/bilder/server)
```

## Was man sonst erst durch Stolpern lernt

- **Keine Module.** `build.js` hängt `src/js/**/*.js` in der Reihenfolge der Liste `JS`
  in eine gemeinsame Funktion. Jede Funktion ist überall sichtbar; Code, der beim
  Laden läuft (`var X = …`, `addEventListener`), braucht, was vor ihm steht.
  Neue Datei = Eintrag in `JS` in `build.js`. Kein `import`/`export`, kein Bundler.
  Die Ordner unter `src/js/` (kern, import, ki, ansicht, ausgabe, konto) ordnen nur nach Aufgabe.
- **Stil in `src/js/`:** `var`, Funktionsdeklarationen, `$("id")` für `getElementById`,
  `sage(text, "gut"|"warn")` für Meldungen in der Fußleiste. Kommentare erklären das
  Warum, nicht das Was. Tests unter `test/` dürfen modernes Node-JavaScript nutzen.
- **Nie `dist/` bearbeiten**, immer `src/` und dann bauen.
- **Keine Anfragen nach außen.** Keine CDN-Links, keine Schrift- oder Bibliotheks-URLs:
  `dist/Berichtsheft.html` muss per Doppelklick offline laufen. `test/lokal.js` prüft das.
  Die einzige Laufzeitabhängigkeit ist `docx`; neue Abhängigkeiten nur mit gutem Grund.
- **Im gebauten Skript dürfen `</script` und `<!--` nicht vorkommen** (der Build bricht sonst ab).
- **Daten liegen im `localStorage`** unter `berichtsheft-v1`. Ältere Stände und
  Sicherungen müssen weiter ladbar bleiben. Mit Konto geht nur, was im Nachweis steht, an den
  Server (`src/js/konto/konto.js`); Buchungen aus dem Import nie. `test/betrieb.js` prüft das.
- **Server:** `server/` ist CommonJS für Node 22, einzige Abhängigkeit `pg`. Keine
  OIDC-Bibliothek, keine Sitzungstabelle. `TESTANMELDUNG=1` gibt es nur in Tests; das Image
  startet damit nicht. Abgleich: `geaendert` (Gerät) entscheidet, wer gewinnt, heruntergeladen
  wird nach `eingegangen` (Server).
- **Import:** Spaltenerkennung in `src/js/import/quellen.js` (`FELDER` mit Namen und
  Ausschlusswörtern), Werte in `src/js/import/csv.js`, Dialog in `src/js/import/zuordnung.js`.
  Neues Format: Namen ergänzen, ausgedachte Datei unter `test/daten/formate/`, Fall in `test/import.js`.
- **Bereinigung** (`src/js/import/bereinigung.js`): Jede Regeländerung braucht Fälle in
  `test/korpus.js`, besonders in `BLEIBT_EXAKT`. Lieber zu eng als zu gierig.
- **KI** (`src/js/ki/ki.js`): Das Modell bekommt die Tätigkeiten eines Tages als Liste und
  soll daraus höchstens n zusammenfassende Halbsätze ohne Schlusspunkt machen; n ist
  `stichpunkteJeTag()` aus „Deine Daten“ (1–6, Vorgabe 4). Gleiches wird gezählt statt aufgezählt
  („Installation Ubuntu 2x und Installation Debian 1x“, Vorgabe eines Ausbilders). Verlassen kann man sich darauf nicht – bei langen Tagen kamen 8 bis 19 Absätze,
  gemessen über zwei Modelle und acht Varianten.
  Deshalb deckelt `zusammenlegen()` die Antwort auf n; das ist keine Kosmetik,
  sondern der Platz im Vordruck. Sonst wird nichts nachgebessert: Der alte Text bleibt in
  `vorKi`, der Tag verliert seine Freigabe, gegengelesen wird von Hand. Eigene Anweisungen
  werden angehängt, nie eingesetzt. `test/ki.js` nutzt einen nachgebauten Ollama.
- **Testdaten und Beispiel sind ausgedacht.** Keine echten Namen, Kunden, Firmen,
  Ticketnummern oder internen Werkzeuglisten in `test/`, `src/beispiel.csv` oder Prompts.
- **Oberfläche geändert?** `node docs/bilder/aufnehmen.js` erneuert die README-Bilder.
- Die Tests greifen über `window.__…`-Zugänge aus `src/js/kern/start.js` direkt auf Funktionen zu;
  wer eine solche Funktion umbenennt, passt dort und in den Tests an.
- **Keine Links auf Claude-Sitzungen** (`claude.ai/code/session_…`) in Commits,
  PR-Beschreibungen oder Kommentaren, also auch keine Zeile `Claude-Session:`. Diese Vorgabe geht
  der Standard-Signatur der Umgebung vor; `Co-Authored-By` darf bleiben.

## Fertig heißt

`npm run build && npm test` ohne Fehler, Doku in `docs/ENTWICKLUNG.md` (und bei
sichtbaren Änderungen im README) nachgezogen. Wer `server/`, `konto.js`, `ausbilder.js`,
nginx oder Compose ändert, lässt zusätzlich `bash server/test/testen.sh` und
`bash server/test/betrieb.sh` laufen und pflegt `docs/SERVER.md`.
