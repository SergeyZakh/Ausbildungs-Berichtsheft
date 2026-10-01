/* ============================================================
 * Reiterzeile: je Werktag ein Reiter, dazu der Reiter der Woche
 * ========================================================== */

function zeichnen() {
  // Ohne Woche gibt es nichts zu blättern und nichts zu exportieren: Kopfleiste und Startkarte
  // werden ruhiger (tag.css, leiste.css).
  document.body.classList.toggle("ohnewoche", !aktiveWoche);
  if (!aktiveWoche && zenAn()) zenSetzen(false);
  zeichneWochenwahl();
  zeichneReiter();
  zeichneTag();
  lehrjahrZeigen();
  hinweiseZeigen();
  $("btn-heft").disabled = !aktiveWoche;
  $("btn-wochenblatt").disabled = !aktiveWoche;
}

/** Das berechnete Lehrjahr im Stammdatendialog. */
function lehrjahrZeigen() {
  var feld = $("f-jahr");
  if (!feld) return;
  var jahr = ausbildungsjahr({ beginn: $("f-beginn").value }, berichtsdatum());
  feld.value = jahr;
  feld.textContent = jahr ? jahr + ". Ausbildungsjahr" : "Beginn eintragen";
  feld.className = jahr ? "" : "leer";
}

/* ---------- Reiterzeile ---------- */

function zeichneReiter() {
  var reiter = $("reiter");
  reiter.innerHTML = "";
  if (!aktiveWoche) { reiter.hidden = true; return; }
  reiter.hidden = false;
  var montag = vonIso(aktiveWoche);
  if (aktiverTag > TAGE_JE_WOCHE) aktiverTag = 0;

  // Eine Blockwoche hat keine Tage zum Anklicken, nur ihr Themenfeld im Reiter der Woche.
  var block = blockwoche(aktiveWoche);
  if (block) aktiverTag = 7;
  // Was die Reiter zeigen, zeigt im Zen-Modus die Leiste mit Tag zurück und weiter (zen.js).
  zenStelleZeigen();
  reiter.classList.toggle("block", block);
  if (block) {
    // Das Menü vor dem Reiter: Am Handy gilt manches nur für den letzten Knopf der Zeile.
    reiter.appendChild(blockTageMenue());
    reiter.appendChild(blockReiter(montag));
    return;
  }
  for (var i = 0; i < TAGE_JE_WOCHE; i++) reiter.appendChild(tagReiter(montag, i));
  reiter.appendChild(wochenReiter());
}

/**
 * Der einzige Reiter einer Blockwoche: Stand der Themen und welche Tage frei sind. Er öffnet die
 * Tage der Woche (blockTageMenue() in schulwoche.js), etwa für einen Tag, an dem man krank war.
 */
function blockReiter(montag) {
  var b = document.createElement("button");
  b.type = "button";
  b.id = "reiter-block";
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", "true");
  b.setAttribute("aria-haspopup", "true");
  b.setAttribute("aria-expanded", "false");
  b.setAttribute("aria-controls", "menue-blocktage");
  var wstand = wochenStand(aktiveWoche);
  if (wstand) b.className = wstand;

  var frei = [];
  for (var i = 0; i < 5; i++) {
    var d = iso(plus(montag, i));
    if (tagArt(d) !== "Berufsschule") frei.push(KURZ[plus(montag, i).getDay()]);
  }
  var marke = wstand === "fertig" ? '<span class="haken" title="Themen übernommen">✓</span>'
    : wstand === "pruefen" ? '<span class="marke" title="Themen geschrieben, aber noch nicht als fertig markiert">!</span>'
    : '<span class="punkt" title="noch keine Themen"></span>';
  b.innerHTML =
    '<span class="rtag"><span class="rkurz">Blockwoche</span></span>' +
    '<span class="rlage">' + marke + '<span class="rtext">Berufsschule' +
    (frei.length ? " · frei: " + frei.join(", ") : " Mo–Fr") + "</span></span>" +
    '<span class="rtage">Tage ändern ▾</span>';
  b.addEventListener("click", function (e) {
    e.stopPropagation();
    var offen = !$("menue-blocktage").hidden;
    menueSchliessen();
    wochenwahlSchliessen();
    if (!offen) blockTageOeffnen();
  });
  return b;
}

