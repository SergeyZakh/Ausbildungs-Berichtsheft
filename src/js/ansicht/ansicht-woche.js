/* ============================================================
 * Wochenbalken und Wochenwahl (Monatsraster)
 * ========================================================== */

/* Welcher Monat im Raster steht; bleibt beim Blättern erhalten. */
var monatAnker = null;

/* Die Winkel der Blätterpfeile, gleich wie in index.html; die Striche kommen aus leiste.css. */
var PFEIL_LINKS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
var PFEIL_RECHTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

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

/** Das Monatsraster: eine Zeile je Woche, die den Monat berührt. */
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
  kopf.innerHTML = "<span>KW</span>" +
    ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(function (k) {
      return "<span>" + k + "</span>";
    }).join("") + "<span>Std</span>";
  liste.appendChild(kopf);

  var letzter = new Date(monatAnker.getFullYear(), monatAnker.getMonth() + 1, 0);
  var montag = montagVon(monatAnker), reihen = 0;
  while (montag <= letzter && reihen < 7) {
    liste.appendChild(wochenzeile(montag));
    montag = plus(montag, 7);
    reihen++;
  }

  if (!wochen.length) {
    var leer = document.createElement("p");
    leer.className = "leerzeile";
    leer.textContent = "Noch keine Woche mit Einträgen.";
    liste.appendChild(leer);
  }
}

function wochenzeile(montag) {
  var montagIso = iso(montag);
  var hatDaten = wochen.indexOf(montagIso) !== -1;
  var l = lage(montagIso);
  var b = document.createElement("button");
  b.type = "button";
  if (!hatDaten) b.className = "neu";
  b.setAttribute("aria-current", String(montagIso === aktiveWoche));

  var wstand = hatDaten ? wochenStand(montagIso) : "";
  if (wstand) b.className = wstand;
  var wortlaut = wstand === "pruefen" ? " — noch nicht gegengelesen"
    : wstand === "fertig" ? " — gegengelesen"
    : l.offen ? " — " + l.offen + " offen" : " — vollständig";
  b.title = langSpanne(montag) + (hatDaten ? wortlaut : " — noch leer");

  var teile = ['<span class="wkw">' + kalenderwoche(montag) + "</span>"];
  for (var d = 0; d < TAGE_JE_WOCHE; d++) {
    var tag = plus(montag, d);
    var zustand = hatDaten ? tagLage(iso(tag)) : "nichts";
    // Ein Werktag der Ausbildung bis heute ohne jeden Eintrag fehlt im Heft, auch in einer Woche
    // ganz ohne Daten: So sieht man im Raster, wo noch gar nichts steht (fehlenderWerktag()).
    if (zustand === "nichts" && fehlenderWerktag(iso(tag))) zustand = "fehlt";
    teile.push('<span class="wtag ' + zustand + '"><b>' + tag.getDate() + "</b></span>");
  }
  teile.push('<span class="wstd">' + (hatDaten ? (l.summe ? stundenText(l.summe) : "") : "+") + "</span>");
  b.innerHTML = teile.join("");

  b.addEventListener("click", function () { wocheZeigen(montagIso); });
  return b;
}

function monatBlaettern(schritt) {
  if (!monatAnker) return;
  monatAnker = new Date(monatAnker.getFullYear(), monatAnker.getMonth() + schritt, 1);
  zeichneWochenliste();
}

/** Eine Woche öffnen. `tag` ist der Index in der Woche, sonst Montag. */
function wocheZeigen(montagIso, tag) {
  aktiveWoche = montagIso;
  aktiverTag = (tag >= 0 && tag <= 6) ? tag : 0;
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

/* ---------- Popover unter dem Wochenknopf ---------- */

function wochenwahlOffen() { return !$("dlg-wochen").hidden; }

function wochenwahlSchliessen() {
  $("dlg-wochen").hidden = true;
  $("wochenlabel").setAttribute("aria-expanded", "false");
}

function wochenwahlOeffnen() {
  var pop = $("dlg-wochen"), knopf = $("wochenlabel");
  $("suchhinweis").textContent = "";
  monatAnker = null;
  zeichneWochenliste();
  pop.hidden = false;
  knopf.setAttribute("aria-expanded", "true");
  // Unter dem Knopf ausrichten, ohne aus dem Fenster zu laufen.
  var r = knopf.getBoundingClientRect();
  var breite = pop.offsetWidth;
  var links = Math.max(6, Math.min(r.left, window.innerWidth - breite - 6));
  pop.style.left = links + "px";
  pop.style.top = (r.bottom + 2) + "px";
}

$("wochenlabel").addEventListener("click", function (e) {
  e.stopPropagation();
  menueSchliessen();
  if (wochenwahlOffen()) wochenwahlSchliessen();
  else wochenwahlOeffnen();
});
$("dlg-wochen").addEventListener("click", function (e) { e.stopPropagation(); });
$("w-zu").addEventListener("click", wochenwahlSchliessen);

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
  wocheZeigen(ziel);
});
$("sprung-heute").addEventListener("click", function () {
  var heute = new Date();
  wocheZeigen(iso(montagVon(heute)), tagIndex(heute));
});
$("woche-zurueck").addEventListener("click", function () { wocheWechseln(1); });
$("woche-vor").addEventListener("click", function () { wocheWechseln(-1); });
