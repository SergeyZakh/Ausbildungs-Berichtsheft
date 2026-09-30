/* ============================================================
 * Der Reiter „Woche“: oben der Stand der Woche, darunter das Blatt, in das man schreibt
 *
 * Am Rechner mit dem wöchentlichen Vordruck sind Abteilung, Unterweisungen und die Themen einer
 * Blockwoche Felder im Blatt selbst: Man schreibt dorthin, wo es gedruckt wird. Drei Spalten
 * (links Eingaben, Mitte Blatt, rechts Stand) waren nicht zu durchschauen. Am Handy wäre das Blatt
 * zum Schreiben zu klein, und die tägliche Notierung hat keine festen Kästen dafür; dort stehen
 * dieselben Felder als Karten über dem Blatt.
 * ========================================================== */

/* ---------- Der Wochenreiter ---------- */

/** Schreibt man in dieser Ansicht ins Blatt, oder stehen die Felder als Karten darüber? */
function imBlattSchreiben() {
  // Während des Drucks bleibt es, wie es war: Die Breite ist dann die von A4, nicht die des Fensters.
  if (druckLaeuft) {
    var flaeche = document.querySelector(".tagflaeche.blattwoche");
    if (flaeche) return flaeche.classList.contains("imblatt");
  }
  return !meldungSchwebt() && $("f-vordruck").value !== "taeglich";
}

function zeichneWochenblatt(bereich) {
  var wd = wocheDaten(aktiveWoche);
  var imBlatt = imBlattSchreiben();
  var panel = document.createElement("div");
  panel.className = "tagpanel woche";
  var flaeche = document.createElement("div");
  flaeche.className = "tagflaeche blattwoche" + (imBlatt ? " imblatt" : "");
  var vorschau = blattVorschau(imBlatt);

  var block = blockwoche(aktiveWoche);
  var themen = (block || wochenSchule(aktiveWoche)) ? schulwocheFeld(vorschau, imBlatt) : null;

  var abt = document.createElement("input");
  abt.id = "feld-abteilung";
  abt.type = "text";
  abt.className = "abteilungsfeld";
  abt.value = wd.abteilung || $("f-abteilung").value || "";
  abt.placeholder = "z. B. IT";
  abt.setAttribute("aria-label", "Ausbildungsabteilung");
  abt.addEventListener("input", function (e) {
    wocheDaten(aktiveWoche).abteilung = e.target.value; merken(); vorschau.spaeter();
  });

  var ta = document.createElement("textarea");
  ta.id = "feld-unterweisungen";
  ta.value = wd.unterweisungen || "";
  ta.placeholder = "Welche Unterweisungen und Schulungen gab es diese Woche?";
  ta.setAttribute("aria-label", "Unterweisungen, Lehrgespräche, betrieblicher Unterricht, sonstige Schulungsveranstaltungen");
  ta.addEventListener("input", function (e) {
    wocheDaten(aktiveWoche).unterweisungen = e.target.value;
    merken(); vorschau.spaeter();
  });

  flaeche.appendChild(wochenStandLeiste(vorschau, themen));
  if (block) flaeche.appendChild(blockTageSektion());

  if (imBlatt) {
    vorschau.felder([
      { feld: "abteilung", el: abt, leer: "Abteilung" },
      { feld: "unterweisung", el: ta, leer: "Hier schreiben: Unterweisungen, Lehrgespräche, Schulungen dieser Woche" },
      themen ? { feld: "schule", el: themen.ta, leer: "Hier schreiben: die Themen des Unterrichts" } : null
    ]);
  } else {
    var spalte = document.createElement("div");
    spalte.className = "wochenspalte";
    if (themen) spalte.appendChild(themen.sektion);
    var sAbt = sektion("Angaben für die ganze Woche");
    sAbt.leib.appendChild(feldPaar("Ausbildungsabteilung", abt, "feld-abteilung"));
    spalte.appendChild(sAbt.wurzel);
    var sUnt = sektion("Unterweisungen, Lehrgespräche, betrieblicher Unterricht, sonstige Schulungsveranstaltungen",
      "wachsend", "Unterweisungen und Schulungen");
    textfeldWachsen(ta);
    sUnt.leib.appendChild(ta);
    spalte.appendChild(sUnt.wurzel);
    flaeche.appendChild(spalte);
  }

  flaeche.appendChild(vorschau.wurzel);
  panel.appendChild(flaeche);
  bereich.appendChild(panel);
  vorschau.jetzt();
}

