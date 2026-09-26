/* ============================================================
 * Stand der Tage und Wochen, Speichern im Browser
 * ========================================================== */

/**
 * Woher der Text eines Tages stammt:
 *
 *   "leer"    kein Text
 *   "roh"     der unveränderte Entwurf aus den importierten Buchungen
 *   "ki"      vom Sprachmodell formuliert, noch von niemandem übernommen
 *   "eigen"   selbst geschrieben oder bearbeitet, aber nicht übernommen
 *   "fertig"  ausdrücklich übernommen (geprueft)
 *
 * Nur "fertig" gilt als gegengelesen. Angefasst ist nicht gelesen: Wer
 * mitten im Satz aufhört, soll keinen grünen Tag sehen.
 */
function tagStand(t) {
  if (!t) return "leer";
  var text = (t.text || "").trim();
  if (!text) return "leer";
  if (t.geprueft) return "fertig";
  if (t.kiText != null && t.text === t.kiText) return "ki";
  if (t.entwurf != null && t.text === t.entwurf) return "roh";
  return "eigen";
}

/** Braucht dieser Tag noch ein Auge? */
function tagOffen(t) {
  var stand = tagStand(t);
  return stand !== "fertig" && stand !== "leer";
}

/**
 * Braucht dieser Tag einen Eintrag, obwohl gar keiner da ist?
 *
 * Werktag, im Ausbildungszeitraum, nicht in der Zukunft. Dieselbe Regel wie auf dem Server
 * (server/stand.js: „fehlt = Werktag im Ausbildungszeitraum ohne Text“). Ohne sie sah der
 * Azubi eine grüne Woche, während der Ausbilder eine Lücke gemeldet bekam – etwa an einem
 * Urlaubstag, den niemand markiert hat, weil die Zeiterfassung dafür nichts liefert.
 *
 * Steht kein Ausbildungsbeginn in den Stammdaten, gilt der erste eingetragene Tag als Anfang –
 * so wie der Server dann min(datum) nimmt (server/api.js). Sonst wären die Werktage davor
 * beim Azubi Lücken und beim Ausbilder nicht, also wieder zwei Rechnungen.
 */
function fehlenderWerktag(datumIso) {
  if (tagIndex(vonIso(datumIso)) > 4) return false;
  // Ein gesetzlicher Feiertag ohne Eintrag fehlt nicht (auf dem Server: server/feiertage.js).
  if (feiertagAn(datumIso, $("f-land") ? $("f-land").value : "")) return false;
  var vonFeld = $("f-beginn"), bisFeld = $("f-ende");
  var beginn = (vonFeld ? vonFeld.value : "") || ersterEingetragenerTag();
  var ende = bisFeld ? bisFeld.value : "";
  if (beginn && datumIso < beginn) return false;
  if (ende && datumIso > ende) return false;
  return datumIso <= iso(new Date());
}

/** Frühester Tag mit Eintrag. Nur gefragt, solange kein Ausbildungsbeginn eingetragen ist. */
function ersterEingetragenerTag() {
  var frueh = "";
  Object.keys(tage).forEach(function (t) { if (!frueh || t < frueh) frueh = t; });
  return frueh;
}

/**
 * Stand der ganzen Woche:
 *
 *   "pruefen"  mindestens ein Tag mit ungelesenem Text
 *   "fertig"   jeder Tag, der Text braucht, ist übernommen
 *   ""         dazwischen: Text fehlt noch, aber nichts ist ungelesen
 *
 * Freie Tage (Urlaub, Krank, Feiertag) zählen nicht. Ein Werktag ohne Text zählt als Lücke,
 * genau wie beim Ausbilder (server/stand.js) – ob ganz ohne Eintrag oder mit einem, dessen Text
 * geleert wurde. Berufsschule und Stunden ohne Text sind immer eine Lücke.
 */
function wochenStand(montagIso) {
  if (!montagIso) return "";
  var montag = vonIso(montagIso), offen = false, fertig = 0, luecke = false;
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = iso(plus(montag, i));
    var t = tage[datum];
    if (!t) {
      if (fehlenderWerktag(datum)) luecke = true;
      continue;
    }
    var schule = istSchultag(t.art);
    if (t.art && !schule) continue;
    var stand = tagStand(t);
    if (stand !== "fertig" && stand !== "leer") offen = true;
    else if (stand === "fertig") fertig++;
    else if (t.stunden || schule || fehlenderWerktag(datum)) luecke = true;     // kein Text
  }
  if (offen) return "pruefen";
  return (fertig && !luecke) ? "fertig" : "";
}

