/* ============================================================
 * Druck: dieselben Blätter wie im Word-Dokument, als HTML
 *
 * Die Blätter kommen in #druck und werden über window.print() gedruckt
 * (oder als PDF gesichert). Die Regeln dafür stehen in css/blatt.css.
 *
 * Eine Woche ist ein Blatt. Passt sie nicht, wird sie in mehrere Blätter
 * geteilt, jedes mit eigener Kopfleiste und eigenem Kasten "Betriebliche
 * Tätigkeit"; die Schlussfelder und Unterschriften stehen auf dem
 * letzten. Ob etwas passt, wird im Drucksatz gemessen (#messung), nicht
 * geschätzt – Schriftgrad, Mindesthöhen und Umbrüche bestimmen die Höhe.
 * ========================================================== */

/* A4 hoch, 16 mm Rand oben und unten, 1 mm Sicherheit für Druckertreiber. */
var SATZ_HOEHE_MM = 297 - 2 * 16 - 1;

/* Am Handy druckt der Browser enger. Safari am iPhone ließ rund 174 mm Breite und setzte eigene
   Kopf- und Fußzeilen (Adresse, Datum, Seitenzahl). Eine Woche, die als passend gemessen war,
   lief dort auf eine zweite Seite, und die trug keine Kopfleiste, weil der Browser statt des
   Werkzeugs umbrach. Mit 170 mm Breite und 251 mm Höhe teilt das Werkzeug selbst, bevor es der
   Browser tut. Am Rechner bleibt es bei 180 × 264 mm; dort gab es das Problem nicht, und jede
   Reserve kostet eine volle Woche ihr einziges Blatt. */
var SATZ_HOEHE_HANDY_MM = 297 - 20 - 26;
var SATZ_BREITE_HANDY_MM = 170;

function druckAmHandy() {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; }
}
function satzHoehe() { return druckAmHandy() ? SATZ_HOEHE_HANDY_MM : SATZ_HOEHE_MM; }

var mmProPixel = null;
function mmInPixel() {
  if (mmProPixel) return mmProPixel;
  var probe = document.createElement("div");
  probe.style.cssText = "position:absolute;left:-9999px;width:100mm;height:0";
  document.body.appendChild(probe);
  mmProPixel = probe.getBoundingClientRect().width / 100 || 3.7795;
  document.body.removeChild(probe);
  return mmProPixel;
}

/** Höhe eines Blatt-HTML in Millimetern. */
function blattHoehe(html) {
  var m = $("messung");
  if (!m) return 0;
  m.style.width = druckAmHandy() ? SATZ_BREITE_HANDY_MM + "mm" : "";
  m.innerHTML = html;
  var el = m.firstElementChild;
  var px = el ? el.getBoundingClientRect().height : 0;
  m.innerHTML = "";
  return px / mmInPixel();
}

/* Misst gar nichts (kein Layout), wird nicht geteilt: Ein zu langes Blatt
   ist besser als ein grundlos zerrissenes. */
function passtAufEineSeite(html) {
  var h = blattHoehe(html);
  return !h || h <= satzHoehe();
}

/* ---------- HTML der Blätter ---------- */

/**
 * Ein Feld des Vordrucks. Jede Zeile ein Stichpunkt, nichts fett – wie in stichpunkt().
 * `feld` und das Datum an Kopf und Zeilen eines Tages braucht nur die Vorschau im Reiter „Woche“:
 * Dort schreibt man in die Felder, auch in die Zeilen eines Tages, und sein Kopf öffnet ihn
 * (wochenblatt.js). Gedruckt stört beides nicht.
 */
