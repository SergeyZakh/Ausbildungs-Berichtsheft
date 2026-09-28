/* ============================================================
 * Testzugänge und Start
 * ========================================================== */

/* Für die Tests unter test/: Diese Funktionen lassen sich im Browser
   direkt aufrufen, ohne den Weg über die Oberfläche. */
window.__saeubern = saeubern;
window.__istMuell = istMuell;
window.__kundeMerken = kundeMerken;
window.__fuersModell = fuersModell;
window.__taetigkeiten = taetigkeiten;
window.__zusammenlegen = function (liste, n) { return zusammenlegen(liste, n); };
window.__ohneDenken = ohneDenken;
window.__stichpunkte = stichpunkteJeTag;
window.__kiPrompt = function (n) { return kiPrompt(n); };
window.__kiAdressen = function () { return kiAdressen(); };
window.__feiertagAn = feiertagAn;
window.__montagVon = function (datumIso) { return iso(montagVon(vonIso(datumIso))); };
window.__fehlenderWerktag = function (datumIso) { return fehlenderWerktag(datumIso); };
window.__tagArt = function (datumIso) { return tagArt(datumIso); };
window.__schulbloeckeLesen = schulbloeckeLesen;
window.__wochenBilanz = function (montagIso) { return wochenBilanz(montagIso); };
window.__blockwoche = function (montagIso) { return blockwoche(montagIso); };
window.__wochenAnteil = function (montagIso) { return wochenAnteil(montagIso); };
window.__tagLage = function (datumIso) { return tagLage(datumIso); };
window.__naechsterOffenerTag = function (datumIso) { return naechsterOffenerTag(datumIso); };
window.__ersterOffenerTag = function () { return ersterOffenerTag(); };
window.__wochenTexte = function (montagIso) { return wochenTexte(vonIso(montagIso)); };
window.__offeneWochen = function () { return offeneWochen(); };
window.__hinweise = function () { return browserHinweise; };
window.__kalenderwoche = function (montagIso) { return kalenderwoche(vonIso(montagIso)); };
window.__blattHoehe = function (html) { return blattHoehe(html); };
window.__satzHoehe = function () { return satzHoehe(); };
window.__druckBlatt = function (n, m, st) { return druckBlatt(n, vonIso(m), st); };
/* Import: Analyse einer CSV ohne Oberfläche, Bytes als Array (für den Zeichensatz). */
window.__csvAnalysieren = function (text) {
  var a = csvAnalysieren(text);
  return { kopf: a.kopf, felder: a.felder, reihenfolge: a.reihenfolge, profil: a.profil,
           sicher: a.sicher, gruende: a.gruende, buchungen: buchungenLesen(a).buchungen };
};
window.__csvDekodieren = function (bytes) { return csvDekodieren(new Uint8Array(bytes).buffer); };
window.__minutenAusZeit = minutenAusZeit;
window.__minutenAusDauer = minutenAusDauer;
window.__datumAusText = datumAusText;
window.__konto = function () { return KONTO; };
window.__tage = function () { return tage; };
// Speichert sofort, was merken() erst nach 400 ms schriebe. Tests, die den Speicher von außen
// ändern und neu laden, rufen das vorher: Sonst überschrieb das verspätete Speichern ihren Stand.
window.__merkenJetzt = function () { speichernVerwerfen(); merkenJetzt(); };
window.__wochendaten = function () { return wochendaten; };
window.__wochenStand = function (montagIso) { return wochenStand(montagIso); };
window.__kontoAbgleichen = function () { return kontoAbgleichen(); };
/** Für die Tests: einen Tag setzen wie die Oberfläche, samt Speichern und Abgleich. */
window.__tagSetzen = function (datum, felder) {
  var t = tage[datum] || (tage[datum] = { pausen: [], posten: [] });
  Object.keys(felder).forEach(function (k) { t[k] = felder[k]; });
  wochenNeu();
  merkenJetzt();
  zeichnen();
  return kontoAbgleichen();
};
/** Dasselbe für Abteilung und Unterweisungen einer Woche. */
window.__wocheSetzen = function (montag, felder) {
  var w = wocheDaten(montag);
  Object.keys(felder).forEach(function (k) { w[k] = felder[k]; });
  merkenJetzt();
  zeichnen();
  return kontoAbgleichen();
};

