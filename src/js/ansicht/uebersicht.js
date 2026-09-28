/* ============================================================
 * Übersicht: jede Woche der Ausbildung als Kästchen, je Ausbildungsjahr,
 * dazu die Tage in der Berufsschule, im Urlaub und krank
 *
 * Die Farben sind dieselben wie in den Reitern und im Monatsraster: grün fertig, rot ungelesen.
 * Ein Klick auf ein Kästchen öffnet die Woche.
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
  frei: "nichts nötig", kommt: "kommt noch"
};

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

function uebersichtZeichnen() {
  var inhalt = $("ueb-inhalt");
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
  jahre.forEach(function (j) {
    var teil = document.createElement("section");
    teil.className = "ujahr";
    var titel = document.createElement("h3");
    titel.innerHTML = (mitBeginn ? j.jahr + ". Ausbildungsjahr" : "Bisher") +
      " <span>" + dmy(vonIso(j.von)) + " – " + dmy(vonIso(j.bis)) + "</span>";
    teil.appendChild(titel);

    var zahl = { fertig: 0, faellig: 0 };
    var raster = document.createElement("div");
    raster.className = "uraster";
    j.wochen.forEach(function (w) {
      var montag = vonIso(w.montag);
      if (w.zustand !== "kommt") zahl.faellig++;
      if (w.zustand === "fertig") zahl.fertig++;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ukw " + w.zustand;
      b.textContent = kalenderwoche(montag);
      b.title = "KW " + kalenderwoche(montag) + " · " + langSpanne(montag) + " · " + KAESTCHEN_WORTE[w.zustand];
      b.setAttribute("aria-label", b.title);
      if (w.montag === aktiveWoche) b.setAttribute("aria-current", "true");
      b.addEventListener("click", function () {
        $("dlg-uebersicht").close();
        wocheZeigen(w.montag);
      });
      raster.appendChild(b);
    });
    var stand = document.createElement("p");
    stand.className = "ustand";
    var kommen = j.wochen.length - zahl.faellig;
    stand.textContent = zahl.faellig
      ? zahl.fertig + " von " + mehrzahl(zahl.faellig, " Woche", " Wochen") + " fertig" +
        (kommen ? ", " + kommen + " kommen noch" : "")
      : kommen ? mehrzahl(kommen, " Woche kommt", " Wochen kommen") + " noch"
      : "Die Wochen zählen zum Jahr davor.";
    teil.appendChild(stand);
    if (j.wochen.length) teil.appendChild(raster);

    var arten = UEBERSICHT_ARTEN.filter(function (a) { return j.tage[a]; });
    var tageZeile = document.createElement("p");
    tageZeile.className = "utage";
    tageZeile.innerHTML = arten.length
      ? arten.map(function (a) {
          return '<span><b>' + j.tage[a] + "</b> " + sicher(a) + "</span>";
        }).join("")
      : '<span class="leise">Noch keine Schul-, Urlaubs- oder Krankheitstage.</span>';
    teil.appendChild(tageZeile);
    inhalt.appendChild(teil);
  });

  var legende = document.createElement("p");
  legende.className = "ulegende";
  legende.innerHTML = ["fertig", "pruefen", "luecke", "frei", "kommt"].map(function (k) {
    return '<span><i class="ukw ' + k + '"></i>' + KAESTCHEN_WORTE[k] + "</span>";
  }).join("") + '<span class="leise">Tage gezählt bis heute, Berufsschule auch laut Schulplan.</span>';
  inhalt.appendChild(legende);
}

$("btn-uebersicht").addEventListener("click", uebersichtOeffnen);
$("ueb-zu").addEventListener("click", function () { $("dlg-uebersicht").close(); });

function uebersichtOeffnen() {
  menueSchliessen();
  wochenwahlSchliessen();
  uebersichtZeichnen();
  $("dlg-uebersicht").showModal();
}
