# Änderungen

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [Semantic Versioning](https://semver.org/lang/de/).
Ein Tag `vX.Y.Z` erzeugt das Release mit `Berichtsheft.html` (`.github/workflows/release.yml`).

Solange die Version bei `0.x` steht, kann sich zwischen zwei Ausgaben noch ändern, wie das
Werkzeug arbeitet. Was im Browser gespeichert ist, bleibt ladbar.

## Unveröffentlicht

### Neu

- **Feste Schultage und Blockunterricht** unter *Deine Daten → Schule*, dort steht jetzt auch der
  Name der Berufsschule. Leere Tage an diesen Tagen stehen schon auf „Berufsschule“, mit dem Feld
  für die Unterrichtsthemen. Feiertage, Tage außerhalb der Vertragslaufzeit und Tage mit Buchungen
  oder Text ändert der Plan nicht. Das Beispiel hat donnerstags Schule.
- **Schulferien** im Schulplan: Darin entfallen die festen Schultage, Blockunterricht gilt weiter.
  Blöcke und Ferien wählst du im Kalender (ersten Tag antippen, dann den letzten); sie stehen als
  Marken mit × da, Überlappendes wird zusammengelegt.
- **Tägliche Notierung** als zweiter Vordruck der IHK: eine Zeile je Tag, ohne Stunden wie das
  wöchentliche Blatt. Umschalten neben der Wochenvorschau oder unter *Deine Daten →
  Verarbeitung*; gilt für Vorschau, Druck und Word, auch beim Ausbilder.
- **Übersicht aller Wochen** (Menü ⋯): je Ausbildungsjahr ein Kästchen pro Woche, grün fertig, rot
  ungelesen oder mit Lücke, dazu die Tage in der Berufsschule, im Urlaub, krank und an Feiertagen.
- **Was fehlt noch?** Beim Öffnen nennt ein Hinweis die Lücken und ungelesenen Tage der letzten
  Woche und der Wochen davor, mit Sprung zum ersten offenen Tag.
- **Erinnerung an die Sicherung**, wenn die letzte älter als 14 Tage ist und sich seitdem etwas
  geändert hat. Ohne Konto liegt das Heft nur im Browser.
- **Tipp fürs iPhone:** Safari löscht Seitendaten nach sieben Tagen ohne Besuch, vom
  Home-Bildschirm aus nicht. Die Seite lässt sich dort als App ablegen, mit eigenem Symbol.
- **Buchung übernehmen:** Das Plus neben einer Buchung hängt sie als bereinigte Zeile an den Text.
- **Dunkler Modus**, wenn das Gerät ihn eingestellt hat oder per Knopf (Mond/Sonne) in der
  Kopfleiste. Die Blattvorschau bleibt weiß.
- **Blockwoche:** Ist jeder Werktag einer Woche Berufsschule oder frei (ab zwei Schultagen), gibt es
  statt der Tagesreiter ein Feld für die Themen der ganzen Woche und einmal „Fertig“. Der
  wöchentliche Vordruck hat für die Berufsschule ohnehin ein Feld je Woche. Darunter stehen die
  Tage mit ihrer Art, etwa für einen Krankheitstag. Beim Ausbilder zählt die Woche genauso; der
  Server speichert die Themen in zwei neuen Spalten der Tabelle `wochen`.
- **Nach „Fertig“ weiter** zum nächsten Tag, der noch Text oder „Fertig“ braucht, auch in die
  nächste Woche; „Zurück“ hinter der Meldung führt wieder hin. Zurück an ältere Lücken springt es
  nicht von selbst, die Meldung bietet den frühesten offenen Tag als Knopf an.

### Geändert

- **Dependabot** schlägt keine neue Hauptversion von Postgres mehr vor: postgres:18 startet nicht auf
  den Daten von 17. Wie der Wechsel von Hand geht, steht in docs/SERVER.md unter „Update“.
- **Hell/dunkel wechselt weich:** Die neue Farbe breitet sich als Kreis vom Knopf aus, statt dass
  die Seite stückweise umspringt. Mit „Bewegung reduzieren“ wechselt sie ohne Animation.
- **Kalender für Blockunterricht und Ferien** übersichtlicher: oben die Schritte „Erster Tag“ und
  „Letzter Tag“ mit den Werktagen, Zeiträume als helles Band mit dunklen Enden, Legende, Punkt an
  Feiertagen, × zum Neubeginnen, „Fertig“ unten; die Marken nennen ihre Werktage.
- **Kopfleiste am Handy:** Die Wochensumme füllt die Zeile bis zu den Knöpfen und sagt „0/5 fertig“;
  bei 320 px bleibt die Leiste zweizeilig.
- **Ohne Woche** stehen nur Name, Menü und die Startkarte in der Mitte da; die Startkarte bietet
  auch „Sicherung laden“ an.
- **Der Kalender erklärt die Marken** der Reiter (E, KI, !, ✓, leerer Kreis).
- **Am Handy** wird die Meldung unten nach acht Sekunden leise (eine Zeile, ohne Farbe), und die
  Überschrift der Unterweisungen ist kurz.
- **Am Handy** stehen die Tagesreiter kompakt in einer Zeile, die Woche breit darunter; Datum, Art
  und Stunden des Tages stehen ebenfalls in einer Zeile. Das Schreibfeld beginnt deutlich weiter
  oben und bleibt mit offener Tastatur sichtbar.

### Behoben

- **„Arbeitstag“ von Hand** an einem Feiertag wurde beim nächsten Import derselben Datei wieder
  zum Feiertag. Eine am Tag gewählte Art bleibt jetzt, auch „Arbeitstag“.

## [0.1.1] – 2026-09-26

### Geändert

- **Am Handy** ist das Werkzeug nicht mehr gesperrt. Tage, Woche und Blattvorschau stehen
  untereinander in voller Breite. Kopfleiste und Meldung stehen fest, dazwischen scrollt der
  Inhalt, ohne unter ihnen durchzulaufen. Textfelder wachsen mit dem Text, die Meldung belegt
  höchstens zwei Zeilen und zeigt sich beim Tippen ganz. Der Rundgang bleibt am Handy aus.
  Eingabefelder haben dort mindestens 16 px, sonst zoomt Safari beim Tippen hinein.

### Behoben

- **PDF vom iPhone:** Eine Woche, die als „passt auf ein Blatt“ galt, lief in Safari auf eine
  zweite Seite ohne Kopfleiste, und in der Kopfleiste brach der Zeitraum um. Ursache: Safari auf
  iOS setzt den Druck rund 22 % größer als den Bildschirm. Der Druck wird dort jetzt auf 82 %
  gesetzt; außerdem misst das Werkzeug am Handy mit etwas Reserve und teilt selbst, und die
  Kopfleiste hat feste Spalten, in denen Zeitraum und Etiketten nicht mehr umbrechen.
- **Änderung kurz vor dem Schließen verloren:** Das Werkzeug speichert 400 ms nach der letzten
  Eingabe. Wer in dieser Zeit die Seite schloss, neu lud oder am Handy die App wechselte, verlor
  die Änderung. Beim Verlassen der Seite wird jetzt sofort gespeichert.

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

[0.1.1]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/releases/tag/v0.1.0