/**
 * Wie viele Tage der Woche gegengelesen sind, von denen, die ins Heft kommen. Ein Werktag ohne
 * Text zählt mit, auch ganz ohne Eintrag: Sonst zeigte der Ring eine volle Woche, die
 * `wochenStand()` zugleich als lückenhaft führt.
 */
function wochenAnteil(montagIso) {
  var montag = vonIso(montagIso), fertig = 0, von = 0;
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = iso(plus(montag, i));
    var t = tage[datum];
    if (!t) {
      if (fehlenderWerktag(datum)) von++;
      continue;
    }
    var schule = istSchultag(t.art);
    if (t.art && !schule) continue;
    var stand = tagStand(t);
    if (stand === "leer" && !(t.stunden || schule || fehlenderWerktag(datum))) continue;
    von++;
    if (stand === "fertig") fertig++;
  }
  return { fertig: fertig, von: von };
}

/** Ein Fortschrittsring als HTML. */
function ringHtml(fertig, von, titel) {
  var anteil = von ? Math.round(fertig / von * 100) : 0;
  // Voll heißt fertig: grüner Kreis mit Haken statt eines geschlossenen Rings.
  if (von && fertig >= von) return '<span class="ring voll" title="' + sicher(titel) + '">✓</span>';
  return '<span class="ring" style="--anteil:' + anteil + '" title="' + sicher(titel) + '"></span>';
}

/** Zustand eines Tages für seine Zelle im Monatsraster. */
function tagLage(key) {
  var t = tage[key];
  if (!t) return "nichts";
  var schule = istSchultag(t.art);
  if (t.art && !schule) return "frei";
  if ((t.text || "").trim()) return tagOffen(t) ? "voll" : "fertig";
  return (t.stunden || schule) ? "offen" : "nichts";
}

/** Stundensumme der Woche und Zahl der Tage, an denen Text fehlt. */
function lage(montagIso) {
  var montag = vonIso(montagIso), summe = 0, offen = 0;
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var t = tage[iso(plus(montag, i))];
    if (!t) continue;
    if (t.stunden) summe += t.stunden;
    var schule = istSchultag(t.art);
    var frei = !!t.art && !schule;
    if (!frei && (t.stunden || schule) && !(t.text || "").trim()) offen++;
  }
  return { summe: summe, offen: offen };
}

/**
 * wochen[] aus den Tagen ableiten, neueste zuerst. Die offene Woche muss
 * nicht darunter sein: Jede Kalenderwoche lässt sich ansehen und füllen.
 */
function wochenNeu() {
  var g = {};
  Object.keys(tage).forEach(function (t) { g[iso(montagVon(vonIso(t)))] = true; });
  wochen = Object.keys(g).sort().reverse();
  if (!aktiveWoche) aktiveWoche = wochen[0] || null;
}

/** Früheste Woche mit fehlendem oder ungelesenem Text. */
function ersteOffeneWoche() {
  for (var i = wochen.length - 1; i >= 0; i--) {
    if (lage(wochen[i]).offen || wochenStand(wochen[i]) === "pruefen") return wochen[i];
  }
  return null;
}

/* ---------- Stammdaten ---------- */

/* Die Feld-IDs folgen den Schlüsseln: kiAdresse -> f-ki-adresse. Ältere
   Felder mit Großbuchstaben (f-vertragAm) werden direkt gefunden. */
function stammFeld(schluessel) {
  return $("f-" + schluessel.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()) || $("f-" + schluessel);
}

function stammdaten() {
  return {
    name: $("f-name").value, beruf: $("f-beruf").value, betrieb: $("f-betrieb").value,
    abteilung: $("f-abteilung").value, land: $("f-land").value,
    ausbilder: $("f-ausbilder").value, schule: $("f-schule").value,
    beginn: $("f-beginn").value, ende: $("f-ende").value,
    jahr: ausbildungsjahr({ beginn: $("f-beginn").value }, berichtsdatum()),
    geburtsort: $("f-geburtsort").value, geburtsdatum: $("f-geburtsdatum").value,
    anschrift: $("f-anschrift").value, zweig: $("f-zweig").value,
    vertragAm: $("f-vertragAm").value,
    vertreterName: $("f-vertreterName").value,
    vertreterAnschrift: $("f-vertreterAnschrift").value,
    ausblenden: $("f-ausblenden").value,
    projektraus: $("f-projektraus").value,
    namen: $("f-namen").value,
    kiAdresse: $("f-ki-adresse").value, kiModell: $("f-ki-modell").value,
    kiAnweisungen: $("f-ki-anweisungen").value,
    kiStichpunkte: $("f-ki-stichpunkte").value
  };
}

