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

/* ---------- Tag zurück und weiter ----------
   Ohne Reiter braucht der Zen-Modus einen Weg zum nächsten Tag, ohne ihn zu verlassen. Er geht die
   Stellen der Woche ab wie die Reiter: Werktage, das Wochenende nur mit Inhalt, dann die Woche; in
   einer Blockwoche nur sie. Am Ende einer Woche geht es in die nächste, am Anfang in die vorige. */

function zenStellen(montagIso) {
  if (blockwoche(montagIso)) return [7];
  var montag = vonIso(montagIso), liste = [];
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    if (i < 5 || tagHatInhalt(tage[iso(plus(montag, i))])) liste.push(i);
  }
  liste.push(7);
  return liste;
}

function zenBlaettern(schritt) {
  if (!aktiveWoche) return;
  var nachbarn = zenStellen(aktiveWoche).filter(function (s) { return schritt > 0 ? s > aktiverTag : s < aktiverTag; });
  if (nachbarn.length) {
    aktiverTag = schritt > 0 ? nachbarn[0] : nachbarn[nachbarn.length - 1];
    zeichneReiter(); zeichneTag(); merken();
  } else {
    aktiveWoche = iso(plus(vonIso(aktiveWoche), 7 * schritt));
    var stellen = zenStellen(aktiveWoche);
    aktiverTag = schritt > 0 ? stellen[0] : stellen[stellen.length - 1];
    zeichnen(); merken();
  }
  $("mitte").scrollTop = 0;
}

/** Zwischen den Pfeilen der offene Tag, wie sein Reiter ihn nennt. */
function zenStelleZeigen() {
  if (!aktiveWoche) return;
  var tag = plus(vonIso(aktiveWoche), aktiverTag);
  $("zen-stelle").textContent = aktiverTag === 7 ? (blockwoche(aktiveWoche) ? "Blockwoche" : "Woche")
    : KURZ[tag.getDay()] + " " + dm(tag);
}

$("zen-zurueck").addEventListener("click", function () { zenBlaettern(-1); });
$("zen-weiter").addEventListener("click", function () { zenBlaettern(1); });
