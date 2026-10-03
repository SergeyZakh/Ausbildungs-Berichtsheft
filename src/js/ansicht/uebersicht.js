/* ============================================================
 * Übersicht: jeder Werktag der Ausbildung als Feld, je Ausbildungsjahr ein Raster wie die
 * Aktivität bei GitHub (Spalten Wochen, Zeilen Mo–Fr), dazu die Tage in der Berufsschule,
 * im Urlaub und krank
 *
 * Die Farben sind dieselben wie im Monatsraster: grün fertig, rot ungelesen, blassrot fehlt Text
 * (im Monatsraster ein Ring, gestrichelt, wenn gar nichts eingetragen ist).
 * Ein Klick auf ein Feld öffnet den Tag. Am Rechner passen drei Jahre ohne Scrollen hinein.
 * Am Handy steht die Übersicht im Kalender, als Ansicht „Ausbildung“ neben dem Monat
 * (ansicht-woche.js); dort öffnet ein Monatsname seinen Monat.
 * ========================================================== */

/* Welche Arten gezählt werden, in dieser Reihenfolge. */
var UEBERSICHT_ARTEN = ["Berufsschule", "Urlaub", "Krank", "Feiertag", "Betriebsversammlung"];

/** Wie weit die Übersicht reicht: Beginn bis Ende der Ausbildung, ohne Angaben vom ersten Eintrag bis heute. */
function uebersichtZeitraum() {
  var heute = iso(new Date());
  var von = $("f-beginn").value || ersterEingetragenerTag();
  if (!von) return null;
  var bis = $("f-ende").value || "";
  if (!bis) {
    bis = heute;
    Object.keys(tage).forEach(function (k) { if (k > bis) bis = k; });
  }
  return bis < von ? null : { von: von, bis: bis, mitBeginn: !!$("f-beginn").value };
}

/** Das Ausbildungsjahr eines Datums als Zahl, ohne Ausbildungsbeginn immer 1. */
function jahrVon(datum) {
  return +ausbildungsjahr({ beginn: $("f-beginn").value }, datum) || 1;
}

/** Der Zustand einer Woche als Kästchen. */
function wochenKaestchen(montagIso, heuteMontag) {
  if (montagIso > heuteMontag) return "kommt";
  var stand = wochenStand(montagIso);
  if (stand) return stand;
  return wochenBilanz(montagIso).ohneText ? "luecke" : "frei";
}

var KAESTCHEN_WORTE = {
  fertig: "fertig", pruefen: "nicht gegengelesen", luecke: "Text fehlt",
  frei: "frei", kommt: "kommt noch"
};

/**
 * Ein Werktag als Feld: dieselbe Rechnung wie im Monatsraster (tagLage(), fehlenderWerktag()).
 * „aussen“ sind die Tage der ersten und letzten Spalte vor Beginn oder nach Ende.
 */
function tagFeld(key, z, heute) {
  if (key < z.von || key > z.bis) return "aussen";
  if (key > heute) return "kommt";
  var lage = tagLage(key);
  if (lage === "fertig") return "fertig";
  if (lage === "voll") return "pruefen";
  if (lage === "offen" || (lage === "nichts" && fehlenderWerktag(key))) return "luecke";
  return "frei";
}

/**
 * Das Raster eines Ausbildungsjahrs: oben die Monate, links Mo, Mi, Fr, je Woche eine Spalte.
 * Die Felder sind Spalte für Spalte angeordnet (Woche 1 Mo–Fr, Woche 2 …), gesetzt über die
 * Rasterposition. Klicks fängt das Raster selbst ab, statt Hunderte Knöpfe zu verdrahten.
 * Mit `monatWahl` sind die Monatsnamen Knöpfe, die den Monat im Kalender zeigen.
 */
