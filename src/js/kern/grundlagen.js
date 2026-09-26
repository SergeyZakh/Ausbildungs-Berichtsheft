/* ============================================================
 * Grundlagen: Zustand, Konstanten, Datums- und Texthelfer
 *
 * Alle Dateien unter src/js/ teilen sich einen Gültigkeitsbereich: Der
 * Build setzt sie in der Reihenfolge aus build.js hintereinander in eine
 * einzige Funktion. Was hier steht, ist deshalb überall sichtbar.
 * ========================================================== */

/* Auf einem Server kann die Anmeldung Pflicht sein. Dann soll man das Werkzeug
   nicht kurz sehen, bevor es zum Anmeldedienst geht: Bis kontoStarten() die
   Antwort hat, bleibt die Seite unsichtbar (html.konto-prueft in basis.css).
   Als Datei (file://) gibt es keinen Server und nichts zu warten. */
if (location.protocol === "http:" || location.protocol === "https:") {
  document.documentElement.classList.add("konto-prueft");
}

/* Chromium hängt bei file:// gelegentlich das erste Dokument eines neuen Tabs an einen leeren
   Speicher, der mit dem Tab verschwindet: Das Heft erschiene leer, und was man schreibt, wäre nach
   dem Schließen weg. Es trifft Seiten, die gleich beim Laden auf den Speicher zugreifen (mit einer
   kleinen Testseite 2–4 % der Tabs); das Werkzeug greift erst nach seinem großen Skript zu und war
   in 250 Versuchen nicht betroffen. Über http und im zweiten Dokument desselben Tabs trat es nie
   auf. Vorsorglich: Ein solcher Speicher ist immer ganz leer, dann einmal neu laden und bis dahin
   nichts zeigen. Ist er beim allerersten Start wirklich leer, kostet das nur dieses Neuladen. */
function speicherNeuLaden() {
  try {
    if (location.protocol !== "file:" || localStorage.length) return false;
    var navigation = performance.getEntriesByType("navigation")[0];
    // Nur beim Öffnen, nie nach einem Neuladen: So kann daraus keine Schleife werden.
    if (!navigation || navigation.type !== "navigate") return false;
    document.documentElement.classList.add("konto-prueft");
    location.reload();
    return true;
  } catch (e) {
    return false;
  }
}
var NEU_LADEN = speicherNeuLaden();

/* ---------- Zustand ----------
   tage         "2026-09-07" -> { text, art, stunden, posten, entwurf, ... }
   wochen       Montage aller Wochen mit Daten, neueste zuerst
   wochendaten  Montag -> { abteilung, unterweisungen }
   aktiverTag   0–6 = Montag–Sonntag, 7 = Wochenreiter */
var tage = {}, wochen = [], aktiveWoche = null, aktiverTag = 0;
var wochendaten = {};

function wocheDaten(montagIso) {
  if (!wochendaten[montagIso]) wochendaten[montagIso] = { abteilung: "", unterweisungen: "" };
  return wochendaten[montagIso];
}

var SPEICHER = "berichtsheft-v1";
var WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
var KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
var MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
var MON_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
var ARTEN = ["", "Berufsschule", "Urlaub", "Krank", "Feiertag", "Betriebsversammlung"];

/* Der Nachweiszeitraum läuft laut IHK von Montag bis Sonntag. */
var TAGE_JE_WOCHE = 7;

/* Wie viele Stichpunkte ein Tag haben soll: so viele Zeilen verlangt der
   Prompt vom Modell, darauf legt zusammenlegen() zusammen, und ab so vielen
   meldet das Textfeld "wird eng". Jeder Betrieb hat eigene Vorgaben, deshalb
   steht die Zahl in "Deine Daten → KI". Vorgabe vier, weil der erste
   Ausbilder schon sechs zu viel fand; mehr als sechs Zeilen zu je rund
   150 Zeichen fasst ein Tag im Vordruck nicht. */
var STICHPUNKTE_VORGABE = 4, STICHPUNKTE_MAX = 6, ZEICHEN_JE_ZEILE = 150;

function stichpunkteJeTag() {
  var feld = document.getElementById("f-ki-stichpunkte");
  var n = parseInt(feld ? feld.value : "", 10);
  if (!(n >= 1)) return STICHPUNKTE_VORGABE;
  return Math.min(n, STICHPUNKTE_MAX);
}

var $ = function (id) { return document.getElementById(id); };

/** "1 Tag", "3 Tage" – Zahl mit passender Endung. */
function mehrzahl(n, eins, viele) { return n + (n === 1 ? eins : viele); }

/* Berufsschule und Betriebsversammlung haben ein eigenes Feld im Vordruck;
   Urlaub, Krank und Feiertag sind "frei" und brauchen keinen Text. */
