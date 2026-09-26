/* ============================================================
 * CSV lesen: Zeichensatz, Trennzeichen, Felder, Werte
 *
 * Exporte kommen aus Clockify, Harvest, Jira/Tempo, Kimai, Toggl oder
 * aus Excel. Excel speichert „CSV“ je nach Einstellung als UTF-8, als
 * Windows-1252 oder als UTF-16 mit Tabulatoren. Deshalb wird die Datei
 * als Bytes gelesen und erst hier zu Text.
 * ========================================================== */

/**
 * Bytes zu Text. UTF-16 erkennt man an der Bytefolge am Anfang; sonst
 * zuerst streng als UTF-8 und, wenn das scheitert, als Windows-1252 –
 * damit aus „Tätigkeit“ nicht „T�tigkeit“ wird.
 */
function csvDekodieren(bytes) {
  var b = new Uint8Array(bytes);
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder("utf-16le").decode(b.subarray(2));
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder("utf-16be").decode(b.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b).replace(/^﻿/, "");
  } catch (e) {
    return new TextDecoder("windows-1252").decode(b);
  }
}

/** Das häufigste Trennzeichen der ersten Zeilen, Anführungszeichen ausgenommen. */
function csvTrenner(text) {
  var zahl = { ";": 0, ",": 0, "\t": 0 }, inAnf = false, zeilen = 0;
  for (var i = 0; i < text.length && zeilen < 5; i++) {
    var c = text[i];
    if (c === '"') inAnf = !inAnf;
    else if (!inAnf && c in zahl) zahl[c]++;
    else if (!inAnf && c === "\n") zeilen++;
  }
  return Object.keys(zahl).sort(function (a, b) { return zahl[b] - zahl[a]; })[0];
}

/** CSV in Zeilen und Felder zerlegen. Felder in Anführungszeichen dürfen Umbrüche enthalten. */
function csvZerlegen(text) {
  var trenner = csvTrenner(text);
  var zeilen = [], feld = "", zeile = [], inAnf = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inAnf) {
      if (c === '"') { if (text[i + 1] === '"') { feld += '"'; i++; } else inAnf = false; }
      else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n") { zeile.push(feld.replace(/\r$/, "")); zeilen.push(zeile); zeile = []; feld = ""; }
    else feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld.replace(/\r$/, "")); zeilen.push(zeile); }
  return zeilen.filter(function (z) { return z.some(function (f) { return f.trim() !== ""; }); });
}

/* ---------- Werte ---------- */

/** "08:30", "8:30:00", "03:45 PM", "2026-09-11 15:45" -> Minuten seit Mitternacht */
function minutenAusZeit(s) {
  if (!s) return null;
  var m = String(s).trim().match(/(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?\s*m\b\.?)?/i);
  if (!m) return null;
  var std = +m[1], min = +m[2];
  if (m[3]) {
    var pm = m[3].toLowerCase() === "p";
    if (std === 12) std = pm ? 12 : 0;
    else if (pm) std += 12;
  }
  return std > 24 || min > 59 ? null : std * 60 + min;
}

/**
 * Dauer -> Minuten. "01:30" und "1:30:00" sind Stunden:Minuten(:Sekunden),
 * "1,5" und "1.5" Dezimalstunden. `einheit` kommt aus dem Spaltennamen
 * ("min", "sek"); ohne Angabe gelten Zahlen über 100 als Sekunden.
 */
function minutenAusDauer(s, einheit) {
  if (s == null) return null;
  var t = String(s).trim();
  if (!t) return null;
  if (t.indexOf(":") !== -1) {
    var p = t.split(":");
    return (+p[0] || 0) * 60 + (+p[1] || 0) + Math.round((+p[2] || 0) / 60);
  }
  var z = parseFloat(t.replace(/\s/g, "").replace(",", "."));
  if (isNaN(z)) return null;
  if (einheit === "min") return Math.round(z);
  if (einheit === "sek") return Math.round(z / 60);
  return z > 100 ? Math.round(z / 60) : Math.round(z * 60);
}

/**
 * Datum -> "JJJJ-MM-TT". Mit Punkt gilt immer Tag.Monat, mit dem Jahr vorn
 * Jahr-Monat-Tag. Bei Schrägstrichen entscheidet `reihenfolge`: "tm"
 * (11/09/2026 = 11. September, Vorgabe) oder "mt" (US: 09/11/2026 = 11. September).
 */
function datumAusText(s, reihenfolge) {
  var t = String(s == null ? "" : s).trim(), m;
  if ((m = t.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return datumPruefen(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})\b/))) return datumPruefen(jahr4(m[3]), +m[2], +m[1]);
  if ((m = t.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4}|\d{2})\b/))) {
    return reihenfolge === "mt"
      ? datumPruefen(jahr4(m[3]), +m[1], +m[2])
      : datumPruefen(jahr4(m[3]), +m[2], +m[1]);
  }
  return null;
}

function jahr4(j) { return j.length === 2 ? 2000 + +j : +j; }

/** Nur echte Kalendertage: Der 31.02. wird nicht still zum 3. März. */
function datumPruefen(j, mo, t) {
  var d = new Date(j, mo - 1, t);
  if (d.getFullYear() !== j || d.getMonth() !== mo - 1 || d.getDate() !== t) return null;
  return j + "-" + zwei(mo) + "-" + zwei(t);
}

/**
 * Reihenfolge von Tag und Monat bei Schrägstrich-Daten, aus allen Werten
 * einer Spalte: Steht vorn irgendwo eine Zahl über 12, ist es Tag/Monat;
 * steht sie in der Mitte, Monat/Tag. `null` heißt: nicht zu entscheiden.
 * Ohne Schrägstrich-Daten ist die Frage egal ("tm").
 */
function datumsReihenfolge(werte) {
  var tm = false, mt = false, schraeg = false;
  werte.forEach(function (w) {
    var m = String(w || "").trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-]\d{2,4}/);
    if (!m) return;
    schraeg = true;
    if (+m[1] > 12) tm = true;
    if (+m[2] > 12) mt = true;
  });
  if (!schraeg || (tm && !mt)) return "tm";
  if (mt && !tm) return "mt";
  return null;
}
