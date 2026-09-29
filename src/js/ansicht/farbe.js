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

/** Die Wahl setzen und merken. */
function farbeSetzen(neu) {
  var wieGeraet = (neu === "dunkel") === geraetDunkel();
  if (wieGeraet) document.documentElement.removeAttribute("data-farbe");
  else document.documentElement.setAttribute("data-farbe", neu);
  try {
    if (wieGeraet) localStorage.removeItem(FARBE);
    else localStorage.setItem(FARBE, neu);
  } catch (e) { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
  farbknopfZeigen();
}

/**
 * Umschalten ohne die Übergänge einzelner Elemente. Knöpfe und Felder blenden ihre Farbe sonst über
 * 0,15 s über, Text und Kanten springen sofort: Beim Wechsel flackerte die Seite stückweise. So
 * springt alles zugleich, und die Kreisblende darüber (unten) macht daraus einen Übergang.
 */
function farbeOhneUebergaenge(neu) {
  var html = document.documentElement;
  html.classList.add("farbwechsel");
  farbeSetzen(neu);
  void getComputedStyle(document.body).backgroundColor;   // neue Farben jetzt berechnen
  requestAnimationFrame(function () { html.classList.remove("farbwechsel"); });
}

/* Die neue Farbe breitet sich als Kreis vom Knopf aus (View Transitions). Ohne diese Schnittstelle
   (ältere Browser) oder mit „Bewegung reduzieren“ wechselt die Seite in einem Schritt. */
var FARBWECHSEL_MS = 480;

$("btn-farbe").addEventListener("click", function () {
  var neu = dunkelAktiv() ? "hell" : "dunkel";
  var ruhig = false;
  try { ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  if (ruhig || typeof document.startViewTransition !== "function") {
    farbeOhneUebergaenge(neu);
    return;
  }
  var r = this.getBoundingClientRect();
  var x = r.left + r.width / 2, y = r.top + r.height / 2;
  var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  var wechsel = document.startViewTransition(function () { farbeOhneUebergaenge(neu); });
  wechsel.ready.then(function () {
    document.documentElement.animate(
      { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + radius + "px at " + x + "px " + y + "px)"] },
      { duration: FARBWECHSEL_MS, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" });
  }).catch(function () { /* abgebrochen: die neue Farbe steht trotzdem */ });
});

try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", farbknopfZeigen);
} catch (e) { /* ältere Browser: der Knopf stimmt dann nach dem Neuladen */ }
farbknopfZeigen();
