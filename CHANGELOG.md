# Änderungen

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [Semantic Versioning](https://semver.org/lang/de/).
Ein Tag `vX.Y.Z` erzeugt das Release mit `Berichtsheft.html` (`.github/workflows/release.yml`).

Solange die Version bei `0.x` steht, kann sich zwischen zwei Ausgaben noch ändern, wie das
Werkzeug arbeitet. Was im Browser gespeichert ist, bleibt ladbar.

## Unveröffentlicht

### Geändert

- **Wochenansicht: direkt ins Blatt schreiben.** Statt drei Spalten (links Eingaben, in der Mitte
  das Blatt, rechts ein kleiner Stand) steht nur noch das Blatt da: Abteilung, Unterweisungen und
  die Themen einer Blockwoche sind gestrichelte Felder mit „✎“ im Blatt selbst, man schreibt, wo es
  gedruckt wird. Darüber eine ruhige Zeile: „Gestrichelt: hier direkt reinschreiben“ und „Montag,
  Dienstag … anklicken: den Tag bearbeiten“. Ein Tag, der noch etwas braucht, trägt im Blatt
  „noch gegenlesen · öffnen ›“; fehlt ihm der Text, steht er über dem Blatt. Keine eigene Leiste
  mehr für Stand und „Woche als Word · PDF“: Das steht schon oben und unter „Exportieren“. „Passt
  auf ein Blatt“ erscheint nur noch, wenn es nicht passt. In der Blockwoche sitzt „Fertig“ unten am
  Feld Berufsschule, die fünf Tage öffnet der Reiter „Blockwoche“ („Tage ändern ▾“). Am Handy und
  bei der täglichen Notierung stehen die Felder als Karten über dem Blatt.

- **Keine Fußleiste mehr am Handy:** Sie stand immer da, erst grün in zwei Zeilen, dann grau mit
  „gespeichert“, und nahm dem Text Platz. Eine Meldung schwebt jetzt als Karte kurz über dem
  Inhalt und geht nach vier Sekunden von selbst, mit Knopf wie „Zurück“ nach acht; antippen, ×
  oder wegwischen schließt sie früher. Eine Warnung bleibt rot stehen, bis man sie schließt. Am
  Rechner bleibt die Fußleiste, wie sie war. „Zurück“ nach „Fertig“ steht rechts neben dem Text.
- **Ergebnis des Imports als Karte oben:** „Kimai-Import fertig. 7 Tage aus …, davon 3
  Berufsschule“ mit „Spalten prüfen“ und „Passt“. Sie bleibt, bis man sie schließt; vorher stand
  „Spalten prüfen“ als Knopf in der Meldung und war am Handy nach Sekunden weg.
- **„Fertig“ bleibt in der Woche:** Nach dem letzten offenen Tag, etwa am Freitag, springt es nicht
  mehr in die nächste Woche. Die Meldung sagt „Die Woche ist fertig“, „Weiter: Mo 14.09.“ dahinter
  führt zur nächsten offenen Stelle. Ist davor in derselben Woche noch ein Tag offen, bietet sie
  ihn an.

### Behoben

- **Riesige Felder in der Übersicht:** Mit nur wenigen Wochen, etwa ohne Ausbildungszeit unter
  *Deine Daten*, wurde jedes Feld so breit wie ein Viertel des Fensters. Die Felder sind jetzt
  höchstens 16 px groß; ein ganzes Ausbildungsjahr füllt die Breite wie bisher.
- **Wochenansicht hinter dem Druckfenster:** Solange der Browser das PDF druckte, hat die Seite
  die Breite von A4, schmaler als ein Handy-Fenster. Die Wochenansicht baute deshalb auf Karten um
  und stand danach so da. Jetzt bleibt sie während des Drucks, wie sie war.
- **Grauer Streifen beim Scrollen der Woche:** Am Rechner endete der Bereich, in dem das Blatt
  scrollt, 16 px unter den Reitern; dazwischen stand ein grauer Streifen, an dem das Blatt
  abgeschnitten wurde. Jetzt läuft es bis unter die Reiter.

## [0.3.0] – 2026-09-30

### Neu

- **Berufsschultag aus der Zeiterfassung:** Bucht der Betrieb den Schultag mit den Fächern in der
  Beschreibung („AEUP: Datenbanken, FUIT: IPv4“ oder je Fach eine Zeile), wird der Tag
  Berufsschule, je Fach eine Zeile im Feld „Berufsschule (Unterrichtsthemen)“. Erkannt wird das an
  mindestens drei Fächern, am Projekt oder an der Tätigkeit „Berufsschule“ oder am Schulplan. Zwei
  Kürzel wie „AD: …, PC: …“ allein machen noch keinen Schultag, ein Tag mit Schule und Betrieb
  bleibt Arbeitstag. Im wöchentlichen Vordruck kommen die Fächer mehrerer Schultage einer Woche
  zusammen in die Themen der Woche, gleiche Fächer in eine Zeile („AEUP: Datenbanken,
  Normalisierung“). Eigene Themen und eine von Hand gewählte Art bleiben beim nächsten Import. Die
  KI lässt eine solche Fächerliste aus.
- **CSV ohne Kopfzeile:** Beginnt der Export gleich mit der ersten Buchung, nimmt der Import sie
  nicht mehr als Kopfzeile. Der Dialog „Spalten zuordnen“ sagt „Die Datei hat keine Kopfzeile“ und
  schlägt die Spalten nach ihrem Inhalt vor: Datum, Uhrzeiten, Dauer und die längste Beschreibung.
  Die Antwort gilt beim nächsten Export mit gleich vielen Spalten.

### Geändert

- **Einheitliche Maße:** Schrift in sechs Stufen statt rund zwanzig Größen, Abstände im
  4-px-Raster, drei Eckenradien. Alle Textknöpfe sind Pillen in Textgröße, Symbolknöpfe Kreise.
  Die Oberfläche wirkt dadurch ruhiger; am Handy ist der Text einen halben Punkt größer.
- **Fenster einheitlich:** Jedes Fenster schließt mit × oben rechts (oder Escape), auch Wochenwahl,
  Übersicht, Kalender, Zuordnung und Rückfragen; die Knöpfe stehen unten rechts. Alle Felder sind
  gleich hoch, auch Datum und Auswahl. Die Einrichtung hat größere Felder und Knöpfe, Willkommen
  und Abschluss stehen mittig, und beim Öffnen hat „Später“ keinen Fokusrahmen mehr.
- **Eine Karte je Tag:** Das Datum ist ihr Titel, Art des Tages, Stunden und „Fertig“ stehen im
  Kopf, über dem Text klein das Feld des Vordrucks. Vorher standen Tageskopf und Text in zwei
  Karten übereinander. Überschriften der Karten in normaler Schreibung statt Versalien.
- **Die Woche als Titel:** Am Rechner steht oben links groß „7.–13. September 2026 ▾“ (ein Klick
  öffnet den Kalender), davor die Pfeile als leise Kreise, dahinter der Stand in Grau; rechts
  Farbe, Export und Menü. Vorher standen in der Mitte vier umrandete Formen, und die Summe sah aus
  wie ein Knopf. Die Pfeile sind jetzt Winkel statt der Zeichen ‹ ›, auch am Handy und im Kalender.
- **Kalender zeigt, wo nichts steht:** Werktage der Ausbildung bis heute ganz ohne Eintrag sind
  blassrot, auch in Wochen ohne Daten; die Legende nennt sie „nichts eingetragen“.
- **Übersicht wie die Aktivität bei GitHub:** je Ausbildungsjahr ein Raster aus Wochen und
  Werktagen, jeder Tag ein Feld in den Farben des Kalenders, oben die Monate. Ein Klick öffnet den
  Tag. Am Rechner passen drei Ausbildungsjahre ohne Scrollen hinein.
- **Ausbildungsberuf** in der Einrichtung und unter *Deine Daten*: eine eigene Liste beim Tippen,
  nach Bereichen und mit dem getippten Teil fett, rund 30 Berufe statt 13. Hat der Beruf
  Fachrichtungen (Fachinformatiker/in, Groß- und Außenhandel, Mediengestaltung), stehen sie darunter
  zum Antippen. Jeder andere Beruf lässt sich weiter frei eintragen.
- **Tastenkürzel sichtbar:** Am Rechner steht in der Ecke jedes Reiters seine Taste (1–7, 8 für die
  Woche); die Pfeile nennen beim Überfahren Alt + ← / →.
- **Legende im Kalender** in zwei Spalten: links die Marken der Tage, rechts die Kreise des Kalenders
  mit genau ihrem Aussehen.
- **Ganzes Heft als Word** geht jetzt wie als PDF, auch bevor etwas geschrieben ist. Vorher war
  „Als Word-Datei“ dann gesperrt, „Als PDF drucken“ nicht.
- **Buchungen ohne Haken:** Steht eine Buchung schon im Text, fällt ihr Plus weg, statt dass ein
  grüner Haken an jeder Zeile steht. Fliegt die Zeile aus dem Text, ist das Plus wieder da.
- **Vor- und Nachname** in zwei Feldern, in der Einrichtung und unter *Deine Daten*. Gespeichert
  wird weiter „Nachname, Vorname“ wie im Vordruck; ein älterer Name ohne Komma wird beim Öffnen
  am letzten Leerzeichen geteilt.
- **Feinschliff:** Ein Fokusrahmen für alle Felder (Kante mit Ring, gut sichtbar auch im dunklen
  Modus), eine kurze Einblendung für Fenster und Menüs, mit „Bewegung reduzieren“ ohne.

## [0.2.0] – 2026-09-29

### Neu

- **Einrichtung beim ersten Start** statt des Rundgangs: in sechs kurzen Schritten Name, Beruf,
  Betrieb, Vertragslaufzeit, Bundesland, Berufsschule und Vordruck, danach Zeiterfassung laden oder
  selbst schreiben. Am Handy im Vollbild. Mit „Später“ geht es ohne Angaben weiter; die Startkarte
  bietet die Einrichtung an, solange Pflichtangaben fehlen. Ausbilder behalten ihren Rundgang.
- **Feste Schultage und Blockunterricht** unter *Deine Daten → Schule*, dort steht jetzt auch der
  Name der Berufsschule. Leere Tage an diesen Tagen stehen schon auf „Berufsschule“, mit dem Feld
  für die Unterrichtsthemen. Feiertage, Tage außerhalb der Vertragslaufzeit und Tage mit Buchungen
  oder Text ändert der Plan nicht. Das Beispiel hat donnerstags Schule.
- **Schulferien** im Schulplan: Darin entfallen die festen Schultage, Blockunterricht gilt weiter.
  Blöcke und Ferien wählst du im Kalender (ersten Tag antippen, dann den letzten); sie stehen als
  Marken mit × da, Überlappendes wird zusammengelegt.
- **Tägliche Notierung** als zweiter Vordruck der IHK: eine Zeile je Tag, ohne Stunden wie das
  wöchentliche Blatt. Gewählt in der Einrichtung oder unter *Deine Daten → Vordruck*; gilt für
  Vorschau, Druck und Word, auch beim Ausbilder.
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

- **Menüs und Knöpfe aufgeräumt:** Das Menü ⋯ ist nach Zweck gruppiert (Deine Daten und Übersicht,
  Zeiterfassung laden, Sicherung). „Exportieren“ trennt „Diese Woche“ und „Ganzes Heft mit
  Deckblatt“, je als Word oder PDF. Das Laden der CSV heißt überall „Zeiterfassung laden“, damit es
  nicht mit „Exportieren“ verwechselt wird. Die Startkarte hat zwei Knöpfe, Beispiel und Sicherung
  stehen als Links darunter.
- **Weniger doppelt:** Neben der Wochenvorschau stehen nur noch Umfang und KI, heruntergeladen wird
  über „Exportieren“, auch beim Ausbilder. Über dem Tagestext steht nur noch die Fahne „KI“, der
  Wochenknopf nennt nur den Zeitraum; den Stand zeigen Farbe und „3/5 fertig“.
- **README** auf das Wesentliche gekürzt; Tipps, Tastatur und Bilder stehen in docs/START.md.
- **Deine Daten** in der Reihenfolge der Einrichtung: Ausbildung (mit Name und Bundesland), Schule,
  Vordruck, Deckblatt (was nur das Deckblatt braucht), KI, Löschen. Statt „Schließen“ und „Speichern“
  gibt es × und „Fertig“; gespeichert wird ohnehin beim Tippen.
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

- **Leeres Datumsfeld am iPhone** war nur ein dünner Streifen, etwa „Beginn laut Vertrag“ in der
  Einrichtung. Es ist jetzt so hoch wie die Felder daneben, das Datum steht links.
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

[0.3.0]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SergeyZakh/Ausbildungs-Berichtsheft/releases/tag/v0.1.0
