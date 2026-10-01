/* ============================================================
 * Word-Dokument (Bibliothek docx, als window.docx eingebunden)
 *
 * Aufbau nach dem amtlichen Vordruck der IHK
 * ("Berichtsheft – Ausbildungsnachweis – wöchentliche Notierung –"):
 *
 *   Seite 1   Deckblatt mit Stammdaten und Unterschrift des
 *             gesetzlichen Vertreters
 *   Seite 2   Ausbildungsgang: Abteilung von/bis
 *   ab 3      je Woche ein Blatt mit drei Feldern und drei Unterschriften
 *
 * Zeiten und Stunden stehen bewusst nicht im Dokument, auch nicht in der
 * täglichen Notierung (Deine Daten → Verarbeitung → Vordruck): Der Nachweis
 * fragt nach Tätigkeiten, die IHK nicht nach Stunden. Maße in Twips (1 cm = 567).
 * ========================================================== */

var D = window.docx;
var FONT = "Cambria";
var AKZENT = "000000", LINIE = "9C9C9C", KRAFT = "000000", GRAU = "575757";
var RAND_X = 850, RAND_Y = 907, BREITE = 11906 - 2 * RAND_X;

var SEITE = {
  page: {
    size: { width: 11906, height: 16838 },
    margin: { top: RAND_Y, right: RAND_X, bottom: RAND_Y, left: RAND_X, header: 500, footer: 460 }
  }
};

/* Satz je Dichtestufe (siehe dichte()). Eine volle Woche rückt enger
   zusammen, statt auf eine zweite Seite zu laufen; unter Stufe 2 wird
   nicht weiter geschrumpft. */
var MASSE = [
  { text: 19, zeile: 250, vorPos: 50, vorTag: 220, tag: 16,
    gross: 5000, klein: 1900, rand: 150, vorFeld: 260, tageszeile: 1350 },
  { text: 18, zeile: 235, vorPos: 40, vorTag: 190, tag: 15,
    gross: 3800, klein: 1600, rand: 130, vorFeld: 210, tageszeile: 950 },
  { text: 17, zeile: 220, vorPos: 30, vorTag: 150, tag: 14,
    gross: 2400, klein: 1200, rand: 110, vorFeld: 170, tageszeile: 560 }
];

/* ---------- Grundbausteine ---------- */

