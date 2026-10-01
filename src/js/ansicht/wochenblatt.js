/* ============================================================
 * Der Reiter „Woche“: das Blatt, in das man schreibt
 *
 * Mit dem wöchentlichen Vordruck ist jedes Feld im Blatt eines zum Schreiben: Abteilung,
 * Unterweisungen, die Themen einer Blockwoche und der Text jedes Tages. Man schreibt dorthin, wo
 * es gedruckt wird. Drei Spalten (links Eingaben, Mitte Blatt, rechts Stand) waren nicht zu
 * durchschauen. Am Handy ist das Blatt zum Schreiben zu klein: Ein Feld antippen öffnet es groß
 * (schreibblattOeffnen()). Karten über dem Blatt gab es dort auch; man sah das Blatt erst nach
 * dem Scrollen und schrieb woanders hin, als es gedruckt wird. Nur die tägliche Notierung hat
 * keine festen Kästen für Abteilung und Unterweisungen; dort bleiben es Karten.
 *
 * Eine Leiste über dem Blatt mit Stand, erstem offenem Tag und „Woche als Word · PDF“ gab es auch;
 * alles davon stand schon anderswo (Kopfleiste, Reiter, „Exportieren“), und sie war zu viel. Was
 * ein Tag noch braucht, steht jetzt an ihm im Blatt.
 * ========================================================== */

/* ---------- Der Wochenreiter ---------- */

