/* ============================================================
 * Rundgang beim ersten Start
 *
 * Ein Gedanke je Schritt. Jeder Schritt zeigt auf das erste seiner Ziele,
 * das sichtbar ist; ohne Ziel steht die Karte mittig.
 * ========================================================== */

var ONBOARDING = "berichtsheft-onboarding";
var ONBOARDING_AUSBILDER = "berichtsheft-onboarding-ausbilder";

var RUNDGANG = [
  { ziel: null,
    titel: "Aus deinen Zeiten wird dein Berichtsheft",
    text: "Du lädst den Export deiner Zeiterfassung, schreibst die Tage fertig und bekommst " +
          "die Wochenblätter im IHK-Vordruck. Alles bleibt in diesem Browser." },
  { ziel: [".leerbild", "#btn-mehr"],
    titel: "Export laden",
    text: "Zieh die CSV aus Clockify, Harvest, Jira, Kimai, Toggl oder Excel einfach ins Fenster. " +
          "Aus jeder Buchung wird eine Zeile, die du dann überarbeitest. Ohne Export schreibst du die Tage selbst." },
  { ziel: [".wochenbalken"],
    titel: "Woche wählen",
    text: "Mit den Pfeilen blätterst du durch jede Kalenderwoche, ein Klick auf " +
          "die Mitte öffnet den Kalender." },
  { ziel: ["#reiter"],
    titel: "Ein Reiter je Tag",
    text: "Der achte Reiter gehört der ganzen Woche. Grün heißt fertig, rot heißt: " +
          "da musst du noch drüber." },
  { ziel: ["#tagbereich .tagpanel"],
    titel: "Schreiben",
    text: "Links schreibst du, rechts stehen deine Buchungen zum " +
          "Nachschauen. Unten am Feld siehst du, ob der Text auf das Blatt passt." },
  { ziel: [".sektion.wachsend > .sektionskopf", "#tagbereich .tagpanel"],
    titel: "Erst prüfen, dann fertig",
    text: "Solange der Kasten rot ist, hat den Text noch niemand freigegeben. " +
          "Ein Klick auf „Fertig“ macht ihn grün — „Bearbeiten“ öffnet ihn wieder." },
  { ziel: [".leiste .schub", "#btn-mehr"],
    titel: "Fertig? Dann raus damit",
    text: "Unter „Exportieren“ bekommst du das Wochenblatt dieser Woche und das " +
          "Gesamtheft, jeweils als Word oder PDF." }
];

/* Ausbilder schreiben kein Heft: Sie wählen Azubis, lesen Wochenblätter und laden sie herunter.
   Schritte, deren Ziel nur im Heft eines Azubis steht, fallen in der Auswahl von selbst weg. */
var RUNDGANG_AUSBILDER = [
  { ziel: null,
    titel: "Die Berichtshefte deiner Azubis",
    text: "Hier siehst du, welche Wochen fertig sind, liest die Wochenblätter und lädst sie als " +
          "Word oder PDF. Schreiben und ändern können nur die Azubis selbst." },
  { ziel: [".aauswahl"],
    titel: "Wen möchtest du ansehen?",
    text: "Oben stehen die Azubis, bei denen etwas zu tun ist. Rot heißt: Wochen warten aufs " +
          "Gegenlesen. Grün heißt: alles übernommen." },
  { ziel: ["#btn-gruppe"],
    titel: "Deine Gruppe",
    text: "Unter „Gruppe verwalten“ nimmst du Azubis auf, die sich schon einmal angemeldet haben. " +
          "Sie sehen dann, wer sie betreut." },
  { ziel: ["#a-wochenlabel"],
    titel: "Woche wählen",
    text: "Mit den Pfeilen blätterst du durch die Wochen, ein Klick auf die Mitte öffnet den Kalender." },
  { ziel: [".wochenspalte"],
    titel: "Stand der Tage",
    text: "„Übernommen“ heißt: Der Azubi hat den Tag gegengelesen und freigegeben." },
  { ziel: [".sektion.vorschau"],
    titel: "Das Wochenblatt",
    text: "So wird die Woche gedruckt und unterschrieben." },
  { ziel: ["#a-exporthalter", ".seitenkarte"],
    titel: "Herunterladen",
    text: "Das Wochenblatt oder das ganze Heft als Word oder PDF." },
  { ziel: ["#a-hilfe"],
    titel: "Noch einmal ansehen",
    text: "Das Fragezeichen startet diesen Rundgang jederzeit wieder." }
];

function onbAlsAusbilder() { return document.body.classList.contains("alsausbilder"); }
function onbSchluessel() { return onbAlsAusbilder() ? ONBOARDING_AUSBILDER : ONBOARDING; }