/* ---------- Letzten Stand wiederherstellen ---------- */
var alt = geladen();

// Ohne die Kundennamen ginge nach dem Neuladen ungefilterter Text ans Modell.
if (alt && alt.kunden) alt.kunden.forEach(kundeMerken);

if (alt && alt.stamm) {
  Object.keys(alt.stamm).forEach(function (k) {
    var feld = stammFeld(k);
    // Auch leere Werte übernehmen: Wer ein vorbelegtes Feld geleert hat,
    // soll nach dem Neuladen nicht wieder die Vorgabe sehen.
    if (feld && typeof alt.stamm[k] === "string") feld.value = alt.stamm[k];
  });
  // Bis Version 1.2 stand die Vertragslaufzeit als Freitext in `zeitraum`.
  if (!$("f-ende").value && alt.stamm.zeitraum) {
    var alteDaten = String(alt.stamm.zeitraum)
      .match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\.\d{1,2}\.\d{4}/g) || [];
    var altVon = datumAusText(alteDaten[0] || "");
    var altBis = datumAusText(alteDaten[1] || "");
    if (!$("f-beginn").value && altVon) $("f-beginn").value = altVon;
    if (altBis) $("f-ende").value = altBis;
  }
}

if (alt && alt.tage) {
  tage = alt.tage;
  Object.keys(tage).forEach(function (k) {
    var t = tage[k];
    if (!t.pausen) t.pausen = [];
    if (!t.posten) t.posten = [];
  });
}
if (alt && alt.wochen) wochendaten = alt.wochen;
if (alt && alt.hinweise && typeof alt.hinweise === "object") browserHinweise = alt.hinweise;
// Die Stempel für den Abgleich. Ohne sie galten Stammdaten und Wochen nach jedem Neuladen als
// eben geändert und überschrieben beim ersten Speichern, was ein anderes Gerät ins Konto schrieb.
stempelLaden(alt && alt.geaendert);

wochenNeu();
if (alt && alt.stand && alt.stand.woche && wochen.length) {
  aktiveWoche = alt.stand.woche;
  aktiverTag = (alt.stand.tag >= 0 && alt.stand.tag <= 7) ? alt.stand.tag : 0;
}
zeichnen();
if (wochen.length) {
  sage("Letzter Stand wiederhergestellt — " + Object.keys(tage).length +
    " Tage, " + wochen.length + (wochen.length === 1 ? " Woche." : " Wochen."));
}
hinweiseBeimOeffnen();

/* Am Handy (Touch und schmal) startet der Rundgang nicht: Er zeigt auf Stellen, die es nur im
   breiten Fenster nebeneinander gibt. Das Werkzeug selbst geht, die Ansicht steht in handy.css. */
var amHandy = false;
try { amHandy = window.matchMedia("(pointer: coarse) and (max-width: 820px)").matches; } catch (e) {}


/* Konto: Liegt das Werkzeug auf einem Berichtsheft-Server, anmelden und abgleichen
   (src/js/konto/konto.js). Als Datei im Browser passiert hier nichts. */
if ($("gruppe-zu")) $("gruppe-zu").addEventListener("click", function () { $("dlg-gruppe").close(); });
// Der Rundgang erst, wenn gezeichnet und klar ist, wer angemeldet ist: Er zeigt auf Stellen im
// Fenster, und Ausbilder bekommen einen eigenen. Geht es gleich zum Anmeldedienst, keiner.
kontoStarten().then(function () {
  // Erst jetzt ist klar, ob ein Konto die Daten hält; dann braucht es keine Sicherung.
  hinweiseZeigen();
  if (!amHandy && !KONTO.weiterleitung && !NEU_LADEN && !onbGesehen()) setTimeout(onbStarten, 300);
});