/** Schreibt man in dieser Ansicht ins Blatt, oder stehen die Felder als Karten darüber? */
function imBlattSchreiben() {
  return $("f-vordruck").value !== "taeglich";
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

  if (imBlatt) {
    vorschau.felder([
      { feld: "abteilung", el: abt, leer: "Abteilung", titel: "Ausbildungsabteilung",
        unter: "Steht oben im Blatt und gilt für die ganze Woche" },
      { feld: "unterweisung", el: ta, leer: "Hier schreiben: Unterweisungen, Lehrgespräche, Schulungen dieser Woche",
        titel: "Unterweisungen und Schulungen", unter: "Kommt ins Blatt unter „Unterweisungen, Lehrgespräche …“" },
      themen ? { feld: "schule", el: themen.ta, leer: "Hier schreiben: die Themen des Unterrichts",
        titel: "Themen der Berufsschule", unter: "Kommt ins Blatt unter „Berufsschule (Unterrichtsthemen)“",
        knoepfe: themen.gruppe } : null
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

/**
 * Das Wochenblatt, wie es gedruckt wird. Es kommt aus demselben Drucksatz wie das PDF (druckBlatt),
 * also mit derselben Dichte und derselben Aufteilung auf mehrere Blätter. Jedes Blatt steht in
 * einem A4-Bogen, der auf die Breite skaliert wird.
 *
 * `imBlatt`: Auf dem Blatt liegen Eingabefelder, genau über ihrem Kasten: die der Woche aus
 * `felder()`, dazu eines über den Zeilen jedes Tages. Solange man nicht darin schreibt, sind sie
 * durchsichtig und ohne Rahmen, man sieht das Blatt, wie es gedruckt wird; beim Drüberfahren tönt
 * ein Feld sich leicht grau. Gelbe, später graue Rahmen um jedes Feld waren zu laut.
 * Wer hineinklickt, schreibt; das Blatt zeichnet sich dahinter neu, und die Felder rücken mit. Der
 * Kopf eines Tages öffnet ihn ganz, was ein Tag noch braucht, steht dort. Statt eines Titels steht
 * darüber eine ruhige Zeile: was man im Blatt tun kann, ein Tag, der ohne Text gar nicht im Blatt
 * steht, und die KI.
 *
 * Ob die Woche auf ein Blatt passt, sagt der Fuß nur, wenn sie es nicht tut.
 */
function blattVorschau(imBlatt) {
  var s = sektion("Vorschau Wochenblatt", "vorschau" + (imBlatt ? " ohnekarte" : ""));
  var buehne = document.createElement("div");
  buehne.className = "vorschaubuehne";
  var blaetter = document.createElement("div");
  blaetter.className = "blaetter";
  var lage = document.createElement("div");
  lage.className = "blattlage";
  buehne.appendChild(blaetter);
  buehne.appendChild(lage);

  // Links die KI für die ganze Woche, rechts, falls nötig, dass es nicht auf ein Blatt passt.
  var fuss = document.createElement("div");
  fuss.className = "textfuss";
  var slot = null;
  if (kiBereit()) {
    slot = document.createElement("span");
    slot.className = "kislot";
    slot.setAttribute("data-woche", aktiveWoche);
    wochenKiKnoepfe(slot);
    fuss.appendChild(slot);
  }
  var zahl = document.createElement("span");
  zahl.className = "textstand";
  fuss.appendChild(zahl);

  var tagHinweis = null, fehlt = null;
  if (imBlatt) {
    s.wurzel.removeChild(s.kopf);
    s.wurzel.setAttribute("aria-label", "Dein Wochenblatt");
    var leiste = document.createElement("div");
    leiste.className = "blattzeile";
    var schreiben = document.createElement("span");
    schreiben.className = "blatthinweis";
    schreiben.innerHTML = '<span class="stift" aria-hidden="true">✎</span> ' +
      '<span class="breit">Ins Blatt klicken und schreiben</span><span class="schmal">Ins Blatt tippen und schreiben</span>';
    tagHinweis = document.createElement("span");
    tagHinweis.className = "blatthinweis tage";
    tagHinweis.innerHTML = "<b>Montag</b>, <b>Dienstag</b> …: der ganze Tag";
    fehlt = document.createElement("button");
    fehlt.type = "button";
    fehlt.className = "blattfehlt";
    fehlt.hidden = true;
    leiste.appendChild(schreiben);
    leiste.appendChild(tagHinweis);
    leiste.appendChild(fehlt);
    leiste.appendChild(fuss);
    s.leib.appendChild(leiste);
    s.leib.appendChild(buehne);
  } else {
    s.leib.appendChild(buehne);
    s.leib.appendChild(fuss);
  }

  var felder = [], tagFeld = {}, fehltAm = null;
  if (fehlt) fehlt.addEventListener("click", function () { if (fehltAm) fehlendenTagSchreiben(fehltAm); });

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

  /**
   * Wo ein Feld im Blatt liegt, in Bildschirmkoordinaten, und die Schrift des Blatts dort.
   * Die Abteilung steht auf jedem Blatt, gemeint ist das erste; Unterweisungen und Schule stehen nur
   * auf dem letzten. Ein Tag, der über zwei Blätter läuft, bekommt sein Feld auf dem ersten.
   */
  function feldOrt(f) {
    var kasten, oben, unten, zeile = null;
    if (f.feld === "tag") {
      var zeilen = blaetter.querySelectorAll('.sp[data-datum="' + f.datum + '"]');
      if (!zeilen.length) return null;
      var blatt = zeilen[0].closest("article"), letzte = zeilen[0];
      zeilen.forEach(function (z) { if (z.closest("article") === blatt) letzte = z; });
      zeile = zeilen[0];
      kasten = zeile.closest(".kasten");
      oben = zeile.getBoundingClientRect().top;
      unten = letzte.getBoundingClientRect().bottom;
    } else {
      var alle = blaetter.querySelectorAll('[data-feld="' + f.feld + '"]');
      var ort = f.feld === "abteilung" ? alle[0] : alle[alle.length - 1];
      if (!ort) return null;
      kasten = f.feld === "abteilung" ? ort : ort.querySelector(".kasten");
      var r = kasten.getBoundingClientRect();
      oben = f.feld === "abteilung" ? kasten.querySelector("span").getBoundingClientRect().bottom : r.top;
      unten = r.bottom;
      if (f.feld !== "abteilung") {
        zeile = kasten.querySelector(".sp:not([data-datum]):not(.frei)");
        // Stehen im Kasten auch Tage (Berufsschule, Betriebsversammlung), gehören ihre Zeilen ihnen.
        // Das Feld der Woche endet über dem ersten, bleibt aber mindestens zwei Zeilen hoch. Ohne
        // Wochentage im Blatt (ohneTage()) beginnt ein Tag mit seiner ersten Zeile.
        var tag = kasten.querySelector(".tagkopf") || kasten.querySelector(".sp[data-datum]");
        if (tag) unten = Math.max(tag.getBoundingClientRect().top, oben + 2 * zeilenHoehe(kasten, r.width / kasten.offsetWidth));
      }
    }
    var rk = kasten.getBoundingClientRect(), mass = rk.width / kasten.offsetWidth;
    var ergebnis = {
      links: rk.left, oben: oben, breite: rk.width, hoehe: unten - oben,
      schrift: parseFloat(getComputedStyle(zeile || kasten).fontSize) * mass, satz: null
    };
    // Die Zeilen im Feld liegen auf den gedruckten: gleiche Zeilenhöhe, der Text beginnt, wo er
    // hinter dem Punkt beginnt. Beim Schreiben verrutscht so nichts, nur die Punkte fehlen.
    if (f.feld !== "abteilung") {
      var ks = getComputedStyle(kasten);
      var z = zeile && zeile.getBoundingClientRect();
      ergebnis.satz = {
        oben: z ? z.top - oben : parseFloat(ks.paddingTop) * mass,
        links: z ? z.left + parseFloat(getComputedStyle(zeile).paddingLeft) * mass - rk.left
                 // Noch ohne Zeile: dorthin, wo die erste stehen wird, 7 mm nach dem Rand (blatt.css).
                 : (parseFloat(ks.paddingLeft) + 7 * 96 / 25.4) * mass,
        rechts: z ? rk.right - z.right : parseFloat(ks.paddingRight) * mass,
        zeile: zeilenHoehe(zeile || kasten, mass)
      };
    }
    return ergebnis;
  }

  /** Abstand von Zeile zu Zeile im Blatt: Zeilenhöhe und der kleine Abstand nach jedem Stichpunkt. */
  function zeilenHoehe(el, mass) {
    var cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight);
    if (isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.4;
    return (lh + (el.classList.contains("sp") ? parseFloat(cs.marginBottom) || 0 : 0)) * mass;
  }

  /** Jedes Feld genau über seinen Kasten im Blatt, in der Schrift des Blatts. */
  function felderSetzen() {
    if (!felder.length) return;
    var basis = lage.getBoundingClientRect();
    felder.forEach(function (f) {
      var ort = feldOrt(f);
      // Wer gerade den ganzen Text eines Tages löscht, schreibt weiter, wo er war.
      if (!ort) { f.huelle.hidden = !dabei(f); return; }
      f.huelle.hidden = false;
      f.hoehe = ort.hoehe;
      f.huelle.style.left = (ort.links - basis.left) + "px";
      f.huelle.style.top = (ort.oben - basis.top) + "px";
      f.huelle.style.width = ort.breite + "px";
      f.huelle.style.height = ort.hoehe + "px";
      f.el.style.fontSize = ort.schrift.toFixed(1) + "px";
      if (ort.satz) {
        f.el.style.padding = ort.satz.oben.toFixed(1) + "px " + ort.satz.rechts.toFixed(1) + "px 0 " + ort.satz.links.toFixed(1) + "px";
        f.el.style.lineHeight = ort.satz.zeile.toFixed(2) + "px";
      }
      f.huelle.classList.toggle("leer", !f.el.value.trim());
      wachsen(f);
    });
  }

  /** Beim Schreiben ist ein Feld so hoch wie sein Text, auch bevor das Blatt nachgezogen hat. */
  function wachsen(f) {
    if (f.feld === "abteilung" || f.hoehe == null) return;
    var hoehe = f.hoehe;
    if (f.huelle.contains(document.activeElement)) {
      f.el.style.height = "0";
      hoehe = Math.max(hoehe, f.el.scrollHeight);
      f.el.style.height = "";
    }
    f.huelle.style.height = hoehe + "px";
  }

  /** Schreibt man gerade in diesem Feld, im Blatt oder groß (schreibblattOeffnen())? */
  function dabei(f) {
    return f.huelle.contains(document.activeElement) || !!(schreibblatt && schreibblatt.feld === f);
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
    var eng = bloecke.length > 1;
    fuss.className = "textfuss" + (eng ? " eng" : "");
    zahl.textContent = eng ? "passt nicht auf ein Blatt: " + bloecke.length + " Blätter" : "";
    zahl.hidden = !eng;
    // Unter dem Blatt wäre ein leerer Fuß nur ein Strich. In der Zeile darüber stört er nicht, und
    // die KI tauscht dort ihre Knöpfe gegen den Fortschritt, ohne dass das Blatt neu gezeichnet wird.
    fuss.hidden = !imBlatt && !eng && !(slot && slot.children.length);
    if (imBlatt) { tageMarkieren(); fehltZeigen(); tageAuflegen(); }
    einpassen();
    blaetter.style.minHeight = "";
  }

  /** Tage, die noch etwas brauchen, im Blatt kennzeichnen. Nur hier, nie im Druck. */
  function tageMarkieren() {
    var koepfe = blaetter.querySelectorAll(".tagkopf[data-datum]");
    koepfe.forEach(function (k) {
      var d = k.getAttribute("data-datum"), t = tage[d];
      k.title = "Den ganzen Tag öffnen";
      if (tagBrauchtNoch(d)) {
        var m = document.createElement("span");
        m.className = "vmarke";
        m.innerHTML = ((t && (t.text || "").trim()) ? "noch gegenlesen" : "Text fehlt") + '<span class="vauf"> · öffnen ›</span>';
        k.appendChild(m);
      }
    });
    tagHinweis.hidden = !koepfe.length;
  }

  /** Ein Tag ohne Text steht nicht im Blatt, braucht aber noch etwas: Er steht über dem Blatt.
   *  Ohne Wochentage im Blatt hat ein Tag keinen Kopf, nur Zeilen; und hat er Text, der schon an
   *  einem anderen Tag steht (ohneTage()), fehlen auch die. Ohne Text ist er trotzdem nicht. */
  function fehltZeigen() {
    var montag = vonIso(aktiveWoche), offen = [];
    for (var i = 0; i < TAGE_JE_WOCHE; i++) {
      var d = iso(plus(montag, i)), text = ((tage[d] && tage[d].text) || "").trim();
      if (tagBrauchtNoch(d) && !tagImWochenfeld(d) && !text && !blaetter.querySelector('[data-datum="' + d + '"]')) offen.push(d);
    }
    fehltAm = offen[0] || null;
    fehlt.hidden = !fehltAm;
    if (fehltAm) {
      fehlt.textContent = WOCHENTAGE[vonIso(fehltAm).getDay()] + " ohne Text" +
        (offen.length > 1 ? " · noch " + (offen.length - 1) + " weitere" : "") + " ›";
    }
  }

  var uhr = null;
  function spaeter() { clearTimeout(uhr); uhr = setTimeout(jetzt, 350); }

  blaetter.addEventListener("click", function (e) {
    var k = imBlatt && e.target.closest ? e.target.closest(".tagkopf[data-datum]") : null;
    if (k) stelleZeigen(k.getAttribute("data-datum"));
  });

  /* ---------- Die Tage im Blatt ---------- */

  /** Text eines Tages aus dem Blatt, wie im Tag selbst (textSektion()): Jede Änderung hebt „Fertig“ auf. */
  function tagSchreiben(d, text) {
    tagTextSetzen(d, text, tagArt(d));
    zeichneReiter(); zeichneWochenwahl();
    merken();
    spaeter();
  }

  function tagFertig(d) {
    var t = tage[d];
    if (!t || !(t.text || "").trim()) return;
    t.geprueft = true;
    merken();
    zeichneReiter(); zeichneWochenwahl();
    if (document.activeElement && lage.contains(document.activeElement)) document.activeElement.blur();
    jetzt();
    sage(WOCHENTAGE[vonIso(d).getDay()] + " ist fertig.", "gut");
  }

  /** „Fertig“ für einen Tag; nur zu sehen, solange sein Text noch nicht übernommen ist. */
  function fertigKnopf(d) {
    var knoepfe = document.createElement("span");
    var knopf = sektionsknopf("Fertig", "uebernehmen");
    knopf.title = "Text gelesen und in Ordnung: kommt so ins Heft";
    // Im Blatt steht der Knopf nur, solange man im Feld schreibt. Der Klick darf es nicht verlassen,
    // sonst wäre der Knopf weg, bevor er ankommt.
    knopf.addEventListener("mousedown", function (e) { e.preventDefault(); });
    knopf.addEventListener("click", function () { tagFertig(d); });
    knoepfe.appendChild(knopf);
    knoepfe.stand = function () { knopf.hidden = !tagOffen(tage[d]); };
    knoepfe.stand();
    return knoepfe;
  }

  /** Jeder Tag mit Text im Blatt bekommt ein Feld über seinen Zeilen. */
  function tageAuflegen() {
    var montag = vonIso(aktiveWoche);
    for (var i = 0; i < TAGE_JE_WOCHE; i++) {
      var d = iso(plus(montag, i)), f = tagFeld[d];
      var da = !!blaetter.querySelector('.sp[data-datum="' + d + '"]');
      if (da && !f) f = tagFeldAuflegen(d);
      if (!f) continue;
      if (!da && !dabei(f)) {
        f.huelle.remove();
        felder.splice(felder.indexOf(f), 1);
        delete tagFeld[d];
        continue;
      }
      // Anderswo geändert (KI, der Tag selbst): Das Feld zeigt, was im Blatt steht.
      var text = (tage[d] && tage[d].text) || "";
      if (!dabei(f) && f.el.value !== text) f.el.value = text;
      f.knoepfe.stand();
    }
  }

  function tagFeldAuflegen(d) {
    var datum = vonIso(d), name = WOCHENTAGE[datum.getDay()] + ", " + dmy(datum);
    var ta = document.createElement("textarea");
    ta.value = (tage[d] && tage[d].text) || "";
    ta.setAttribute("aria-label", name);
    var knoepfe = fertigKnopf(d);
    ta.addEventListener("input", function () { tagSchreiben(d, ta.value); knoepfe.stand(); });
    // Danach das Blatt nachziehen: Ein geleerter Tag verliert dort seinen Platz und sein Feld.
    ta.addEventListener("blur", spaeter);
    var f = feldAuflegen({ feld: "tag", datum: d, el: ta, leer: "", titel: name, unter: tagUnter(d), knoepfe: knoepfe });
    tagFeld[d] = f;
    return f;
  }

  /** Wohin der Text eines Tages im Blatt kommt, für die Zeile unter dem Titel des großen Felds. */
  function tagUnter(d) {
    return "Kommt ins Blatt unter „" + (istSchultag(tagArt(d)) ? "Berufsschule" : "Betriebliche Tätigkeit") + "“";
  }

  /** Ein Tag ohne Text steht nicht im Blatt: Sein Text entsteht im großen Feld, dann steht er dort. */
  function fehlendenTagSchreiben(d) {
    var datum = vonIso(d), knoepfe = fertigKnopf(d);
    schreibblattOeffnen({
      titel: WOCHENTAGE[datum.getDay()] + ", " + dmy(datum),
      unter: tagUnter(d),
      wert: (tage[d] && tage[d].text) || "",
      platzhalter: "Was hast du an diesem Tag gemacht?",
      schreiben: function (v) { tagSchreiben(d, v); knoepfe.stand(); },
      knoepfe: knoepfe, datum: d, zu: jetzt
    });
  }

  /* ---------- Die Felder ---------- */

  /**
   * Ein Feld aufs Blatt legen: eine Hülle mit dem Feld und einem Hinweis, solange es leer ist.
   * `knoepfe` sitzen am Feld („Fertig“). Am Handy schreibt man nicht im verkleinerten Blatt: Ein
   * Tipp öffnet das Feld groß (dieselbe Grenze wie in handy.css, wo das Feld selbst keinen Tipp nimmt).
   */
  function feldAuflegen(o) {
    var huelle = document.createElement("label");
    huelle.className = "blattfeld feld-" + o.feld;
    if (o.datum) huelle.setAttribute("data-datum", o.datum);
    var leer = document.createElement("span");
    leer.className = "blattleer";
    // Am Handy steht der Kasten dreimal kleiner da; dort reicht, was zu tun ist.
    leer.innerHTML = o.feld === "abteilung" ? sicher(o.leer)
      : '<span class="breit">' + sicher(o.leer) + '</span><span class="schmal">✎ antippen und schreiben</span>';
    huelle.appendChild(o.el);
    huelle.appendChild(leer);
    if (o.knoepfe) {
      o.knoepfe.classList.add("blattknoepfe");
      huelle.appendChild(o.knoepfe);
    }
    var f = { feld: o.feld, datum: o.datum, el: o.el, huelle: huelle, knoepfe: o.knoepfe, titel: o.titel };
    o.el.addEventListener("input", function () { huelle.classList.toggle("leer", !o.el.value.trim()); wachsen(f); });
    o.el.addEventListener("focus", function () { wachsen(f); });
    o.el.addEventListener("blur", function () { wachsen(f); });
    huelle.addEventListener("click", function (e) {
      if (!meldungSchwebt() || (e.target.closest && e.target.closest(".blattknoepfe"))) return;
      e.preventDefault();
      schreibblattOeffnen({
        titel: o.titel, unter: o.unter, wert: o.el.value, platzhalter: o.el.placeholder, feld: f,
        einzeilig: o.el.tagName === "INPUT",
        schreiben: function (v) { o.el.value = v; o.el.dispatchEvent(new Event("input")); },
        knoepfe: o.knoepfe, datum: o.datum, zu: jetzt
      });
    });
    lage.appendChild(huelle);
    felder.push(f);
    return f;
  }

  function felderAuflegen(liste) { liste.filter(Boolean).forEach(feldAuflegen); }

  if (window.ResizeObserver) {
    new ResizeObserver(function () { if (buehne.isConnected) einpassen(); }).observe(buehne);
  }
  return { wurzel: s.wurzel, jetzt: jetzt, spaeter: spaeter, felder: felderAuflegen };
}

/* ---------- Groß schreiben ---------- */

/** Solange das große Feld offen ist: was darin steht und wohin es schreibt. */
var schreibblatt = null;

/**
 * Ein Feld aus dem Blatt groß zum Schreiben. Am Handy ist das Blatt auf ein Drittel verkleinert;
 * darin zu schreiben hieße, in Fünf-Pixel-Schrift zu tippen. Dort fährt das Feld von unten hoch:
 * oben sein Titel mit „Fertig“, darunter, wohin der Text im Blatt kommt. Geschrieben wird trotzdem
 * ins Feld im Blatt (`schreiben`), das speichert und das Blatt nachzieht. „Fertig“ schließt; ist
 * der Tag oder sind die Themen noch offen, übernimmt es sie auch, wie „Fertig“ überall sonst (der
 * Knopf dafür bleibt am Feld, `knoepfe`). Wer nur nachsehen will, wischt das Feld nach unten oder
 * tippt daneben. Ein Tag ohne Text öffnet sich so auch am Rechner: Im Blatt hat er noch kein Feld.
 *
 * Am Touchgerät kommt die Tastatur erst, wenn man ins Textfeld tippt. Holte das Öffnen sie gleich,
 * fuhren Tastatur, Seite und Feld gleichzeitig los, und das Feld sprang ruckartig auf; oft will
 * man den Text auch nur lesen und „Fertig“ drücken.
 *
 * o: { titel, unter, wert, platzhalter, einzeilig, schreiben(text), knoepfe, datum (ein Tag), zu() }
 */
function schreibblattOeffnen(o) {
  var dlg = $("dlg-schreiben"), ta = $("schreiben-text"), offen = dlg.open;
  // Fährt es gerade hinaus, bleibt es: Wer schnell das nächste Feld antippt, sieht kein Zucken.
  clearTimeout(schreibblattUhr);
  dlg.classList.remove("geht");
  // Schon offen: das alte Feld gleich abschließen. Über close ginge es nicht, das Ereignis kommt
  // erst später und träfe dann das neue.
  if (offen) schreibblattAufraeumen();
  $("schreiben-titel").textContent = o.titel;
  $("schreiben-unter").textContent = o.unter || "";
  $("schreiben-unter").hidden = !o.unter;
  ta.value = o.wert || "";
  ta.placeholder = o.platzhalter || "";
  ta.classList.toggle("einzeilig", !!o.einzeilig);
  schreibblatt = { o: o, feld: o.feld || null };
  $("schreiben-tag").hidden = !o.datum;
  schreibblattLoslassen();
  if (!offen) { dlg.classList.remove("da"); dlg.showModal(); }
  schreibblattLage();
  if (!dlg.classList.contains("da")) {
    // Den Anfang (Blatt unten, Schleier aus) einmal berechnen lassen; ohne ihn sähe der Browser
    // keinen Übergang, und das Blatt stünde schlagartig da.
    void dlg.querySelector(".schreiben-blatt").offsetHeight;
    dlg.classList.add("da");
  }
  // preventScroll: Ein Fokus während des Hereinfahrens schöbe das Blatt sonst sofort ins Bild.
  // Am Touchgerät bleibt er beim Fenster selbst, nicht auf „Fertig“, das der Browser sonst wählt.
  if (!grobZeiger()) {
    ta.focus({ preventScroll: true });
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
  } else dlg.focus({ preventScroll: true });
}

/* Hinaus mit derselben Bewegung wie herein, nur umgekehrt; der Schleier blendet mit aus, zu ist es
   erst danach (dialoge.css: .da herein, .geht hinaus). Ohne das verschwand es von einem Bild aufs
   nächste. */
var schreibblattUhr = null, SCHREIBBLATT_WEG_MS = 280;

function schreibblattZu() {
  var dlg = $("dlg-schreiben");
  if (!dlg.open || dlg.classList.contains("geht")) return;
  if (!meldungSchwebt() || bewegungAus()) { dlg.close(); return; }
  // Die Tastatur geht mit, nicht erst hinterher.
  if (dlg.contains(document.activeElement)) document.activeElement.blur();
  schreibblattLoslassen();
  dlg.classList.remove("da");
  dlg.classList.add("geht");
  schreibblattUhr = setTimeout(function () {
    dlg.classList.remove("geht");
    if (dlg.open) dlg.close();
  }, SCHREIBBLATT_WEG_MS + 20);
}

/** Was das Wischen von Hand gesetzt hat, wieder den Klassen überlassen. */
function schreibblattLoslassen() {
  var dlg = $("dlg-schreiben");
  ["schreiben-blatt", "schreiben-schleier"].forEach(function (k) {
    var el = dlg.querySelector("." + k);
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  });
}

function bewegungAus() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
}

function grobZeiger() {
  try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; }
}

/** Das Blatt nachziehen; ein Tag ohne Feld im Blatt gibt seinen „Fertig“-Knopf wieder ab. */
function schreibblattAufraeumen() {
  var sb = schreibblatt;
  schreibblatt = null;
  if (!sb) return;
  var k = sb.o.knoepfe;
  if (k && !sb.feld && k.parentNode) k.parentNode.removeChild(k);
  if (sb.o.zu) sb.o.zu();
}

/* Am Handy liegt der Dialog genau über dem, was man sieht (visualViewport): Mit offener Tastatur
   ist das weniger als das Fenster, und iOS schiebt die Seite dabei noch hin und her. Das Blatt sitzt
   unten darin und damit immer direkt über der Tastatur. Nachgezogen wird ohne Übergang: Ein
   weicher Abstand zur Tastatur hinkte hinterher, beim Scrollen blieb unten eine Lücke. */
function schreibblattLage() {
  var dlg = $("dlg-schreiben"), vv = window.visualViewport;
  if (!dlg.open) return;
  if (!vv || !meldungSchwebt()) { dlg.style.top = ""; dlg.style.height = ""; return; }
  dlg.style.top = vv.offsetTop + "px";
  dlg.style.height = vv.height + "px";
}
if (window.visualViewport) {
  var schreibblattBild = 0;
  var schreibblattNachziehen = function () {
    cancelAnimationFrame(schreibblattBild);
    schreibblattBild = requestAnimationFrame(schreibblattLage);
  };
  window.visualViewport.addEventListener("resize", schreibblattNachziehen);
  window.visualViewport.addEventListener("scroll", schreibblattNachziehen);
}

$("schreiben-text").addEventListener("input", function (e) {
  if (schreibblatt) schreibblatt.o.schreiben(e.target.value);
});
// Die Abteilung ist eine Zeile: Enter heißt dort fertig.
$("schreiben-text").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && schreibblatt && schreibblatt.o.einzeilig) { e.preventDefault(); schreibblattZu(); }
});
$("schreiben-fertig").addEventListener("click", function () {
  var k = schreibblatt && schreibblatt.o.knoepfe;
  var fertig = k && k.querySelector(".uebernehmen:not([hidden])");
  schreibblattZu();
  if (fertig) fertig.click();
});
$("schreiben-tag").addEventListener("click", function () {
  var d = schreibblatt && schreibblatt.o.datum;
  schreibblattZu();
  if (d) stelleZeigen(d);
});
$("dlg-schreiben").addEventListener("close", function () {
  var dlg = $("dlg-schreiben");
  clearTimeout(schreibblattUhr);
  dlg.classList.remove("da", "geht");
  dlg.style.top = "";
  dlg.style.height = "";
  schreibblattLoslassen();
  schreibblattAufraeumen();
});
// Daneben tippen schließt, ohne etwas zu übernehmen: am Rechner der Hintergrund des Dialogs, am
// Handy der Schleier über der Seite.
$("dlg-schreiben").addEventListener("click", function (e) {
  if (e.target === this || e.target.classList.contains("schreiben-schleier")) schreibblattZu();
});
// Escape schließt wie Wischen, mit derselben Bewegung.
$("dlg-schreiben").addEventListener("cancel", function (e) { e.preventDefault(); schreibblattZu(); });

