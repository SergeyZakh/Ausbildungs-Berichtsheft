/* ============================================================
 * Wochenbalken und Kalender (Monatsraster)
 * ========================================================== */

/* Welcher Monat im Raster steht; bleibt beim Blättern erhalten. */
var monatAnker = null;

/* Die Winkel der Blätterpfeile, gleich wie in index.html; die Striche kommen aus leiste.css. */
var PFEIL_LINKS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
var PFEIL_RECHTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

/* Was ein Kreis im Raster heißt, für Vorleser und als Titel beim Überfahren. */
var TAG_WORTE = {
  voll: "nicht gegengelesen", fertig: "gegengelesen", offen: "Stunden ohne Text", fehlt: "nichts eingetragen"
};

/** Wochenknopf, Blätterpfeile und Stundensumme. wochen[] ist absteigend sortiert. */
function zeichneWochenwahl() {
  var etikett = $("wochenlabel");
  if (!aktiveWoche) {
    etikett.textContent = "Keine Woche";
    // "wochenknopf" trägt das Aussehen; der Stand kommt als zweite Klasse dazu.
    etikett.className = "wochenknopf";
    $("woche-zurueck").disabled = true;
    $("woche-vor").disabled = true;
    $("wochensumme").textContent = "";
    return;
  }
  var l = lage(aktiveWoche);
  var wstand = wochenStand(aktiveWoche);
  // Nur der Zeitraum: Den Stand zeigen die Tage und daneben „3/5 fertig“. Am Rechner steht er
  // ausgeschrieben als Titel, am Handy kurz im Knopf (leiste.css).
  etikett.className = "wochenknopf" + (wstand ? " " + wstand : "");
  etikett.innerHTML = '<span class="lang">' + langSpanne(vonIso(aktiveWoche)) + "</span>" +
    '<span class="kurz">' + kurzSpanne(vonIso(aktiveWoche)) + "</span>";
  $("woche-zurueck").disabled = false;
  $("woche-vor").disabled = false;
  var anteil = wochenAnteil(aktiveWoche);
  $("wochensumme").innerHTML = (anteil.von
    ? '<span class="wsanteil' + (anteil.fertig === anteil.von ? " fertig" : "") + '">' +
      ringHtml(anteil.fertig, anteil.von, anteil.fertig + " von " + anteil.von + " Tagen gegengelesen") +
      "<span>" + anteil.fertig + "/" + anteil.von + '<span class="wswort">\u00a0fertig</span></span></span>'
    : "") + '<span class="wsstunden">' + stundenText(l.summe) + "\u2009h</span>";

  // Ein offenes Raster zeigt Änderungen sofort.
  if (wochenwahlOffen()) zeichneWochenliste();
}

/**
 * Das Monatsraster: eine Zeile je Woche, die den Monat berührt. Jeder Tag ist ein eigener Knopf
 * und öffnet sich selbst, die Kalenderwoche öffnet die ganze Woche. Vorher war die Zeile ein
 * einziger Knopf: Wer auf die 17 klickte, landete am Montag.
 */
function zeichneWochenliste() {
  var liste = $("wochenliste");
  liste.innerHTML = "";
  if (!monatAnker) {
    var bezug = aktiveWoche ? vonIso(aktiveWoche) : new Date();
    monatAnker = new Date(bezug.getFullYear(), bezug.getMonth(), 1);
  }
  $("monatslabel").textContent = MONATE[monatAnker.getMonth()] + " " + monatAnker.getFullYear();

  var kopf = document.createElement("div");
  kopf.className = "wkopf";
  kopf.setAttribute("aria-hidden", "true");
  kopf.innerHTML = "<span>KW</span>" +
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(function (k) {
      return "<span>" + k + "</span>";
    }).join("") + "<span>Std</span>";
  liste.appendChild(kopf);

  var heute = iso(new Date());
  var letzter = new Date(monatAnker.getFullYear(), monatAnker.getMonth() + 1, 0);
  var montag = montagVon(monatAnker), reihen = 0;
  while (montag <= letzter && reihen < 7) {
    liste.appendChild(wochenzeile(montag, monatAnker.getMonth(), heute));
    montag = plus(montag, 7);
    reihen++;
  }

  if (!wochen.length) {
    var leer = document.createElement("p");
    leer.className = "leerzeile";
    leer.textContent = "Noch keine Woche mit Einträgen.";
    liste.appendChild(leer);
  }
  kalenderTabstopp();
  sprungOffenZeigen();
}