/** Reiter eines Tages: Farbe und Marke zeigen, was der Tag noch braucht. */
function tagReiter(montag, i) {
  var datum = plus(montag, i), t = tage[iso(datum)];
  var art = tagArt(iso(datum));
  var schule = istSchultag(art);
  var frei = !!art && !schule;
  var fehlt = !frei && !!(t && (t.stunden || schule)) && !((t && t.text ? t.text : "").trim());
  var laeuftHier = kiLaufIndex() === i;

  var b = document.createElement("button");
  b.type = "button";
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", String(i === aktiverTag));
  tasteZeigen(b, String(i + 1));

  var stand = tagStand(t);
  var klassen = ["tagreiter"];
  // Am Handy steht ein leeres Wochenende und ein freier Tag nur blass in der Kalenderleiste (handy.css).
  if (i > 4 && !tagHatInhalt(t)) klassen.push("leerwe");
  if (frei) klassen.push("frei");
  if (laeuftHier) klassen.push("laeuft");
  if (!frei && stand === "fertig") klassen.push("fertig");
  else if (stand !== "fertig" && stand !== "leer") klassen.push("pruefen");
  else if (fehlt) klassen.push("fehlt");
  b.className = klassen.join(" ");

  var standText = laeuftHier ? "wird gekürzt"
    : stand === "ki" ? "vom Sprachmodell formuliert — bitte gegenlesen"
    : stand === "roh" ? "Entwurf: noch unverändert aus dem Import"
    : stand === "eigen" ? "selbst geschrieben, aber noch nicht als fertig markiert"
    : stand === "fertig" && !frei ? "gegengelesen"
    : fehlt ? "noch kein Text" : "";
  var titel = ' title="' + standText + '"';
  var marke = !standText ? ""
    : laeuftHier ? '<span class="dreht"' + titel + "></span>"
    : stand === "fertig" ? '<span class="haken"' + titel + ">✓</span>"
    : fehlt ? '<span class="punkt"' + titel + "></span>"
    : '<span class="marke"' + titel + ">" + { ki: "KI", roh: "E", eigen: "!" }[stand] + "</span>";
  var lage = frei ? art : t && t.stunden ? stundenText(t.stunden) + "\u2009h" : schule ? "Schule" : "";

  // Am Rechner Datum, Marke und Stunden; am Handy nur der Tag des Monats im Kreis, dessen Farbe den
  // Stand zeigt (rzahl, handy.css). Was man dort nicht sieht, sagt Vorlesern der Name des Reiters.
  b.setAttribute("aria-label", WOCHENTAGE[datum.getDay()] + ", " + dm(datum) +
    (standText ? ", " + standText : "") + (lage ? ", " + lage.replace("\u2009", " ") : ""));
  b.innerHTML =
    '<span class="rtag"><span class="rkurz">' + KURZ[datum.getDay()].toUpperCase() +
    '</span><span class="rdatum">' + dm(datum) + '</span><span class="rzahl" aria-hidden="true">' + datum.getDate() + "</span></span>" +
    '<span class="rlage' + (marke ? "" : " ohnemarke") + '">' + marke + '<span class="rtext">' +
    (lage ? sicher(lage) : "—") + "</span></span>";
  b.addEventListener("click", function () {
    aktiverTag = i; zeichneReiter(); zeichneTag(); merken();
  });
  b.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    var n = TAGE_JE_WOCHE;
    aktiverTag = (i + (e.key === "ArrowRight" ? 1 : n - 1)) % n;
    zeichneReiter(); zeichneTag();
    var neuKnopf = $("reiter").children[aktiverTag];
    if (neuKnopf) neuKnopf.focus();
  });
  return b;
}

/**
 * Die Taste, die den Reiter wählt (bedienung.js), steht am Rechner klein in seiner Ecke (leiste.css):
 * Wer sie sieht, benutzt sie. Für Vorleser als aria-keyshortcuts.
 */
function tasteZeigen(knopf, taste) {
  knopf.setAttribute("data-taste", taste);
  knopf.setAttribute("aria-keyshortcuts", taste);
}

/** Der achte Reiter zeigt den Stand der ganzen Woche, nicht nur sein eigenes Feld. */
function wochenReiter() {
  var w = document.createElement("button");
  w.type = "button";
  w.setAttribute("role", "tab");
  w.setAttribute("aria-selected", String(aktiverTag === 7));
  w.id = "reiter-woche";
  tasteZeigen(w, "8");
  var wd = wocheDaten(aktiveWoche);

  var wstand = wochenStand(aktiveWoche);
  var wocheVoll = !!(wd.unterweisungen || "").trim();
  w.className = "wochenreiter" + (wstand ? " " + wstand : "");
  var anteil = wochenAnteil(aktiveWoche);
  var marke = wstand === "fertig"
    ? '<span class="haken" title="alle Tage gegengelesen">✓</span>'
    : ringHtml(anteil.fertig, anteil.von, anteil.fertig + " von " + anteil.von + " Tagen gegengelesen");
  w.innerHTML =
    '<span class="rtag"><span class="rkurz">WOCHE</span></span>' +
    '<span class="rlage">' + marke + '<span class="rtext">' + (wocheVoll ? "ausgefüllt" : "offen") + "</span></span>";
  w.addEventListener("click", function () { aktiverTag = 7; zeichneReiter(); zeichneTag(); });
  return w;
}