function druckAbschnitt(titel, liste, klasse, feld) {
  var inhalt = liste.map(function (e) {
    var kopf = (e.kopf && e.kopf.tag)
      ? '<p class="tagkopf"' + (e.kopf.datum ? ' data-datum="' + e.kopf.datum + '"' : "") + "><b>" + sicher(e.kopf.tag) + "</b>" +
        (e.kopf.rest ? "<span>" + sicher(e.kopf.rest) + "</span>" : "") + "</p>"
      : "";
    var tag = (e.kopf && e.kopf.datum) ? ' data-datum="' + e.kopf.datum + '"' : "";
    var text = zeilen(e.text).map(function (z) {
      var roh = String(z).replace(/^\s*[-*•·]\s*/, "").trim();
      if (!roh) return "";
      // Das Zeichen steht im Markup, damit es beim Kopieren aus dem PDF mitkommt.
      return '<p class="sp' + (e.frei ? " frei" : "") + '"' + tag + '><span class="pkt">•</span>' + sicher(roh) + "</p>";
    }).join("");
    return kopf + text;
  }).join("");
  return '<section class="feld ' + klasse + '"' + (feld ? ' data-feld="' + feld + '"' : "") + ">" +
         "<h2>" + sicher(titel) + "</h2>" +
         '<div class="kasten">' + inhalt + "</div></section>";
}

/**
 * Ein Blatt einer Woche. `fortsetzung` markiert Folgeblätter, `letzte`
 * hängt Unterweisungen, Berufsschule und Unterschriften an.
 */
/** Kopfleiste eines Blatts: Nummer, Ausbildungsjahr, Woche, Abteilung, Name. */
function druckKopfleiste(nummer, montag, s) {
  var wd = wochendaten[iso(montag)] || {};
  var abteilung = wd.abteilung || s.abteilung || "";
  var jahr = ausbildungsjahr(s, montag) || s.jahr || "";

  function kopfFeld(etikett, wert, feld) {
    return "<td" + (feld ? ' data-feld="' + feld + '"' : "") + "><span>" + sicher(etikett) + "</span>" + sicher(wert || "") + "</td>";
  }
  return '<table class="kopfleiste"><tr>' +
    // Zwei eigene Felder wie im Vordruck: "3 / 1" unter einem Etikett las niemand richtig.
    kopfFeld("Nr.", nummer) +
    kopfFeld("Ausbildungsjahr", jahr ? jahr + "." : "") +
    kopfFeld("Ausbildungswoche", dmy(montag) + " – " + dmy(plus(montag, 6))) +
    kopfFeld("Ausbildungsabteilung", abteilung, "abteilung") +
    kopfFeld("Name", s.name) +
  "</tr></table>";
}

var DRUCK_UNTERSCHRIFTEN = '<div class="unterschriften">' +
  "<div>Auszubildender / Datum</div>" +
  "<div>Ausbilder / Datum</div>" +
  "<div>Gesetzlicher Vertreter / Datum</div>" +
"</div>";

var DRUCK_FELDER = {
  betrieb: ["Betriebliche Tätigkeit", "gross"],
  unterweisung: ["Unterweisungen, Lehrgespräche, betrieblicher Unterricht, sonstige Schulungsveranstaltungen", "klein"],
  schule: ["Berufsschule (Unterrichtsthemen)", "klein"]
};

/**
 * Ein Blatt des wöchentlichen Vordrucks. Gewöhnlich steht auf jedem Blatt der Kasten „Betriebliche
 * Tätigkeit“ und auf dem letzten die beiden kleinen Felder. Laufen auch die über (druckBlatt()),
 * sagt `texte.felder`, welche Felder auf diesem Blatt stehen.
 */
function druckBlattSeite(nummer, montag, s, texte, fortsetzung, letzte) {
  var felder = texte.felder || (letzte ? ["betrieb", "unterweisung", "schule"] : ["betrieb"]);
  return '<article class="blatt dicht-' + dichte(texte) + (fortsetzung ? " fortsetzung" : "") + '">' +
    "<h1>Ausbildungsnachweis" + (fortsetzung ? " – Fortsetzung" : "") + "</h1>" +
    druckKopfleiste(nummer, montag, s) +
    felder.map(function (f) {
      return druckAbschnitt(DRUCK_FELDER[f][0], texte[f], DRUCK_FELDER[f][1], f);
    }).join("") +
    (letzte ? DRUCK_UNTERSCHRIFTEN : "") +
    "</article>";
}

function druckBlattEinseitig(nummer, montag, s) {
  if (taeglich(s)) return druckTaeglichSeite(nummer, montag, s, tagesZeilen(montag), false, true);
  return druckBlattSeite(nummer, montag, s, wochenTexte(montag, s), false, true);
}

/* ---------- Aufteilen einer vollen Woche ---------- */

