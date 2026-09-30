/* ============================================================
 * Berufsschule in der Zeiterfassung erkennen
 *
 * Manche Betriebe lassen den Schultag wie jeden anderen buchen, die Fächer in der Beschreibung:
 * „AEUP: Datenbanken, FUIT: IPv4, E: Compiler“ oder je Fach eine Zeile. Ohne Erkennung wurde das
 * ein Arbeitstag mit einer langen Zeile unter „Betriebliche Tätigkeit“.
 *
 * Lieber zu eng als zu gierig: Auch im Betrieb schreibt man „AD: Benutzer angelegt, PC: neu
 * aufgesetzt“. Deshalb zählt ein Tag nur als Berufsschule, wenn jede seiner Buchungen schulisch
 * ist und dazu ein zweites Zeichen kommt: das Stichwort im Projekt oder in der Tätigkeit, der
 * Schulplan aus „Deine Daten“ oder eine Liste von mindestens drei Fächern.
 * ========================================================== */

/* Projekt oder Tätigkeit, die für sich „Schule“ sagen. Ganze Namen: „Schule Musterstadt“ kann ein Kunde sein. */
var SCHUL_STICHWORTE = ["berufsschule", "schule", "berufskolleg", "bs", "unterricht", "blockunterricht"];

/* Fächer, die man ausschreibt; alles andere muss ein Kürzel sein. */
var SCHUL_FAECHER = ["deutsch", "englisch", "mathe", "mathematik", "politik", "religion", "ethik",
  "sport", "wirtschaft", "sozialkunde", "gemeinschaftskunde", "wirtschaftskunde"];

/* Vor dem Doppelpunkt: ein Wort mit großem Anfang, dahinter wahlweise eine Nummer („LF 4“). */
var FACH_ETIKETT = "[A-ZÄÖÜ][A-Za-zÄÖÜäöüß]{0,19}(?: ?\\d{1,2})?";

/**
 * Eine Beschreibung in ihre Teile: an Zeilenumbrüchen, und an Komma oder Semikolon, wenn danach
 * ein neues „Etikett:“ beginnt. „AEUP: Datenbanken, Normalisierung, FUIT: IPv4“ sind zwei Teile.
 */
function fachTeile(text) {
  return String(text || "")
    .split(new RegExp("\\s*(?:\\n|[,;](?=\\s*" + FACH_ETIKETT + ":\\s))\\s*"))
    .map(function (t) { return t.trim(); })
    .filter(Boolean);
}

/** Das Etikett eines Teils, wenn es ein Fach ist: ein Kürzel („AEUP“, „LF4“, „WiSo“) oder ein ausgeschriebenes Fach. */
function fachEtikett(teil) {
  var m = new RegExp("^(" + FACH_ETIKETT + "):\\s*\\S").exec(teil);
  if (!m) return "";
  var e = m[1];
  if (/^[A-ZÄÖÜ]{1,5} ?\d{0,2}$/.test(e)) return e;
  if (/^[A-ZÄÖÜ][a-zäöü]{1,3}[A-ZÄÖÜ][a-zäöü]{0,3}$/.test(e)) return e;
  if (/^Lernfeld ?\d{1,2}$/.test(e)) return e;
  return SCHUL_FAECHER.indexOf(e.toLowerCase()) !== -1 ? e : "";
}

/** Die Fächer einer Beschreibung, wenn sie aus nichts anderem besteht; sonst null. */
function faecherListe(text) {
  var teile = fachTeile(text);
  return teile.length && teile.every(fachEtikett) ? teile : null;
}

function schulStichwort(p) {
  return [p.projekt, p.taetigkeit].some(function (w) {
    var k = schluessel(w);
    return SCHUL_STICHWORTE.indexOf(k) !== -1 || (" " + k + " ").indexOf(" berufsschule ") !== -1;
  });
}

/** Ist der Tag mit diesen Buchungen ein Berufsschultag? */
function schultagAusBuchungen(datumIso, posten) {
  var liste = (posten || []).filter(function (p) { return !ausgeblendet(p, ausnahmen()); });
  if (!liste.length) return false;
  var stichwort = false, faecher = 0;
  var schulisch = liste.every(function (p) {
    var f = faecherListe(p.beschreibung);
    if (f) faecher += f.length;
    if (schulStichwort(p)) { stichwort = true; return true; }
    return !!f;
  });
  return schulisch && (stichwort || faecher >= 3 || schultagLautPlan(datumIso));
}

/**
 * Die Zeilen eines Schultags: je Fach eine, ohne Projekt davor. Ein „Berufsschule:“ am Anfang
 * fällt weg, das sagt schon das Feld im Vordruck.
 */
function schulZeilen(posten) {
  var raus = ausnahmen(), gesehen = {}, out = [];
  (posten || []).forEach(function (p) {
    if (ausgeblendet(p, raus)) return;
    var text = (p.beschreibung || "").trim() || (schulStichwort({ taetigkeit: p.taetigkeit }) ? "" : (p.taetigkeit || "").trim());
    // Der Tag ist schon Schule: Zeilen und „, Fach:“ trennen auch, wenn nicht jeder Teil ein Fach ist.
    fachTeile(text).forEach(function (z) {
      z = saeubern(z.replace(/^(?:berufsschule|schule|unterricht)\s*:\s*/i, "")).trim();
      var k = schluessel(z);
      if (!k || gesehen[k]) return;
      gesehen[k] = true;
      out.push(z);
    });
  });
  return out;
}

