/* ============================================================
 * Reiterzeile: je Werktag ein Reiter, dazu der Reiter der Woche
 * ========================================================== */

function zeichnen() {
  // Ohne Woche gibt es nichts zu blättern und nichts zu exportieren: Kopfleiste und Startkarte
  // werden ruhiger (tag.css, leiste.css).
  document.body.classList.toggle("ohnewoche", !aktiveWoche);
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
  reiter.classList.toggle("block", block);
  if (block) {
    aktiverTag = 7;
    reiter.appendChild(blockReiter(montag));
    return;
  }
  for (var i = 0; i < TAGE_JE_WOCHE; i++) reiter.appendChild(tagReiter(montag, i));
  reiter.appendChild(wochenReiter());
}

/** Der einzige Reiter einer Blockwoche: Stand der Themen und welche Tage frei sind. */
function blockReiter(montag) {
  var b = document.createElement("button");
  b.type = "button";
  b.id = "reiter-block";
  b.setAttribute("role", "tab");
  b.setAttribute("aria-selected", "true");
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
    (frei.length ? " · frei: " + frei.join(", ") : " Mo–Fr") + "</span></span>";
  b.addEventListener("click", function () { zeichneTag(); });
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

  var stand = tagStand(t);
  var klassen = [];
  if (laeuftHier) klassen.push("laeuft");
  if (!frei && stand === "fertig") klassen.push("fertig");
  else if (stand !== "fertig" && stand !== "leer") klassen.push("pruefen");
  b.className = klassen.join(" ");

  var marke = "";
  if (laeuftHier) marke = '<span class="dreht" title="wird gekürzt"></span>';
  else if (stand === "ki") marke = '<span class="marke" title="vom Sprachmodell formuliert — bitte gegenlesen">KI</span>';
  else if (stand === "roh") marke = '<span class="marke" title="Entwurf: noch unverändert aus dem Import">E</span>';
  else if (stand === "eigen") marke = '<span class="marke" title="selbst geschrieben, aber noch nicht als fertig markiert">!</span>';
  else if (stand === "fertig" && !frei) marke = '<span class="haken" title="gegengelesen">✓</span>';
  else if (fehlt) marke = '<span class="punkt" title="noch kein Text"></span>';

  // Am Handy bleibt neben einer Marke kein Platz für den Text (handy.css); ohne Marke steht er da.
  b.innerHTML =
    '<span class="rtag"><span class="rkurz">' + KURZ[datum.getDay()].toUpperCase() +
    '</span><span class="rdatum">' + dm(datum) + "</span></span>" +
    '<span class="rlage' + (marke ? "" : " ohnemarke") + '">' + marke + '<span class="rtext">' +
    (frei ? sicher(art) : t && t.stunden ? stundenText(t.stunden) + "\u2009h" : schule ? "Schule" : "—") +
    "</span></span>";
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

/** Der achte Reiter zeigt den Stand der ganzen Woche, nicht nur sein eigenes Feld. */
function wochenReiter() {
  var w = document.createElement("button");
  w.type = "button";
  w.setAttribute("role", "tab");
  w.setAttribute("aria-selected", String(aktiverTag === 7));
  var wd = wocheDaten(aktiveWoche);

  var wstand = wochenStand(aktiveWoche);
  var wocheVoll = !!(wd.unterweisungen || "").trim();
  if (wstand) w.className = wstand;
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
