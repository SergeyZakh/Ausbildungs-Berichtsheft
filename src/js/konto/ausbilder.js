/* ============================================================
 * Ansicht für Ausbilder
 *
 * Gleiches Gerüst wie im Heft des Azubis – Wochenleiste, Reiterzeile, Sektionen –
 * nur anders belegt: Erst wählt der Ausbilder einen Azubi, dann sieht er dessen Heft –
 * Wochenleiste mit Monatsraster, links der Stand der Tage, rechts das Wochenblatt.
 *
 * Geändert wird hier nichts, das Heft gehört dem Azubi. Exportieren darf der
 * Ausbilder: Wochenblatt und Gesamtheft, dieselben Bausteine wie im Heft.
 * ========================================================== */

var AUSBILDER = {
  azubis: [],        // aus /api/azubis, mit Wochenständen
  stand: {},         // je Azubi der volle Stand aus /api/azubis/<id>
  woche: null,       // Montag der gezeigten Woche, ISO
  gewaehlt: null    // der Azubi, dessen Heft gerade offen ist
};

var WOCHENFARBE = { fertig: "gut", offen: "warn", fehlt: "fehlt" };

/** Kurz sagen, woran es liegt: „fertig“, „2 Tage nicht übernommen“, „3 Tage fehlen“. */
function wochenWort(w) {
  if (!w) return "keine Einträge";
  if (w.stand === "fertig") return "fertig";
  var teile = [];
  if (w.offen) teile.push(w.offen + (w.offen === 1 ? " Tag nicht übernommen" : " Tage nicht übernommen"));
  if (w.fehlt) teile.push(w.fehlt + (w.fehlt === 1 ? " Tag fehlt" : " Tage fehlen"));
  return teile.join(", ") || "offen";
}

function ausbilderHolen(weg) {
  return kontoAnfrage(weg).then(function (antwort) {
    if (!antwort.ok) throw new Error("Server antwortet mit " + antwort.status);
    return antwort.json();
  });
}

/* ---------- Start und Daten ---------- */

function ausbilderStarten() {
  document.body.classList.add("alsausbilder");
  $("ausbilder").hidden = false;
  return ausbilderListe();
}

function ausbilderListe() {
  return ausbilderHolen("azubis").then(function (daten) {
    // Wer Aufmerksamkeit braucht, steht links: erst offene, dann unvollständige Wochen.
    AUSBILDER.azubis = (daten.azubis || []).sort(function (a, b) {
      return (b.offen - a.offen) || (b.fehlt - a.fehlt) || a.name.localeCompare(b.name, "de");
    });
    if (!AUSBILDER.woche) AUSBILDER.woche = iso(montagVon(new Date()));
    if (AUSBILDER.gewaehlt) {
      AUSBILDER.gewaehlt = AUSBILDER.azubis.filter(function (a) { return a.id === AUSBILDER.gewaehlt.id; })[0] || null;
    }
    ausbilderZeichnen();
  }).catch(function (e) {
    kontoZurueck();
    $("ausbilder").innerHTML = '<p class="leerbild">Die Übersicht ließ sich nicht laden: ' + sicher(e.message) + "</p>";
  });
}

/** Voller Stand eines Azubis, einmal geholt und gemerkt. */
function azubiStand(id) {
  if (AUSBILDER.stand[id]) return Promise.resolve(AUSBILDER.stand[id]);
  return ausbilderHolen("azubis/" + encodeURIComponent(id)).then(function (daten) {
    var nachDatum = {};
    (daten.tage || []).forEach(function (t) { nachDatum[t.datum] = t; });
    var wochen = {};
    (daten.wochen || []).forEach(function (w) { wochen[w.montag] = w; });
    AUSBILDER.stand[id] = { tage: nachDatum, wochen: wochen, stamm: daten.stamm, von: daten.von, bis: daten.bis };
    return AUSBILDER.stand[id];
  });
}

function wochenstandVon(azubi, montag) {
  return (azubi.wochen || []).filter(function (w) { return w.montag === montag; })[0] || null;
}

/* ---------- Zwei Bilder: Auswahl und das Heft eines Azubis ----------
   Erst wählt der Ausbilder einen Azubi, dann sieht er nur dessen Heft. Zwei Hefte
   nebeneinander verwirren mehr, als sie helfen. */