function rahmen(farbe, staerke) { return { style: D.BorderStyle.SINGLE, size: staerke || 4, color: farbe || LINIE }; }
function ohneRahmen() { return { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" }; }

function absatz(inhalt, o) {
  o = o || {};
  return new D.Paragraph({
    alignment: o.ausrichtung || D.AlignmentType.LEFT,
    spacing: { before: o.vor || 0, after: o.nach || 0, line: o.zeile || 240 },
    children: [new D.TextRun({
      text: inhalt, font: FONT, size: o.groesse || 20, bold: !!o.fett,
      color: o.farbe || "2B2F33", characterSpacing: o.sperrung || 0, allCaps: !!o.grossbuchstaben
    })]
  });
}

/** Absatz aus mehreren Textstücken, etwa für fetten Wochentag und normalen Rest. */
function mischAbsatz(teile, o) {
  o = o || {};
  return new D.Paragraph({
    alignment: o.ausrichtung || D.AlignmentType.LEFT,
    spacing: { before: o.vor || 0, after: o.nach || 0, line: o.zeile || 240 },
    indent: o.einzug,
    children: teile.filter(function (t) { return t && t.text; }).map(function (t) {
      return new D.TextRun({
        text: t.text, font: FONT, size: t.groesse || o.groesse || 20,
        bold: !!t.fett, color: t.farbe || "2B2F33", characterSpacing: t.sperrung || 0
      });
    })
  });
}

/** Zelle ohne Rahmen, für Kopfzeilen und Unterschriftsfelder. */
function frei(kinder, breite, opt) {
  opt = opt || {};
  return new D.TableCell({
    width: { size: breite, type: D.WidthType.DXA },
    columnSpan: opt.spalten,
    verticalAlign: opt.vertikal || D.VerticalAlign.BOTTOM,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    borders: {
      top: opt.oben || ohneRahmen(), bottom: opt.unten || ohneRahmen(),
      left: ohneRahmen(), right: ohneRahmen()
    },
    children: kinder
  });
}

function tabelle(breiten, reihen) {
  return new D.Table({
    width: { size: BREITE, type: D.WidthType.DXA },
    columnWidths: breiten,
    layout: D.TableLayoutType.FIXED,
    rows: reihen
  });
}

/* ---------- Wochenblatt ---------- */

var SP_KOPF = [850, 1800, 2450, 2506, 2600];   // Summe = BREITE

/**
 * Kopfleiste: Nummer, Ausbildungsjahr, Woche, Abteilung, Name – Etikett über dem Wert.
 * Das Ausbildungsjahr steht links, so will es der Ausbilder lesen; Nummer und Jahr in eigenen
 * Feldern wie im Vordruck, "3 / 1" unter einem Etikett las niemand richtig.
 */
function kopfLeiste(s, abteilung, nummer, montag) {
  var jahr = ausbildungsjahr(s, montag) || s.jahr || "";
  var werte = [
    ["Nr.", String(nummer)],
    ["Ausbildungsjahr", jahr ? jahr + "." : ""],
    ["Ausbildungswoche", dmy(montag) + " – " + dmy(plus(montag, 6))],
    ["Ausbildungsabteilung", abteilung],
    ["Name", s.name]
  ];
  return tabelle(SP_KOPF, [new D.TableRow({
    children: werte.map(function (w, i) {
      return new D.TableCell({
        width: { size: SP_KOPF[i], type: D.WidthType.DXA },
        verticalAlign: D.VerticalAlign.BOTTOM,
        margins: { top: 0, bottom: 60, left: 0, right: 160 },
        borders: { top: ohneRahmen(), left: ohneRahmen(), right: ohneRahmen(), bottom: rahmen(KRAFT, 4) },
        children: [
          absatz(w[0], { groesse: 13, sperrung: 10, grossbuchstaben: true, farbe: GRAU, nach: 40 }),
          absatz(w[1] || "", { groesse: 19 })
        ]
      });
    })
  })]);
}

/**
 * Ein Feld: Überschrift und umrandete Fläche in einer Tabelle. Die erste
 * Zeile ist als Kopfzeile markiert, damit Word die Überschrift wiederholt,
 * wenn das Feld auf eine zweite Seite läuft.
 */
function feldBlock(titel, absaetze, hoehe, m) {
  m = m || MASSE[0];
  return [
    absatz("", { nach: m.vorFeld }),
    tabelle([BREITE], [
      new D.TableRow({
        tableHeader: true,
        children: [new D.TableCell({
          width: { size: BREITE, type: D.WidthType.DXA },
          margins: { top: 0, bottom: 90, left: 0, right: 0 },
          borders: { top: ohneRahmen(), bottom: ohneRahmen(), left: ohneRahmen(), right: ohneRahmen() },
          children: [absatz(titel, {
            groesse: 14, sperrung: 12, grossbuchstaben: true, farbe: AKZENT, zeile: 220
          })]
        })]
      }),
      new D.TableRow({
        height: { value: hoehe, rule: D.HeightRule.ATLEAST },
        children: [new D.TableCell({
          width: { size: BREITE, type: D.WidthType.DXA },
          verticalAlign: D.VerticalAlign.TOP,
          margins: { top: m.rand, bottom: m.rand, left: 180, right: 180 },
          borders: {
            top: rahmen(KRAFT, 2), bottom: rahmen(KRAFT, 2),
            left: rahmen(KRAFT, 2), right: rahmen(KRAFT, 2)
          },
          children: absaetze.length ? absaetze : [absatz("")]
        })]
      })
    ])
  ];
}

/** Drei Unterschriftsfelder nebeneinander. */
function unterschriften() {
  var oben = { style: D.BorderStyle.SINGLE, size: 4, color: KRAFT, space: 4 };
  function feld(bezeichnung) {
    return [
      new D.Paragraph({ spacing: { after: 480 }, children: [new D.TextRun({ text: "", size: 20 })] }),
      new D.Paragraph({
        spacing: { after: 0 },
        border: { top: oben },
        children: [new D.TextRun({ text: bezeichnung, font: FONT, size: 14, color: GRAU })]
      })
    ];
  }
  var l = 3200, g = 303;
  return tabelle([l, g, l, g, l], [new D.TableRow({
    cantSplit: true,
    children: [
      frei(feld("Auszubildender / Datum"), l, { vertikal: D.VerticalAlign.TOP }),
      frei([absatz("")], g),
      frei(feld("Ausbilder / Datum"), l, { vertikal: D.VerticalAlign.TOP }),
      frei([absatz("")], g),
      frei(feld("Gesetzlicher Vertreter / Datum"), l, { vertikal: D.VerticalAlign.TOP })
    ]
  })]);
}

/**
 * Verteilt die Woche auf die drei Felder des Vordrucks:
 *   betrieb       Arbeitstage mit Text, dazu Urlaub, Krank, Feiertag
 *   unterweisung  Text aus dem Wochenreiter, Betriebsversammlungen
 *   schule        Berufsschultage
 * Ein Eintrag ist { kopf: { tag, rest }, text }. Wird auch vom Druck genutzt.
 * Mit dem Vordruck „ohne Wochentage“ (`s`) stehen die Tage ohne Überschrift da (ohneTage()).
 */
function wochenTexte(montag, s) {
  var betrieb = [], unterweisung = [], schule = [], summe = 0;

  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = plus(montag, i), t = tage[iso(datum)];
    if (!t) continue;
    if (t.stunden) summe += t.stunden;

    var art = t.art || "";
    var text = zeilen(t.text).map(ohneSchlusspunkt).join("\n");
    // In Schul- und Unterweisungsfeld steht die Art schon in der Überschrift.
    var eigenesFeld = istSchultag(art);

    // Ein Arbeitstag ohne Text wäre eine leere Zeile. Freie Tage bleiben
    // auch ohne Text stehen: Dort ist der Grund die Angabe.
    if (!text && (eigenesFeld || !art)) continue;
    var eintrag = {
      kopf: { tag: WOCHENTAGE[datum.getDay()], rest: (art && !eigenesFeld) ? art : "", datum: iso(datum) },
      text: text
    };
    if (art === "Berufsschule") schule.push(eintrag);
    else if (art === "Betriebsversammlung") unterweisung.push(eintrag);
    else betrieb.push(eintrag);
  }

  var wd = wochendaten[iso(montag)] || {};
  var eigene = zeilen(wd.unterweisungen).map(ohneSchlusspunkt).join("\n");
  if (eigene) unterweisung.unshift({ kopf: "", text: eigene });
  // Die Themen einer Blockwoche stehen ohne Wochentag vorn, wie der Vordruck sein Feld meint.
  var themen = zeilen(wd.schule).map(ohneSchlusspunkt).join("\n");
  if (themen) schule.unshift({ kopf: "", text: themen });

  if (ohneWochentage(s)) {
    betrieb = ohneTage(betrieb);
    unterweisung = ohneTage(unterweisung);
    schule = ohneTage(schule);
  }
  return { betrieb: betrieb, unterweisung: unterweisung, schule: schule, summe: summe };
}

/**
 * Dieselben Einträge ohne Tagesüberschrift, für Hefte, in denen nur die Tätigkeiten der Woche
 * stehen. Jede Zeile steht nur einmal: Die Teambesprechung an jedem Morgen stünde sonst fünfmal
 * untereinander. Freie Tage verlören mit der Überschrift ihre einzige Angabe; sie werden eine
 * Zeile am Ende („Urlaub am Mittwoch und Donnerstag“, `frei`). Die Zeilen behalten ihr Datum,
 * damit man im Blatt weiter je Tag schreibt (wochenblatt.js).
 */
function ohneTage(liste) {
  var gesehen = {}, frei = [], raus = [];
  liste.forEach(function (e) {
    var kopf = e.kopf || {};
    if (kopf.rest) {
      var f = frei.filter(function (x) { return x.art === kopf.rest; })[0];
      if (!f) frei.push(f = { art: kopf.rest, tage: [] });
      f.tage.push(kopf.tag);
    }
    var neu = zeilen(e.text).filter(function (z) {
      var k = schluessel(z);
      if (!k || gesehen[k]) return false;
      gesehen[k] = true;
      return true;
    });
    if (neu.length) raus.push({ kopf: kopf.datum ? { datum: kopf.datum } : "", text: neu.join("\n") });
  });
  frei.forEach(function (f) {
    raus.push({ kopf: "", frei: true, text: f.art + " am " + aufzaehlen(f.tage) });
  });
  return raus;
}

/** Dichtestufe 0–2 nach der Textmenge der Woche. */
function dichte(texte) {
  var n = 0;
  [texte.betrieb, texte.unterweisung, texte.schule].forEach(function (liste) {
    liste.forEach(function (e) { n += (e.text || "").length + 24; });
  });
  return n < 950 ? 0 : n < 1750 ? 1 : 2;
}

/** Eine Zeile als Stichpunkt: Punkt davor, der Text durchgehend normal, auch vor einem Doppelpunkt. */
function stichpunkt(text, m, vor) {
  var roh = String(text).replace(/^\s*[-*•]\s*/, "").trim();
  // Hängender Einzug: Der Punkt steht bei 200 Twips, der Text bei 400.
  var o = { groesse: m.text, zeile: m.zeile, vor: vor, einzug: { left: 400, hanging: 200 } };
  return mischAbsatz([{ text: "•\u2003" + roh }], o);
}

/** Einträge in Absätze: Wochentag als Kopf, jede Textzeile ein Stichpunkt. */
function eintraege(liste, m) {
  m = m || MASSE[0];
  var out = [];
  liste.forEach(function (e, i) {
    if (e.kopf && e.kopf.tag) {
      out.push(mischAbsatz([
        { text: e.kopf.tag, fett: true, farbe: AKZENT },
        { text: e.kopf.rest ? "   ·   " + e.kopf.rest : "", farbe: GRAU }
      ], { groesse: m.tag, vor: i ? m.vorTag : 0, zeile: 230 }));
    }
    zeilen(e.text).forEach(function (z, j) {
      // Ohne Tagesüberschrift (ohneTage()) laufen die Zeilen durch, ohne Abstand zwischen den Tagen.
      var vor = j ? m.vorPos : ((e.kopf && e.kopf.tag) ? m.vorPos + 10 : (i ? m.vorPos : 0));
      out.push(stichpunkt(z, m, vor));
    });
  });
  return out;
}

function wochenSeite(nummer, montag, s) {
  if (taeglich(s)) return taeglicheSeite(nummer, montag, s);
  var texte = wochenTexte(montag, s);
  var wd = wochendaten[iso(montag)] || {};
  var abteilung = wd.abteilung || s.abteilung || "";
  var m = MASSE[dichte(texte)];

  var teile = [
    absatz("Ausbildungsnachweis", {
      groesse: 24, sperrung: 20, grossbuchstaben: true, farbe: AKZENT,
      ausrichtung: D.AlignmentType.CENTER, vor: 120, nach: 420
    }),
    kopfLeiste(s, abteilung, nummer, montag)
  ]
    .concat(feldBlock("Betriebliche Tätigkeit", eintraege(texte.betrieb, m), m.gross, m))
    .concat(feldBlock("Unterweisungen, Lehrgespräche, betrieblicher Unterricht, sonstige Schulungsveranstaltungen",
                      eintraege(texte.unterweisung, m), m.klein, m))
    .concat(feldBlock("Berufsschule (Unterrichtsthemen)", eintraege(texte.schule, m), m.klein, m));

  teile.push(absatz("", { nach: m.vorFeld }));
  teile.push(unterschriften());
  return { kinder: teile, kopf: fortsetzungsKopf(s, montag) };
}

/* ---------- Tägliche Notierung ---------- */

function taeglich(s) { return !!s && s.vordruck === "taeglich"; }
/** Wöchentlich, aber nur die Tätigkeiten, ohne Überschrift je Tag (ohneTage(), Schalter über dem Blatt). */
function ohneWochentage(s) { return !!s && !taeglich(s) && (s.ohneTage === "ja" || s.vordruck === "ohnetage"); }

/** Untertitel des Deckblatts, je nach Vordruck. */
function notierungTitel(s) {
  return "(Ausbildungsnachweis – " + (taeglich(s) ? "tägliche" : "wöchentliche") + " Notierung –)";
}

var TAEGLICH_SPALTE = "Ausgeführte Arbeiten, Unterweisungen, Berufsschulunterricht";

/**
 * Die Zeilen einer Woche für die tägliche Notierung, gemeinsam für Word und Druck:
 * Montag bis Freitag immer, Samstag und Sonntag nur mit Eintrag, zuletzt die Themen einer
 * Blockwoche und die Unterweisungen der Woche. Ein Eintrag ist { kopf: { tag, datum, art, woche }, text }.
 * Die Art steht über dem Text, außer bei einem gewöhnlichen Arbeitstag.
 */
function tagesZeilen(montag) {
  var out = [];
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var datum = plus(montag, i), t = tage[iso(datum)];
    var text = t ? zeilen(t.text).map(ohneSchlusspunkt).join("\n") : "";
    // Ein Tag unter den Themen der Woche ist Berufsschule, auch ohne eigenen Eintrag.
    var art = (t && t.art) || (tagImWochenfeld(iso(datum)) ? "Berufsschule" : "");
    if (i > 4 && !text && !art) continue;
    out.push({
      kopf: { tag: WOCHENTAGE[datum.getDay()], datum: dm(datum), art: art },
      text: text
    });
  }
  var wd = wochendaten[iso(montag)] || {};
  // Wer nach einer Blockwoche auf die tägliche Notierung umstellt, verliert die Themen nicht.
  var themen = zeilen(wd.schule).map(ohneSchlusspunkt).join("\n");
  if (themen) out.push({ kopf: { tag: "Berufsschule", datum: "", art: "", woche: true }, text: themen });
  var eigene = zeilen(wd.unterweisungen).map(ohneSchlusspunkt).join("\n");
  if (eigene) out.push({ kopf: { tag: "Unterweisungen", datum: "", art: "", woche: true }, text: eigene });
  return out;
}