var onbIndex = 0;
/* Die Schritte, deren Ziel gerade zu sehen ist. Ohne geladene Woche gibt
   es keine Reiter und kein Textfeld; diese Schritte fallen dann weg. */
var onbSchritte = RUNDGANG;

function onbGesehen() {
  try { return localStorage.getItem(onbSchluessel()) === "1"; } catch (e) { return true; }
}

function onbZiel(schritt) {
  if (!schritt.ziel) return null;
  for (var i = 0; i < schritt.ziel.length; i++) {
    var el = document.querySelector(schritt.ziel[i]);
    if (el && el.getBoundingClientRect().height > 4) return el;
  }
  return null;
}

/** Rahmen eines Elements ohne padding. */
function innenRahmen(el) {
  var r = el.getBoundingClientRect(), st = getComputedStyle(el);
  var l = parseFloat(st.paddingLeft) || 0, o = parseFloat(st.paddingTop) || 0;
  var re = parseFloat(st.paddingRight) || 0, u = parseFloat(st.paddingBottom) || 0;
  // Karten mit Rand (leerbild, sektion) behalten ihren Rahmen.
  if (parseFloat(st.borderTopWidth) > 0) return r;
  return { left: r.left + l, top: r.top + o, right: r.right - re, bottom: r.bottom - u,
           width: r.width - l - re, height: r.height - o - u };
}

function onbZeigen(i) {
  var schritt = onbSchritte[i];
  var loch = $("onb-loch"), karte = $("onb-karte");

  $("onb-zaehler").textContent = "Schritt " + (i + 1) + " von " + onbSchritte.length;
  $("onb-titel").textContent = schritt.titel;
  $("onb-text").textContent = schritt.text;
  $("onb-zurueck").disabled = i === 0;
  $("onb-weiter").textContent = i === onbSchritte.length - 1 ? "Los geht's" : "Weiter";

  var el = onbZiel(schritt);
  if (!el) {
    loch.style.width = "0"; loch.style.height = "0";
    loch.style.left = (window.innerWidth / 2) + "px";
    loch.style.top = (window.innerHeight / 2) + "px";
    karte.style.left = Math.max(12, (window.innerWidth - karte.offsetWidth) / 2) + "px";
    karte.style.top = Math.max(12, (window.innerHeight - karte.offsetHeight) / 2) + "px";
    return;
  }

  // Ohne Innenabstand: Das Loch soll den Inhalt umschließen, nicht den Rand.
  var r = innenRahmen(el), luft = 6;
  loch.style.left = (r.left - luft) + "px";
  loch.style.top = (r.top - luft) + "px";
  loch.style.width = (r.width + 2 * luft) + "px";
  loch.style.height = (r.height + 2 * luft) + "px";

  // Karte unter das Ziel, wenn Platz ist, sonst darüber.
  var hoehe = karte.offsetHeight, breite = karte.offsetWidth;
  var oben = r.bottom + 14;
  if (oben + hoehe > window.innerHeight - 12) oben = r.top - hoehe - 14;
  if (oben < 12) oben = Math.max(12, (window.innerHeight - hoehe) / 2);
  karte.style.top = oben + "px";
  karte.style.left = Math.max(12, Math.min(r.left, window.innerWidth - breite - 12)) + "px";
}

function onbStarten() {
  onbIndex = 0;
  onbSchritte = (onbAlsAusbilder() ? RUNDGANG_AUSBILDER : RUNDGANG)
    .filter(function (s) { return !s.ziel || onbZiel(s); });
  $("onboarding").hidden = false;
  onbZeigen(0);
}

function onbBeenden() {
  $("onboarding").hidden = true;
  try { localStorage.setItem(onbSchluessel(), "1"); } catch (e) { /* ohne Speicher */ }
}

$("onb-weiter").addEventListener("click", function () {
  if (onbIndex >= onbSchritte.length - 1) { onbBeenden(); return; }
  onbZeigen(++onbIndex);
});
$("onb-zurueck").addEventListener("click", function () {
  if (onbIndex > 0) onbZeigen(--onbIndex);
});
$("onb-ueberspringen").addEventListener("click", onbBeenden);
// Beim Ändern der Fenstergröße wandert das Loch mit.
window.addEventListener("resize", function () {
  if (!$("onboarding").hidden) onbZeigen(onbIndex);
});
$("btn-hilfe").addEventListener("click", function () { menueSchliessen(); onbStarten(); });
document.addEventListener("keydown", function (e) {
  if (!$("onboarding").hidden && e.key === "Escape") { e.stopPropagation(); onbBeenden(); }
}, true);
window.addEventListener("resize", function () {
  if (!$("onboarding").hidden) onbZeigen(onbIndex);
});