/* Eine sehr lange Zeile wortweise in Stücke brechen, damit die Aufteilung
   Stellen hat, an denen sie trennen darf. Der Inhalt bleibt gleich. */
function druckWortzeilen(text, max) {
  var worte = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!worte.length) return [];
  var out = [], aktuell = "";
  worte.forEach(function (wort) {
    var probe = aktuell ? aktuell + " " + wort : wort;
    if (aktuell && probe.length > max) {
      out.push(aktuell);
      aktuell = wort;
    } else aktuell = probe;
  });
  if (aktuell) out.push(aktuell);
  return out;
}

/** Die kleinsten trennbaren Stücke: je eine (Teil-)Zeile mit dem Tageskopf. */
function druckEinheiten(liste) {
  var out = [];
  (liste || []).forEach(function (e) {
    var teile = [];
    zeilen(e.text).forEach(function (z) {
      druckWortzeilen(z, 105).forEach(function (t) { teile.push(t); });
    });
    teile.forEach(function (z, i) {
      out.push({ kopf: e.kopf, text: z, erste: i === 0, frei: e.frei });
    });
  });
  return out;
}

/** Aufeinanderfolgende Einheiten desselben Tages wieder bündeln. Ein Tag,
 *  der über zwei Blätter läuft, trägt seinen Kopf auf beiden. */
function druckBuendeln(einheiten) {
  var out = [];
  einheiten.forEach(function (e) {
    var letzte = out[out.length - 1];
    if (letzte && letzte.kopf === e.kopf && letzte.frei === e.frei) letzte.text += "\n" + e.text;
    else out.push({ kopf: e.kopf, text: e.text, frei: e.frei });
  });
  return out;
}

/** Das längste Präfix, das auf ein Blatt passt (Intervallhalbierung,
 *  mindestens eine Einheit, damit die Aufteilung endet). */
function druckPraefix(einheiten, bauen) {
  if (!einheiten.length) return 0;
  if (passtAufEineSeite(bauen(einheiten))) return einheiten.length;
  var tief = 1, hoch = einheiten.length, beste = 1;
  while (tief <= hoch) {
    var mitte = (tief + hoch) >> 1;
    if (passtAufEineSeite(bauen(einheiten.slice(0, mitte)))) {
      beste = mitte; tief = mitte + 1;
    } else hoch = mitte - 1;
  }
  return beste;
}

function druckBlatt(nummer, montag, s) {
  var einseitig = druckBlattEinseitig(nummer, montag, s);
  if (passtAufEineSeite(einseitig)) return einseitig;

  if (taeglich(s)) {
    var reihen = tagesZeilen(montag);
    return druckAufteilen(druckTagesEinheiten(reihen), function (teil, fortsetzung, letzte) {
      return druckTaeglichSeite(nummer, montag, s, druckBuendeln(teil), fortsetzung, letzte, reihen);
    });
  }

  var texte = wochenTexte(montag, s);
  var seiten = druckSeiten(druckEinheiten(texte.betrieb), function (teil, fortsetzung, letzte) {
    return druckBlattSeite(nummer, montag, s, {
      betrieb: druckBuendeln(teil),
      unterweisung: letzte ? texte.unterweisung : [],
      schule: letzte ? texte.schule : []
    }, fortsetzung, letzte);
  });
  if (passtAufEineSeite(seiten[seiten.length - 1])) return seiten.join("");

  /* Unterweisungen und Berufsschule stehen ganz auf dem letzten Blatt. Sind sie zu lang (viele
     Schultage, eine Blockwoche ohne betriebliche Tätigkeit), lief dieses Blatt über A4 hinaus: Der
     Browser brach es selbst um, ohne Kopfleiste, oder schnitt den Rest ab. Dann laufen alle drei
     Felder der Reihe nach über die Blätter, wie in Word. Ein leeres Feld bleibt als eine Einheit
     ohne Text in der Reihe, damit sein leerer Kasten an seiner Stelle steht. */
  var alle = [];
  ["betrieb", "unterweisung", "schule"].forEach(function (f) {
    var teile = druckEinheiten(texte[f]);
    if (!teile.length) teile = [{ kopf: "", text: "", leer: true }];
    teile.forEach(function (e) { e.feld = f; alle.push(e); });
  });
  return druckAufteilen(alle, function (teil, fortsetzung, letzte) {
    var blatt = { felder: [], betrieb: [], unterweisung: [], schule: [] };
    ["betrieb", "unterweisung", "schule"].forEach(function (f) {
      var eigene = teil.filter(function (e) { return e.feld === f; });
      if (!eigene.length) return;
      blatt.felder.push(f);
      blatt[f] = druckBuendeln(eigene.filter(function (e) { return !e.leer; }));
    });
    return druckBlattSeite(nummer, montag, s, blatt, fortsetzung, letzte);
  });
}