/**
 * Die Themen mehrerer Schultage als ein Feld: gleiche Fächer in eine Zeile („AEUP: Datenbanken,
 * Normalisierung“), gleiche Themen einmal, in der Reihenfolge der Woche.
 */
function schulThemenZusammen(zeilenJeTag) {
  var faecher = {}, out = [];
  zeilenJeTag.forEach(function (zeilen) {
    zeilen.forEach(function (z) {
      var e = fachEtikett(z);
      if (!e) {
        if (!out.some(function (x) { return x.text && schluessel(x.text) === schluessel(z); })) out.push({ text: z });
        return;
      }
      var thema = z.slice(z.indexOf(":") + 1).trim();
      var f = faecher[e];
      if (!f) { f = faecher[e] = { etikett: e, themen: [] }; out.push(f); }
      if (!f.themen.some(function (t) { return schluessel(t) === schluessel(thema); })) f.themen.push(thema);
    });
  });
  return out.map(function (x) { return x.etikett ? x.etikett + ": " + x.themen.join(", ") : x.text; }).join("\n");
}

/** Der Entwurf eines importierten Tages: an einem Schultag die Fächer, sonst die Tätigkeiten. */
function tagesEntwurf(t) {
  return t.art === "Berufsschule" ? schulZeilen(t.posten).join("\n") : rohtext(t.posten);
}

/**
 * Im wöchentlichen Vordruck hat die Berufsschule ein Feld je Woche. Haben mindestens zwei
 * importierte Schultage einer Woche noch ihren Entwurf, kommen ihre Fächer zusammen in die Themen
 * der Woche (wochendaten[montag].schule), die Tage bleiben ohne eigenen Text und zählen darunter.
 * Ein einzelner Schultag behält seinen Text; bei der täglichen Notierung bleibt jeder Tag für sich.
 *
 * Eigene Themen der Woche bleiben. Ersetzt wird nur, was leer ist oder noch genau so dasteht, wie
 * es der letzte Import aus `vorher` (dem gespeicherten Stand) gebaut hätte.
 */
function schulwochenZusammenfuehren(montage, vorher) {
  if ($("f-vordruck").value === "taeglich") return;
  montage.forEach(function (montagIso) {
    var montag = vonIso(montagIso), schultage = [];
    for (var i = 0; i < 5; i++) {
      var key = iso(plus(montag, i)), t = tage[key];
      if (!t || t.art !== "Berufsschule" || !t.posten || !t.posten.length) continue;
      if ((t.text || "").trim() && t.text !== t.entwurf) continue;
      schultage.push(key);
    }
    if (schultage.length < 2) return;

    var neu = schulThemenZusammen(schultage.map(function (k) { return schulZeilen(tage[k].posten); }));
    var alt = vorher ? schulThemenZusammen([0, 1, 2, 3, 4].map(function (i) {
      var g = vorher[iso(plus(montag, i))];
      return g && g.art === "Berufsschule" && g.posten ? schulZeilen(g.posten) : [];
    })) : "";
    var w = wocheDaten(montagIso), jetzt = (w.schule || "").trim();
    if (!jetzt || jetzt === alt.trim()) {
      if (jetzt !== neu) delete w.schuleGeprueft;
      w.schule = neu;
    }
    schultage.forEach(function (k) {
      tage[k].text = "";
      tage[k].entwurf = "";
      delete tage[k].geprueft;
    });
  });
}

/**
 * Vorgeschlagene Schultage übernehmen (Karte nach dem Import, hinweise.js). Die Art gilt dann als
 * von Hand gewählt: Derselbe Export fragt beim nächsten Mal nicht wieder. Ein unveränderter Entwurf
 * wird zur Fächerliste; im wöchentlichen Vordruck kommen mehrere Schultage einer Woche in die
 * Themen der Woche (schulwochenZusammenfuehren()).
 */
function schultageUebernehmen(liste) {
  var montage = [];
  liste.forEach(function (k) {
    var t = tage[k];
    if (!t) return;
    var unberuehrt = !(t.text || "").trim() || t.text === t.entwurf;
    t.art = "Berufsschule";
    t.artVonHand = true;
    if (unberuehrt) {
      t.text = tagesEntwurf(t);
      t.entwurf = t.text;
      delete t.geprueft;
    }
    var montag = iso(montagVon(vonIso(k)));
    if (montage.indexOf(montag) === -1) montage.push(montag);
  });
  schulwochenZusammenfuehren(montage, null);
  wochenNeu();
  merkenJetzt();
  zeichnen();
}

/** Vorgeschlagene Schultage ablehnen: Sie bleiben Arbeitstage, und derselbe Export fragt nicht wieder. */
function schultageAblehnen(liste) {
  liste.forEach(function (k) { if (tage[k]) tage[k].artVonHand = true; });
  merkenJetzt();
}

/** Kurz, was an einem vorgeschlagenen Tag gebucht ist: die Fächer, sonst die Beschreibung. */
function schulVorschauText(k) {
  var t = tage[k];
  return schulZeilen((t && t.posten) || []).join(", ");
}

/** Eine Fächerliste, wie der Import sie gebaut hat: Die KI hätte daran nichts zu kürzen. */
function schulEntwurf(t) {
  if (!t || t.art !== "Berufsschule" || t.entwurf == null || t.text !== t.entwurf) return false;
  var z = zeilen(t.text);
  return z.length > 0 && z.every(fachEtikett);
}
