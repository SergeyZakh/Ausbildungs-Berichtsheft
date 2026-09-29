/* ============================================================
 * Menüs und Tastatur
 * ========================================================== */

var MENUES = [["btn-export", "menue-export"], ["btn-mehr", "menue-mehr"]];

function menueSchliessen() {
  MENUES.forEach(function (m) {
    $(m[1]).hidden = true;
    $(m[0]).setAttribute("aria-expanded", "false");
  });
}

MENUES.forEach(function (m) {
  $(m[0]).addEventListener("click", function (e) {
    e.stopPropagation();
    var offen = !$(m[1]).hidden;
    menueSchliessen();
    wochenwahlSchliessen();
    if (offen) return;
    $(m[1]).hidden = false;
    $(m[0]).setAttribute("aria-expanded", "true");
  });
  $(m[1]).addEventListener("click", function () { menueSchliessen(); });
});

/* Das × im Kopf eines Fensters schließt es wie Escape. Was ein Fenster dabei tun muss (Antwort
   „nein“, Kalender übernehmen), hängt an seinem close-Ereignis. */
document.querySelectorAll("dialog .dlg-x").forEach(function (x) {
  x.addEventListener("click", function () { x.closest("dialog").close(); });
});

// Ein Klick daneben schließt, was offen ist.
document.addEventListener("click", function () {
  menueSchliessen();
  if (wochenwahlOffen()) wochenwahlSchliessen();
});

/* Tastatur:
     Escape         Menü und Wochenwahl schließen
     Strg/Cmd+S     Wochenblatt speichern
     Alt+← / Alt+→  ältere / neuere Woche (auch aus dem Textfeld)
     1–7            Tag wählen, 8 oder W: Wochenreiter (nicht beim Tippen) */
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    menueSchliessen();
    if (wochenwahlOffen()) wochenwahlSchliessen();
    return;
  }
  var imFeld = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || "").toUpperCase());

  // Hinter einem Dialog oder dem Rundgang wirkt nichts.
  if (document.querySelector("dialog[open]") || !$("onboarding").hidden) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) e.preventDefault();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
    wochenblattSpeichern();
    return;
  }
  if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    wocheWechseln(e.key === "ArrowLeft" ? 1 : -1);
    return;
  }
  if (imFeld || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key >= "1" && e.key <= "7") {
    if (!aktiveWoche) return;
    e.preventDefault();
    aktiverTag = +e.key - 1;
    zeichneReiter(); zeichneTag();
  } else if (e.key === "8" || e.key === "w" || e.key === "W") {
    if (!aktiveWoche) return;
    e.preventDefault();
    aktiverTag = 7;
    zeichneReiter(); zeichneTag();
  }
});