/**
 * Einheiten auf Blätter verteilen. `bauen(teil, fortsetzung, letzte)` liefert das HTML eines Blatts.
 * Vor jedem Blatt: Passt der ganze Rest samt Schlussfeldern? Dann ist es das letzte. Sonst so viel
 * wie möglich ohne Schlussfelder – aber nie alles, sonst stünden die Schlussfelder allein auf einem
 * leeren Blatt.
 */
function druckAufteilen(rest, bauen) {
  return druckSeiten(rest, bauen).join("");
}

/** Wie druckAufteilen, aber jedes Blatt einzeln, damit sich das letzte nachmessen lässt. */
function druckSeiten(rest, bauen) {
  var seiten = [], wache = 0;
  while (rest.length && wache++ < 200) {
    var fortsetzung = seiten.length > 0;

    var mitSchluss = druckPraefix(rest, function (teil) { return bauen(teil, fortsetzung, true); });
    if (mitSchluss === rest.length) { seiten.push(rest); break; }

    var ohneSchluss = druckPraefix(rest, function (teil) { return bauen(teil, fortsetzung, false); });
    var n = Math.max(1, Math.min(ohneSchluss, rest.length - 1));
    seiten.push(rest.slice(0, n));
    rest = rest.slice(n);
  }
  if (!seiten.length) seiten = [[]];

  return seiten.map(function (teil, i) {
    return bauen(teil, i > 0, i === seiten.length - 1);
  });
}

/* ---------- Tägliche Notierung ----------
   Der zweite Vordruck der IHK: eine Zeile je Tag. Stunden stehen nicht darin, die IHK fragt nach
   Tätigkeiten. Montag bis Freitag stehen immer da, wie im Vordruck; Samstag und Sonntag nur mit
   Eintrag. */

/** Wie druckEinheiten, aber auch ein Tag ohne Text bleibt als leere Zeile stehen. */
function druckTagesEinheiten(reihen) {
  var out = [];
  reihen.forEach(function (e) {
    var teile = [];
    zeilen(e.text).forEach(function (z) {
      druckWortzeilen(z, 85).forEach(function (t) { teile.push(t); });
    });
    if (!teile.length) teile.push("");
    teile.forEach(function (z, i) { out.push({ kopf: e.kopf, text: z, erste: i === 0 }); });
  });
  return out;
}

/** Ein Blatt der täglichen Notierung. `alle` sind die Zeilen der ganzen Woche, für die Dichte:
 *  Alle Blätter einer Woche stehen in derselben Stufe. */
function druckTaeglichSeite(nummer, montag, s, reihen, fortsetzung, letzte, alle) {
  var zeile = function (e) {
    var k = e.kopf;
    var art = k.art ? '<p class="tart">' + sicher(k.art) + "</p>" : "";
    var text = zeilen(e.text).map(function (z) {
      var roh = String(z).replace(/^\s*[-*•·]\s*/, "").trim();
      return roh ? '<p class="sp"><span class="pkt">•</span>' + sicher(roh) + "</p>" : "";
    }).join("");
    return '<tr' + (k.woche ? ' class="wochenzeile"' : "") + ">" +
      '<td class="ttag"><b>' + sicher(k.tag) + "</b>" + (k.datum ? "<span>" + k.datum + "</span>" : "") + "</td>" +
      '<td class="ttext">' + art + text + "</td></tr>";
  };
  return '<article class="blatt taeglich dicht-' + dichte({ betrieb: alle || reihen, unterweisung: [], schule: [] }) +
      (fortsetzung ? " fortsetzung" : "") + '">' +
    "<h1>Ausbildungsnachweis" + (fortsetzung ? " – Fortsetzung" : "") + "</h1>" +
    druckKopfleiste(nummer, montag, s) +
    '<table class="tagestabelle"><thead><tr>' +
      "<th>Tag</th><th>" + TAEGLICH_SPALTE + "</th>" +
    "</tr></thead><tbody>" + reihen.map(zeile).join("") + "</tbody></table>" +
    (letzte ? DRUCK_UNTERSCHRIFTEN : "") +
    "</article>";
}