var SP_TAEGLICH = [1600, BREITE - 1600];

function taeglicheSeite(nummer, montag, s) {
  var reihen = tagesZeilen(montag);
  var m = MASSE[dichte({ betrieb: reihen, unterweisung: [], schule: [] })];
  var wd = wochendaten[iso(montag)] || {};
  var rundum = { top: rahmen(KRAFT, 2), bottom: rahmen(KRAFT, 2), left: rahmen(KRAFT, 2), right: rahmen(KRAFT, 2) };

  function zelle(kinder, i, o) {
    o = o || {};
    return new D.TableCell({
      width: { size: SP_TAEGLICH[i], type: D.WidthType.DXA },
      verticalAlign: o.vertikal || D.VerticalAlign.TOP,
      margins: { top: m.rand, bottom: m.rand, left: 140, right: 140 },
      borders: rundum,
      children: kinder.length ? kinder : [absatz("")]
    });
  }
  function kopfText(t) {
    return absatz(t, { groesse: 14, sperrung: 10, grossbuchstaben: true, farbe: AKZENT, zeile: 220 });
  }

  var zeilenListe = [new D.TableRow({
    tableHeader: true,
    children: [zelle([kopfText("Tag")], 0), zelle([kopfText(TAEGLICH_SPALTE)], 1)]
  })];
  reihen.forEach(function (e) {
    var inhalt = [];
    if (e.kopf.art) inhalt.push(absatz(e.kopf.art, { groesse: m.tag, farbe: GRAU, nach: 40 }));
    zeilen(e.text).forEach(function (z, j) { inhalt.push(stichpunkt(z, m, j ? m.vorPos : 0)); });
    zeilenListe.push(new D.TableRow({
      height: { value: e.kopf.woche ? 400 : m.tageszeile, rule: D.HeightRule.ATLEAST },
      children: [
        zelle([absatz(e.kopf.tag, { groesse: m.tag, fett: true, farbe: AKZENT })]
          .concat(e.kopf.datum ? [absatz(e.kopf.datum, { groesse: m.tag, farbe: GRAU, vor: 20 })] : []), 0),
        zelle(inhalt, 1)
      ]
    }));
  });

  var teile = [
    absatz("Ausbildungsnachweis", {
      groesse: 24, sperrung: 20, grossbuchstaben: true, farbe: AKZENT,
      ausrichtung: D.AlignmentType.CENTER, vor: 120, nach: 420
    }),
    kopfLeiste(s, wd.abteilung || s.abteilung || "", nummer, montag),
    absatz("", { nach: m.vorFeld }),
    new D.Table({
      width: { size: BREITE, type: D.WidthType.DXA },
      columnWidths: SP_TAEGLICH,
      layout: D.TableLayoutType.FIXED,
      rows: zeilenListe
    }),
    absatz("", { nach: m.vorFeld }),
    unterschriften()
  ];
  return { kinder: teile, kopf: fortsetzungsKopf(s, montag) };
}

