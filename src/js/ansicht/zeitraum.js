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
    liste: "schulbloecke-liste", stand: "schulbloecke-stand", titel: "Blockunterricht wählen",
    anders: "f-schulferien", leer: "Noch kein Block. Jeder Werktag darin gilt als Schultag."
  },
  "f-schulferien": {
    liste: "schulferien-liste", stand: "schulferien-stand", titel: "Schulferien wählen",
    anders: "f-schulbloecke", leer: "Keine Ferien eingetragen. Darin entfallen die festen Schultage."
  }
};

/** "02.03.–20.03.2026"; über den Jahreswechsel mit beiden Jahren, ein einzelner Tag als "05.10.2026". */
function zeitraumText(b) {
  var von = vonIso(b.von), bis = vonIso(b.bis);
  if (b.von === b.bis) return dmy(von);
  return (von.getFullYear() === bis.getFullYear() ? dm(von) : dmy(von)) + "–" + dmy(bis);
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

/** Eine Marke mit ×. */
function zeitraumMarke(text, klasse, weg) {
  var marke = document.createElement("span");
  marke.className = "zchip" + (klasse ? " " + klasse : "");
  marke.appendChild(document.createTextNode(text));
  var x = document.createElement("button");
  x.type = "button";
  x.textContent = "×";
  x.setAttribute("aria-label", text + " entfernen");
  x.addEventListener("click", weg);
  marke.appendChild(x);
  return marke;
}

/** Die Marken eines Felds in `ziel`, dahinter auf Wunsch der Knopf zum Kalender. */
function zeitraumListe(ziel, feldId, mitKnopf) {
  var gelesen = schulbloeckeLesen($(feldId).value);
  ziel.innerHTML = "";
  zeitraeumeOrdnen(gelesen.bloecke).forEach(function (b) {
    ziel.appendChild(zeitraumMarke(zeitraumText(b), "", function () {
      var jetzt = schulbloeckeLesen($(feldId).value);
      zeitraeumeSchreiben(feldId, zeitraeumeOrdnen(jetzt.bloecke).filter(function (x) {
        return x.von !== b.von || x.bis !== b.bis;
      }), jetzt.unklar);
      if ($("dlg-zeitraum").open) zeitraumZeichnen();
    }));
  });
  gelesen.unklar.forEach(function (teil) {
    ziel.appendChild(zeitraumMarke(teil, "unklar", function () {
      var jetzt = schulbloeckeLesen($(feldId).value);
      zeitraeumeSchreiben(feldId, jetzt.bloecke, jetzt.unklar.filter(function (u) { return u !== teil; }));
      if ($("dlg-zeitraum").open) zeitraumZeichnen();
    }));
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
    zeitraumListe($(art.liste), feldId, true);
    stand.className = gelesen.unklar.length ? "fehlt" : "";
    stand.textContent = gelesen.unklar.length
      ? "Nicht lesbar, rot markiert. Mit × entfernen und im Kalender neu wählen."
      : gelesen.bloecke.length ? "" : art.leer;
    stand.hidden = !stand.textContent;
  });
}

/* ---------- Der Kalender ---------- */

/* Welches Feld gerade gewählt wird, der schon angetippte erste Tag und der erste gezeigte Monat. */
var zeitraum = { feld: null, anfang: null, monat: null };

function zeitraumOeffnen(feldId) {
  zeitraum.feld = feldId;
  zeitraum.anfang = null;
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
  $("zr-titel").textContent = ZEITRAUM_ARTEN[feldId].titel;
  zeitraumZeichnen();
  $("dlg-zeitraum").showModal();
}

function imZeitraum(liste, datum) {
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].von <= datum && datum <= liste[i].bis) return liste[i];
  }
  return null;
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
  zeitraumListe($("zr-liste"), zeitraum.feld, false);
  $("zr-hilfe").textContent = zeitraum.anfang
    ? "Ab " + dmy(vonIso(zeitraum.anfang)) + ": jetzt den letzten Tag antippen (für einen einzelnen Tag denselben)."
    : "Den ersten Tag antippen, dann den letzten.";
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
    var k = iso(d), b = imZeitraum(eigene, k);
    var klassen = ["zr-tag"];
    if (tagIndex(d) > 4) klassen.push("we");
    var feiertag = !!feiertagAn(k, land);
    if (feiertag) klassen.push("ft");
    if (b) klassen.push("drin");
    if (b && b.von === k) klassen.push("anfang");
    if (b && b.bis === k) klassen.push("ende");
    if (!b && imZeitraum(andere, k)) klassen.push("anders");
    if (zeitraum.anfang === k) klassen.push("start");
    if (k === heute) klassen.push("heute");

    var t = document.createElement("button");
    t.type = "button";
    t.className = klassen.join(" ");
    t.textContent = d.getDate();
    t.setAttribute("data-datum", k);
    t.setAttribute("aria-label", WOCHENTAGE[d.getDay()] + ", " + dmy(d) + (feiertag ? ", Feiertag" : "") +
      (b ? ", eingetragen" : ""));
    t.setAttribute("aria-pressed", String(!!b));
    t.addEventListener("click", zeitraumTag);
    t.addEventListener("mouseenter", zeitraumVorschau);
    gitter.appendChild(t);
  }
  blatt.appendChild(gitter);
  return blatt;
}

/** Erster Klick merkt den Anfang, der zweite trägt den Zeitraum ein – in beliebiger Richtung. */
function zeitraumTag(e) {
  var datum = e.currentTarget.getAttribute("data-datum");
  if (!zeitraum.anfang) {
    zeitraum.anfang = datum;
    zeitraumZeichnen();
    return;
  }
  var von = zeitraum.anfang < datum ? zeitraum.anfang : datum;
  var bis = zeitraum.anfang < datum ? datum : zeitraum.anfang;
  zeitraum.anfang = null;
  var gelesen = schulbloeckeLesen($(zeitraum.feld).value);
  zeitraeumeSchreiben(zeitraum.feld, gelesen.bloecke.concat([{ von: von, bis: bis }]), gelesen.unklar);
  zeitraumZeichnen();
}

/** Mit der Maus: zwischen Anfang und Zeiger den Zeitraum andeuten, bevor er eingetragen ist. */
function zeitraumVorschau(e) {
  var a = zeitraum.anfang, bis = e.currentTarget.getAttribute("data-datum");
  Array.prototype.forEach.call($("zr-raster").querySelectorAll(".zr-tag"), function (t) {
    var x = t.getAttribute("data-datum");
    t.classList.toggle("vorschau", !!a && ((a <= x && x <= bis) || (bis <= x && x <= a)));
  });
}

function zeitraumBlaettern(schritt) {
  zeitraum.monat = new Date(zeitraum.monat.getFullYear(), zeitraum.monat.getMonth() + schritt, 1);
  zeitraumZeichnen();
}

$("zr-zurueck").addEventListener("click", function () { zeitraumBlaettern(-1); });
$("zr-vor").addEventListener("click", function () { zeitraumBlaettern(1); });
$("zr-fertig").addEventListener("click", function () { $("dlg-zeitraum").close(); });
$("dlg-zeitraum").addEventListener("close", function () {
  zeitraum.anfang = null;
  zeitraumZeichnen();
  zeitraeumeZeigen();
});