function jahresRaster(j, z, monatWahl) {
  var heute = iso(new Date());
  var raster = document.createElement("div");
  raster.className = "uraster";
  raster.style.setProperty("--wochen", j.wochen.length);
  raster.setAttribute("role", "group");
  raster.setAttribute("aria-label", "Werktage " + dmy(vonIso(j.von)) + " – " + dmy(vonIso(j.bis)));

  // Eine Woche gehört zu dem Monat, in dem ihr Donnerstag liegt (wie die Kalenderwoche): Die
  // Woche vom 29.7. bis 2.8. steht unter „Aug“, nicht unter „Jul“.
  function monatVon(w) { return plus(vonIso(w.montag), 3).getMonth(); }
  var zuletzt = -9;
  j.wochen.forEach(function (w, s) {
    var montag = vonIso(w.montag);
    // Der Monat steht über seiner ersten Woche; zu dicht aufeinander nicht.
    var neu = s === 0 || monatVon(w) !== monatVon(j.wochen[s - 1]);
    if (neu && s - zuletzt >= 3) {
      var monat = document.createElement(monatWahl ? "button" : "span");
      monat.className = "umonat";
      monat.textContent = MON_KURZ[monatVon(w)];
      if (monatWahl) {
        monat.type = "button";
        monat.setAttribute("data-monat", iso(plus(montag, 3)));
        monat.setAttribute("aria-label", MONATE[monatVon(w)] + " im Kalender zeigen");
      }
      monat.style.gridColumn = String(s + 2);
      raster.appendChild(monat);
      zuletzt = s;
    }
    for (var d = 0; d < 5; d++) {
      var datum = plus(montag, d), key = iso(datum), zustand = tagFeld(key, z, heute);
      var feld = document.createElement("span");
      feld.className = "utag " + zustand + (key === heute ? " heute" : "");
      feld.style.gridColumn = String(s + 2);
      feld.style.gridRow = String(d + 2);
      if (zustand !== "aussen") {
        feld.setAttribute("data-datum", key);
        feld.title = WOCHENTAGE[datum.getDay()] + ", " + dmy(datum) + " · " + KAESTCHEN_WORTE[zustand];
      }
      raster.appendChild(feld);
    }
  });
  ["Mo", "", "Mi", "", "Fr"].forEach(function (k, d) {
    if (!k) return;
    var name = document.createElement("span");
    name.className = "uwt";
    name.textContent = k;
    name.style.gridRow = String(d + 2);
    raster.appendChild(name);
  });
  raster.addEventListener("click", function (e) {
    var monat = e.target.closest("[data-monat]");
    if (monat) { monatWahl(vonIso(monat.getAttribute("data-monat"))); return; }
    var feld = e.target.closest("[data-datum]");
    if (!feld) return;
    $("dlg-uebersicht").close();
    stelleZeigen(feld.getAttribute("data-datum"));
  });
  return raster;
}

/**
 * Alles, was die Übersicht zeigt, nach Ausbildungsjahren: je Jahr die Wochen mit Zustand und
 * die Tage je Art bis heute.
 */
function uebersichtDaten() {
  var z = uebersichtZeitraum();
  if (!z) return [];
  var heute = iso(new Date()), heuteMontag = iso(montagVon(new Date()));
  var jahre = {}, liste = [];
  function jahr(n) {
    if (!jahre[n]) {
      jahre[n] = { jahr: n, wochen: [], tage: {}, von: null, bis: null };
      UEBERSICHT_ARTEN.forEach(function (a) { jahre[n].tage[a] = 0; });
      liste.push(jahre[n]);
    }
    return jahre[n];
  }

  var ende = montagVon(vonIso(z.bis));
  for (var m = montagVon(vonIso(z.von)); m <= ende; m = plus(m, 7)) {
    var j = jahr(jahrVon(m)), mIso = iso(m);
    j.wochen.push({ montag: mIso, zustand: wochenKaestchen(mIso, heuteMontag) });
    if (!j.von) j.von = mIso;
    j.bis = iso(plus(m, 6));
  }

  // Gezählt wird bis heute: Ein geplanter Schultag nächste Woche ist noch keiner. Ein Tag zählt in
  // seinem eigenen Ausbildungsjahr, auch wenn der Montag seiner Woche noch ins alte fällt; dann
  // kann ein Jahr ohne eigene Woche entstehen.
  var land = $("f-land").value;
  var letzter = z.bis < heute ? z.bis : heute;
  for (var d = vonIso(z.von); iso(d) <= letzter; d = plus(d, 1)) {
    var k = iso(d), art = tagArt(k);
    if (!art && !tagHatInhalt(tage[k]) && tagIndex(d) < 5 && feiertagAn(k, land)) art = "Feiertag";
    if (art && jahr(jahrVon(d)).tage[art] != null) jahr(jahrVon(d)).tage[art]++;
  }

  // Mit Ausbildungsbeginn stehen die Grenzen des Ausbildungsjahrs darüber, nicht die der Wochen.
  var b = vonIso(z.von);
  liste.forEach(function (j) {
    if (!z.mitBeginn && j.von) return;
    j.von = iso(new Date(b.getFullYear() + j.jahr - 1, b.getMonth(), b.getDate()));
    j.bis = iso(plus(new Date(b.getFullYear() + j.jahr, b.getMonth(), b.getDate()), -1));
    if ($("f-ende").value && j.bis > $("f-ende").value) j.bis = $("f-ende").value;
  });
  return liste.sort(function (a, b) { return a.jahr - b.jahr; });
}

