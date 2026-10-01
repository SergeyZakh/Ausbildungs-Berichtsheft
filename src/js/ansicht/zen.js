/* ============================================================
 * Zen-Modus: nur der Arbeitsbereich
 *
 * Der Knopf neben hell/dunkel blendet Kopfleiste, Reiter, Buchungen, Hinweise und Fußleiste aus.
 * Am Tag bleibt die Textkarte mit „Fertig“, in der Woche das Blatt. Die Tasten 1–8 und Alt+←/→
 * wirken weiter (bedienung.js); derselbe Knopf oben rechts oder Esc beendet ihn. Gemerkt wird er
 * nicht: Wer die Seite öffnet, will erst sehen, wo er steht.
 * ========================================================== */

function zenAn() { return document.body.classList.contains("zen"); }

function zenSetzen(an) {
  document.body.classList.toggle("zen", !!an);
  var knopf = $("btn-zen");
  knopf.setAttribute("aria-pressed", String(!!an));
  knopf.title = an ? "Zen-Modus beenden (Esc)" : "Zen-Modus: nur schreiben";
}

$("btn-zen").addEventListener("click", function () {
  menueSchliessen();
  zenSetzen(!zenAn());
});
