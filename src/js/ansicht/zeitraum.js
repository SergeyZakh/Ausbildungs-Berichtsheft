/* ============================================================
 * Blockunterricht und Schulferien: Zeiträume als Marken, gewählt im Kalender
 *
 * Gespeichert wird weiter der Text in f-schulbloecke und f-schulferien
 * ("02.03.2026–20.03.2026; 05.10.2026"), wie ihn schulbloeckeLesen() liest: Ältere Stände,
 * Sicherungen und das Konto kennen nur ihn. Getippt wird er nicht mehr. Im Reiter „Schule“
 * stehen die Zeiträume als Marken mit ×, „Im Kalender wählen“ öffnet ein Monatsraster: erster
 * Tag, letzter Tag, der Zeitraum steht. Mit getippten Daten verrutschte leicht ein Monat.
 * ========================================================== */

var ZEITRAUM_ARTEN = {
  "f-schulbloecke": {
    liste: "schulbloecke-liste", stand: "schulbloecke-stand", titel: "Blockunterricht",
    name: "Blockunterricht", anders: "f-schulferien", andersName: "Schulferien",
    leer: "Noch kein Block. Jeder Werktag darin gilt als Schultag."
  },
  "f-schulferien": {
    liste: "schulferien-liste", stand: "schulferien-stand", titel: "Schulferien",
    name: "Schulferien", anders: "f-schulbloecke", andersName: "Blockunterricht",
    leer: "Keine Ferien eingetragen. Darin entfallen die festen Schultage."
  }
};

/** "02.03.–20.03.2026"; über den Jahreswechsel mit beiden Jahren, ein einzelner Tag als "05.10.2026". */
function zeitraumText(b) {
  var von = vonIso(b.von), bis = vonIso(b.bis);
  if (b.von === b.bis) return dmy(von);
  return (von.getFullYear() === bis.getFullYear() ? dm(von) : dmy(von)) + "–" + dmy(bis);
}

/** Werktage im Zeitraum ohne gesetzliche Feiertage: so viele Schultage bringt ein Block. */
function werktageIn(von, bis) {
  var n = 0, land = $("f-land").value;
  for (var d = vonIso(von); iso(d) <= bis; d = plus(d, 1)) {
    if (tagIndex(d) < 5 && !feiertagAn(iso(d), land)) n++;
  }
  return n;
}

/** "Mo, 02.03.2026" */
function tagMitName(datumIso) {
  var d = vonIso(datumIso);
  return KURZ[d.getDay()] + ", " + dmy(d);
}

/** Sortieren und zusammenlegen, was sich überschneidet oder lückenlos anschließt. */
function zeitraeumeOrdnen(bloecke) {
  var out = [];
  bloecke.slice().sort(function (a, b) { return a.von < b.von ? -1 : a.von > b.von ? 1 : 0; })
    .forEach(function (b) {
      var letzter = out[out.length - 1];
      if (letzter && b.von <= iso(plus(vonIso(letzter.bis), 1))) {
        if (b.bis > letzter.bis) letzter.bis = b.bis;
      } else out.push({ von: b.von, bis: b.bis });
    });
  return out;
}