/* Wer das Fenster über die Grenze zieht, bekommt die andere Anordnung. Nicht aber, während der
   Druckdialog offen ist (druckLaeuft in druck.js): Dann ist die Seite nur so breit wie A4. */
function wochenAnordnungPruefen() {
  var flaeche = document.querySelector(".tagflaeche.blattwoche");
  if (!druckLaeuft && flaeche && flaeche.classList.contains("imblatt") !== imBlattSchreiben()) zeichneTag();
}
try {
  window.matchMedia("(max-width: 820px)").addEventListener("change", wochenAnordnungPruefen);
} catch (e) { /* ältere Browser: bleibt bis zum nächsten Zeichnen */ }
window.addEventListener("afterprint", function () { setTimeout(wochenAnordnungPruefen, 0); });

/**
 * Die Leiste über dem Blatt: wie weit die Woche ist, was als Erstes fehlt (mit Sprung dorthin), die
 * Themen einer Blockwoche mit „Fertig“, ob es aufs Blatt passt, KI und der Export der Woche. Sie
 * rechnet nach jedem Neuzeichnen des Blatts neu (vorschau.nachher).
 */
function wochenStandLeiste(vorschau, themen) {
  var s = document.createElement("section");
  s.className = "sektion wochenstand";
  var montagIso = aktiveWoche;

  var ring = document.createElement("span");
  ring.className = "wsring";
  var satz = document.createElement("span");
  satz.className = "wssatz";
  var offen = document.createElement("span");
  offen.className = "wsoffen";
  var hin = sektionsknopf("Ansehen", "wshin");
  s.appendChild(ring);
  s.appendChild(satz);
  s.appendChild(offen);
  s.appendChild(hin);
  if (themen) s.appendChild(themen.gruppe);

  var rechts = document.createElement("span");
  rechts.className = "wsrechts";
  rechts.appendChild(vorschau.fuss);
  if (vorschau.slot) { rechts.appendChild(vorschau.slot); wochenKiKnoepfe(vorschau.slot); }
  var word = document.createElement("button");
  word.type = "button";
  word.className = "knopf voll";
  word.textContent = "Woche als Word";
  word.addEventListener("click", function () { $("btn-wochenblatt").click(); });
  var pdf = document.createElement("button");
  pdf.type = "button";
  pdf.className = "knopf";
  pdf.textContent = "PDF";
  pdf.title = "Wochenblatt als PDF drucken";
  pdf.addEventListener("click", function () { $("btn-pdf-woche").click(); });
  rechts.appendChild(word);
  rechts.appendChild(pdf);
  s.appendChild(rechts);

  var ziel = null;
  hin.addEventListener("click", function () { if (ziel) stelleZeigen(ziel); });

  function aktualisieren() {
    var a = wochenAnteil(montagIso), b = wochenBilanz(montagIso);
    ring.innerHTML = ringHtml(a.fertig, a.von, a.fertig + " von " + a.von + " fertig");
    satz.textContent = !a.von ? "Noch nichts einzutragen"
      : a.fertig >= a.von ? "Woche fertig"
      : a.fertig + " von " + a.von + (a.von === 1 ? " Tag" : " Tagen") + " fertig";
    // Das Erste, was fehlt, mit Namen; die Themen einer Blockwoche nennt ihre eigene Gruppe.
    ziel = null;
    var montag = vonIso(montagIso), rest = b.ohneText + b.ungelesen;
    for (var i = 0; i < TAGE_JE_WOCHE && !ziel; i++) {
      var d = iso(plus(montag, i));
      if (!tagImWochenfeld(d) && tagBrauchtNoch(d)) ziel = d;
    }
    if (ziel) {
      var t = tage[ziel], ohne = !(t && (t.text || "").trim());
      offen.textContent = WOCHENTAGE[vonIso(ziel).getDay()] + ", " + dm(vonIso(ziel)) +
        (ohne ? " ohne Text" : " noch gegenlesen") + (rest > 1 ? " · noch " + (rest - 1) + " weitere" : "");
    } else offen.textContent = "";
    offen.hidden = hin.hidden = !ziel;
    s.classList.toggle("fertig", !!a.von && a.fertig >= a.von);
  }
  vorschau.nachher(aktualisieren);
  aktualisieren();
  return s;
}

