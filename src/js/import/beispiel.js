/* ============================================================
 * Beispiel: ein ausgedachtes Heft zum Ausprobieren
 *
 * BEISPIEL_CSV setzt build.js aus src/beispiel.csv ein. Die Datei nutzt
 * bewusst keine bekannte Zeiterfassung, sondern eine Excel-artige Liste
 * mit deutschen Spalten – so zeigt das Beispiel nebenbei die Erkennung
 * und die Bereinigung (Kundennamen, Ticketnummern, Rechnernamen).
 * ========================================================== */

var BEISPIEL_STAMM = {
  name: "Muster, Max", beruf: "Fachinformatiker für Systemintegration",
  betrieb: "Beispiel IT GmbH", abteilung: "IT", ausbilder: "Erika Beispiel",
  schule: "Berufskolleg Musterstadt", schultage: "Do", beginn: "2025-08-01", ende: "2028-07-31"
};

function beispielLaden() {
  // Nur leere Felder füllen: Eigene Stammdaten überschreibt ein Beispiel nie.
  Object.keys(BEISPIEL_STAMM).forEach(function (k) {
    var feld = stammFeld(k);
    if (feld && !feld.value.trim()) feld.value = BEISPIEL_STAMM[k];
  });
  // Den Donnerstag erkennt der Import als Berufsschule, an der Tätigkeit und am Schulplan.
  importAnwenden(csvAnalysieren(BEISPIEL_CSV), "Beispiel");
  // Am Beispiel gibt es keine Spalten zu prüfen.
  importKarteWeg();
  wocheZeigen("2026-09-07", 0);
  sage("Beispiel geladen: zwei ausgedachte Wochen. Wieder weg: ⋯ → Deine Daten → Löschen.", "gut");
}