/* ---------- Speichern im localStorage ----------
   Aufbau unter SPEICHER:
     stamm   Stammdaten und Einstellungen
     tage    je Tag Text, Art, Zeiten, Buchungen und Herkunft des Texts
     wochen  Abteilung und Unterweisungen je Woche
     kunden  Kundennamen aus dem letzten Import
     stand   zuletzt offene Woche und Reiter */

/* ---------- Zeitstempel für den Abgleich mit dem Server ----------
   Ohne Konto stören sie nicht, mit Konto entscheiden sie, welcher Stand gewinnt.
   Statt an jeder Stelle im Code zu stempeln, vergleicht `zeitstempelPflegen`
   vor dem Speichern mit dem zuletzt gesicherten Stand. */

var stammGeaendert = null;
/* Je Woche ein Stempel (Montag -> Zeit), wie bei den Tagen. Mit einem gemeinsamen Stempel
   ging bei jeder Änderung an einer Woche der Stand aller Wochen hinaus und überschrieb im
   Konto, was ein anderes Gerät inzwischen in eine andere Woche geschrieben hatte. */
var wochenGeaendert = {};
var zuletztGesichert = {};

/** Was einen Tag im Nachweis ausmacht. Ändert sich das, ist der Tag neu. */
function tagKennung(t) {
  return JSON.stringify([t.text || "", t.art || "", t.stunden == null ? null : t.stunden, !!t.geprueft]);
}

/** Dasselbe für eine Woche. */
function wocheKennung(w) {
  return JSON.stringify([(w && w.abteilung) || "", (w && w.unterweisungen) || ""]);
}
var LEERE_WOCHE = wocheKennung(null);

function zeitstempelPflegen() {
  var jetzt = new Date().toISOString();
  // Beim ersten Durchlauf nach dem Laden nur stempeln, was noch keinen Stempel hat:
  // Sonst sähe ein alter Stand nach dem Öffnen frischer aus als der auf dem Server.
  var stempeln = function (schluessel, kennung, hatStempel, setzen) {
    if (zuletztGesichert[schluessel] === kennung) return;
    if (zuletztGesichert[schluessel] !== undefined || !hatStempel) setzen(jetzt);
    zuletztGesichert[schluessel] = kennung;
  };
  Object.keys(tage).forEach(function (k) {
    stempeln(k, tagKennung(tage[k]), tage[k].geaendert, function (z) { tage[k].geaendert = z; });
  });
  stempeln("__stamm", JSON.stringify(stammdaten()), stammGeaendert, function (z) { stammGeaendert = z; });
  Object.keys(wochendaten).forEach(function (m) {
    var schluessel = "__woche:" + m, kennung = wocheKennung(wochendaten[m]);
    // wocheDaten() legt eine Woche schon beim Ansehen leer an. Das ist keine Eingabe: Mit
    // Stempel ginge sie leer ins Konto und überschriebe dort, was ein anderes Gerät eintrug.
    if (zuletztGesichert[schluessel] === undefined && kennung === LEERE_WOCHE && !wochenGeaendert[m]) {
      zuletztGesichert[schluessel] = kennung;
      return;
    }
    stempeln(schluessel, kennung, wochenGeaendert[m], function (z) { wochenGeaendert[m] = z; });
  });
}

/** Die Stempel, wie merkenJetzt() sie abgelegt hat, nach dem Laden zurück. */
function stempelLaden(geaendert) {
  stammGeaendert = (geaendert && geaendert.stamm) || null;
  wochenGeaendert = {};
  if (!geaendert) return;
  if (geaendert.jeWoche && typeof geaendert.jeWoche === "object") {
    Object.keys(geaendert.jeWoche).forEach(function (m) { wochenGeaendert[m] = geaendert.jeWoche[m]; });
  } else if (geaendert.wochen) {
    // Vor 0.1.0 ein Stempel für alle Wochen zusammen: Er gilt dann für jede einzelne.
    Object.keys(wochendaten).forEach(function (m) { wochenGeaendert[m] = geaendert.wochen; });
  }
}

/** Ein Tag, wie er gespeichert wird. Die Buchungen sind der größte Teil
 *  und fallen weg, wenn der Speicher voll ist. */
