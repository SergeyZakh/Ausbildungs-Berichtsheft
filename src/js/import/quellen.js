/* ============================================================
 * Quellen: Welche Spalte ist was? Aus Zeilen werden Tage.
 *
 * Jede Zeiterfassung nennt ihre Spalten anders, oft auch je nach Sprache
 * der Oberfläche. Statt fester Formate gibt es Felder mit Namenslisten
 * (Deutsch und Englisch) und eine Bewertung: exakter Name vor Namens-
 * anfang vor einzelnem Wort. Wörter wie "billable" oder "end" schließen
 * eine Spalte für ein Feld aus, damit "Start Date" nicht als Beginn-
 * Uhrzeit und "Billable Hours" nicht als Dauer gilt.
 *
 * Reicht das nicht, fragt zuordnung.js nach. Profile bekannter Werkzeuge
 * dienen nur der Meldung („Clockify-Export erkannt“), nicht der Logik.
 * ========================================================== */

var FELDER = [
  { id: "datum", name: "Datum", pflicht: true,
    namen: ["date", "datum", "start date", "startdatum", "work date", "arbeitsdatum", "day", "tag", "spent on", "buchungsdatum", "leistungsdatum"],
    ohne: ["end", "ende", "bis", "stop", "created", "erstellt", "updated", "geändert", "exported", "invoice", "rechnung", "birth", "geburt"] },
  { id: "von", name: "Beginn",
    namen: ["from", "von", "begin", "beginn", "start", "start time", "startzeit", "startuhrzeit", "uhrzeit von", "kommen"],
    ohne: ["date", "datum", "end", "ende", "bis"] },
  { id: "bis", name: "Ende",
    namen: ["to", "bis", "end", "ende", "end time", "endzeit", "enduhrzeit", "uhrzeit bis", "stop", "gehen"],
    ohne: ["date", "datum"] },
  { id: "dauer", name: "Dauer",
    namen: ["duration", "dauer", "hours", "stunden", "std", "zeit", "time", "time spent", "arbeitszeit", "hours worked", "logged hours", "duration h", "duration decimal", "menge"],
    ohne: ["billable", "billed", "abrechenbar", "abgerechnet", "rounded", "gerundet", "rate", "amount", "betrag", "satz", "cost", "kosten",
           "start", "end", "beginn", "ende", "estimate", "schätzung", "remaining", "original", "external", "zone", "stamp",
           "id", "entry", "eintrag", "number", "nummer", "type", "typ", "raum"] },
  { id: "kunde", name: "Kunde",
    namen: ["customer", "kunde", "client", "auftraggeber", "account customer", "kundenname"],
    ohne: ["number", "nummer", "reference", "referenz", "id", "key"] },
  { id: "projekt", name: "Projekt",
    namen: ["project", "projekt", "project name", "projektname", "auftrag"],
    ohne: ["number", "nummer", "code", "key", "reference", "referenz", "id", "lead", "leiter"] },
  { id: "taetigkeit", name: "Tätigkeit",
    namen: ["activity", "tätigkeit", "taetigkeit", "aktivität", "task", "aufgabe", "leistung", "service", "activity name", "issue summary", "summary", "arbeitspaket", "vorgang"],
    ohne: ["id", "key", "type", "typ", "status", "estimate"] },
  { id: "beschreibung", name: "Beschreibung",
    namen: ["description", "beschreibung", "notes", "note", "notiz", "notizen", "comment", "kommentar", "bemerkung", "work description", "text", "tätigkeitsbeschreibung", "details"],
    ohne: ["project", "projekt", "account", "issue"] }
];

/* Nur für die Meldung nach dem Import. Reihenfolge zählt: Clockify vor Toggl. */
var PROFILE = [
  { name: "Kimai", alle: [["tätigkeit", "activity"], ["kunde", "customer"], ["von", "from"], ["bis", "to"]] },
  { name: "Clockify", alle: [["start date"], ["start time"], ["duration h", "duration decimal"]] },
  { name: "Toggl Track", alle: [["start date"], ["start time"], ["duration"], ["email"]] },
  { name: "Harvest", alle: [["notes"], ["hours"], ["first name"], ["last name"]] },
  { name: "Jira/Tempo", alle: [["issue key"], ["work date", "worklog"]] }
];