function ausbilderZeichnen() {
  if (!AUSBILDER.gewaehlt) return zeichneAuswahl();
  zeichneHeft();
}

/* ---------- Bild 1: Auswahl ---------- */

/**
 * Rechts in der Leiste: Person, Abmelden und der Rundgang. Die Kopfleiste des Hefts bleibt beim
 * Ausbilder weg, sonst stand der Name allein in einer eigenen Zeile darüber. #konto zieht mit um;
 * vor dem Neuzeichnen holt kontoZurueck() es heraus, sonst verschwände es mit der alten Leiste.
 */
function leisteEnde() {
  var leiste = document.querySelector("#ausbilder .aleiste");
  var konto = $("konto");
  if (konto) leiste.appendChild(konto);
  var hilfe = document.createElement("button");
  hilfe.type = "button";
  hilfe.className = "rundknopf";
  hilfe.id = "a-hilfe";
  hilfe.textContent = "?";
  hilfe.title = "Rundgang";
  hilfe.setAttribute("aria-label", "Rundgang");
  hilfe.addEventListener("click", onbStarten);
  leiste.appendChild(hilfe);
}

function kontoZurueck() {
  var konto = $("konto"), schub = document.querySelector(".leiste .schub");
  if (konto && schub && $("ausbilder").contains(konto)) schub.insertBefore(konto, schub.firstChild);
}

function zeichneAuswahl() {
  document.body.classList.remove("beiAzubi");
  var bereich = $("ausbilder");
  kontoZurueck();
  bereich.innerHTML =
    '<div class="aleiste"><h1 class="atitel">Deine Azubis</h1>' +
    '<button type="button" class="knopf" id="btn-gruppe">Gruppe verwalten</button></div>' +
    '<div class="abereich" id="a-inhalt"></div>';
  $("btn-gruppe").addEventListener("click", gruppeOeffnen);
  leisteEnde();

  var inhalt = $("a-inhalt");
  if (!AUSBILDER.azubis.length) {
    inhalt.innerHTML = '<p class="leerbild">Noch niemand in deiner Gruppe. Über <b>Gruppe verwalten</b> ' +
      "nimmst du Azubis auf, die sich hier schon einmal angemeldet haben.</p>";
    return;
  }

  var s = sektion("Wen möchtest du ansehen?");
  s.leib.innerHTML = '<ul class="aauswahl">' + AUSBILDER.azubis.map(function (a) {
    // Ohne Zeitraum hat der Azubi noch nichts geschrieben; grün wäre dann gelogen.
    var leer = !a.von;
    var lage = leer ? "" : a.offen ? "pruefen" : (a.fehlt ? "" : "fertig");
    var stand = leer ? "noch keine Einträge"
      : a.offen ? a.offen + (a.offen === 1 ? " Woche zum Gegenlesen" : " Wochen zum Gegenlesen")
        : a.fehlt ? a.fehlt + (a.fehlt === 1 ? " Woche unvollständig" : " Wochen unvollständig")
          : "alles übernommen";
    var marke = a.offen ? '<span class="marke">!</span>'
      : (a.fehlt || leer) ? '<span class="punkt"></span>' : '<span class="haken">✓</span>';
    return '<li><button type="button" class="aauswahlknopf ' + lage + '" data-azubi="' + sicher(a.id) + '">' +
      '<span class="aname">' + sicher(a.name) + "</span>" +
      '<span class="alage">' + marke + sicher(stand) + "</span>" +
      '<span class="azuletzt">' + (a.zuletzt ? "zuletzt " + dmy(vonIso(a.zuletzt)) : "noch nichts geschrieben") + "</span>" +
      "</button></li>";
  }).join("") + "</ul>";
  inhalt.appendChild(s.wurzel);

  Array.prototype.forEach.call(inhalt.querySelectorAll("[data-azubi]"), function (knopf) {
    knopf.addEventListener("click", function () { azubiWaehlen(knopf.getAttribute("data-azubi")); });
  });
}

function azubiWaehlen(id) {
  var azubi = AUSBILDER.azubis.filter(function (a) { return a.id === id; })[0];
  if (!azubi) return;
  AUSBILDER.gewaehlt = azubi;
  // Die Woche, in der zuletzt etwas geschrieben wurde – dort fängt das Gegenlesen an.
  AUSBILDER.woche = azubi.zuletzt ? iso(montagVon(vonIso(azubi.zuletzt))) : iso(montagVon(new Date()));
  monatAnkerAusbilder = null;
  azubiStand(id).then(ausbilderZeichnen).catch(function (e) {
    sage("Die Einträge ließen sich nicht laden: " + e.message, "warn");
  });
}