/* ---------- Deckblatt und Ausbildungsgang ---------- */

/** Zeile des Deckblatts: Bezeichnung und Wert auf einer Linie. */
function stammZeile(bezeichnung, wert, breiteLinks) {
  var links = breiteLinks || 3800;
  return new D.TableRow({
    height: { value: 560, rule: D.HeightRule.ATLEAST },
    children: [
      new D.TableCell({
        width: { size: links, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.BOTTOM,
        margins: { top: 60, bottom: 80, left: 0, right: 160 },
        borders: { top: ohneRahmen(), bottom: ohneRahmen(), left: ohneRahmen(), right: ohneRahmen() },
        children: [absatz(bezeichnung, { groesse: 19, farbe: GRAU })]
      }),
      new D.TableCell({
        width: { size: BREITE - links, type: D.WidthType.DXA }, verticalAlign: D.VerticalAlign.BOTTOM,
        margins: { top: 60, bottom: 80, left: 0, right: 0 },
        borders: {
          top: ohneRahmen(), left: ohneRahmen(), right: ohneRahmen(),
          bottom: { style: D.BorderStyle.SINGLE, size: 4, color: KRAFT }
        },
        children: [absatz(wert || "", { groesse: 21 })]
      })
    ]
  });
}

/** Vertragszeitraum als { von, bis }. Gespeicherte Stände bis Version 1.2
 *  kennen nur den Freitext `zeitraum`. */
function ausbildungszeit(s) {
  var von = s.beginn ? dmy(vonIso(s.beginn)) : "";
  var bis = s.ende ? dmy(vonIso(s.ende)) : "";
  if ((!von || !bis) && s.zeitraum) {
    var teile = String(s.zeitraum).split(/\s*(?:–|-|bis)\s*/).filter(Boolean);
    von = von || teile[0] || "";
    bis = bis || teile[1] || "";
  }
  return { von: von, bis: bis };
}

/** Zeilen des Deckblatts, gemeinsam für Word und Druck. */
function deckblattAngaben(s) {
  var z = ausbildungszeit(s);
  return [
    ["Name, Vorname", s.name],
    ["Geburtsort, Geburtsdatum",
      [s.geburtsort, s.geburtsdatum ? dmy(vonIso(s.geburtsdatum)) : ""].filter(Boolean).join(", ")],
    ["Anschrift", s.anschrift],
    ["Ausbildungsberuf", s.beruf],
    ["Ausbildungsfirma", s.betrieb],
    ["Geschäftszweig", s.zweig],
    ["Vertragliche Ausbildungszeit vom", z.von],
    ["bis", z.bis],
    ["Berufsausbildungsvertrag abgeschlossen am", s.vertragAm ? dmy(vonIso(s.vertragAm)) : ""]
  ];
}

function deckblatt(s) {
  return [
    new D.Paragraph({ spacing: { after: 700 }, children: [new D.TextRun({ text: "", size: 20 })] }),
    absatz("Berichtsheft", {
      groesse: 40, fett: true, farbe: AKZENT, ausrichtung: D.AlignmentType.CENTER, nach: 140
    }),
    absatz(notierungTitel(s), {
      groesse: 20, farbe: GRAU, ausrichtung: D.AlignmentType.CENTER, nach: 900
    }),
    tabelle([3800, BREITE - 3800], deckblattAngaben(s).map(function (a) { return stammZeile(a[0], a[1]); })),
    absatz("Gesetzlicher Vertreter des Auszubildenden", {
      groesse: 15, sperrung: 8, grossbuchstaben: true, farbe: AKZENT, vor: 800, nach: 200
    }),
    tabelle([3800, BREITE - 3800], [
      stammZeile("Name", s.vertreterName),
      stammZeile("Anschrift", s.vertreterAnschrift)
    ]),
    new D.Paragraph({ spacing: { before: 1100 }, children: [] }),
    tabelle([5600, BREITE - 5600], [new D.TableRow({
      children: [
        frei([
          new D.Paragraph({ spacing: { after: 0 }, children: [new D.TextRun({ text: "", size: 20 })] }),
          new D.Paragraph({
            spacing: { after: 0 },
            border: { top: { style: D.BorderStyle.SINGLE, size: 4, color: KRAFT, space: 4 } },
            children: [new D.TextRun({
              text: "Unterschrift der Eltern bzw. der gesetzlichen Vertreter",
              font: FONT, size: 15, color: GRAU
            })]
          })
        ], 5600, { vertikal: D.VerticalAlign.TOP }),
        frei([absatz("")], BREITE - 5600)
      ]
    })])
  ];
}

/** Aufeinanderfolgende Wochen mit derselben Abteilung werden ein Abschnitt. */
function abteilungsAbschnitte(s) {
  var out = [];
  wochen.slice().sort().forEach(function (k) {
    var wd = wochendaten[k] || {};
    var name = (wd.abteilung || s.abteilung || "").trim();
    if (!name) return;
    var montag = vonIso(k), sonntag = plus(montag, 6);
    var letzter = out[out.length - 1];
    if (letzter && letzter.name === name) letzter.bis = sonntag;
    else out.push({ name: name, von: montag, bis: sonntag });
  });
  return out;
}

/* Mindestens so viele Zeilen hat die Tabelle im Ausbildungsgang. */
var GANG_ZEILEN = 14;

function ausbildungsgang(s) {
  var SP = [4206, 1700, 1700, 2600];
  var zelleRahmen = function (unten) {
    return { top: rahmen(KRAFT, 2), bottom: rahmen(KRAFT, unten), left: rahmen(KRAFT, 2), right: rahmen(KRAFT, 2) };
  };
  var kopfZeile = new D.TableRow({
    tableHeader: true,
    height: { value: 620, rule: D.HeightRule.ATLEAST },
    children: [
      "Abteilung (Arbeitsgebiet oder Sparte)", "Dauer vom", "bis",
      "Unterschrift des Abteilungsleiters oder des Ausbildenden"
    ].map(function (t, i) {
      return new D.TableCell({
        width: { size: SP[i], type: D.WidthType.DXA },
        verticalAlign: D.VerticalAlign.BOTTOM,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        borders: zelleRahmen(4),
        children: [absatz(t, { groesse: 14, sperrung: 6, grossbuchstaben: true, farbe: AKZENT, zeile: 220 })]
      });
    })
  });

  var abschnitte = abteilungsAbschnitte(s);
  var reihen = [kopfZeile];
  for (var i = 0; i < Math.max(GANG_ZEILEN, abschnitte.length); i++) {
    var a = abschnitte[i];
    reihen.push(new D.TableRow({
      height: { value: 620, rule: D.HeightRule.ATLEAST },
      children: [
        a ? a.name : "", a ? dmy(a.von) : "", a ? dmy(a.bis) : "", ""
      ].map(function (t, j) {
        return new D.TableCell({
          width: { size: SP[j], type: D.WidthType.DXA },
          verticalAlign: D.VerticalAlign.CENTER,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          borders: zelleRahmen(2),
          children: [absatz(t, {
            groesse: 19,
            ausrichtung: j === 0 || j === 3 ? D.AlignmentType.LEFT : D.AlignmentType.CENTER
          })]
        });
      })
    }));
  }

  return [
    absatz("Ausbildungsgang", {
      groesse: 26, sperrung: 16, grossbuchstaben: true, farbe: AKZENT,
      ausrichtung: D.AlignmentType.CENTER, nach: 420
    }),
    new D.Table({
      width: { size: BREITE, type: D.WidthType.DXA },
      columnWidths: SP,
      layout: D.TableLayoutType.FIXED,
      rows: reihen
    })
  ];
}

/* ---------- Kopf- und Fußzeilen, Dokument ---------- */

function leererKopf() {
  return new D.Header({ children: [new D.Paragraph({ children: [] })] });
}

/** Kopfzeile auf Folgeseiten eines Wochenblatts: Name und Woche. */
function fortsetzungsKopf(s, montag) {
  return new D.Header({ children: [new D.Paragraph({
    spacing: { after: 240 },
    border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: LINIE, space: 5 } },
    tabStops: [{ type: D.TabStopType.RIGHT, position: BREITE }],
    children: [new D.TextRun({
      text: (s.name || "") + "\tAusbildungswoche " + dmy(montag) + " – " + dmy(plus(montag, 6)),
      font: FONT, size: 15, color: GRAU
    })]
  })] });
}