/** Wie druckBlatt, aber ohne Ausnahmen: Scheitert die Aufteilung, kommt
 *  die Woche ungeteilt aufs Papier. */
function druckBlattSicher(nummer, montag, s) {
  try {
    return druckBlatt(nummer, montag, s);
  } catch (fehler) {
    try { return druckBlattEinseitig(nummer, montag, s); }
    catch (zweiter) { return ""; }
  }
}

/** Deckblatt und Ausbildungsgang für das gedruckte Gesamtheft. */
function druckVorseiten(s) {
  function zeile(b, w) {
    return "<tr><th>" + sicher(b) + "</th><td>" + sicher(w || "") + "</td></tr>";
  }
  var deck = '<article class="blatt deck">' +
    '<h1 class="gross">Berichtsheft</h1>' +
    '<p class="untertitel">' + sicher(notierungTitel(s)) + "</p>" +
    '<table class="stammliste">' +
      deckblattAngaben(s).map(function (a) { return zeile(a[0], a[1]); }).join("") +
    "</table>" +
    '<h2 class="block">Gesetzlicher Vertreter des Auszubildenden</h2>' +
    '<table class="stammliste">' + zeile("Name", s.vertreterName) +
      zeile("Anschrift", s.vertreterAnschrift) + "</table>" +
    '<div class="unterschriften eins">' +
      "<div>Unterschrift der Eltern bzw. der gesetzlichen Vertreter</div>" +
    "</div></article>";

  var reihen = "", abschnitte = abteilungsAbschnitte(s);
  for (var i = 0; i < Math.max(GANG_ZEILEN, abschnitte.length); i++) {
    var a = abschnitte[i];
    reihen += "<tr><td>" + (a ? sicher(a.name) : "") + "</td>" +
      "<td>" + (a ? dmy(a.von) : "") + "</td>" +
      "<td>" + (a ? dmy(a.bis) : "") + "</td><td></td></tr>";
  }
  var gang = '<article class="blatt">' +
    "<h1>Ausbildungsgang</h1>" +
    '<table class="gang"><thead><tr>' +
      "<th>Abteilung (Arbeitsgebiet oder Sparte)</th><th>Dauer vom</th><th>bis</th>" +
      "<th>Unterschrift des Abteilungsleiters oder des Ausbildenden</th>" +
    "</tr></thead><tbody>" + reihen + "</tbody></table></article>";

  return deck + gang;
}

/**
 * Druckansicht aufbauen und den Druckdialog öffnen. Messen braucht
 * Layout, und daran kann in einem fremden Browser mehr scheitern als an
 * reiner Rechnung – deshalb ist alles abgesichert.
 */
function drucken(alleWochen) {
  if (!aktiveWoche) return;
  try {
    var s = stammdaten();
    var blaetter = "";

    if (alleWochen) {
      blaetter = druckVorseiten(s) + alleExportMontage(s).map(function (montag, i) {
        return druckBlattSicher(i + 1, montag, s);
      }).join("");
    } else {
      var m = vonIso(aktiveWoche);
      blaetter = druckBlattSicher(wochenNummer(m, startMontag(s)), m, s);
    }

    if (!blaetter) {
      sage("Für den Druck kam kein Blatt zustande.", "warn");
      return;
    }

    $("druck").innerHTML = blaetter;
    menueSchliessen();
    // Kurz warten, damit der Browser die Blätter vor dem Dialog zeichnet.
    setTimeout(function () {
      try { window.print(); }
      catch (fehler) { sage("Der Druckdialog ließ sich nicht öffnen.", "warn"); }
    }, 60);
  } catch (fehler) {
    // Reste abräumen, sonst druckt der nächste Versuch sie mit.
    $("druck").innerHTML = "";
    sage("Der Druck ist gescheitert: " + fehler.message, "warn");
  }
}