function wochenzeile(montag, monat, heute) {
  var montagIso = iso(montag), kw = kalenderwoche(montag);
  var hatDaten = wochen.indexOf(montagIso) !== -1;
  var l = lage(montagIso);
  var zeile = document.createElement("div");
  var wstand = hatDaten ? wochenStand(montagIso) : "";
  // Leere Woche: blass; ein Klick auf einen ihrer Tage legt sie an.
  zeile.className = "wzeile" + (wstand ? " " + wstand : hatDaten ? "" : " neu");
  zeile.setAttribute("role", "group");
  zeile.setAttribute("aria-current", String(montagIso === aktiveWoche));
  var wortlaut = wstand === "pruefen" ? " — noch nicht gegengelesen"
    : wstand === "fertig" ? " — gegengelesen"
    : l.offen ? " — " + l.offen + " offen" : " — vollständig";
  var wochenText = langSpanne(montag) + (hatDaten ? wortlaut : " — noch leer");
  zeile.setAttribute("aria-label", "KW " + kw + ", " + wochenText);

  var kwKnopf = document.createElement("button");
  kwKnopf.type = "button";
  kwKnopf.className = "wkw";
  kwKnopf.textContent = kw;
  kwKnopf.title = wochenText + " · ganze Woche öffnen";
  kwKnopf.setAttribute("aria-label", "KW " + kw + ", ganze Woche öffnen");
  kwKnopf.setAttribute("data-montag", montagIso);
  kwKnopf.setAttribute("data-tag", String(TAGE_JE_WOCHE));
  zeile.appendChild(kwKnopf);

  for (var d = 0; d < TAGE_JE_WOCHE; d++) {
    var tag = plus(montag, d), key = iso(tag);
    var zustand = hatDaten ? tagLage(key) : "nichts";
    // Ein Werktag der Ausbildung bis heute ohne jeden Eintrag fehlt im Heft, auch in einer Woche
    // ganz ohne Daten: So sieht man im Raster, wo noch gar nichts steht (fehlenderWerktag()).
    if (zustand === "nichts" && fehlenderWerktag(key)) zustand = "fehlt";
    // Tage des Monats davor und danach blass, heute mit Ring (dialoge.css).
    var b = document.createElement("button");
    b.type = "button";
    b.className = "wtag " + zustand + (tag.getMonth() !== monat ? " aussen" : "") + (key === heute ? " heute" : "");
    b.innerHTML = "<b>" + tag.getDate() + "</b>";
    var wort = zustand === "frei" ? tage[key].art : TAG_WORTE[zustand];
    var name = WOCHENTAGE[tag.getDay()] + ", " + dm(tag) + (key === heute ? " (heute)" : "") + (wort ? ": " + wort : "");
    b.title = name;
    b.setAttribute("aria-label", name);
    b.setAttribute("data-montag", montagIso);
    b.setAttribute("data-tag", String(d));
    zeile.appendChild(b);
  }

  var std = document.createElement("span");
  std.className = "wstd";
  std.textContent = hatDaten && l.summe ? stundenText(l.summe) : "";
  zeile.appendChild(std);
  return zeile;
}

/**
 * Nur ein Knopf des Rasters ist mit Tab erreichbar, weiter geht es mit den Pfeiltasten: sonst
 * wären es bis zu 48 Tabstopps. Es ist der offene Tag, sonst heute, sonst der Erste des Monats.
 */
