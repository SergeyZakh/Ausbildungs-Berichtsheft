# Mitmachen

Danke, dass du helfen willst! Drei Wege, von klein nach groß:

## 1. Ein Exportformat melden

Dein Export wird nicht erkannt oder braucht zu viel Zuordnung? Eröffne ein
Issue mit der Vorlage **„Neues Exportformat“**. Wichtig ist nur:

- die **Kopfzeile** der CSV, genau wie sie in der Datei steht,
- **zwei Beispielzeilen** – bitte mit ausgedachten Inhalten, ohne echte
  Namen, Kunden oder Ticketnummern,
- aus welchem Werkzeug und in welcher Sprache der Oberfläche exportiert wurde.

## 2. Einen Fehler melden

Beschreibe, was du gemacht hast, was passiert ist und was du erwartet
hättest. Eine Sicherung (**⋯ → Sicherung speichern**) hilft, enthält aber
deine Texte und Stammdaten – teile sie nur anonymisiert.

## 3. Code beitragen

```bash
npm install
npx playwright install chromium firefox   # einmalig, für die Tests
npm run build
npm test
```

- Änderungen immer in `src/`, danach `npm run build`. `dist/` ist Build-Ausgabe.
- Die Dateien in `src/js/` sind keine Module, sie teilen sich einen
  Gültigkeitsbereich (siehe [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md)).
- **Neues Exportformat:** Namen in `FELDER` in `src/js/import/quellen.js` ergänzen,
  eine ausgedachte Beispieldatei unter `test/daten/formate/` ablegen und in
  `test/import.js` prüfen, dass sie ohne Rückfrage erkannt wird.
- **Bereinigungsregel geändert:** Fälle in `test/korpus.js` ergänzen, vor allem
  in `BLEIBT_EXAKT`. Eine zu gierige Regel fällt sonst erst im fertigen Heft auf.
- Kommentare, Bezeichner und Oberfläche sind auf Deutsch – das Werkzeug ist
  für deutsche Ausbildungsnachweise gebaut.

### Am Server arbeiten

Der Server ist die zweite Betriebsart neben „allein im Browser“; beide müssen
nach jeder Änderung funktionieren. Wer am Server etwas ändert, braucht Docker:

```bash
npm ci --prefix server
bash server/test/testen.sh    # Server gegen Postgres im Container, dazu test/konto.js
bash server/test/betrieb.sh   # der ganze Stapel mit echtem Keycloak, rund 3 Minuten
```

Aufbau, Datenmodell, Schnittstelle und Fehlersuche stehen in
[docs/SERVER.md](docs/SERVER.md).

## Pull Requests

- Eine Änderung pro Pull Request, mit kurzer Beschreibung von Anlass und Lösung.
  Sichtbare Änderungen mit Screenshot, nur mit ausgedachten Daten.
- Eintrag in [CHANGELOG.md](CHANGELOG.md) unter „Unveröffentlicht“.
- Formatierung nach `.editorconfig`: UTF-8, LF, zwei Leerzeichen.
- Pull Requests laufen durch dieselben Tests wie `npm test` und `server/test/testen.sh`.

Dependabot schlägt Updates für npm-Pakete, Images und Actions vor. Übernommen wird
erst, wenn die Tests grün sind; bei `docx` zusätzlich ein erzeugtes Wochenblatt in
Word öffnen.

## Sicherheitslücken

Nicht als Issue, sondern über [SECURITY.md](SECURITY.md).