/** In den Dialog „Übersicht“ oder, mit `ziel` und `monatWahl`, in den Kalender am Handy. */
function uebersichtZeichnen(ziel, monatWahl) {
  var inhalt = ziel || $("ueb-inhalt");
  inhalt.innerHTML = "";
  var jahre = uebersichtDaten();
  if (!jahre.length) {
    var leer = document.createElement("p");
    leer.className = "pruef-vorwort";
    leer.textContent = "Noch nichts zu zeigen. Trag unter Deine Daten → Ausbildung den Beginn ein " +
      "oder schreib den ersten Tag, dann steht hier jede Woche deiner Ausbildung.";
    inhalt.appendChild(leer);
    return;
  }

  var offen = offeneWochen();
  var kopf = document.createElement("div");
  kopf.className = "ueb-kopf";
  var satz = document.createElement("p");
  if (offen.length) {
    var summe = offen.reduce(function (s, w) {
      s.ohneText += w.bilanz.ohneText; s.ungelesen += w.bilanz.ungelesen; return s;
    }, { ohneText: 0, ungelesen: 0 });
    satz.innerHTML = "Vor dieser Woche noch offen: <b>" + mehrzahl(offen.length, " Woche", " Wochen") +
      "</b> – " + sicher(bilanzText(summe)) + ".";
    kopf.appendChild(satz);
    var hin = document.createElement("button");
    hin.type = "button";
    hin.className = "knopf voll";
    hin.textContent = "Früheste öffnen";
    hin.addEventListener("click", function () {
      $("dlg-uebersicht").close();
      wocheZeigen(offen[0].montag, Math.max(0, offen[0].bilanz.erster));
    });
    kopf.appendChild(hin);
  } else {
    satz.className = "gut";
    satz.textContent = "Bis zu dieser Woche ist alles geschrieben und gegengelesen.";
    kopf.appendChild(satz);
  }
  inhalt.appendChild(kopf);

  var mitBeginn = !!$("f-beginn").value;
  var z = uebersichtZeitraum();
  jahre.forEach(function (j) {
    var teil = document.createElement("section");
    teil.className = "ujahr";
    var kopfzeile = document.createElement("div");
    kopfzeile.className = "ukopf";
    var titel = document.createElement("h3");
    titel.innerHTML = (mitBeginn ? j.jahr + ". Ausbildungsjahr" : "Bisher") +
      " <span>" + dmy(vonIso(j.von)) + " – " + dmy(vonIso(j.bis)) + "</span>";
    kopfzeile.appendChild(titel);
    teil.appendChild(kopfzeile);

    var zahl = { fertig: 0, faellig: 0 };
    j.wochen.forEach(function (w) {
      if (w.zustand !== "kommt") zahl.faellig++;
      if (w.zustand === "fertig") zahl.fertig++;
    });
    var stand = document.createElement("p");
    stand.className = "ustand";
    var kommen = j.wochen.length - zahl.faellig;
    stand.textContent = zahl.faellig
      ? zahl.fertig + " von " + mehrzahl(zahl.faellig, " Woche", " Wochen") + " fertig" +
        (kommen ? ", " + kommen + " kommen noch" : "")
      : kommen ? mehrzahl(kommen, " Woche kommt", " Wochen kommen") + " noch"
      : "Die Wochen zählen zum Jahr davor.";
    if (j.wochen.length) teil.appendChild(jahresRaster(j, z, monatWahl));

    var arten = UEBERSICHT_ARTEN.filter(function (a) { return j.tage[a]; });
    var tageZeile = document.createElement("p");
    tageZeile.className = "utage";
    tageZeile.innerHTML = arten.length
      ? arten.map(function (a) {
          return '<span><b>' + j.tage[a] + "</b> " + sicher(a) + "</span>";
        }).join("")
      : "";
    // Tage und Stand in der Zeile des Titels: So passen drei Jahre ohne Scrollen auf den Schirm.
    kopfzeile.appendChild(tageZeile);
    kopfzeile.appendChild(stand);
    inhalt.appendChild(teil);
  });

  var legende = document.createElement("p");
  legende.className = "ulegende";
  legende.innerHTML = ["fertig", "pruefen", "luecke", "frei", "kommt"].map(function (k) {
    return '<span><i class="utag ' + k + '"></i>' + KAESTCHEN_WORTE[k] + "</span>";
  }).join("") + '<span class="leise">Ein Klick auf einen Tag öffnet ihn' +
    (monatWahl ? ", einer auf den Monat zeigt ihn im Kalender" : "") + ". Tage gezählt bis heute, " +
    "Berufsschule auch laut Schulplan.</span>";
  inhalt.appendChild(legende);
}

$("btn-uebersicht").addEventListener("click", uebersichtOeffnen);
$("ueb-zu").addEventListener("click", function () { $("dlg-uebersicht").close(); });

function uebersichtOeffnen(e) {
  menueSchliessen();
  // Am Handy ist die Übersicht eine Ansicht des Kalenders. Der Klick darf nicht bis zum Dokument
  // steigen, das schlösse den eben geöffneten Kalender wieder (bedienung.js).
  if (kalenderAlsFenster()) {
    if (e && e.stopPropagation) e.stopPropagation();
    wochenwahlOeffnen("ausbildung");
    return;
  }
  wochenwahlSchliessen();
  uebersichtZeichnen();
  $("dlg-uebersicht").showModal();
}