function tagSichern(t, mitPosten) {
  var d = {
    text: t.text || "", art: t.art || "",
    geaendert: t.geaendert || null,
    von: t.von == null ? null : t.von,
    bis: t.bis == null ? null : t.bis,
    pausen: t.pausen || [],
    pauseMinuten: t.pauseMinuten || 0,
    stunden: t.stunden == null ? null : t.stunden
  };
  // Entwurf und Modellausgabe gehen mit, damit ein späterer Import
  // erkennt, was selbst geschrieben ist.
  if (t.entwurf != null) d.entwurf = t.entwurf;
  if (t.vorKi != null) d.vorKi = t.vorKi;
  if (t.kiText != null) d.kiText = t.kiText;
  if (t.geprueft) d.geprueft = true;
  if (mitPosten && t.posten && t.posten.length) d.posten = t.posten;
  return d;
}

function merkenJetzt() {
  // Ein neu beschriebener Tag macht seine Woche zu einer mit Daten.
  wochenNeu();
  zeitstempelPflegen();
  var schreiben = function (mitPosten) {
    var alleTage = {};
    Object.keys(tage).forEach(function (k) {
      alleTage[k] = tagSichern(tage[k], mitPosten);
    });
    localStorage.setItem(SPEICHER, JSON.stringify({
      stamm: stammdaten(),
      tage: alleTage,
      wochen: wochendaten,
      kunden: kunden,
      stand: { woche: aktiveWoche, tag: aktiverTag },
      geaendert: { stamm: stammGeaendert, jeWoche: wochenGeaendert }
    }));
  };
  try {
    schreiben(true);
    standZeigen(new Date());
  } catch (e) {
    // Speicher voll: lieber die Buchungen opfern als Texte und Stunden.
    try {
      schreiben(false);
      standZeigen(new Date());
      sage("Wenig Speicherplatz — die einzelnen Buchungen wurden nicht mitgesichert.", "warn");
    } catch (e2) { /* Browser ohne Speicher */ }
  }
}

var speicherTimer = null;
/** Verzögert speichern, damit nicht jeder Tastendruck schreibt. */
function merken() {
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(function () {
    merkenJetzt();
    // Mit Konto wandert der neue Stand kurz danach zum Server (src/js/konto/konto.js).
    if (typeof kontoAbgleichBald === "function") kontoAbgleichBald();
  }, 400);
}

function geladen() {
  try { return JSON.parse(localStorage.getItem(SPEICHER) || "null"); } catch (e) { return null; }
}

/* ---------- Meldungen in der Fußleiste ---------- */

/** art: "" (neutral), "gut" oder "warn" */
function sage(text, art) {
  var m = $("notiz");
  if (!m) return;
  m.textContent = text;
  m.className = "notiz" + (art ? " " + art : "");
  var leiste = m.closest ? m.closest(".fussleiste") : null;
  if (leiste) leiste.className = "fussleiste" + (art ? " " + art : "");
  // Ein modaler Dialog liegt über der Fußleiste; die Meldung erscheint dann zusätzlich in ihm.
  var dlg = offenerDialog();
  if (dlg && text) dialogNotiz(dlg, text, art);
}
// Am Handy kürzt handy.css die Meldung auf zwei Zeilen; ein Tippen zeigt sie ganz. Die nächste
// Meldung setzt className neu und ist damit wieder gekürzt.
if ($("notiz")) $("notiz").addEventListener("click", function () { this.classList.toggle("ganz"); });

/** Der oberste offene modale Dialog, sonst null. */
function offenerDialog() {
  var offen = [].slice.call(document.querySelectorAll("dialog[open]")).filter(function (d) {
    try { return d.matches(":modal"); } catch (e) { return true; }
  });
  return offen.length ? offen[offen.length - 1] : null;
}

var dialogNotizTimer = null;
function dialogNotiz(dlg, text, art) {
  var n = dlg.querySelector(".dlgnotiz");
  if (!n) {
    n = document.createElement("p");
    n.className = "dlgnotiz";
    n.setAttribute("role", "status");
    dlg.appendChild(n);
  }
  n.textContent = text;
  n.className = "dlgnotiz" + (art ? " " + art : "");
  n.hidden = false;
  clearTimeout(dialogNotizTimer);
  dialogNotizTimer = setTimeout(function () { n.hidden = true; }, 6000);
}

function standZeigen(zeit) {
  var f = $("speicherstand");
  if (!f) return;
  f.textContent = zeit
    ? "gespeichert " + zwei(zeit.getHours()) + ":" + zwei(zeit.getMinutes())
    : "";
  // Der Punkt davor leuchtet kurz auf; Neustart der Animation über reflow.
  f.classList.remove("frisch");
  if (zeit) { void f.offsetWidth; f.classList.add("frisch"); }
}