function zurueckZurAuswahl() {
  AUSBILDER.gewaehlt = null;
  ausbilderListe();
}

/* ---------- Bild 2: das Heft eines Azubis ---------- */

function zeichneHeft() {
  document.body.classList.add("beiAzubi");
  var azubi = AUSBILDER.gewaehlt;
  var bereich = $("ausbilder");
  kontoZurueck();
  bereich.innerHTML =
    '<div class="aleiste">' +
      '<button type="button" class="knopf zurueck" id="a-zurueck-liste">‹ Azubis</button>' +
      '<h1 class="atitel">' + sicher(azubi.name) + "</h1>" +
      '<div class="wochenschalter">' +
        '<button type="button" class="rundknopf" id="a-zurueck" aria-label="Vorige Woche">‹</button>' +
        '<button type="button" class="wochenknopf" id="a-wochenlabel" aria-haspopup="dialog" aria-expanded="false"></button>' +
        '<button type="button" class="rundknopf" id="a-vor" aria-label="Nächste Woche">›</button>' +
      "</div>" +
      '<div class="wochensumme" id="a-summe"></div>' +
      '<div class="menuehalter" id="a-exporthalter">' +
        '<button type="button" class="knopf voll" id="a-export" aria-haspopup="true" aria-expanded="false">Exportieren</button>' +
        '<div class="menue" id="a-menue" hidden role="menu">' +
          '<button type="button" role="menuitem" id="a-wochenblatt">Wochenblatt als Word</button>' +
          '<button type="button" role="menuitem" id="a-pdf-woche">Wochenblatt als PDF drucken</button>' +
          '<div class="menuetrenner" role="separator"></div>' +
          '<button type="button" role="menuitem" id="a-heft">Gesamtheft als Word</button>' +
          '<button type="button" role="menuitem" id="a-pdf-heft">Gesamtheft als PDF drucken</button>' +
        "</div>" +
      "</div>" +
    "</div>" +
    '<div class="wpopover" id="a-wochen" hidden role="dialog" aria-label="Woche wählen">' +
      '<div class="dkopf"><h2>Woche wählen</h2>' +
        '<button type="button" class="knopf" id="a-wochen-zu">Schließen</button></div>' +
      '<div class="dkoerper">' +
        '<div class="monatszeile">' +
          '<button type="button" class="rundknopf" id="a-monat-zurueck" aria-label="Voriger Monat">‹</button>' +
          '<span id="a-monatslabel"></span>' +
          '<button type="button" class="rundknopf" id="a-monat-vor" aria-label="Nächster Monat">›</button>' +
        "</div>" +
        '<div class="wochenliste" id="a-wochenliste"></div>' +
        '<div class="sprungzeile"><button type="button" class="knopf" id="a-sprung-heute">Diese Woche</button></div>' +
      "</div>" +
    "</div>" +
    '<div class="abereich" id="a-inhalt"></div>';

  $("a-zurueck-liste").addEventListener("click", zurueckZurAuswahl);
  $("a-zurueck").addEventListener("click", function () { ausbilderWocheWechseln(-7); });
  $("a-vor").addEventListener("click", function () { ausbilderWocheWechseln(7); });
  $("a-wochenlabel").addEventListener("click", function (e) { e.stopPropagation(); monatsrasterZeigen(); });
  $("a-wochen-zu").addEventListener("click", monatsrasterSchliessen);
  $("a-monat-zurueck").addEventListener("click", function () { ausbilderMonatBlaettern(-1); });
  $("a-monat-vor").addEventListener("click", function () { ausbilderMonatBlaettern(1); });
  $("a-sprung-heute").addEventListener("click", function () {
    AUSBILDER.woche = iso(montagVon(new Date()));
    monatsrasterSchliessen();
    zeichneWochenkopf();
    zeichneAusbilderInhalt();
  });
  $("a-wochen").addEventListener("click", function (e) { e.stopPropagation(); });
  document.addEventListener("click", function () {
    var popover = $("a-wochen");
    if (popover && !popover.hidden) monatsrasterSchliessen();
  });
  exportMenueBinden();
  leisteEnde();

  zeichneWochenkopf();
  zeichneAusbilderInhalt();
}