function istSchultag(art) { return art === "Berufsschule" || art === "Betriebsversammlung"; }

/* ---------- Datum ---------- */
function zwei(n) { return String(n).padStart(2, "0"); }
function iso(d) { return d.getFullYear() + "-" + zwei(d.getMonth() + 1) + "-" + zwei(d.getDate()); }
function dmy(d) { return zwei(d.getDate()) + "." + zwei(d.getMonth() + 1) + "." + d.getFullYear(); }
function dm(d) { return zwei(d.getDate()) + "." + zwei(d.getMonth() + 1) + "."; }
function plus(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function vonIso(s) { var t = s.split("-"); return new Date(+t[0], +t[1] - 1, +t[2]); }

/** Index eines Tages in seiner Woche: Montag 0 … Sonntag 6. */
function tagIndex(d) { return (d.getDay() + 6) % 7; }

/** Der Montag der Woche, in der d liegt. Der Sonntag gehört ans Ende
 *  seiner Woche (getDay() liefert für ihn 0, nicht 7). */
function montagVon(d) {
  var m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - tagIndex(m));
  return m;
}

function wochenNummer(m, start) { return Math.round((m - start) / 604800000) + 1; }

/**
 * Kalenderwoche nach ISO 8601: Über das Jahr entscheidet der Donnerstag,
 * KW 1 ist die Woche mit dem 4. Januar.
 *
 * Gerechnet wird in UTC, also in ganzen Tagen. Eine Differenz lokaler
 * Daten wäre über die Sommerzeitumstellung hinweg eine Stunde zu kurz.
 */
function kalenderwoche(montag) {
  var donnerstag = Date.UTC(montag.getFullYear(), montag.getMonth(), montag.getDate() + 3);
  var jahr = new Date(donnerstag).getUTCFullYear();
  var vierter = new Date(Date.UTC(jahr, 0, 4));
  var kw1 = Date.UTC(jahr, 0, 4 - ((vierter.getUTCDay() + 6) % 7));
  var dieser = Date.UTC(montag.getFullYear(), montag.getMonth(), montag.getDate());
  return Math.round((dieser - kw1) / 604800000) + 1;
}

/** "7.–13. Sep" bzw. "31. Aug – 6. Sep" */
function kurzSpanne(montag) {
  var sonntag = plus(montag, 6);
  return montag.getMonth() === sonntag.getMonth()
    ? montag.getDate() + ".–" + sonntag.getDate() + ". " + MON_KURZ[sonntag.getMonth()]
    : montag.getDate() + ". " + MON_KURZ[montag.getMonth()] + " – " + sonntag.getDate() + ". " + MON_KURZ[sonntag.getMonth()];
}

/** "7.–13. September 2026" bzw. "31. August – 6. September 2026" */
function langSpanne(montag) {
  var sonntag = plus(montag, 6);
  return montag.getMonth() === sonntag.getMonth()
    ? montag.getDate() + ".–" + sonntag.getDate() + ". " + MONATE[sonntag.getMonth()] + " " + sonntag.getFullYear()
    : montag.getDate() + ". " + MONATE[montag.getMonth()] + " – " + sonntag.getDate() + ". " + MONATE[sonntag.getMonth()] + " " + sonntag.getFullYear();
}

function stundenText(h) { return h == null ? "" : h.toFixed(2).replace(".", ","); }
function uhrzeit(min) { return min == null ? "" : zwei(Math.floor(min / 60)) + ":" + zwei(min % 60); }
/** "08:00 – 12:00" mit geschützten Leerzeichen, damit die Spanne nicht umbricht. */
function spanne(a, b) { return uhrzeit(a) + "\u00a0–\u00a0" + uhrzeit(b); }

/**
 * Das Ausbildungsjahr zu einem Datum, gezählt ab Vertragsbeginn.
 * Als Bezug dient das Berichtsdatum, damit alte Wochenblätter im
 * richtigen Jahr bleiben.
 */
function ausbildungsjahr(s, bezug) {
  if (!s || !s.beginn) return "";
  var start = vonIso(s.beginn);
  if (isNaN(start.getTime())) return "";
  var datum = bezug instanceof Date ? new Date(bezug) : new Date();
  if (isNaN(datum.getTime())) datum = new Date();
  var jahr = datum.getFullYear() - start.getFullYear() + 1;
  if (datum.getMonth() < start.getMonth() ||
      (datum.getMonth() === start.getMonth() && datum.getDate() < start.getDate())) jahr--;
  return String(Math.max(1, jahr));
}

function berichtsdatum() { return aktiveWoche ? vonIso(aktiveWoche) : new Date(); }

