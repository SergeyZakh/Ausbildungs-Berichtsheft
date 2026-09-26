/* ============================================================
 * Der Reiter „Woche“: Angaben der Woche, Blattvorschau, rechte Spalte
 * ========================================================== */

/* ---------- Der Wochenreiter ---------- */

function zeichneWochenblatt(bereich) {
  var wd = wocheDaten(aktiveWoche);
  var panel = document.createElement("div");
  panel.className = "tagpanel woche";
  var flaeche = document.createElement("div");
  flaeche.className = "tagflaeche dreispaltig";
  var spalte = document.createElement("div");
  spalte.className = "wochenspalte";
  var vorschau = blattVorschau();

  var sAbt = sektion("Angaben für die ganze Woche");

  var abt = document.createElement("input");
  abt.id = "feld-abteilung";
  abt.type = "text";
  abt.className = "abteilungsfeld";
  abt.value = wd.abteilung || $("f-abteilung").value || "";
  abt.placeholder = "z. B. IT";
  abt.addEventListener("input", function (e) {
    wocheDaten(aktiveWoche).abteilung = e.target.value; merken(); vorschau.spaeter();
  });
  sAbt.leib.appendChild(feldPaar("Ausbildungsabteilung", abt, "feld-abteilung"));
  spalte.appendChild(sAbt.wurzel);

  var sUnt = sektion("Unterweisungen, Lehrgespräche, betrieblicher Unterricht, sonstige Schulungsveranstaltungen", "wachsend");
  var ta = document.createElement("textarea");
  ta.id = "feld-unterweisungen";
  ta.value = wd.unterweisungen || "";
  ta.placeholder = "Welche Unterweisungen und Schulungen gab es diese Woche?";
  ta.addEventListener("input", function (e) {
    wocheDaten(aktiveWoche).unterweisungen = e.target.value;
    merken(); vorschau.spaeter();
  });
  sUnt.leib.appendChild(ta);
  spalte.appendChild(sUnt.wurzel);

  // Das Blatt steht in der Mitte: links, was man einträgt, rechts Stand und Knöpfe.
  var seite = seitenspalte(vorschau.fuss, vorschau.slot, [
    ["Word", function () { $("btn-wochenblatt").click(); }],
    ["PDF", function () { $("btn-pdf-woche").click(); }]
  ]);
  flaeche.appendChild(spalte);
  flaeche.appendChild(vorschau.wurzel);
  flaeche.appendChild(seite);
  if (vorschau.slot) wochenKiKnoepfe(vorschau.slot);
  panel.appendChild(flaeche);
  bereich.appendChild(panel);
  vorschau.jetzt();
}

/**
 * Das Wochenblatt, wie es gedruckt wird, verkleinert neben den Angaben.
 * Es kommt aus demselben Drucksatz wie das PDF (druckBlatt), also mit
 * derselben Dichte und derselben Aufteilung auf mehrere Blätter.
 * Jedes Blatt steht in einem A4-Bogen, der auf die Spaltenbreite skaliert wird.
 */
function blattVorschau() {
  var s = sektion("Vorschau Wochenblatt", "vorschau");
  var buehne = document.createElement("div");
  buehne.className = "vorschaubuehne";
  s.leib.appendChild(buehne);

  // Fuß wie am Tag: links die KI für die ganze Woche, rechts, ob es passt.
  var fuss = document.createElement("div");
  fuss.className = "textfuss";
  var slot = null;
  if (kiBereit()) {
    slot = document.createElement("span");
    slot.className = "kislot";
    slot.setAttribute("data-woche", aktiveWoche);
    fuss.appendChild(slot);
  }
  var zahl = document.createElement("span");
  zahl.className = "textstand";
  fuss.appendChild(zahl);
  s.leib.appendChild(fuss);

  function einpassen() {
    var breite = buehne.clientWidth - 2 * 16;
    buehne.querySelectorAll(".bogenrahmen").forEach(function (rahmen) {
      var bogen = rahmen.firstElementChild;
      var mass = breite / bogen.offsetWidth;
      bogen.style.transform = "scale(" + mass + ")";
      rahmen.style.width = breite + "px";
      rahmen.style.height = bogen.offsetHeight * mass + "px";
    });
  }

  function jetzt() {
    if (!aktiveWoche || !buehne.isConnected) return;
    var montag = vonIso(aktiveWoche), st = stammdaten();
    var html = druckBlattSicher(wochenNummer(montag, startMontag(st)), montag, st);
    var bloecke = html.match(/<article[\s\S]*?<\/article>/g) || [];
    buehne.innerHTML = bloecke.map(function (b) {
      return '<div class="bogenrahmen"><div class="bogen">' + b + "</div></div>";
    }).join("");
    fuss.className = "textfuss " + (bloecke.length > 1 ? "eng" : "passt");
    zahl.textContent = bloecke.length > 1
      ? "braucht " + bloecke.length + " Blätter"
      : "passt auf ein Blatt";
    einpassen();
  }

  var uhr = null;
  function spaeter() { clearTimeout(uhr); uhr = setTimeout(jetzt, 350); }

  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (buehne.isConnected) einpassen(); }).observe(buehne);
  }
  return { wurzel: s.wurzel, fuss: fuss, slot: slot, jetzt: jetzt, spaeter: spaeter };
}