function ausbilderWocheWechseln(tage) {
  AUSBILDER.woche = iso(plus(vonIso(AUSBILDER.woche), tage));
  zeichneWochenkopf();
  zeichneAusbilderInhalt();
}

/** Wochenknopf und Stundensumme, wie im Heft – nur für den gewählten Azubi. */
function zeichneWochenkopf() {
  var montag = vonIso(AUSBILDER.woche);
  var w = wochenstandVon(AUSBILDER.gewaehlt, AUSBILDER.woche);
  var etikett = $("a-wochenlabel");
  etikett.textContent = "KW " + kalenderwoche(montag) + "  ·  " + kurzSpanne(montag) +
    (w && w.stand !== "fertig" ? "  ·  " + wochenWort(w) : w ? "  ·  fertig" : "");
  etikett.className = "wochenknopf" + (!w ? "" : w.stand === "offen" ? " pruefen" : w.stand === "fertig" ? " fertig" : "");

  var stand = AUSBILDER.stand[AUSBILDER.gewaehlt.id];
  var summe = 0;
  if (stand) {
    for (var i = 0; i < TAGE_JE_WOCHE; i++) {
      var t = stand.tage[iso(plus(montag, i))];
      if (t && t.stunden) summe += Number(t.stunden);
    }
  }
  var von = w ? w.fertig + w.offen + w.fehlt : 0;
  $("a-summe").innerHTML = (w
    ? '<span class="wsanteil' + (von && w.fertig === von ? " fertig" : "") + '">' +
      ringHtml(w.fertig, von, w.fertig + " von " + von + " Tagen übernommen") + w.fertig + "/" + von + "</span>"
    : "") + "<span>" + stundenText(summe) + " h</span>";
}

/* ---------- Monatsraster am Wochenknopf ----------
   Genau wie im Heft: eine Zeile je Woche mit den sieben Tagen des gewählten Azubis. */

var monatAnkerAusbilder = null;

function ausbilderMonatBlaettern(schritte) {
  monatAnkerAusbilder = new Date(monatAnkerAusbilder.getFullYear(), monatAnkerAusbilder.getMonth() + schritte, 1);
  monatsrasterZeichnen();
}

function monatsrasterZeigen() {
  var popover = $("a-wochen");
  if (!popover.hidden) return monatsrasterSchliessen();
  if (!monatAnkerAusbilder) {
    var bezug = vonIso(AUSBILDER.woche);
    monatAnkerAusbilder = new Date(bezug.getFullYear(), bezug.getMonth(), 1);
  }
  popover.hidden = false;
  $("a-wochenlabel").setAttribute("aria-expanded", "true");
  monatsrasterZeichnen();
  // Unter dem Knopf ausrichten, ohne aus dem Fenster zu laufen – wie im Heft.
  var r = $("a-wochenlabel").getBoundingClientRect();
  popover.style.left = Math.max(6, Math.min(r.left, window.innerWidth - popover.offsetWidth - 6)) + "px";
  popover.style.top = (r.bottom + 2) + "px";
}

function monatsrasterSchliessen() {
  var popover = $("a-wochen");
  if (!popover) return;
  popover.hidden = true;
  $("a-wochenlabel").setAttribute("aria-expanded", "false");
}

function monatsrasterZeichnen() {
  $("a-monatslabel").textContent = MONATE[monatAnkerAusbilder.getMonth()] + " " + monatAnkerAusbilder.getFullYear();
  var liste = $("a-wochenliste");
  liste.innerHTML = "";

  var kopf = document.createElement("div");
  kopf.className = "wkopf";
  kopf.innerHTML = "<span>KW</span>" +
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(function (k) { return "<span>" + k + "</span>"; }).join("") +
    "<span>Std</span>";
  liste.appendChild(kopf);

  var letzter = new Date(monatAnkerAusbilder.getFullYear(), monatAnkerAusbilder.getMonth() + 1, 0);
  var montag = montagVon(monatAnkerAusbilder), reihen = 0;
  while (montag <= letzter && reihen < 7) {
    liste.appendChild(monatsrasterZeile(montag));
    montag = plus(montag, 7);
    reihen++;
  }
}

/** Bundesland aus den Stammdaten des Azubis, für seine Feiertage. */
function azubiLand(stand) {
  return ((stand && stand.stamm && stand.stamm.daten) || {}).land || "";
}