/* ---------- Gesetzliche Feiertage ----------
   Bundesweit plus die Feiertage des Bundeslands aus den Stammdaten. Was nur in einzelnen
   Gemeinden gilt (Mariä Himmelfahrt in Teilen Bayerns, Fronleichnam in Teilen Sachsens und
   Thüringens, Friedensfest in Augsburg), fehlt absichtlich: Das Land allein entscheidet es nicht,
   und einen solchen Tag trägt man mit „Art des Tages“ selbst ein. */
function ostersonntag(jahr) {
  var a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  var d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  var i = Math.floor(c / 4), k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7;
  var m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(jahr, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November. */
function bussUndBettag(jahr) {
  var tag = new Date(jahr, 10, 22);
  while (tag.getDay() !== 3) tag = plus(tag, -1);
  return tag;
}

/** Feiertage einzelner Länder: Kürzel der Länder und Datum im Jahr. */
function landesfeiertage(jahr, ostern) {
  return [
    { laender: "BW BY ST", tag: new Date(jahr, 0, 6) },                          // Heilige Drei Könige
    { laender: "BE MV", tag: new Date(jahr, 2, 8) },                             // Frauentag
    { laender: "BW BY HE NW RP SL", tag: plus(ostern, 60) },                     // Fronleichnam
    { laender: "SL", tag: new Date(jahr, 7, 15) },                               // Mariä Himmelfahrt
    { laender: "TH", tag: new Date(jahr, 8, 20) },                               // Weltkindertag
    { laender: "BB HB HH MV NI SN ST SH TH", tag: new Date(jahr, 9, 31) },       // Reformationstag
    { laender: "BW BY NW RP SL", tag: new Date(jahr, 10, 1) },                   // Allerheiligen
    { laender: "SN", tag: bussUndBettag(jahr) }                                  // Buß- und Bettag
  ];
}

var feiertageCache = {};
/** "Feiertag" oder null; `land` ist das Kürzel aus den Stammdaten, leer heißt nur bundesweit. */
function feiertagAn(tagIso, land) {
  var jahr = +tagIso.slice(0, 4);
  var schluessel = jahr + (land || "");
  if (!feiertageCache[schluessel]) {
    var ostern = ostersonntag(jahr);
    var daten = [
      new Date(jahr, 0, 1),        // Neujahr
      plus(ostern, -2),            // Karfreitag
      plus(ostern, 1),             // Ostermontag
      new Date(jahr, 4, 1),        // Tag der Arbeit
      plus(ostern, 39),            // Christi Himmelfahrt
      plus(ostern, 50),            // Pfingstmontag
      new Date(jahr, 9, 3),        // Tag der Deutschen Einheit
      new Date(jahr, 11, 25),      // 1. Weihnachtstag
      new Date(jahr, 11, 26)       // 2. Weihnachtstag
    ];
    if (land) {
      landesfeiertage(jahr, ostern).forEach(function (f) {
        if (f.laender.split(" ").indexOf(land) >= 0) daten.push(f.tag);
      });
    }
    feiertageCache[schluessel] = {};
    daten.forEach(function (d) { feiertageCache[schluessel][iso(d)] = "Feiertag"; });
  }
  return feiertageCache[schluessel][tagIso] || null;
}

/* ---------- Text ---------- */

/** Die nicht leeren, getrimmten Zeilen eines Texts. */
function zeilen(text) {
  return String(text || "").split(/\r?\n/)
    .map(function (z) { return z.trim(); })
    .filter(Boolean);
}

/* Stichpunkte stehen im Nachweis ohne Satzzeichen am Ende. Abkürzungen
   behalten ihren Punkt, sonst stünde dort "usw" oder "z. B". */
var ABKUERZUNG_AM_ENDE = /(?:\b(?:usw|etc|bzw|ggf|evtl|inkl|ca|bspw|vgl)|\b[a-z]\.\s?[a-z])\.$/i;

function ohneSchlusspunkt(zeile) {
  var z = String(zeile || "").trim();
  if (ABKUERZUNG_AM_ENDE.test(z)) return z;
  return z.replace(/\s*[.;,]+$/, "");
}

/** Vergleichsschlüssel: klein, nur Buchstaben und Ziffern. */
function schluessel(text) {
  return String(text || "").toLowerCase()
    .replace(/[^0-9a-zäöüß]+/g, " ").trim();
}

/** Text für innerHTML entschärfen. */
function sicher(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wie viele Zeilen ein Tagestext im Vordruck belegt, Umbrüche mitgezählt. */
function zeilenBedarf(text) {
  return zeilen(text).reduce(function (n, z) {
    return n + Math.max(1, Math.ceil(z.length / ZEICHEN_JE_ZEILE));
  }, 0);
}
