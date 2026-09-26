/* ============================================================
 * Vorlage für das Sprachmodell
 *
 * Das Modell bekommt nicht den Text aus dem Feld, sondern die bereinigten
 * Tätigkeiten des Tages als Liste: ohne Dopplungen, ohne wertlose Zeilen.
 * Wie viele es sind, spielt keine Rolle – zusammenfassen ist die Aufgabe
 * des Modells.
 * ========================================================== */

/** Nur der erste Doppelpunkt trennt Thema und Beschreibung. */
function einDoppelpunkt(text) {
  var s = String(text || ""), i = s.indexOf(":");
  if (i === -1) return s;
  return s.slice(0, i + 1) + s.slice(i + 1).replace(/\s*:\s*/g, ", ");
}

/** Die bereinigten, entdoppelten Tätigkeiten eines Tages. */
function taetigkeiten(text) {
  var gesehen = {}, out = [];
  zeilen(text).forEach(function (z) {
    var eine = einDoppelpunkt(saeubern(z));
    if (istMuell(eine)) return;
    var k = schluessel(eine);
    if (gesehen[k]) return;
    gesehen[k] = true;
    out.push(eine);
  });
  return out;
}

/** Die Tätigkeiten als Liste, so wie das Modell sie bekommt. */
function fuersModell(text) {
  return taetigkeiten(text).map(function (z) { return "- " + z; }).join("\n");
}