/** Kein Eintrag oder einer, in dem nichts steht – zählt wie keiner (server/stand.js). */
function azubiTagLeer(t) {
  return !t || (!t.art && !String(t.text || "").trim() && !t.stunden);
}

/**
 * Die Woche, wenn der Tag unter ihren Themen für die Berufsschule steht (Blockwoche), sonst null.
 * Dieselbe Regel wie auf dem Server (server/stand.js) und im Heft (tagImWochenfeld()).
 */
function azubiWochenfeld(stand, datumIso, t) {
  var w = stand.wochen && stand.wochen[iso(montagVon(vonIso(datumIso)))];
  if (!w || !String(w.schule || "").trim()) return null;
  if (azubiTagLeer(t) && feiertagAn(datumIso, azubiLand(stand))) return null;
  if (t && ((t.art && !istSchultag(t.art)) || String(t.text || "").trim())) return null;
  return w;
}

/**
 * Lage eines Tages im Raster, mit denselben Klassen wie im Heft (tagLage()):
 *   voll    Text da, noch nicht übernommen (roter Kreis)
 *   fertig  übernommen (grüner Kreis)
 *   offen   Stunden oder Berufsschule, aber kein Text (Ring)
 *   frei    Urlaub, Krank, Feiertag (durchgestrichen)
 *   nichts  kein Eintrag
 * Ein gesetzlicher Feiertag ohne Eintrag ist frei, wie im Heft und auf dem Server.
 */
function azubiTagLage(t, datumIso, stand) {
  var block = azubiWochenfeld(stand, datumIso, t);
  if (block) return block.schuleGeprueft ? "fertig" : "voll";
  if (azubiTagLeer(t)) return feiertagAn(datumIso, azubiLand(stand)) ? "frei" : "nichts";
  var schule = istSchultag(t.art);
  if (t.art && !schule) return "frei";
  if (!String(t.text || "").trim()) return (t.stunden || schule) ? "offen" : "nichts";
  return t.geprueft ? "fertig" : "voll";
}

function monatsrasterZeile(montag) {
  var montagIso = iso(montag);
  var stand = AUSBILDER.stand[AUSBILDER.gewaehlt.id] || { tage: {} };
  var w = wochenstandVon(AUSBILDER.gewaehlt, montagIso);
  var b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-current", String(montagIso === AUSBILDER.woche));
  b.className = !w ? "neu" : w.stand === "offen" ? "pruefen" : w.stand === "fertig" ? "fertig" : "";
  b.title = langSpanne(montag) + (w ? " — " + wochenWort(w) : " — keine Einträge");

  var summe = 0;
  var felder = [];
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var tag = plus(montag, i), t = stand.tage[iso(tag)];
    if (t && t.stunden) summe += Number(t.stunden);
    felder.push('<span class="wtag ' + azubiTagLage(t, iso(tag), stand) + '"><b>' + tag.getDate() + "</b></span>");
  }
  b.innerHTML = '<span class="wkw">' + kalenderwoche(montag) + "</span>" + felder.join("") +
    '<span class="wstd">' + (summe ? stundenText(summe) : "") + "</span>";

  b.addEventListener("click", function () {
    AUSBILDER.woche = montagIso;
    monatsrasterSchliessen();
    zeichneWochenkopf();
    zeichneAusbilderInhalt();
  });
  return b;
}

/* ---------- Inhalt ---------- */

function zeichneAusbilderInhalt() {
  var inhalt = $("a-inhalt");
  var azubi = AUSBILDER.gewaehlt;
  inhalt.innerHTML = "";
  azubiStand(azubi.id).then(function (stand) {
    if (AUSBILDER.gewaehlt !== azubi) return;   // inzwischen zurück zur Auswahl
    inhalt.innerHTML = "";
    inhalt.appendChild(azubiWoche(azubi, stand));
  }).catch(function (e) {
    inhalt.innerHTML = '<p class="leerbild">Die Einträge ließen sich nicht laden: ' + sicher(e.message) + "</p>";
  });
}

/**
 * Reiter eines Azubis: links der Stand der Tage, in der Mitte das Wochenblatt, wie es
 * gedruckt und unterschrieben wird, rechts die Angaben der Woche und der Export.
 *
 * Fünf Tage mit je sechs Zeilen als einzelne Karten untereinander liest niemand gern,
 * und beim Unterschreiben zählt ohnehin das Blatt. Deshalb dasselbe Bild wie im Heft:
 * schmale Spalte mit dem Stand, daneben die Vorschau aus demselben Drucksatz (druckBlatt).
 */