function kalenderTabstopp(ziel) {
  var liste = $("wochenliste");
  var knoepfe = [].slice.call(liste.querySelectorAll(".wzeile button"));
  if (!ziel && aktiveWoche) {
    ziel = liste.querySelector('button[data-montag="' + aktiveWoche + '"][data-tag="' + aktiverTag + '"]');
  }
  ziel = ziel || liste.querySelector(".wtag.heute") || liste.querySelector(".wtag:not(.aussen)");
  knoepfe.forEach(function (k) { k.tabIndex = k === ziel ? 0 : -1; });
}

$("wochenliste").addEventListener("click", function (e) {
  var k = e.target.closest("button[data-montag]");
  if (k) wocheZeigen(k.getAttribute("data-montag"), +k.getAttribute("data-tag"));
});
$("wochenliste").addEventListener("keydown", function (e) {
  var schritt = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
  var k = e.target.closest(".wzeile button");
  if (!schritt || !k) return;
  e.preventDefault();
  var zeilen = [].slice.call($("wochenliste").querySelectorAll(".wzeile"));
  var z = Math.max(0, Math.min(zeilen.length - 1, zeilen.indexOf(k.parentNode) + schritt[0]));
  var spalte = [].indexOf.call(k.parentNode.querySelectorAll("button"), k) + schritt[1];
  var reihe = zeilen[z].querySelectorAll("button");
  var neu = reihe[Math.max(0, Math.min(reihe.length - 1, spalte))];
  kalenderTabstopp(neu);
  neu.focus();
});

/** Der Knopf nennt sein Ziel, damit man vorher weiß, wohin er springt. */
function sprungOffenZeigen() {
  var ziel = ersteOffeneWoche(), k = $("sprung-offen");
  k.textContent = ziel ? "Erste offene: " + kurzSpanne(vonIso(ziel)) + " \u2192" : "Alles fertig";
  k.title = ziel ? "Die früheste Woche, in der noch Text fehlt oder etwas gegenzulesen ist"
    : "Alle geladenen Wochen sind ausgefüllt und übernommen.";
}

function monatBlaettern(schritt) {
  if (!monatAnker) return;
  monatAnker = new Date(monatAnker.getFullYear(), monatAnker.getMonth() + schritt, 1);
  zeichneWochenliste();
}

/** Eine Woche öffnen. `tag` ist der Index in der Woche (7 der Reiter „Woche“), sonst Montag. */
function wocheZeigen(montagIso, tag) {
  aktiveWoche = montagIso;
  aktiverTag = (tag >= 0 && tag <= TAGE_JE_WOCHE) ? tag : 0;
  monatAnker = null;
  wochenwahlSchliessen();
  zeichnen();
  merken();
}

/** "Dienstag, 15.09." oder, in einer Blockwoche, "der Blockwoche 14.–20. Sep." */
function stelleText(datumIso) {
  var datum = vonIso(datumIso), montag = iso(montagVon(datum));
  return blockwoche(montag)
    ? "der Blockwoche " + kurzSpanne(vonIso(montag)) + "."
    : WOCHENTAGE[datum.getDay()] + ", " + dm(datum);
}

/** Kurz für einen Knopf: "Mo 14.09." oder bei einer Blockwoche "Blockwoche 21.–27. Sep". */
function stelleKurz(datumIso) {
  var datum = vonIso(datumIso), montag = montagVon(datum);
  return blockwoche(iso(montag)) ? "Blockwoche " + kurzSpanne(montag) : KURZ[datum.getDay()] + " " + dm(datum);
}

/** Einen Tag öffnen; in einer Blockwoche öffnet zeichneReiter() von selbst die Woche. */
function stelleZeigen(datumIso) {
  var datum = vonIso(datumIso);
  wocheZeigen(iso(montagVon(datum)), tagIndex(datum));
  if ($("mitte")) $("mitte").scrollTop = 0;
}

/**
 * Nach „Fertig“ gleich zum nächsten Tag derselben Woche, der noch etwas braucht: Wer eine Woche
 * nacharbeitet, muss sich nicht selbst durch die Reiter klicken. „Zurück“ hinter der Meldung
 * führt wieder her. In eine andere Woche springt es nicht: Wer am Freitag „Fertig“ drückt, will
 * die Woche noch ansehen, bevor die nächste kommt. Dafür steht ein Knopf zur nächsten offenen
 * Stelle da, zu einem offenen Tag davor in derselben Woche oder, wenn danach nichts mehr offen
 * ist, zum frühesten. `datumIso` ist der letzte Tag dessen, was eben fertig wurde (bei den
 * Themen einer Woche ihr Sonntag).
 */