/* Nach unten wischen schließt, wie bei jedem Blatt, das von unten kommt. Gegriffen wird oben, am
   Griff und am Titel; im Textfeld scrollt ein Wischen den Text. Das Blatt folgt dem Finger, der
   Schleier wird mit ihm heller; weit genug oder schnell genug nach unten fährt es hinaus, sonst
   schnappt es weich zurück. */
(function () {
  var dlg = $("dlg-schreiben"), blatt = dlg.querySelector(".schreiben-blatt"),
    schleier = dlg.querySelector(".schreiben-schleier"), start = null, zeit = 0, weg = 0;
  blatt.addEventListener("touchstart", function (e) {
    start = e.target.closest(".schreiben-griff, .dkopf") && !e.target.closest("button") ? e.touches[0].clientY : null;
    zeit = Date.now();
    weg = 0;
    if (start == null) return;
    blatt.style.transition = "none";
    schleier.style.transition = "none";
  }, { passive: true });
  blatt.addEventListener("touchmove", function (e) {
    if (start == null) return;
    var dy = e.touches[0].clientY - start;
    // Nach oben gibt es nach, aber kaum und höchstens 40 px: Das Blatt steht schon, wo es hingehört.
    weg = dy > 0 ? dy : Math.max(-40, dy / 6);
    blatt.style.transform = "translateY(" + weg + "px)";
    schleier.style.opacity = String(Math.max(0, 1 - Math.max(0, weg) / blatt.offsetHeight));
  }, { passive: true });
  function los() {
    if (start == null) return;
    start = null;
    var schnell = weg > 20 && weg / Math.max(1, Date.now() - zeit) > 0.5;
    // Beides gibt die Hand an die Klassen zurück; der Übergang beginnt dort, wo der Finger war.
    if (weg > blatt.offsetHeight / 4 || schnell) schreibblattZu();
    else schreibblattLoslassen();
  }
  blatt.addEventListener("touchend", los);
  blatt.addEventListener("touchcancel", los);
})();

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