function azubiWoche(azubi, stand) {
  var panel = document.createElement("div");
  panel.className = "tagpanel woche";
  var flaeche = document.createElement("div");
  flaeche.className = "tagflaeche dreispaltig";
  flaeche.appendChild(tageSpalte(stand));
  var vorschau = azubiVorschau(stand);
  flaeche.appendChild(vorschau.wurzel);
  flaeche.appendChild(seitenspalte(vorschau.fuss, null, [angabenSektion(stand)]));
  panel.appendChild(flaeche);
  return panel;
}

/** Linke Spalte: je Werktag eine Zeile mit Stand und Stunden. */
function tageSpalte(stand) {
  var spalte = document.createElement("div");
  spalte.className = "wochenspalte";
  var montag = vonIso(AUSBILDER.woche), heute = iso(new Date());

  var s = sektion("Diese Woche");
  var zeilen = [];
  for (var i = 0; i < 5; i++) {
    var datum = plus(montag, i), key = iso(datum), t = stand.tage[key] || null;
    var leer = azubiTagLeer(t);
    var feiertag = leer && feiertagAn(key, azubiLand(stand));
    // Berufsschule und Betriebsversammlung brauchen Text wie ein Arbeitstag (server/stand.js).
    var schule = !leer && istSchultag(t.art);
    var frei = !leer && !!t.art && !schule;
    var ohneText = leer || !String(t.text || "").trim();
    // Nach heute: Tage ohne Text stehen noch aus; was schon geschrieben ist, zeigt seinen Stand.
    var lage = feiertag || frei ? "frei" : key > heute && ohneText ? "kommt"
      : ohneText ? "fehlt" : (t.geprueft ? "fertig" : "offen");
    var wort = { fertig: "übernommen", offen: "nicht übernommen", frei: frei ? sicher(t.art) : "Feiertag",
      fehlt: leer ? "kein Eintrag" : "kein Text", kommt: "steht noch aus" }[lage];
    if (schule) wort = sicher(t.art) + ", " + wort;
    // In einer Blockwoche gilt für den Tag, was mit den Themen der Woche ist.
    var block = azubiWochenfeld(stand, key, t);
    if (block) {
      lage = block.schuleGeprueft ? "fertig" : "offen";
      wort = "Blockwoche, " + (block.schuleGeprueft ? "übernommen" : "nicht übernommen");
    }
    var marke = lage === "fertig" ? '<span class="haken">✓</span>'
      : lage === "offen" ? '<span class="marke">!</span>' : '<span class="punkt"></span>';
    zeilen.push('<li class="' + lage + '"><span class="atagname">' + KURZ[datum.getDay()] + " " + dm(datum) + "</span>" +
      '<span class="atagstand">' + marke + wort + "</span>" +
      '<span class="astunden">' + (t && t.stunden != null ? stundenText(t.stunden) + " h" : "") + "</span></li>");
  }
  s.leib.innerHTML = '<ul class="atageliste">' + zeilen.join("") + "</ul>";
  spalte.appendChild(s.wurzel);
  return spalte;
}

/** Abteilung und Unterweisungen der Woche, wie der Azubi sie eingetragen hat. */
function angabenSektion(stand) {
  var w = stand.wochen[AUSBILDER.woche];
  // Ohne eigene Angabe für die Woche gilt die Abteilung aus den Stammdaten – dieselbe
  // Reihenfolge wie im Wochenblatt, im Druck und im Word-Dokument. Nicht stammdaten()
  // nehmen: Die Felder tragen hier die Daten des Ausbilders, nicht die des Azubis.
  var stamm = (stand.stamm && stand.stamm.daten) || {};
  var sW = sektion("Angaben für die ganze Woche");
  var wert = function (titel, text, leer) {
    return '<div class="seitenblock"><div class="seitentitel">' + titel + "</div>" +
      '<p class="seitenwert' + (text ? "" : " ruhig") + '">' + (text ? sicher(text) : leer) + "</p></div>";
  };
  sW.leib.innerHTML =
    wert("Abteilung", (w && w.abteilung) || stamm.abteilung, "nicht angegeben") +
    wert("Unterweisungen", w && w.unterweisungen, "nichts eingetragen") +
    (w && String(w.schule || "").trim() ? wert("Berufsschule (Blockwoche)", w.schule, "") : "");
  return sW.wurzel;
}

