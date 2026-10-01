/* ============================================================
 * Zen-Modus: nur der Arbeitsbereich
 *
 * Der Knopf neben hell/dunkel blendet Kopfleiste, Reiter, Buchungen, Hinweise und Fußleiste aus.
 * Am Tag bleibt die Textkarte mit „Fertig“, in der Woche das Blatt. Die Tasten 1–8 und Alt+←/→
 * wirken weiter (bedienung.js); derselbe Knopf oder Esc beendet ihn. Gemerkt wird er nicht: Wer
 * die Seite öffnet, will erst sehen, wo er steht.
 * ========================================================== */

function zenAn() { return document.body.classList.contains("zen"); }

function zenSetzen(an) {
  document.body.classList.toggle("zen", !!an);
  var knopf = $("btn-zen");
  knopf.setAttribute("aria-pressed", String(!!an));
  knopf.title = an ? "Zen-Modus beenden (Esc)" : "Zen-Modus: nur schreiben";
}

/**
 * Umschalten mit Übergang (leiste.css, zenwechsel): Vorher sprang die Karte an ihren neuen Platz,
 * und alles um sie herum verschwand in einem Bild. Mit „Bewegung reduzieren“ oder ohne View
 * Transitions bleibt es der Sprung.
 */
function zenUmschalten(an) {
  if (bewegungAus() || typeof document.startViewTransition !== "function") { zenSetzen(an); return; }
  var html = document.documentElement;
  html.classList.add("zenwechsel");
  var wechsel = document.startViewTransition(function () { zenSetzen(an); });
  wechsel.ready.catch(function () { /* abgebrochen: der Modus steht trotzdem */ });
  wechsel.finished.then(fertig, fertig);
  function fertig() { html.classList.remove("zenwechsel"); }
}

$("btn-zen").addEventListener("click", function () {
  menueSchliessen();
  zenUmschalten(!zenAn());
});