function weiterNachFertig(datumIso, meldung) {
  var montag = iso(montagVon(vonIso(datumIso))), sonntag = iso(plus(vonIso(montag), 6));
  var ziel = naechsterOffenerTag(datumIso);
  if (!ziel || ziel > sonntag) {
    var davor = offenerTagAb(montag, sonntag);
    if (davor) {
      sage(meldung + " In dieser Woche ist noch " + stelleText(davor) + " offen.", "gut");
      notizKnopf("Hin: " + stelleKurz(davor), function () { stelleZeigen(davor); });
      return;
    }
    if (ziel) {
      sage(meldung + " Die Woche ist fertig.", "gut");
      notizKnopf("Weiter: " + stelleKurz(ziel), function () { stelleZeigen(ziel); });
      return;
    }
    var frueher = ersterOffenerTag(datumIso);
    if (!frueher) { sage(meldung + " Alles bis heute ist fertig.", "gut"); return; }
    sage(meldung + " Danach ist nichts mehr offen.", "gut");
    notizKnopf("Früher offen: " + dm(vonIso(frueher)), function () { stelleZeigen(frueher); });
    return;
  }
  var vorher = { woche: aktiveWoche, tag: aktiverTag };
  stelleZeigen(ziel);
  sage(meldung + " Weiter mit " + stelleText(ziel), "gut");
  notizKnopf("Zurück", function () {
    aktiveWoche = vorher.woche;
    aktiverTag = vorher.tag;
    zeichnen();
    merken();
    sage("Zurück.", "");
  });
}

/** Zu einem Datum springen – auf den Tag selbst, nicht auf seinen Montag. */
function wocheSuchen(datumIso) {
  if (!datumIso) return;
  var datum = vonIso(datumIso);
  $("suchhinweis").textContent = "";
  wocheZeigen(iso(montagVon(datum)), tagIndex(datum));
}

/** schritt +1 = eine Kalenderwoche zurück, -1 = eine vor */
function wocheWechseln(schritt) {
  if (!aktiveWoche) return;
  aktiveWoche = iso(plus(vonIso(aktiveWoche), -7 * schritt));
  aktiverTag = 0;
  zeichnen();
  merken();
}

/* ---------- Der Kalender: am Rechner unter dem Wochenknopf, am Handy ein Fenster ---------- */

/** Am Handy steht der Kalender als Fenster in der Mitte, mit Grund dahinter (handy.css). */
function kalenderAlsFenster() {
  try { return window.matchMedia("(max-width: 820px)").matches; } catch (e) { return false; }
}

function wochenwahlOffen() { return !$("dlg-wochen").hidden; }

function wochenwahlSchliessen() {
  $("dlg-wochen").hidden = true;
  $("wochen-grund").hidden = true;
  $("wochenlabel").setAttribute("aria-expanded", "false");
}

/** `ansicht` "ausbildung" zeigt am Handy gleich alle Wochen; am Rechner gibt es nur den Monat. */
function wochenwahlOeffnen(ansicht) {
  var pop = $("dlg-wochen"), knopf = $("wochenlabel");
  $("suchhinweis").textContent = "";
  $("wochensuche").value = "";
  monatAnker = null;
  zeichneWochenliste();
  kalenderAnsichtSetzen(ansicht === "ausbildung" ? "ausbildung" : "monat");
  pop.hidden = false;
  // Der Grund steht nur am Handy da (handy.css); ein Tipp darauf schließt wie ein Klick daneben.
  $("wochen-grund").hidden = false;
  knopf.setAttribute("aria-expanded", "true");
  // Unter dem Knopf ausrichten, ohne aus dem Fenster zu laufen. Als Variablen, nicht als left/top:
  // Am Handy setzt handy.css die Lage, und ein Stil am Element ginge dort vor.
  var r = knopf.getBoundingClientRect();
  var links = Math.max(6, Math.min(r.left, window.innerWidth - pop.offsetWidth - 6));
  pop.style.setProperty("--links", links + "px");
  pop.style.setProperty("--oben", (r.bottom + 2) + "px");
}