/** Das Wochenblatt des Azubis, verkleinert – derselbe Drucksatz wie im Heft und im PDF. */
function azubiVorschau(stand) {
  var s = sektion("Wochenblatt", "vorschau");
  var buehne = document.createElement("div");
  buehne.className = "vorschaubuehne";
  s.leib.appendChild(buehne);
  var fuss = document.createElement("div");
  fuss.className = "textfuss";
  var zahl = document.createElement("span");
  zahl.className = "textstand";
  fuss.appendChild(zahl);
  s.leib.appendChild(fuss);

  var einpassen = function () {
    var breite = buehne.clientWidth - 32;
    Array.prototype.forEach.call(buehne.querySelectorAll(".bogenrahmen"), function (rahmen) {
      var bogen = rahmen.firstElementChild;
      var mass = breite / bogen.offsetWidth;
      bogen.style.transform = "scale(" + mass + ")";
      rahmen.style.width = breite + "px";
      rahmen.style.height = bogen.offsetHeight * mass + "px";
    });
  };

  mitAzubiStand(stand, function () {
    var st = stammdaten(), montag = vonIso(AUSBILDER.woche);
    return (druckBlattSicher(wochenNummer(montag, startMontag(st)), montag, st).match(/<article[\s\S]*?<\/article>/g) || []);
  }).then(function (bloecke) {
    if (!buehne.isConnected) return;
    buehne.innerHTML = bloecke.map(function (b) {
      return '<div class="bogenrahmen"><div class="bogen">' + b + "</div></div>";
    }).join("");
    fuss.className = "textfuss " + (bloecke.length > 1 ? "eng" : "passt");
    zahl.textContent = bloecke.length > 1 ? "braucht " + bloecke.length + " Blätter" : "passt auf ein Blatt";
    einpassen();
  });

  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (buehne.isConnected) einpassen(); }).observe(buehne);
  }
  return { wurzel: s.wurzel, fuss: fuss };
}

/* ---------- Export: dieselben Bausteine wie im Heft ---------- */

/**
 * Den Stand eines Azubis kurz in den eigenen Zustand legen, etwas damit tun und
 * alles zurückräumen. So schreiben Word und Druck genau dasselbe Blatt wie beim Azubi,
 * ohne dass der Export etwas von Konten wissen muss.
 */
function mitAzubiStand(stand, aufgabe) {
  var sicherung = {
    tage: tage, wochendaten: wochendaten, wochen: wochen, aktiveWoche: aktiveWoche,
    felder: stammdaten()
  };
  var eigeneTage = {};
  Object.keys(stand.tage).forEach(function (k) {
    var t = stand.tage[k];
    eigeneTage[k] = {
      text: t.text || "", art: t.art || "", stunden: t.stunden == null ? null : Number(t.stunden),
      geprueft: !!t.geprueft, pausen: [], posten: []
    };
  });
  tage = eigeneTage;
  wochendaten = {};
  Object.keys(stand.wochen).forEach(function (m) {
    var w = stand.wochen[m];
    wochendaten[m] = { abteilung: w.abteilung || "", unterweisungen: w.unterweisungen || "",
      schule: w.schule || "", schuleGeprueft: !!w.schuleGeprueft };
  });
  var azubiStamm = (stand.stamm && stand.stamm.daten) || {};
  Object.keys(azubiStamm).forEach(function (k) {
    var feld = stammFeld(k);
    if (feld && typeof azubiStamm[k] === "string") feld.value = azubiStamm[k];
  });
  wochenNeu();
  aktiveWoche = AUSBILDER.woche;

  var zurueck = function () {
    tage = sicherung.tage;
    wochendaten = sicherung.wochendaten;
    wochen = sicherung.wochen;
    aktiveWoche = sicherung.aktiveWoche;
    Object.keys(sicherung.felder).forEach(function (k) {
      var feld = stammFeld(k);
      if (feld && typeof sicherung.felder[k] === "string") feld.value = sicherung.felder[k];
    });
  };
  return Promise.resolve()
    .then(aufgabe)
    .then(function (e) { zurueck(); return e; }, function (e) { zurueck(); throw e; });
}