/** Zeiträume zurück ins Feld; Unlesbares aus älteren Ständen bleibt, bis es entfernt wird. */
function zeitraeumeSchreiben(feldId, bloecke, unklar) {
  var feld = $(feldId);
  feld.value = zeitraeumeOrdnen(bloecke).map(function (b) {
    return b.von === b.bis ? dmy(vonIso(b.von)) : dmy(vonIso(b.von)) + "–" + dmy(vonIso(b.bis));
  }).concat(unklar || []).join("; ");
  // Wie eine Eingabe: Die Listener in stammdaten.js speichern und zeigen den neuen Stand.
  feld.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Eine Marke mit ×; `zusatz` steht leiser dahinter (Werktage). */
function zeitraumMarke(text, klasse, weg, zusatz) {
  var marke = document.createElement("span");
  marke.className = "zchip" + (klasse ? " " + klasse : "");
  marke.appendChild(document.createTextNode(text));
  if (zusatz) {
    var z = document.createElement("span");
    z.className = "zzusatz";
    z.textContent = zusatz;
    marke.appendChild(z);
  }
  var x = document.createElement("button");
  x.type = "button";
  x.textContent = "×";
  x.setAttribute("aria-label", text + " entfernen");
  x.addEventListener("click", weg);
  marke.appendChild(x);
  return marke;
}

/**
 * Die Marken eines Felds in `ziel`, dahinter auf Wunsch der Knopf zum Kalender. Im Kalender
 * (imKalender) zeigt eine Marke beim Überfahren ihren Zeitraum und blättert beim Antippen dorthin.
 */
function zeitraumListe(ziel, feldId, mitKnopf, imKalender) {
  var gelesen = schulbloeckeLesen($(feldId).value);
  ziel.innerHTML = "";
  zeitraeumeOrdnen(gelesen.bloecke).forEach(function (b) {
    var marke = zeitraumMarke(zeitraumText(b), "", function (e) {
      e.stopPropagation();
      var jetzt = schulbloeckeLesen($(feldId).value);
      zeitraeumeSchreiben(feldId, zeitraeumeOrdnen(jetzt.bloecke).filter(function (x) {
        return x.von !== b.von || x.bis !== b.bis;
      }), jetzt.unklar);
      if ($("dlg-zeitraum").open) {
        zeitraumZeichnen();
        zeitraumSagen(zeitraumText(b) + " entfernt.");
      }
    }, werktageText(b.von, b.bis));
    if (imKalender) {
      marke.title = "Im Kalender zeigen";
      marke.addEventListener("mouseenter", function () { zeitraumMarkieren(b); });
      marke.addEventListener("mouseleave", function () { zeitraumMarkieren(null); });
      marke.addEventListener("click", function () {
        var d = vonIso(b.von);
        zeitraum.monat = new Date(d.getFullYear(), d.getMonth(), 1);
        zeitraumZeichnen();
        zeitraumMarkieren(b);
      });
    }
    ziel.appendChild(marke);
  });
  gelesen.unklar.forEach(function (teil) {
    ziel.appendChild(zeitraumMarke(teil, "unklar", function (e) {
      e.stopPropagation();
      var jetzt = schulbloeckeLesen($(feldId).value);
      zeitraeumeSchreiben(feldId, jetzt.bloecke, jetzt.unklar.filter(function (u) { return u !== teil; }));
      if ($("dlg-zeitraum").open) zeitraumZeichnen();
    }, "nicht lesbar"));
  });
  if (!mitKnopf) return;
  var knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "knopf zwahl";
  knopf.textContent = "+ Im Kalender wählen";
  knopf.addEventListener("click", function () { zeitraumOeffnen(feldId); });
  ziel.appendChild(knopf);
}

/** Marken und Hinweis beider Felder im Reiter „Schule“. */
function zeitraeumeZeigen() {
  Object.keys(ZEITRAUM_ARTEN).forEach(function (feldId) {
    var art = ZEITRAUM_ARTEN[feldId], stand = $(art.stand);
    var gelesen = schulbloeckeLesen($(feldId).value);
    zeitraumListe($(art.liste), feldId, true, false);
    stand.className = gelesen.unklar.length ? "fehlt" : "";
    stand.textContent = gelesen.unklar.length
      ? "Nicht lesbar, rot markiert. Mit × entfernen und im Kalender neu wählen."
      : gelesen.bloecke.length ? "" : art.leer;
    stand.hidden = !stand.textContent;
  });
}

/* ---------- Der Kalender ----------
   Zwei Schritte, oben sichtbar: erster Tag, letzter Tag. Ein Zeitraum ist ein helles Band mit
   dunklen Kreisen an Anfang und Ende; der Zeitraum der anderen Art (Ferien beim Blockunterricht
   und umgekehrt) steht schraffiert zur Orientierung, Feiertage tragen einen Punkt. */

/* Welches Feld gerade gewählt wird, der schon angetippte erste Tag, der Tag unter der Maus und der
   erste gezeigte Monat. */
var zeitraum = { feld: null, anfang: null, zeiger: null, monat: null };

function zeitraumOeffnen(feldId) {
  zeitraum.feld = feldId;
  zeitraum.anfang = null;
  zeitraum.zeiger = null;
  // Anfangen beim ersten eingetragenen Zeitraum, der noch kommt, sonst bei heute; beides
  // innerhalb der Ausbildung.
  var heute = iso(new Date()), bezug = heute;
  var kommend = zeitraeumeOrdnen(schulbloeckeLesen($(feldId).value).bloecke)
    .filter(function (b) { return b.bis >= heute; })[0];
  if (kommend) bezug = kommend.von < heute ? heute : kommend.von;
  var beginn = $("f-beginn").value, ende = $("f-ende").value;
  if (beginn && bezug < beginn) bezug = beginn;
  if (ende && bezug > ende) bezug = ende;
  var d = vonIso(bezug);
  zeitraum.monat = new Date(d.getFullYear(), d.getMonth(), 1);
  var art = ZEITRAUM_ARTEN[feldId];
  $("zr-titel").textContent = art.titel;
  $("zr-legende").innerHTML =
    '<span><i class="zl-band"></i>' + art.name + "</span>" +
    '<span><i class="zl-anders"></i>' + art.andersName + "</span>" +
    '<span><i class="zl-feiertag"></i>Feiertag</span>' +
    '<span><i class="zl-heute"></i>Heute</span>';
  zeitraumSagen("Für einen einzelnen Tag denselben Tag zweimal antippen.");
  zeitraumZeichnen();
  $("dlg-zeitraum").showModal();
}

/** Kurze Rückmeldung unten im Kalender, auch für Vorleser. */
function zeitraumSagen(text) { $("zr-hilfe").textContent = text; }

function imZeitraum(liste, datum) {
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].von <= datum && datum <= liste[i].bis) return liste[i];
  }
  return null;
}

