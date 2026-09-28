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

/* ---------- Schulplan ----------
   Feste Schultage, Blockunterricht und Schulferien aus „Deine Daten → Schule“. Der Plan füllt nur
   Tage ohne eigenen Inhalt vor: Ein Tag mit Buchungen kann in den Schulferien liegen, dann
   wurde an ihm gearbeitet, und davon weiß der Plan nichts. Gespeichert wird die Art erst, wenn
   am Tag geschrieben oder gewählt wird. Bis dahin ist ein leerer Schultag dieselbe Lücke wie
   ein leerer Arbeitstag, im Heft wie auf dem Server (server/stand.js kennt keinen Plan). */

var WERKTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr"];

/** "Di, Mi" -> [1, 2], Montag ist 0. Was kein Werktag ist, fällt weg. */
function schultageLesen(text) {
  var liste = [];
  String(text || "").split(/[\s,;]+/).forEach(function (w) {
    var i = WERKTAGE_KURZ.indexOf(w.charAt(0).toUpperCase() + w.charAt(1).toLowerCase());
    if (i !== -1 && liste.indexOf(i) === -1) liste.push(i);
  });
  return liste.sort();
}

/**
 * Blockunterricht als Zeiträume, getrennt durch Semikolon, Komma oder Zeilenumbruch:
 * "02.03.2026–20.03.2026; 04.05.–22.05.2026". Fehlt beim ersten Datum das Jahr, gilt das des
 * zweiten (bei einem Block über Neujahr das davor). Ein einzelnes Datum ist ein Block von einem
 * Tag. Was sich nicht lesen lässt, steht in `unklar`, damit der Dialog es zeigen kann.
 */
