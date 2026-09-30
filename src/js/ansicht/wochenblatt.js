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
      { feld: "abteilung", el: abt, leer: "Abteilung", titel: "Ausbildungsabteilung" },
      { feld: "unterweisung", el: ta, leer: "Hier schreiben: Unterweisungen, Lehrgespräche, Schulungen dieser Woche",
        titel: "Unterweisungen, Lehrgespräche, Schulungen" },
      themen ? { feld: "schule", el: themen.ta, leer: "Hier schreiben: die Themen des Unterrichts",
        titel: "Berufsschule (Unterrichtsthemen)", knoepfe: themen.gruppe } : null
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
 * durchsichtig, man sieht das Blatt, wie es gedruckt wird; die Felder der Woche mit einem feinen
 * grauen Rahmen, die Tage erst beim Drüberfahren. Ein gelber Rahmen um jedes Feld war zu laut.
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
    tagHinweis.className = "blatthinweis";
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
        zeile = kasten.querySelector(".sp:not([data-datum])");
        // Stehen im Kasten auch Tage (Berufsschule, Betriebsversammlung), gehören ihre Zeilen ihnen.
        // Das Feld der Woche endet über dem ersten, bleibt aber mindestens zwei Zeilen hoch.
        var tag = kasten.querySelector(".tagkopf");
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

  /** Ein Tag ohne Text steht nicht im Blatt, braucht aber noch etwas: Er steht über dem Blatt. */
  function fehltZeigen() {
    var montag = vonIso(aktiveWoche), offen = [];
    for (var i = 0; i < TAGE_JE_WOCHE; i++) {
      var d = iso(plus(montag, i));
      if (tagBrauchtNoch(d) && !tagImWochenfeld(d) && !blaetter.querySelector('.tagkopf[data-datum="' + d + '"]')) offen.push(d);
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
    var f = feldAuflegen({ feld: "tag", datum: d, el: ta, leer: "", titel: name, knoepfe: knoepfe });
    tagFeld[d] = f;
    return f;
  }

  /** Ein Tag ohne Text steht nicht im Blatt: Sein Text entsteht im großen Feld, dann steht er dort. */
  function fehlendenTagSchreiben(d) {
    var datum = vonIso(d), knoepfe = fertigKnopf(d);
    schreibblattOeffnen({
      titel: WOCHENTAGE[datum.getDay()] + ", " + dmy(datum),
      unter: istSchultag(tagArt(d)) ? "Berufsschule (Unterrichtsthemen)" : "Betriebliche Tätigkeit",
      wert: (tage[d] && tage[d].text) || "",
      platzhalter: "Was hast du an diesem Tag gemacht?",
      schreiben: function (v) { tagSchreiben(d, v); knoepfe.stand(); },
      knoepfe: knoepfe, datum: d, zu: jetzt
    });
  }

  /* ---------- Die Felder ---------- */

  /**
   * Ein Feld aufs Blatt legen: eine Hülle mit dem Feld, einem Hinweis, solange es leer ist, und „✎“.
   * `knoepfe` sitzen am Feld („Fertig“). Am Handy schreibt man nicht im verkleinerten Blatt: Ein
   * Tipp öffnet das Feld groß (dieselbe Grenze wie in handy.css, wo das Feld selbst keinen Tipp nimmt).
   */
  function feldAuflegen(o) {
    var huelle = document.createElement("label");
    huelle.className = "blattfeld feld-" + o.feld;
    if (o.datum) huelle.setAttribute("data-datum", o.datum);
    var leer = document.createElement("span");
    leer.className = "blattleer";
    leer.textContent = o.leer;
    var stift = document.createElement("span");
    stift.className = "blattstift";
    stift.setAttribute("aria-hidden", "true");
    stift.textContent = "✎";
    huelle.appendChild(o.el);
    huelle.appendChild(leer);
    huelle.appendChild(stift);
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
        titel: o.titel, wert: o.el.value, platzhalter: o.el.placeholder, feld: f,
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
 * darin zu schreiben hieße, in Fünf-Pixel-Schrift zu tippen. Geschrieben wird trotzdem ins Feld im
 * Blatt (`schreiben`), das speichert und das Blatt nachzieht; seine Knöpfe („Fertig“) wandern für
 * die Zeit mit. Ein Tag ohne Text öffnet sich so auch am Rechner: Im Blatt hat er noch kein Feld.
 *
 * o: { titel, unter, wert, platzhalter, schreiben(text), knoepfe, datum (ein Tag: „Ganzer Tag“), zu() }
 */
function schreibblattOeffnen(o) {
  var dlg = $("dlg-schreiben"), ta = $("schreiben-text"), offen = dlg.open;
  // Schon offen: das alte Feld gleich zurückgeben. Über close ginge es nicht, das Ereignis kommt
  // erst später und träfe dann das neue.
  if (offen) schreibblattAufraeumen();
  $("schreiben-titel").textContent = o.titel;
  $("schreiben-unter").textContent = o.unter || "";
  $("schreiben-unter").hidden = !o.unter;
  ta.value = o.wert || "";
  ta.placeholder = o.platzhalter || "";
  schreibblatt = { o: o, feld: o.feld || null, heim: o.knoepfe ? o.knoepfe.parentNode : null };
  if (o.knoepfe) $("schreiben-knoepfe").appendChild(o.knoepfe);
  $("schreiben-tag").hidden = !o.datum;
  if (!offen) dlg.showModal();
  ta.focus();
  try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
}

$("schreiben-text").addEventListener("input", function (e) {
  if (schreibblatt) schreibblatt.o.schreiben(e.target.value);
});
// Ein Knopf („Fertig“) erledigt das Feld: Danach ist es zu.
$("schreiben-knoepfe").addEventListener("click", function (e) {
  if (e.target.closest && e.target.closest("button")) setTimeout(function () { $("dlg-schreiben").close(); }, 0);
});
$("schreiben-tag").addEventListener("click", function () {
  var d = schreibblatt && schreibblatt.o.datum;
  $("dlg-schreiben").close();
  if (d) stelleZeigen(d);
});
$("schreiben-zu").addEventListener("click", function () { $("dlg-schreiben").close(); });
/** Die Knöpfe zurück an ihr Feld, das Blatt nachziehen. */
function schreibblattAufraeumen() {
  var sb = schreibblatt;
  schreibblatt = null;
  if (!sb) return;
  var k = sb.o.knoepfe;
  if (k) { if (sb.heim) sb.heim.appendChild(k); else if (k.parentNode) k.parentNode.removeChild(k); }
  if (sb.o.zu) sb.o.zu();
}
$("dlg-schreiben").addEventListener("close", schreibblattAufraeumen);

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