/** Monat oder Ausbildung (die Übersicht, uebersicht.js); die Umschaltung gibt es nur am Handy. */
function kalenderAnsichtSetzen(ansicht) {
  var pop = $("dlg-wochen");
  pop.classList.toggle("ausbildung", ansicht === "ausbildung");
  $("w-ansicht-monat").setAttribute("aria-pressed", String(ansicht === "monat"));
  $("w-ansicht-ausbildung").setAttribute("aria-pressed", String(ansicht === "ausbildung"));
  if (ansicht === "ausbildung") uebersichtZeichnen($("w-ausbildung"), monatImKalender);
  pop.scrollTop = 0;
}

/** Aus der Ausbildung in einen Monat: Ein Tipp auf den Monatsnamen zeigt ihn im Raster. */
function monatImKalender(datum) {
  monatAnker = new Date(datum.getFullYear(), datum.getMonth(), 1);
  zeichneWochenliste();
  kalenderAnsichtSetzen("monat");
}

function heuteZeigen() {
  var heute = new Date();
  wocheZeigen(iso(montagVon(heute)), tagIndex(heute));
}

$("wochenlabel").addEventListener("click", function (e) {
  e.stopPropagation();
  menueSchliessen();
  if (wochenwahlOffen()) wochenwahlSchliessen();
  else wochenwahlOeffnen();
});
$("dlg-wochen").addEventListener("click", function (e) { e.stopPropagation(); });
$("w-zu").addEventListener("click", wochenwahlSchliessen);
$("w-ansicht-monat").addEventListener("click", function () { kalenderAnsichtSetzen("monat"); });
$("w-ansicht-ausbildung").addEventListener("click", function () { kalenderAnsichtSetzen("ausbildung"); });
$("w-hilfe").addEventListener("click", function () {
  var marken = $("w-marken");
  marken.hidden = !marken.hidden;
  $("w-hilfe").setAttribute("aria-expanded", String(!marken.hidden));
});

/* Getipptes Datum: Sobald es vollständig ist, wird gesprungen. Enter bei
   einer unvollständigen oder unmöglichen Angabe sagt, was nicht stimmt. */
function getipptesDatum(text) {
  var d = datumAusText(text);
  if (!d || !/^\s*[\d./-]+\s*$/.test(text)) return null;
  var probe = vonIso(d);
  return iso(probe) === d ? d : null;
}
$("wochensuche").addEventListener("input", function (e) {
  var d = getipptesDatum(e.target.value);
  if (d) wocheSuchen(d);
});
$("wochensuche").addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  var d = getipptesDatum(e.target.value);
  if (d) wocheSuchen(d);
  else $("suchhinweis").textContent = "Datum als TT.MM.JJJJ eingeben, zum Beispiel 14.03.2026.";
});
$("monat-zurueck").addEventListener("click", function () { monatBlaettern(-1); });
$("monat-vor").addEventListener("click", function () { monatBlaettern(1); });
$("sprung-offen").addEventListener("click", function () {
  var ziel = ersteOffeneWoche();
  if (!ziel) { $("suchhinweis").textContent = "Alle geladenen Wochen sind ausgefüllt und übernommen."; return; }
  // Gleich auf den ersten offenen Tag der Woche, nicht auf ihren Montag.
  wocheZeigen(ziel, Math.max(0, wochenBilanz(ziel).erster));
});
// Am Rechner steht „Heute“ oben neben dem Monat, am Handy unten neben „Erste offene“ (handy.css).
$("sprung-heute").addEventListener("click", heuteZeigen);
$("sprung-heute-handy").addEventListener("click", heuteZeigen);
$("woche-zurueck").addEventListener("click", function () { wocheWechseln(1); });
$("woche-vor").addEventListener("click", function () { wocheWechseln(-1); });
