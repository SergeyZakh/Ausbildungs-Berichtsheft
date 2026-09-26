/* ============================================================
 * Modelllauf über einen oder mehrere Tage
 *
 * Die Tage laufen nacheinander (ein lokales Modell rechnet ohnehin nur
 * eine Anfrage zur Zeit). Der Zustand liegt in kiLauf, nicht im Knopf,
 * der den Lauf gestartet hat: Man darf währenddessen navigieren und
 * schreiben, der Fortschritt steht in einer eigenen Leiste.
 * ========================================================== */

var kiLauf = null;   // { montag, gesamt, fertig, tag, key, begonnen, abbruch, steuerung }
var fortschrittUhr = null;

function kiLaeuft() { return !!kiLauf; }

/** Index des gerade laufenden Tages in der sichtbaren Woche, sonst -1. */
function kiLaufIndex() {
  if (!kiLauf || !kiLauf.key || kiLauf.montag !== aktiveWoche) return -1;
  return Math.round((vonIso(kiLauf.key) - vonIso(aktiveWoche)) / 86400000);
}

/** Fortschrittsleiste: Tag, Stand und verstrichene Sekunden. */
function zeichneFortschritt() {
  var leiste = $("fortschritt");
  if (!leiste) return;
  var slot = document.querySelector("#tagbereich .kislot");
  var hier = !!(kiLauf && slot && (slot.getAttribute("data-key") === kiLauf.key ||
    slot.getAttribute("data-woche") === kiLauf.montag));
  // Steht im Feld noch der Fortschritt eines anderen oder beendeten Laufs,
  // kommt der Knopf zurück – nach dem Lauf nur der Knopf, ohne den
  // Tagbereich neu aufzubauen.
  if (!hier && slot && slot.querySelector(".kistatus")) {
    if (kiLauf) frischauf(true);
    else kiKnopfZurueck(slot);
  }
  if (!kiLauf) {
    leiste.hidden = true;
    clearInterval(fortschrittUhr);
    fortschrittUhr = null;
    return;
  }
  // Oben nur, wenn weder der laufende Tag noch seine Woche offen ist.
  leiste.hidden = hier;
  if (hier) kiStatusImFeld(slot);
  var gesamt = kiLauf.gesamt || 1;

  var sek = kiLauf.begonnen ? Math.round((Date.now() - kiLauf.begonnen) / 1000) : 0;
  $("fuhr").textContent = kiLauf.abbruch ? "" : sek + " s";

  if (kiLauf.abbruch) {
    $("ftext").textContent = "wird abgebrochen …";
  } else {
    $("ftext").innerHTML = '<span class="fpunkt"></span>' +
      "<b>KI kürzt " + sicher(kiLauf.tag) + "</b>" +
      (gesamt > 1
        ? '<span class="fzahl">Tag ' + Math.min(kiLauf.fertig + 1, gesamt) + " von " + gesamt + "</span>"
        : "");
  }

  if (!fortschrittUhr) {
    fortschrittUhr = setInterval(function () {
      if (kiLauf) zeichneFortschritt();
      else { clearInterval(fortschrittUhr); fortschrittUhr = null; }
    }, 1000);
  }
  $("f-abbrechen").disabled = kiLauf.abbruch;
}

/** Der Fortschritt an der Stelle des KI-Knopfs im Feld des laufenden Tages. */
function kiStatusImFeld(slot) {
  var status = slot.querySelector(".kistatus");
  if (!status) {
    slot.innerHTML = '<span class="kistatus" role="status">' +
      '<span class="fpunkt"></span><b></b><span class="ksek"></span>' +
      '<button type="button" class="kiabbruch">Abbrechen</button></span>';
    status = slot.firstChild;
    status.querySelector(".kiabbruch").addEventListener("click", function () { $("f-abbrechen").click(); });
  }
  var sek = kiLauf.begonnen ? Math.round((Date.now() - kiLauf.begonnen) / 1000) : 0;
  var woche = slot.hasAttribute("data-woche") && kiLauf.gesamt > 1;
  status.querySelector("b").textContent = kiLauf.abbruch ? "wird abgebrochen …"
    : woche && kiLauf.tag
      ? "KI kürzt " + kiLauf.tag + " · " + Math.min(kiLauf.fertig + 1, kiLauf.gesamt) + " von " + kiLauf.gesamt
      : "KI kürzt …";
  status.querySelector(".ksek").textContent = kiLauf.abbruch ? "" : sek + " s";
  status.querySelector(".kiabbruch").disabled = kiLauf.abbruch;
}

/* Die KI-Knöpfe, die ein Lauf gesperrt hat, statt den Tagbereich dafür
   neu aufzubauen. */
var kiGesperrt = [];