function fussZeile(mitZahl) {
  return new D.Footer({ children: [new D.Paragraph({
    alignment: D.AlignmentType.RIGHT,
    children: mitZahl ? [new D.TextRun({
      children: ["Seite ", D.PageNumber.CURRENT, " von ", D.PageNumber.TOTAL_PAGES],
      font: FONT, size: 15, color: GRAU
    })] : []
  })] });
}

/**
 * Jeder Abschnitt { kinder, kopf } wird ein eigener Word-Abschnitt,
 * damit jedes Wochenblatt seine eigene Fortsetzungs-Kopfzeile hat.
 * `einzel`: ein einzelnes Wochenblatt ohne Seitenzahlen.
 */
function dokument(abschnitte, s, einzel) {
  return new D.Document({
    creator: s.name || "Berichtsheft",
    title: "Ausbildungsnachweis " + s.jahr + ". Lehrjahr",
    styles: { default: { document: { run: { font: FONT, size: 20, color: "2B2F33" } } } },
    sections: abschnitte.map(function (a) {
      return {
        properties: Object.assign({}, SEITE, { titlePage: true }),
        headers: { first: leererKopf(), default: a.kopf || leererKopf() },
        footers: { first: fussZeile(!einzel), default: fussZeile(!einzel) },
        children: a.kinder
      };
    })
  });
}