function schulbloeckeLesen(text) {
  var bloecke = [], unklar = [];
  String(text || "").split(/[;,\n]+/).forEach(function (teil) {
    if (!teil.trim()) return;
    var muster = /(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?/g, m, daten = [];
    while ((m = muster.exec(teil))) {
      daten.push(m[1] ? { j: +m[1], mo: +m[2], t: +m[3] } : { j: m[6] ? jahr4(m[6]) : null, mo: +m[5], t: +m[4] });
    }
    var von = daten[0], bis = daten[daten.length - 1];
    if (!von || daten.length > 2 || bis.j == null) { unklar.push(teil.trim()); return; }
    if (von.j == null) von.j = (von.mo * 100 + von.t > bis.mo * 100 + bis.t) ? bis.j - 1 : bis.j;
    var a = datumPruefen(von.j, von.mo, von.t), b = datumPruefen(bis.j, bis.mo, bis.t);
    if (!a || !b || a > b) { unklar.push(teil.trim()); return; }
    bloecke.push({ von: a, bis: b });
  });
  return { bloecke: bloecke, unklar: unklar };
}

/** Liegt das Datum in einem der Zeiträume aus diesem Feld (Blockunterricht, Schulferien)? */
function inZeitraeumen(feldId, datumIso) {
  return schulbloeckeLesen($(feldId).value).bloecke.some(function (b) {
    return b.von <= datumIso && datumIso <= b.bis;
  });
}

/**
 * Ist das laut Plan ein Schultag? Feiertage und Tage außerhalb der Ausbildung nie. Ein Block
 * gilt auch in den Ferien, die festen Schultage dort nicht: Blockunterricht in den Ferien hat es
 * nie gegeben, ein vergessenes Ferienende dagegen schon.
 */
function schultagLautPlan(datumIso) {
  var tag = tagIndex(vonIso(datumIso));
  if (tag > 4) return false;
  if (feiertagAn(datumIso, $("f-land").value)) return false;
  if (ausserhalbAusbildung(datumIso)) return false;
  if (inZeitraeumen("f-schulbloecke", datumIso)) return true;
  if (inZeitraeumen("f-schulferien", datumIso)) return false;
  return schultageLesen($("f-schultage").value).indexOf(tag) !== -1;
}

/** Liegt der Tag vor dem Ausbildungsbeginn oder nach dem Ende aus den Stammdaten? */
function ausserhalbAusbildung(datumIso) {
  var beginn = $("f-beginn").value, ende = $("f-ende").value;
  return !!((beginn && datumIso < beginn) || (ende && datumIso > ende));
}

/** Hat der Tag etwas Eigenes: Text, Buchungen, Stunden oder eine gewählte Art? */
function tagHatInhalt(t) {
  return !!(t && (t.art || t.artVonHand || (t.text || "").trim() || (t.posten && t.posten.length) || t.stunden));
}

/**
 * Die Art, die für einen Tag gilt: die eingetragene, an einem leeren Tag laut Schulplan
 * "Berufsschule". Für die Ansicht und für das, was am Tag neu eingetragen wird; Stand, Lücken
 * und Export lesen weiter die gespeicherte Art.
 */
function tagArt(datumIso) {
  var t = tage[datumIso];
  if (tagHatInhalt(t)) return t.art || "";
  return schultagLautPlan(datumIso) ? "Berufsschule" : "";
}

/* ---------- Blockwoche ----------
   Der wöchentliche Vordruck hat für die Berufsschule ein Feld je Woche, nicht je Tag. Ist jeder
   Werktag einer Woche Schule oder frei, schreibt man deshalb einmal die Themen der Woche statt
   fünf Tagestexte: wochendaten[montag].schule, übernommen mit schuleGeprueft. */

/**
 * Bekommt die Woche das Themenfeld statt der Tagesreiter? Nur beim wöchentlichen Vordruck (der
 * tägliche braucht eine Zeile je Tag) und nur ohne eigene Tagestexte: Geschriebenes bleibt, wo es
 * steht. Jeder Werktag ist Berufsschule oder frei (Urlaub, Krank, Feiertag, außerhalb der
 * Ausbildung), und Schule ist an mindestens zwei Tagen – ein fester Schultag in einer
 * Urlaubswoche ist kein Block. Ein von Hand gewählter Arbeitstag macht die Woche wieder tageweise.
 */
function blockwoche(montagIso) {
  if (!montagIso || $("f-vordruck").value === "taeglich") return false;
  var montag = vonIso(montagIso), land = $("f-land").value, schule = 0;
  for (var i = 0; i < 5; i++) {
    var d = iso(plus(montag, i)), t = tage[d];
    if (t && (t.text || "").trim()) return false;
    var art = tagArt(d);
    if (art === "Berufsschule") schule++;
    else if (art && !istSchultag(art)) continue;
    else if (art || tagHatInhalt(t) || !(feiertagAn(d, land) || ausserhalbAusbildung(d))) return false;
  }
  return schule >= 2;
}

/** Die Woche, wenn sie Themen für die Berufsschule hat, sonst null. */
function wochenSchule(montagIso) {
  var w = wochendaten[montagIso];
  return w && (w.schule || "").trim() ? w : null;
}

/**
 * Steht der Tag unter den Themen seiner Woche? Jeder Werktag ohne eigenen Text, der nicht frei ist,
 * sobald die Woche Themen hat, mit Eintrag oder ohne. Nicht nur die Schultage laut Plan: Der Server
 * kennt den Plan nicht und zählt genauso (server/stand.js).
 */
function tagImWochenfeld(datumIso) {
  var datum = vonIso(datumIso);
  if (tagIndex(datum) > 4 || !wochenSchule(iso(montagVon(datum)))) return false;
  var t = tage[datumIso];
  if (t && ((t.text || "").trim() || (t.art && !istSchultag(t.art)))) return false;
  if (!tagHatInhalt(t) && feiertagAn(datumIso, $("f-land").value)) return false;
  return !ausserhalbAusbildung(datumIso);
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
  var feld = wochenSchule(montagIso);
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = iso(plus(montag, i));
    var t = tage[datum];
    // Unter den Themen der Woche zählt der Tag mit deren Stand.
    if (feld && tagImWochenfeld(datum)) {
      if (feld.schuleGeprueft) fertig++; else offen = true;
      continue;
    }
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
  var feld = wochenSchule(montagIso);
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = iso(plus(montag, i));
    var t = tage[datum];
    if (feld && tagImWochenfeld(datum)) {
      von++;
      if (feld.schuleGeprueft) fertig++;
      continue;
    }
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

/**
 * Was eine Woche noch braucht, Tag für Tag nach denselben Regeln wie `wochenStand()`:
 *   ohneText   Tage, die Text bräuchten und keinen haben
 *   ungelesen  Tage mit Text, der noch nicht als fertig markiert ist
 *   fertig     gegengelesene Tage
 *   erster     Index des ersten Tags, der etwas braucht, sonst -1
 * Für den Hinweis beim Öffnen und die Übersicht (hinweise.js, uebersicht.js).
 */
function wochenBilanz(montagIso) {
  var montag = vonIso(montagIso), b = { ohneText: 0, ungelesen: 0, fertig: 0, erster: -1 };
  var merke = function (i) { if (b.erster === -1) b.erster = i; };
  var feld = wochenSchule(montagIso);
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = iso(plus(montag, i));
    var t = tage[datum];
    if (feld && tagImWochenfeld(datum)) {
      if (feld.schuleGeprueft) b.fertig++;
      else { b.ungelesen++; merke(i); }
      continue;
    }
    if (!t) {
      if (fehlenderWerktag(datum)) { b.ohneText++; merke(i); }
      continue;
    }
    var schule = istSchultag(t.art);
    if (t.art && !schule) continue;
    var stand = tagStand(t);
    if (stand === "fertig") b.fertig++;
    else if (stand !== "leer") { b.ungelesen++; merke(i); }
    else if (t.stunden || schule || fehlenderWerktag(datum)) { b.ohneText++; merke(i); }
  }
  return b;
}

/** Braucht der Tag noch etwas, Text oder „Fertig“? Die Regeln von wochenBilanz(), für einen Tag. */
function tagBrauchtNoch(datumIso) {
  if (tagImWochenfeld(datumIso)) return !wochenSchule(iso(montagVon(vonIso(datumIso)))).schuleGeprueft;
  var t = tage[datumIso];
  if (!t) return fehlenderWerktag(datumIso);
  var schule = istSchultag(t.art);
  if (t.art && !schule) return false;
  var stand = tagStand(t);
  if (stand === "fertig") return false;
  if (stand !== "leer") return true;
  return !!(t.stunden || schule || fehlenderWerktag(datumIso));
}

/**
 * Der erste Tag von `von` bis `bis` (einschließlich), der noch etwas braucht, sonst null. Ohne
 * `bis` bis heute oder bis zum letzten Eintrag, wenn der später liegt: Vorgeschriebenes will auch
 * gelesen sein.
 */
function offenerTagAb(von, bis) {
  if (!bis) {
    bis = iso(new Date());
    Object.keys(tage).forEach(function (k) { if (k > bis) bis = k; });
    Object.keys(wochendaten).forEach(function (m) {
      var freitag = iso(plus(vonIso(m), 4));
      if (wochenSchule(m) && freitag > bis) bis = freitag;
    });
  }
  for (var d = vonIso(von); iso(d) <= bis; d = plus(d, 1)) {
    if (tagBrauchtNoch(iso(d))) return iso(d);
  }
  return null;
}

/** Der nächste Tag nach `datumIso`, der noch etwas braucht. Nur nach vorn: Wer den heutigen Tag
 *  fertig macht, soll nicht zur ältesten Lücke der Ausbildung zurückgeworfen werden. */
function naechsterOffenerTag(datumIso) {
  return offenerTagAb(iso(plus(vonIso(datumIso), 1)));
}

/** Der früheste Tag, der noch etwas braucht, ab Ausbildungsbeginn (ohne ihn ab dem ersten Eintrag). */
function ersterOffenerTag(bis) {
  var anfang = $("f-beginn").value || ersterEingetragenerTag();
  return anfang ? offenerTagAb(anfang, bis) : null;
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
  if (tagImWochenfeld(key)) return wochenSchule(iso(montagVon(vonIso(key)))).schuleGeprueft ? "fertig" : "voll";
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
    var key = iso(plus(montag, i)), t = tage[key];
    if (!t) continue;
    if (t.stunden) summe += t.stunden;
    if (tagImWochenfeld(key)) continue;
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
  // Eine Blockwoche kann ohne einen einzigen Tageseintrag auskommen und gehört doch ins Heft.
  Object.keys(wochendaten).forEach(function (m) { if (wochenSchule(m)) g[m] = true; });
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
    schultage: $("f-schultage").value, schulbloecke: $("f-schulbloecke").value,
    schulferien: $("f-schulferien").value, vordruck: $("f-vordruck").value,
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
     wochen  Abteilung und Unterweisungen je Woche, in Blockwochen die Themen der Berufsschule
     kunden  Kundennamen aus dem letzten Import
     stand   zuletzt offene Woche und Reiter
     hinweise  letzte Sicherung und weggeklickte Hinweise (hinweise.js), nur für diesen Browser */

/* { gesichert, homeBildschirm, sicherungSpaeter } – nie im Konto: Ob in diesem Browser gesichert
   wurde, sagt nichts über ein anderes Gerät. */
var browserHinweise = {};

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
  return JSON.stringify([(w && w.abteilung) || "", (w && w.unterweisungen) || "",
    (w && w.schule) || "", !!(w && w.schuleGeprueft)]);
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
  // Auch „Arbeitstag“ von Hand zählt: Sonst stünde ein leerer Tag gleich wieder auf dem Schulplan.
  if (t.artVonHand) d.artVonHand = true;
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
      geaendert: { stamm: stammGeaendert, jeWoche: wochenGeaendert },
      hinweise: browserHinweise
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
    speicherTimer = null;
    merkenJetzt();
    // Mit Konto wandert der neue Stand kurz danach zum Server (src/js/konto/konto.js).
    if (typeof kontoAbgleichBald === "function") kontoAbgleichBald();
  }, 400);
}
/** Ein ausstehendes Speichern fallen lassen, etwa weil der Stand gleich ersetzt wird. */
function speichernVerwerfen() {
  clearTimeout(speicherTimer);
  speicherTimer = null;
}
/** Steht ein Speichern aus, jetzt statt in bis zu 400 ms. */
function speichernSofort() {
  if (!speicherTimer) return;
  speichernVerwerfen();
  merkenJetzt();
}
// Wer ändert und die Seite gleich schließt, neu lädt oder am Handy die App wechselt, verlor die
// Änderung der letzten 400 ms. Auf dem Bau-Server traf das den Test fürs Bundesland: gewählt,
// 400 ms gewartet, neu geladen – und manchmal war es weg.
window.addEventListener("pagehide", speichernSofort);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") speichernSofort();
});

function geladen() {
  try { return JSON.parse(localStorage.getItem(SPEICHER) || "null"); } catch (e) { return null; }
}

/* ---------- Meldungen in der Fußleiste ---------- */

/* Am Handy wird die Meldung nach NOTIZ_STILL_MS leise: eine Zeile, ohne Farbe (handy.css). Sie
   bleibt lesbar und lässt sich antippen, nimmt dem Schreibfeld aber keinen Platz mehr. */
var NOTIZ_STILL_MS = 8000, notizUhr = null;

/** art: "" (neutral), "gut" oder "warn" */
function sage(text, art) {
  var m = $("notiz");
  if (!m) return;
  m.textContent = text;
  m.className = "notiz" + (art ? " " + art : "");
  var leiste = m.closest ? m.closest(".fussleiste") : null;
  if (leiste) leiste.className = "fussleiste" + (art ? " " + art : "");
  clearTimeout(notizUhr);
  notizUhr = setTimeout(function () {
    if (m.classList.contains("ganz")) return;
    m.classList.add("still");
    if (leiste) leiste.classList.add("still");
  }, NOTIZ_STILL_MS);
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
