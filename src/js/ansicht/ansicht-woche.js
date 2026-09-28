/* ============================================================
 * Wochenbalken und Wochenwahl (Monatsraster)
 * ========================================================== */

/* Welcher Monat im Raster steht; bleibt beim Blättern erhalten. */
var monatAnker = null;

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
  etikett.className = "wochenknopf" + (wstand ? " " + wstand : "");
  var zusatz = wstand === "pruefen" ? "  ·  nicht gegengelesen"
    : l.offen ? "  ·  " + l.offen + " offen" : "";
  etikett.textContent = kurzSpanne(vonIso(aktiveWoche)) + zusatz;
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
    leer.textContent = "Noch kein Export geladen.";
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

/** Einen Tag öffnen; in einer Blockwoche öffnet zeichneReiter() von selbst die Woche. */
function stelleZeigen(datumIso) {
  var datum = vonIso(datumIso);
  wocheZeigen(iso(montagVon(datum)), tagIndex(datum));
  if ($("mitte")) $("mitte").scrollTop = 0;
}

/**
 * Nach „Fertig“ gleich zum nächsten Tag, der noch etwas braucht, auch in eine andere Woche: Wer
 * einen Block oder eine liegengebliebene Woche nacharbeitet, muss sich nicht selbst durch die
 * Reiter klicken. „Zurück“ hinter der Meldung führt wieder her. Danach nichts mehr offen, aber
 * davor: kein Sprung zurück, nur ein Knopf dorthin. `datumIso` ist der letzte Tag dessen, was eben
 * fertig wurde (bei den Themen einer Woche ihr Sonntag).
 */
function weiterNachFertig(datumIso, meldung) {
  var ziel = naechsterOffenerTag(datumIso);
  if (!ziel) {
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