/** Oben die zwei Schritte: was gewählt ist und was noch fehlt. */
function zeitraumSchritteZeigen() {
  var a = zeitraum.anfang, z = zeitraum.zeiger;
  $("zr-von").textContent = a ? tagMitName(a) : "–";
  // Mit der Maus zeigt der letzte Tag schon, worauf sie steht; am Handy bleibt er leer bis zum Tippen.
  if (a && z && z !== a) {
    $("zr-bis").textContent = tagMitName(z);
    $("zr-tage").textContent = werktageText(a < z ? a : z, a < z ? z : a);
  } else {
    $("zr-bis").textContent = "–";
    $("zr-tage").textContent = "";
  }
  $("zr-schritt-von").classList.toggle("aktiv", !a);
  $("zr-schritt-bis").classList.toggle("aktiv", !!a);
  // Unsichtbar statt entfernt: Sonst verschob sich die Zeile, sobald der erste Tag stand.
  $("zr-neu").style.visibility = a ? "visible" : "hidden";
}

/** "8 Werktage"; ohne Werktag (nur Wochenende) nichts. */
function werktageText(von, bis) {
  var n = werktageIn(von, bis);
  return n ? mehrzahl(n, " Werktag", " Werktage") : "";
}

/** Zwei Monate nebeneinander, am Handy einer (handy.css). */
function zeitraumZeichnen() {
  if (!zeitraum.feld) return;
  var raster = $("zr-raster");
  raster.innerHTML = "";
  var eigene = zeitraeumeOrdnen(schulbloeckeLesen($(zeitraum.feld).value).bloecke);
  var andere = zeitraeumeOrdnen(schulbloeckeLesen($(ZEITRAUM_ARTEN[zeitraum.feld].anders).value).bloecke);
  for (var n = 0; n < 2; n++) {
    var erster = new Date(zeitraum.monat.getFullYear(), zeitraum.monat.getMonth() + n, 1);
    raster.appendChild(zeitraumMonat(erster, eigene, andere));
  }
  zeitraumListe($("zr-liste"), zeitraum.feld, false, true);
  $("zr-liste-titel").textContent = eigene.length ? "Eingetragen" : "Noch nichts eingetragen";
  zeitraumSchritteZeigen();
  zeitraumVorschau();
}

function zeitraumMonat(erster, eigene, andere) {
  var blatt = document.createElement("div");
  blatt.className = "zr-monat";
  var name = document.createElement("div");
  name.className = "zr-monatsname";
  name.textContent = MONATE[erster.getMonth()] + " " + erster.getFullYear();
  blatt.appendChild(name);

  var gitter = document.createElement("div");
  gitter.className = "zr-tage";
  ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].forEach(function (k) {
    var s = document.createElement("span");
    s.className = "zr-wt";
    s.textContent = k;
    gitter.appendChild(s);
  });
  for (var leer = 0; leer < tagIndex(erster); leer++) gitter.appendChild(document.createElement("span"));

  var land = $("f-land").value, heute = iso(new Date());
  for (var d = new Date(erster); d.getMonth() === erster.getMonth(); d = plus(d, 1)) {
    var k = iso(d), b = imZeitraum(eigene, k), spalte = tagIndex(d);
    var feiertag = feiertagAn(k, land);
    var klassen = ["zr-tag"];
    if (spalte > 4) klassen.push("we");
    if (feiertag) klassen.push("ft");
    // Das Band endet sichtbar am Zeilenrand und am Monatsende, statt ins Leere zu laufen.
    if (spalte === 0 || d.getDate() === 1) klassen.push("zeilenanfang");
    if (spalte === 6 || plus(d, 1).getMonth() !== d.getMonth()) klassen.push("zeilenende");
    if (b) klassen.push("drin");
    if (b && b.von === k) klassen.push("anfang");
    if (b && b.bis === k) klassen.push("ende");
    if (!b && imZeitraum(andere, k)) klassen.push("anders");
    if (zeitraum.anfang === k) klassen.push("start");
    if (k === heute) klassen.push("heute");

    var t = document.createElement("button");
    t.type = "button";
    t.className = klassen.join(" ");
    t.setAttribute("data-datum", k);
    t.setAttribute("aria-label", WOCHENTAGE[d.getDay()] + ", " + dmy(d) + (feiertag ? ", Feiertag" : "") +
      (b ? ", eingetragen" : ""));
    t.setAttribute("aria-pressed", String(!!b));
    if (feiertag) t.title = "Feiertag";
    var zahl = document.createElement("span");
    zahl.textContent = d.getDate();
    t.appendChild(zahl);
    t.addEventListener("click", zeitraumTag);
    t.addEventListener("mouseenter", function (e) {
      zeitraum.zeiger = e.currentTarget.getAttribute("data-datum");
      zeitraumVorschau();
      zeitraumSchritteZeigen();
    });
    gitter.appendChild(t);
  }
  blatt.appendChild(gitter);
  return blatt;
}

