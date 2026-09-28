/* ============================================================
 * Hell oder dunkel: der Knopf in der Kopfleiste
 *
 * Ohne Wahl folgt die Seite dem Gerät (prefers-color-scheme in basis.css). Ein Klick legt das
 * Gegenteil fest. Wer zurückschaltet und damit wieder beim Gerät landet, hat keine Wahl mehr
 * gespeichert: Stellt das Gerät abends auf dunkel um, zieht die Seite dann wieder mit. Gelesen wird
 * die Wahl schon im Kopf von index.html, damit die Seite nicht erst hell erscheint und umspringt.
 * Sie gehört zum Browser, nicht zum Heft, und steht deshalb nicht in berichtsheft-v1.
 * ========================================================== */

var FARBE = "berichtsheft-farbe";

function geraetDunkel() {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch (e) { return false; }
}

function dunkelAktiv() {
  var gewaehlt = document.documentElement.getAttribute("data-farbe");
  return gewaehlt ? gewaehlt === "dunkel" : geraetDunkel();
}

function farbknopfZeigen() {
  var knopf = $("btn-farbe"), dunkel = dunkelAktiv();
  knopf.setAttribute("aria-pressed", String(dunkel));
  knopf.title = dunkel ? "Hell anzeigen" : "Dunkel anzeigen";
}

$("btn-farbe").addEventListener("click", function () {
  var neu = dunkelAktiv() ? "hell" : "dunkel";
  var wieGeraet = (neu === "dunkel") === geraetDunkel();
  if (wieGeraet) document.documentElement.removeAttribute("data-farbe");
  else document.documentElement.setAttribute("data-farbe", neu);
  try {
    if (wieGeraet) localStorage.removeItem(FARBE);
    else localStorage.setItem(FARBE, neu);
  } catch (e) { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
  farbknopfZeigen();
});

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", farbknopfZeigen);
} catch (e) { /* ältere Browser: der Knopf stimmt dann nach dem Neuladen */ }
farbknopfZeigen();