function kiKnoepfeSperren() {
  kiGesperrt = Array.prototype.filter.call(
    document.querySelectorAll("#tagbereich .kiknopf"), function (k) { return !k.disabled; });
  kiGesperrt.forEach(function (k) { k.disabled = true; });
}

function kiKnoepfeFreigeben() {
  kiGesperrt.forEach(function (k) { if (k.isConnected) k.disabled = false; });
  kiGesperrt = [];
}

/** Im Feld steht wieder der Knopf statt des Fortschritts. */
function kiKnopfZurueck(slot) {
  var key = slot.getAttribute("data-key");
  slot.innerHTML = "";
  if (key) slot.appendChild(kiKnopf(key, tage[key]));
  else if (slot.hasAttribute("data-woche")) wochenKiKnoepfe(slot);
}

/** Neu zeichnen, ohne beim Tippen zu stören: Hat ein Feld im Tagbereich
 *  den Fokus, bleibt der Tagbereich stehen. */
function frischauf(auchTag) {
  zeichneWochenwahl();
  zeichneReiter();
  if (!auchTag) return;
  var a = document.activeElement;
  if (a && $("tagbereich").contains(a) &&
      /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  zeichneTag();
}

function wocheKuerzen(montagIso) {
  return tageKuerzen(kiTageDerWoche(montagIso), montagIso);
}

function tagKuerzen(key, tag, daten, montagIso) {
  return tageKuerzen([{ key: key, tag: tag, daten: daten }], montagIso);
}

async function tageKuerzen(offeneTage, montagIso) {
  if (kiLauf) return;
  if (!offeneTage || !offeneTage.length) return;

  kiLauf = {
    montag: montagIso, gesamt: offeneTage.length, fertig: 0,
    tag: "", key: null, abbruch: false, steuerung: null
  };
  var fehlerhaft = [];
  zeichneFortschritt();
  // Den Tagbereich hier nicht neu aufbauen: Das leert ihn samt Vorschau,
  // und die Seite sieht beim Klick aus, als lade sie neu. Den Fortschritt
  // im Feld setzt zeichneFortschritt(), zu sperren sind nur die KI-Knöpfe.
  frischauf(false);
  kiKnoepfeSperren();

  for (var i = 0; i < offeneTage.length; i++) {
    if (kiLauf.abbruch) break;
    var e = offeneTage[i];
    kiLauf.tag = e.tag;
    kiLauf.key = e.key;
    kiLauf.begonnen = Date.now();
    kiLauf.steuerung = new AbortController();
    zeichneFortschritt();
    zeichneReiter();
    sage(e.tag + " wird gekürzt … (" + (i + 1) + " von " + offeneTage.length + ")");
    try {
      await kiTagKuerzen(e.daten, kiLauf.steuerung.signal);
      kiLauf.fertig++;
      merken();
      // Den Tagbereich nur neu zeichnen, wenn genau dieser Tag sichtbar ist.
      var sichtbar = aktiveWoche === montagIso && aktiverTag < TAGE_JE_WOCHE &&
        iso(plus(vonIso(aktiveWoche), aktiverTag)) === e.key;
      frischauf(sichtbar);
    } catch (fehler) {
      if (kiLauf.abbruch) break;
      fehlerhaft.push(e.tag + ": " + fehler.message);
      break;   // hakt es einmal, hakt es meist weiter
    }
  }

  var abgebrochen = kiLauf.abbruch, fertig = kiLauf.fertig;
  kiLauf = null;
  zeichneFortschritt();
  merkenJetzt();
  // Neu aufbauen nur, wenn sich Text geändert hat; nach Abbruch oder
  // Fehler ohne Ergebnis reicht es, die Knöpfe freizugeben.
  kiKnoepfeFreigeben();
  frischauf(fertig > 0);

  var meldung = fertig + (fertig === 1 ? " Tag gekürzt" : " Tage gekürzt");
  if (abgebrochen && !fertig) {
    sage("Abgebrochen. Es wurde nichts verändert.");
  } else if (abgebrochen) {
    sage(meldung + ", dann abgebrochen. Die übrigen Tage sind unverändert.");
  } else if (fehlerhaft.length) {
    sage(offeneTage.length === 1
      ? fehlerhaft[0].replace(/^[^:]+: /, "")
      : meldung + ". Abgebrochen bei " + fehlerhaft[0], "warn");
  } else {
    sage(meldung + ". Die Texte bleiben Entwürfe — lies sie gegen.", "gut");
  }
}

$("f-abbrechen").addEventListener("click", function () {
  if (!kiLauf) return;
  kiLauf.abbruch = true;
  if (kiLauf.steuerung) kiLauf.steuerung.abort();
  zeichneFortschritt();
  sage("Lauf wird abgebrochen …");
});