function azubiExport(was) {
  var azubi = AUSBILDER.gewaehlt;
  if (!azubi) return;
  menueSchliessen();
  return azubiStand(azubi.id).then(function (stand) {
    return mitAzubiStand(stand, function () {
      var s = stammdaten();
      var name = azubi.name.replace(/[^\wÄÖÜäöüß-]+/g, "-");
      if (was === "wochenblatt") {
        var montag = vonIso(AUSBILDER.woche);
        var nr = wochenNummer(montag, startMontag(s));
        sage("Wochenblatt wird erzeugt …");
        return ausliefern(dokument([wochenSeite(nr, montag, s)], s, true),
          exportName("Wochenblatt", nr, AUSBILDER.woche, iso(plus(montag, 6)), name));
      }
      if (was === "heft") {
        sage("Gesamtheft wird erzeugt …");
        var abschnitte = [{ kinder: deckblatt(s) }, { kinder: ausbildungsgang(s) }];
        var montage = alleExportMontage(s);
        montage.forEach(function (m, i) { abschnitte.push(wochenSeite(i + 1, m, s)); });
        var spanne = heftSpanne(montage);
        return ausliefern(dokument(abschnitte, s, false),
          exportName("Berichtsheft", spanne.nummer, spanne.von, spanne.bis, name));
      }
      // Drucken: dieselbe Vorschau wie im Heft, der Browser macht das PDF.
      return drucken(was === "pdf-heft");
    });
  }).catch(function (e) {
    sage("Export nicht möglich: " + e.message, "warn");
  });
}

function exportMenueBinden() {
  var knopf = $("a-export"), menue = $("a-menue");
  knopf.addEventListener("click", function (e) {
    e.stopPropagation();
    var offen = !menue.hidden;
    menue.hidden = offen;
    knopf.setAttribute("aria-expanded", String(!offen));
  });
  [["a-wochenblatt", "wochenblatt"], ["a-pdf-woche", "pdf-woche"],
    ["a-heft", "heft"], ["a-pdf-heft", "pdf-heft"]].forEach(function (paar) {
    $(paar[0]).addEventListener("click", function () { azubiExport(paar[1]); });
  });
  document.addEventListener("click", function () {
    if (!menue.hidden) { menue.hidden = true; knopf.setAttribute("aria-expanded", "false"); }
  });
}

/* ---------- Gruppe ---------- */

function gruppeOeffnen() {
  return ausbilderHolen("gruppe").then(function (daten) {
    var zeile = function (a, drin) {
      return "<li><span>" + sicher(a.name) + "</span>" +
        '<button type="button" class="knopf klein" data-' + (drin ? "raus" : "rein") + '="' + sicher(a.id) + '">' +
        (drin ? "entfernen" : "aufnehmen") + "</button></li>";
    };
    $("dlg-gruppe-inhalt").innerHTML =
      '<h3>In deiner Gruppe</h3><ul class="gruppenliste">' +
        (daten.gruppe.map(function (a) { return zeile(a, true); }).join("") || '<li class="ruhig">niemand</li>') + "</ul>" +
      '<h3>Weitere Azubis</h3><ul class="gruppenliste">' +
        (daten.frei.map(function (a) { return zeile(a, false); }).join("") ||
          '<li class="ruhig">niemand. Wer sich noch nie angemeldet hat, erscheint hier nicht.</li>') + "</ul>";
    Array.prototype.forEach.call($("dlg-gruppe-inhalt").querySelectorAll("[data-rein],[data-raus]"), function (knopf) {
      var rein = knopf.getAttribute("data-rein");
      knopf.addEventListener("click", function () {
        var anfrage = rein
          ? kontoAnfrage("gruppe", { azubi_id: rein })
          : fetch("api/gruppe/" + encodeURIComponent(knopf.getAttribute("data-raus")),
            { method: "DELETE", credentials: "same-origin" });
        anfrage.then(function (antwort) {
          if (!antwort.ok) throw new Error("Server antwortet mit " + antwort.status);
          AUSBILDER.stand = {};
          return gruppeOeffnen().then(ausbilderListe);
        }).catch(function (e) { sage("Das hat nicht geklappt: " + e.message, "warn"); });
      });
    });
    if (!$("dlg-gruppe").open) $("dlg-gruppe").showModal();
  }).catch(function (e) {
    sage("Die Gruppe ließ sich nicht laden: " + e.message, "warn");
  });
}