/**
 * Rechte Spalte neben dem Wochenblatt: ob es aufs Blatt passt, die KI für die
 * Woche (nur mit Sprachmodell) und der Export genau dieser Woche.
 * vorne: weitere Sektionen, die oben stehen sollen (Ausbilder: Angaben der Woche).
 */
function seitenspalte(fuss, kiSlot, exporte, vorne) {
  var spalte = document.createElement("div");
  spalte.className = "seitenspalte";
  (vorne || []).forEach(function (el) { spalte.appendChild(el); });

  // Eine Karte statt drei: Jeder Teil ist nur eine Zeile oder ein Knopf, drei Kartenköpfe
  // darüber waren mehr Rahmen als Inhalt.
  var karte = sektion("Wochenblatt", "seitenkarte");
  var block = function (titel, inhalt) {
    var b = document.createElement("div");
    b.className = "seitenblock";
    var t = document.createElement("div");
    t.className = "seitentitel";
    t.textContent = titel;
    b.appendChild(t);
    b.appendChild(inhalt);
    karte.leib.appendChild(b);
    return b;
  };
  block("Umfang", fuss);
  if (kiSlot) {
    kiSlot.classList.add("kispalte");
    // Ohne Knöpfe (alles gekürzt, keine KI eingestellt) fällt der Block ganz weg.
    var kiBlock = block("KI", kiSlot);
    new MutationObserver(function () { kiBlock.hidden = !kiSlot.children.length; })
      .observe(kiSlot, { childList: true });
    kiBlock.hidden = !kiSlot.children.length;
  }

  var knoepfe = document.createElement("div");
  knoepfe.className = "exportknoepfe";
  exporte.forEach(function (e) {
    var k = document.createElement("button");
    k.type = "button";
    k.className = "knopf";
    k.textContent = e[0];
    k.addEventListener("click", e[1]);
    knoepfe.appendChild(k);
  });
  block("Herunterladen", knoepfe);
  spalte.appendChild(karte.wurzel);
  return spalte;
}

/** "Originale zurück" und "Ganze Woche mit KI kürzen" unten in der Wochenvorschau. */
function wochenKiKnoepfe(kopf) {
  var offeneTage = kiTageDerWoche(aktiveWoche);
  var erledigt = [];
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var k = iso(plus(vonIso(aktiveWoche), i));
    if (tage[k] && tage[k].vorKi != null) erledigt.push(k);
  }

  if (erledigt.length) {
    var zurueck = sektionsknopf("Originale zurück", "kiknopf zurueck");
    zurueck.title = "Alle Tage dieser Woche auf den Text vor der Kürzung zurücksetzen";
    zurueck.disabled = kiLaeuft();
    mitRueckfrage(zurueck, function () {
      erledigt.forEach(function (k) {
        tage[k].text = tage[k].vorKi;
        delete tage[k].vorKi;
        delete tage[k].kiText;
        delete tage[k].geprueft;
      });
      merken(); zeichnen();
      sage(erledigt.length + " Tage zurückgesetzt — sie sind wieder offen.", "warn");
    });
    kopf.appendChild(zurueck);
  }

  if (offeneTage.length) {
    var laeuft = kiLaeuft();
    var kuerzen = sektionsknopf(laeuft ? "KI kürzt …" : "Ganze Woche mit KI kürzen (" + offeneTage.length + ")", "kiknopf");
    kuerzen.title = "Alle Tage dieser Woche nacheinander vom Sprachmodell kürzen lassen";
    kuerzen.disabled = laeuft;
    var dieseWoche = aktiveWoche;
    kuerzen.addEventListener("click", function () { wocheKuerzen(dieseWoche); });
    kopf.appendChild(kuerzen);
  }
}