/** Erster Tipp merkt den Anfang, der zweite trägt den Zeitraum ein – in beliebiger Richtung. */
function zeitraumTag(e) {
  var datum = e.currentTarget.getAttribute("data-datum");
  if (!zeitraum.anfang) {
    zeitraum.anfang = datum;
    zeitraum.zeiger = datum;
    zeitraumZeichnen();
    zeitraumSagen("Jetzt den letzten Tag antippen.");
    return;
  }
  var von = zeitraum.anfang < datum ? zeitraum.anfang : datum;
  var bis = zeitraum.anfang < datum ? datum : zeitraum.anfang;
  zeitraum.anfang = null;
  zeitraum.zeiger = null;
  var gelesen = schulbloeckeLesen($(zeitraum.feld).value);
  zeitraeumeSchreiben(zeitraum.feld, gelesen.bloecke.concat([{ von: von, bis: bis }]), gelesen.unklar);
  zeitraumZeichnen();
  var tage = werktageText(von, bis);
  zeitraumSagen("Eingetragen: " + zeitraumText({ von: von, bis: bis }) + (tage ? ", " + tage : "") + ".");
}

/** Zwischen Anfang und Zeiger den Zeitraum andeuten, bevor er eingetragen ist. */
function zeitraumVorschau() {
  var a = zeitraum.anfang, z = zeitraum.zeiger;
  var von = a && z ? (a < z ? a : z) : null, bis = a && z ? (a < z ? z : a) : null;
  Array.prototype.forEach.call($("zr-raster").querySelectorAll(".zr-tag"), function (t) {
    var x = t.getAttribute("data-datum");
    var drin = !!von && von <= x && x <= bis;
    t.classList.toggle("vorschau", drin);
    t.classList.toggle("vanfang", drin && x === von);
    t.classList.toggle("vende", drin && x === bis);
  });
}

/** Die Tage eines eingetragenen Zeitraums hervorheben (Marke überfahren), null hebt auf. */
function zeitraumMarkieren(b) {
  Array.prototype.forEach.call($("zr-raster").querySelectorAll(".zr-tag"), function (t) {
    var x = t.getAttribute("data-datum");
    t.classList.toggle("markiert", !!b && b.von <= x && x <= b.bis);
  });
}

function zeitraumBlaettern(schritt) {
  zeitraum.monat = new Date(zeitraum.monat.getFullYear(), zeitraum.monat.getMonth() + schritt, 1);
  zeitraumZeichnen();
}

$("zr-zurueck").addEventListener("click", function () { zeitraumBlaettern(-1); });
$("zr-vor").addEventListener("click", function () { zeitraumBlaettern(1); });
$("zr-neu").addEventListener("click", function () {
  zeitraum.anfang = null;
  zeitraum.zeiger = null;
  zeitraumZeichnen();
  zeitraumSagen("Neu: den ersten Tag antippen.");
});
$("zr-raster").addEventListener("mouseleave", function () {
  zeitraum.zeiger = zeitraum.anfang;
  zeitraumVorschau();
  zeitraumSchritteZeigen();
});
$("zr-fertig").addEventListener("click", function () { $("dlg-zeitraum").close(); });
$("dlg-zeitraum").addEventListener("close", function () {
  zeitraum.anfang = null;
  zeitraum.zeiger = null;
  zeitraumZeichnen();
  zeitraeumeZeigen();
});
