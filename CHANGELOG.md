# Änderungen

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [Semantic Versioning](https://semver.org/lang/de/).
Ein Tag `vX.Y.Z` erzeugt das Release mit `Berichtsheft.html` (`.github/workflows/release.yml`).

Solange die Version bei `0.x` steht, kann sich zwischen zwei Ausgaben noch ändern, wie das
Werkzeug arbeitet. Was im Browser gespeichert ist, bleibt ladbar.

## Unveröffentlicht

### Geändert

- **Am Handy** ist das Werkzeug nicht mehr gesperrt. Tage, Woche und Blattvorschau stehen
  untereinander in voller Breite. Kopfleiste und Meldung stehen fest, dazwischen scrollt der
  Inhalt, ohne unter ihnen durchzulaufen. Textfelder wachsen mit dem Text, die Meldung belegt
  höchstens zwei Zeilen und zeigt sich beim Tippen ganz. Der Rundgang bleibt am Handy aus.
  Eingabefelder haben dort mindestens 16 px, sonst zoomt Safari beim Tippen hinein.

### Behoben

- **PDF vom iPhone:** Eine Woche, die als „passt auf ein Blatt“ galt, lief in Safari auf eine
  zweite Seite ohne Kopfleiste, und in der Kopfleiste brach der Zeitraum um. Am Handy misst das
  Werkzeug jetzt mit dem engeren Druckbereich von Safari und teilt selbst; die Kopfleiste hat
  feste Spalten, in denen Zeitraum und Etiketten nicht mehr umbrechen. Safari vergrößerte die
  Schrift im Druck außerdem selbsttätig um rund 20 %; das ist abgeschaltet (`text-size-adjust`).

## [0.1.0] – 2026-09-26

Erste öffentliche Version.

### Neu

- **Import** aus Kimai, Clockify, Toggl Track, Harvest, Jira mit Tempo und Excel-Listen:
  Zeichensatz, Titelzeilen, AM/PM und Datumsreihenfolge werden erkannt. Unbekannte Spalten
  ordnet ein Dialog mit Vorschau zu und merkt sich die Zuordnung je Kopfzeile.

- **Bereinigung** im Entwurf je Tag: Ticketnummern, Geräte, Personen und Kunden werden ersetzt,
  so weit die Regeln greifen; im Zweifel bleibt der Text stehen.

- **Wochenblatt und Gesamtheft** als Word und PDF nach dem IHK-Vordruck „wöchentliche
  Notierung“, mit Deckblatt, Ausbildungsgang, Kopfzeile (Nr., Ausbildungsjahr, Woche, Abteilung)
  und Live-Vorschau. Vor dem Export wird gewarnt, wenn Tage nicht gegengelesen sind, das
  Ausbildungsjahr fehlt oder ein Text nicht auf das Blatt passt.

- **Feiertage je Bundesland** unter *Deine Daten → Verarbeitung*. Ein Feiertag ohne Eintrag
  zählt nicht als Lücke, im Heft, auf dem Server und beim Ausbilder.

- **Optional ein eigenes Sprachmodell** über [Ollama](https://ollama.com): Es fasst den Tag in
  1–6 Stichpunkten zusammen (Vorgabe 4, einstellbar unter „Deine Daten“) und zählt Gleiches
  zusammen, statt es aufzuzählen. In allen Compose-Stapeln läuft Ollama als Container; der
  Dienst `ollama-modelle` lädt `KI_MODELL` (Vorgabe `qwen3.5:4b`) beim ersten Start.

- **Allein im Browser:** `Berichtsheft.html` als Einzeldatei, offline per Doppelklick, alles im
  `localStorage`. Dazu die Demo auf GitHub Pages mit „Beispiel ansehen“ und `npm start` für den
  eigenen Rechner (Node.js 20 oder neuer).

- **Mit Server** (`docker-compose.server.yml`): Node, Postgres und Anmeldung über OIDC, erprobt
  mit Keycloak. Azubis arbeiten ohne Netz weiter und gleichen später ab; auf den Server geht nur,
  was im Nachweis steht. Ausbilder pflegen ihre Gruppe, lesen und exportieren die Hefte, ohne sie
  zu ändern. Nächtliche Sicherung mit Wiederherstellung, Realm-Vorlage und Anmeldeseite für
  Keycloak gehören dazu. `docs/SERVER.md` weist auf Ausbildungsvertrag (§ 11 BBiG) und
  Betriebsrat (§ 87 BetrVG) hin.

- **Nachprüfbar:** Das Release nennt die SHA-256-Prüfsumme von `Berichtsheft.html`. Der Build
  bricht ab, wenn im eigenen Code eine fremde Adresse, `eval` oder `new Function` steht.

[0.1.0]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/releases/tag/v0.1.0