/** Spaltenname zum Vergleichen: klein, ohne Klammern und Satzzeichen. */
function spaltenName(h) {
  return String(h || "").replace(/^﻿/, "").toLowerCase()
    .replace(/[()\[\]{}.:#_\/-]+/g, " ").replace(/[^0-9a-zäöüß ]+/g, "").replace(/\s+/g, " ").trim();
}

/** Wie gut passt ein Spaltenname zu einem Feld? 0 = gar nicht. */
function spaltenPunkte(norm, feld) {
  if (!norm) return 0;
  var woerter = norm.split(" ");
  if (feld.ohne.some(function (w) { return woerter.indexOf(w) !== -1; }) &&
      feld.namen.indexOf(norm) === -1) return 0;
  var best = 0;
  feld.namen.forEach(function (n) {
    if (norm === n) best = Math.max(best, 30 + n.length);
    else if ((norm + " ").indexOf(n + " ") === 0) best = Math.max(best, 20 + n.length);
    else if ((" " + norm + " ").indexOf(" " + n + " ") !== -1) best = Math.max(best, 10 + n.length);
  });
  return best;
}

/**
 * Felder den Spalten zuordnen: { datum: 0, von: 1, … }, -1 = keine Spalte.
 * Die besten Paare zuerst, jede Spalte nur einmal.
 */
function spaltenZuordnen(kopf) {
  var norm = kopf.map(spaltenName), paare = [];
  FELDER.forEach(function (f) {
    norm.forEach(function (n, i) {
      var p = spaltenPunkte(n, f);
      if (p) paare.push({ feld: f.id, spalte: i, punkte: p });
    });
  });
  paare.sort(function (a, b) { return b.punkte - a.punkte || a.spalte - b.spalte; });
  var felder = {}, belegt = {};
  FELDER.forEach(function (f) { felder[f.id] = -1; });
  paare.forEach(function (p) {
    if (felder[p.feld] !== -1 || belegt[p.spalte]) return;
    felder[p.feld] = p.spalte;
    belegt[p.spalte] = true;
  });
  return felder;
}

function profilErkennen(kopf) {
  var norm = kopf.map(spaltenName);
  var treffer = PROFILE.filter(function (p) {
    return p.alle.every(function (gruppe) {
      return gruppe.some(function (n) { return norm.indexOf(n) !== -1; });
    });
  })[0];
  return treffer ? treffer.name : null;
}

/** Einheit einer Dauer aus dem Spaltennamen. */
function dauerEinheit(name) {
  var n = spaltenName(name);
  if (/\b(min|minuten|minutes)\b/.test(n)) return "min";
  if (/\b(sek|sekunden|sec|seconds|s)\b/.test(n)) return "sek";
  return "";
}

/**
 * Die Kopfzeile finden: Manche Exporte haben Titel- oder Filterzeilen
 * darüber. Gewählt wird unter den ersten zehn Zeilen die, zu der die
 * meisten Felder passen.
 */
function kopfzeileFinden(zeilen) {
  var beste = 0, punkte = -1;
  for (var i = 0; i < Math.min(10, zeilen.length); i++) {
    var f = spaltenZuordnen(zeilen[i]);
    var p = Object.keys(f).filter(function (k) { return f[k] !== -1; }).length + (f.datum !== -1 ? 2 : 0);
    if (p > punkte) { punkte = p; beste = i; }
  }
  return beste;
}

/** Fingerabdruck einer Kopfzeile, unter dem eine Zuordnung gemerkt wird. */
function kopfSignatur(kopf) {
  return kopf.map(spaltenName).join("|");
}

/* ---------- Gemerkte Zuordnungen ---------- */

var ZUORDNUNGEN = "berichtsheft-zuordnungen";

function zuordnungGemerkt(signatur) {
  try { return (JSON.parse(localStorage.getItem(ZUORDNUNGEN) || "{}"))[signatur] || null; } catch (e) { return null; }
}

function zuordnungMerken(signatur, zuordnung) {
  try {
    var alle = JSON.parse(localStorage.getItem(ZUORDNUNGEN) || "{}");
    alle[signatur] = { felder: zuordnung.felder, reihenfolge: zuordnung.reihenfolge };
    localStorage.setItem(ZUORDNUNGEN, JSON.stringify(alle));
  } catch (e) { /* ohne Speicher */ }
}

/**
 * Eine gelesene Datei analysieren:
 *   { kopf, daten, felder, reihenfolge, profil, gemerkt, sicher, gruende }
 * `sicher` heißt: ohne Rückfrage importieren. Sonst nennt `gruende`, was fehlt.
 */
function csvAnalysieren(text) {
  var zeilen = csvZerlegen(text);
  if (!zeilen.length) throw new Error("Die Datei ist leer.");
  var k = kopfzeileFinden(zeilen);
  var kopf = zeilen[k].map(function (h) { return String(h).trim(); });
  var daten = zeilen.slice(k + 1);
  var signatur = kopfSignatur(kopf);
  var gemerkt = zuordnungGemerkt(signatur);

  var a = {
    kopf: kopf, daten: daten, signatur: signatur,
    profil: profilErkennen(kopf),
    felder: gemerkt ? gemerkt.felder : spaltenZuordnen(kopf),
    reihenfolge: null, gemerkt: !!gemerkt, gruende: []
  };
  a.reihenfolge = gemerkt && gemerkt.reihenfolge ? gemerkt.reihenfolge
    : (a.felder.datum !== -1 ? datumsReihenfolge(daten.map(function (z) { return z[a.felder.datum]; })) : "tm");

  if (!gemerkt) a.gruende = zuordnungPruefen(a);
  a.sicher = !a.gruende.length;
  return a;
}

/** Was an einer Zuordnung noch nicht stimmt, in Worten. Leer = passt. */
function zuordnungPruefen(a) {
  var f = a.felder, gruende = [];
  if (f.datum === -1) { gruende.push("Keine Spalte mit dem Datum gefunden."); return gruende; }
  if (f.beschreibung === -1 && f.taetigkeit === -1 && f.projekt === -1) gruende.push("Keine Spalte mit einer Beschreibung gefunden.");
  if (f.dauer === -1 && (f.von === -1 || f.bis === -1)) gruende.push("Weder Dauer noch Beginn und Ende gefunden.");
  if (!a.reihenfolge) gruende.push("Das Datum lässt sich als Tag/Monat und als Monat/Tag lesen.");
  var gelesen = buchungenLesen(a);
  if (!gelesen.buchungen.length) gruende.push("In der Datumsspalte steht kein lesbares Datum.");
  // Summen- und Leerzeilen am Ende sind normal; viele Zeilen ohne Datum heißen: falsche Spalte.
  else if (gelesen.ohneDatum > Math.max(2, gelesen.buchungen.length / 4)) {
    gruende.push(gelesen.ohneDatum + " Zeilen ohne lesbares Datum.");
  }
  return gruende;
}

/**
 * Zeilen zu Buchungen: [{ tag, von, bis, dauer, kunde, projekt, taetigkeit, beschreibung }].
 * Zeilen ohne lesbares Datum (Summen, Leerzeilen) fallen weg und werden gezählt.
 */
function buchungenLesen(a) {
  var f = a.felder, reihenfolge = a.reihenfolge || "tm";
  var wert = function (z, id) { return f[id] !== -1 && f[id] < z.length ? String(z[f[id]] || "").trim() : ""; };
  var einheit = f.dauer !== -1 ? dauerEinheit(a.kopf[f.dauer]) : "";
  var buchungen = [], ohneDatum = 0;

  a.daten.forEach(function (z) {
    var tag = datumAusText(wert(z, "datum"), reihenfolge);
    if (!tag) { ohneDatum++; return; }
    // Steht die Uhrzeit mit in der Datumsspalte ("2026-09-11 15:45"), gilt sie als Beginn.
    var von = f.von !== -1 ? minutenAusZeit(wert(z, "von")) : minutenAusZeit(wert(z, "datum").replace(/^\S+/, ""));
    var bis = minutenAusZeit(wert(z, "bis"));
    var dauer = minutenAusDauer(wert(z, "dauer"), einheit);
    if (dauer == null && von != null && bis != null) dauer = bis >= von ? bis - von : bis + 1440 - von;
    buchungen.push({
      tag: tag, von: von, bis: bis, dauer: dauer || 0,
      kunde: wert(z, "kunde"), projekt: wert(z, "projekt"),
      taetigkeit: wert(z, "taetigkeit"), beschreibung: wert(z, "beschreibung")
    });
  });
  return { buchungen: buchungen, ohneDatum: ohneDatum };
}

/* Lücken ab dieser Minutenzahl zwischen zwei Buchungen gelten als Pause. */
var PAUSE_AB = 10;

/**
 * Buchungen in Tage übersetzen: { "2026-09-07": { stunden, posten, text, ... } }.
 * Nebenbei werden die Kundennamen gemerkt, damit die Bereinigung sie
 * aus dem Text entfernen kann.
 */
function tageAusBuchungen(buchungen) {
  if (!buchungen.length) throw new Error("Keine verwertbaren Zeiteinträge gefunden.");
  kunden = [];
  var neu = {};
  buchungen.forEach(function (b) {
    if (!neu[b.tag]) neu[b.tag] = { von: null, bis: null, minuten: 0, abschnitte: [], posten: [] };
    var t = neu[b.tag];
    if (b.von != null) t.von = t.von == null ? b.von : Math.min(t.von, b.von);
    if (b.bis != null) t.bis = t.bis == null ? b.bis : Math.max(t.bis, b.bis);
    if (b.dauer) t.minuten += b.dauer;
    if (b.von != null && b.bis != null && b.bis > b.von) t.abschnitte.push([b.von, b.bis]);
    if (b.kunde) kundeMerken(b.kunde);
    t.posten.push({
      von: b.von, bis: b.bis, dauer: b.dauer,
      projekt: b.projekt, taetigkeit: b.taetigkeit, beschreibung: b.beschreibung
    });
  });

  Object.keys(neu).forEach(function (tag) {
    var t = neu[tag];
    var ab = t.abschnitte.slice().sort(function (a, b) { return a[0] - b[0]; });
    t.pausen = [];
    if (ab.length) {
      var ende = ab[0][1];
      for (var i = 1; i < ab.length; i++) {
        if (ab[i][0] - ende >= PAUSE_AB) t.pausen.push([ende, ab[i][0]]);
        ende = Math.max(ende, ab[i][1]);
      }
    }
    t.pauseMinuten = t.pausen.reduce(function (s, p) { return s + (p[1] - p[0]); }, 0);
    t.stunden = t.minuten ? Math.round(t.minuten / 3) / 20 : null;
    delete t.abschnitte;
    delete t.minuten;
    // Viele Werkzeuge liefern die neueste Buchung zuerst; gelesen wird der
    // Tag von vorn. Buchungen ohne Uhrzeit bleiben in Dateireihenfolge am Ende.
    t.posten = t.posten.map(function (p, i) { return [p, i]; }).sort(function (a, b) {
      if (a[0].von == null && b[0].von == null) return a[1] - b[1];
      if (a[0].von == null) return 1;
      if (b[0].von == null) return -1;
      return a[0].von - b[0].von || a[1] - b[1];
    }).map(function (x) { return x[0]; });
    t.text = rohtext(t.posten);
    t.entwurf = t.text;          // erkennt später "noch unverändert"
    t.art = feiertagAn(tag, $("f-land").value) || "";
  });
  return neu;
}