/**
 * Das Wochenblatt, wie es gedruckt wird. Es kommt aus demselben Drucksatz wie das PDF (druckBlatt),
 * also mit derselben Dichte und derselben Aufteilung auf mehrere Blätter. Jedes Blatt steht in
 * einem A4-Bogen, der auf die Breite skaliert wird.
 *
 * `imBlatt`: Auf dem Blatt liegen die Eingabefelder der Woche (`felder()`), genau über ihrem Kasten.
 * Solange man nicht darin schreibt, sind sie durchsichtig, man sieht das Blatt, wie es gedruckt
 * wird, mit einem gestrichelten Rahmen und „✎“. Wer hineinklickt, schreibt; das Blatt zeichnet
 * sich dahinter neu, und die Felder rücken mit. Ein Tag im Blatt öffnet den Tag.
 */
function blattVorschau(imBlatt) {
  var s = sektion(imBlatt ? "Dein Wochenblatt" : "Vorschau Wochenblatt", "vorschau");
  if (imBlatt) {
    var hinweis = document.createElement("span");
    hinweis.className = "blatthinweis";
    hinweis.innerHTML = '<span class="stift" aria-hidden="true">✎</span> In die gestrichelten Felder schreibst du direkt. Ein Tag öffnet sich per Klick.';
    s.kopf.appendChild(hinweis);
  }
  var buehne = document.createElement("div");
  buehne.className = "vorschaubuehne";
  var blaetter = document.createElement("div");
  blaetter.className = "blaetter";
  var lage = document.createElement("div");
  lage.className = "blattlage";
  buehne.appendChild(blaetter);
  buehne.appendChild(lage);
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

  var felder = [], danach = [];

  function einpassen() {
    var breite = buehne.clientWidth - 2 * 16;
    // Unsichtbar (etwa beim Drucken, wo nur #druck steht) gibt es nichts einzupassen; ein negativer
    // Maßstab hätte das Blatt gespiegelt, bis zum nächsten Zeichnen.
    if (breite <= 0) return;
    blaetter.querySelectorAll(".bogenrahmen").forEach(function (rahmen) {
      var bogen = rahmen.firstElementChild;
      var mass = breite / bogen.offsetWidth;
      bogen.style.transform = "scale(" + mass + ")";
      rahmen.style.width = breite + "px";
      rahmen.style.height = bogen.offsetHeight * mass + "px";
    });
    felderSetzen();
  }

  /** Jedes Feld genau über seinen Kasten im Blatt, in der Schrift des Blatts. */
  function felderSetzen() {
    if (!felder.length) return;
    var basis = lage.getBoundingClientRect();
    felder.forEach(function (f) {
      var alle = blaetter.querySelectorAll('[data-feld="' + f.feld + '"]');
      // Die Abteilung steht auf jedem Blatt, gemeint ist das erste; Unterweisungen und Schule stehen
      // nur auf dem letzten.
      var ort = f.feld === "abteilung" ? alle[0] : alle[alle.length - 1];
      var kasten = ort && (f.feld === "abteilung" ? ort : ort.querySelector(".kasten"));
      f.huelle.hidden = !kasten || f.el.readOnly;
      if (f.huelle.hidden) return;
      var r = kasten.getBoundingClientRect(), oben = r.top;
      if (f.feld === "abteilung") oben = kasten.querySelector("span").getBoundingClientRect().bottom;
      var mass = r.width / kasten.offsetWidth;
      f.huelle.style.left = (r.left - basis.left) + "px";
      f.huelle.style.top = (oben - basis.top) + "px";
      f.huelle.style.width = r.width + "px";
      f.huelle.style.height = (r.bottom - oben) + "px";
      f.el.style.fontSize = (parseFloat(getComputedStyle(kasten).fontSize) * mass).toFixed(1) + "px";
      f.huelle.classList.toggle("leer", !f.el.value.trim());
    });
  }

  function jetzt() {
    if (!aktiveWoche || !buehne.isConnected) return;
    var montag = vonIso(aktiveWoche), st = stammdaten();
    var html = druckBlattSicher(wochenNummer(montag, startMontag(st)), montag, st);
    var bloecke = html.match(/<article[\s\S]*?<\/article>/g) || [];
    // Neu gezeichnet ist das Blatt einen Augenblick ohne Höhe: Die Rahmen bekommen sie erst in
    // einpassen(). Der Bereich, in dem man scrollt, sprang dabei nach oben, bei jedem Tastendruck
    // im Blatt. Die alte Höhe bleibt stehen, bis die neue gemessen ist.
    blaetter.style.minHeight = blaetter.offsetHeight + "px";
    blaetter.innerHTML = bloecke.map(function (b) {
      return '<div class="bogenrahmen"><div class="bogen">' + b + "</div></div>";
    }).join("");
    fuss.className = "textfuss " + (bloecke.length > 1 ? "eng" : "passt");
    zahl.textContent = bloecke.length > 1
      ? "braucht " + bloecke.length + " Blätter"
      : "passt auf ein Blatt";
    if (imBlatt) tageMarkieren();
    einpassen();
    blaetter.style.minHeight = "";
    danach.forEach(function (fn) { fn(); });
  }

  /** Tage, die noch etwas brauchen, im Blatt kennzeichnen. Nur hier, nie im Druck. */
  function tageMarkieren() {
    blaetter.querySelectorAll(".tagkopf[data-datum]").forEach(function (k) {
      var d = k.getAttribute("data-datum");
      k.title = "Diesen Tag öffnen";
      if (tagBrauchtNoch(d)) {
        var m = document.createElement("span");
        m.className = "vmarke";
        m.textContent = "noch gegenlesen";
        k.appendChild(m);
      }
    });
  }

  var uhr = null;
  function spaeter() { clearTimeout(uhr); uhr = setTimeout(jetzt, 350); }

  blaetter.addEventListener("click", function (e) {
    var k = imBlatt && e.target.closest ? e.target.closest(".tagkopf[data-datum]") : null;
    if (k) stelleZeigen(k.getAttribute("data-datum"));
  });

  /** Die Felder aufs Blatt legen: je eine Hülle mit dem Feld, einem Hinweis, solange es leer ist, und „✎“. */
  function felderAuflegen(liste) {
    liste.filter(Boolean).forEach(function (f) {
      var huelle = document.createElement("label");
      huelle.className = "blattfeld feld-" + f.feld;
      var leer = document.createElement("span");
      leer.className = "blattleer";
      leer.textContent = f.leer;
      var stift = document.createElement("span");
      stift.className = "blattstift";
      stift.setAttribute("aria-hidden", "true");
      stift.textContent = "✎";
      huelle.appendChild(f.el);
      huelle.appendChild(leer);
      huelle.appendChild(stift);
      f.el.addEventListener("input", function () { huelle.classList.toggle("leer", !f.el.value.trim()); });
      lage.appendChild(huelle);
      felder.push({ feld: f.feld, el: f.el, huelle: huelle });
    });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (buehne.isConnected) einpassen(); }).observe(buehne);
  }
  return {
    wurzel: s.wurzel, fuss: fuss, slot: slot, jetzt: jetzt, spaeter: spaeter,
    felder: felderAuflegen, nachher: function (fn) { danach.push(fn); }
  };
}

/**
 * Rechte Spalte neben dem Wochenblatt: ob es aufs Blatt passt und die KI für die
 * Woche (nur mit Sprachmodell). Heruntergeladen wird über „Exportieren“ oben.
 * vorne: weitere Sektionen, die oben stehen sollen (Ausbilder: Angaben der Woche).
 */
function seitenspalte(fuss, kiSlot, vorne) {
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
