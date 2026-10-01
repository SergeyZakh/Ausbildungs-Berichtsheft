/* ============================================================
 * Herkunft: Welche Wörter im Tagestext stammen aus welcher Buchung?
 *
 * Jede Buchung bekommt eine Farbe, ihr Strich steht in der Liste daneben. Wörter im Text, die aus
 * ihr kommen, sind in derselben Farbe unterstrichen. Ein Textfeld kann einzelne Wörter nicht
 * einfärben; hinter dem Feld liegt deshalb ein Spiegel mit demselben Text in derselben Schrift,
 * unsichtbar bis auf die Striche, und das Feld davor ist durchsichtig. Ins Blatt, nach Word oder
 * ins PDF kommt davon nichts.
 *
 * Zugeordnet wird je Zeile, nicht je Wort: Jede Buchung mit eigener Farbe unterstrich schon bei
 * fünf Buchungen fast jedes Wort, und „Infrastruktur“ aus zwei Buchungen bekam irgendeine Farbe.
 * Eine Buchung zählt in einer Zeile erst, wenn sie zwei Wörter mit ihr teilt oder die Hälfte
 * ihrer Wörter; ein Wort aus mehreren Buchungen bekommt die Farbe derer, die in der Zeile am
 * meisten trifft. Füllwörter und Wörter unter drei Buchstaben zählen nicht. Eigene Zeilen, die
 * zu keiner Buchung passen, bleiben ohne Strich: Auch das sagt, woher etwas kommt.
 * ========================================================== */

/** Gehört zum Browser, nicht zum Heft (wie berichtsheft-farbe): „aus“, wenn abgeschaltet. */
var HERKUNFT = "berichtsheft-herkunft";
/** So viele Farben gibt es (--hk-0 bis --hk-5 in basis.css); ohne Rot und Grün, die heißen „offen“ und „fertig“. */
var HERKUNFT_FARBEN = 6;
var FUELLWOERTER = ("der die das den dem des ein eine einen einem einer eines und oder aber mit ohne " +
  "fuer für von vom zum zur am im in an auf aus bei beim bis nach ueber über unter vor zu als auch so " +
  "wie noch nicht nur sich ist sind war waren wurde wurden hat haben habe hatte wird werden kann " +
  "sowie bzw usw etc ggf inkl sehr alle allen durch gegen pro per neu neue neuen neuer neues " +
  "the and for with from into via").split(" ");

function herkunftAn() {
  try { return localStorage.getItem(HERKUNFT) !== "aus"; } catch (e) { return true; }
}

function herkunftSetzen(an) {
  try {
    if (an) localStorage.removeItem(HERKUNFT);
    else localStorage.setItem(HERKUNFT, "aus");
  } catch (e) { /* ohne Speicher gilt die Wahl bis zum Neuladen */ }
}

/** Wörter eines Textes mit ihrer Stelle; nur solche, die etwas aussagen. */
function herkunftWoerter(text) {
  var re = /[0-9A-Za-zÀ-ÖØ-öø-ÿß]+/g, m, raus = [];
  while ((m = re.exec(text))) {
    var w = m[0].toLowerCase();
    if (w.length < 3 || !/[a-zà-öø-ÿß]/.test(w) || FUELLWOERTER.indexOf(w) !== -1) continue;
    raus.push({ w: w, von: m.index, bis: m.index + m[0].length });
  }
  return raus;
}

/** Gleich, oder dasselbe Wort mit kurzer Endung („Notebook“ und „Notebooks“). Mit Ziffern nur
 *  genau gleich: „Lager“ ist nicht der Rechner „LAGER02“. */
function herkunftGleich(a, b) {
  if (a === b) return true;
  if (/\d/.test(a + b)) return false;
  var kurz = a.length <= b.length ? a : b, lang = kurz === a ? b : a;
  return kurz.length >= 5 && lang.length - kurz.length <= 3 && lang.indexOf(kurz) === 0;
}

/** Die Wörter einer Buchung: die bereinigte Zeile, wie sie in den Entwurf kommt, dazu Projekt und
 *  Tätigkeit. Die rohe Beschreibung nicht: Kundennamen, Rechner und Ticketnummern stehen nicht im
 *  Text, und ein Rechner „PC-LAGER02“ färbte sonst ein „Lager“ in einer eigenen Zeile. */
function herkunftBuchungsWoerter(p) {
  var teile = [postenZeile(p)];
  if (projektTaugt(p.projekt)) teile.push(p.projekt);
  if (p.taetigkeit && !istMuell(p.taetigkeit)) teile.push(p.taetigkeit);
  var menge = [];
  herkunftWoerter(teile.filter(Boolean).join(" ")).forEach(function (x) {
    if (menge.indexOf(x.w) === -1) menge.push(x.w);
  });
  return menge;
}

/**
 * Farbe je Buchung (0 bis 5), -1 für Buchungen ohne Wörter. Bis sechs Buchungen hat jede ihre
 * eigene; darüber teilen sich Buchungen eines Projekts eine Farbe, damit es nicht bunt wird.
 */
function herkunftFarben(posten, woerter) {
  var mitWort = woerter.filter(function (w) { return w.length; }).length;
  var schluesselListe = [];
  return posten.map(function (p, i) {
    if (!woerter[i].length) return -1;
    if (mitWort <= HERKUNFT_FARBEN) return schluesselListe.push(i) - 1;
    var k = projektTaugt(p.projekt) ? "p:" + schluessel(p.projekt) : "b:" + i;
    var n = schluesselListe.indexOf(k);
    if (n === -1) n = schluesselListe.push(k) - 1;
    return n % HERKUNFT_FARBEN;
  });
}

/**
 * Ordnet Zeilen und Wörter eines Textes den Buchungen zu.
 * stellen: unterstrichene Wörter { von, bis, p }; zeilen: je Zeile { von, bis, p } mit der
 * Buchung, die dort am meisten trifft (-1: keine); farben: je Buchung; getroffen: je Buchung,
 * ob sie im Text vorkommt.
 */
function herkunftFinden(text, posten) {
  text = String(text || "");
  var woerter = posten.map(herkunftBuchungsWoerter);
  var erg = { stellen: [], zeilen: [], farben: herkunftFarben(posten, woerter), getroffen: posten.map(function () { return false; }) };
  var anfang = 0;
  text.split("\n").forEach(function (zeile) {
    var eintrag = { von: anfang, bis: anfang + zeile.length, p: -1 };
    erg.zeilen.push(eintrag);
    var token = herkunftWoerter(zeile);
    var eigene = [];
    token.forEach(function (t) { if (eigene.indexOf(t.w) === -1) eigene.push(t.w); });
    // Je Buchung: welche Wörter dieser Zeile hat sie?
    var treffer = woerter.map(function (menge) {
      return eigene.filter(function (w) { return menge.some(function (m) { return herkunftGleich(w, m); }); });
    });
    var zaehlt = treffer.map(function (t) { return t.length >= 2 || (t.length >= 1 && t.length * 2 >= eigene.length); });
    var beste = -1;
    treffer.forEach(function (t, i) {
      if (zaehlt[i] && (beste === -1 || t.length > treffer[beste].length)) beste = i;
    });
    eintrag.p = beste;
    token.forEach(function (t) {
      var p = -1;
      treffer.forEach(function (tr, i) {
        if (zaehlt[i] && tr.indexOf(t.w) !== -1 && (p === -1 || tr.length > treffer[p].length)) p = i;
      });
      if (p === -1) return;
      erg.getroffen[p] = true;
      erg.stellen.push({ von: anfang + t.von, bis: anfang + t.bis, p: p });
    });
    anfang += zeile.length + 1;
  });
  return erg;
}

/**
 * Legt den Spiegel hinter das Textfeld und färbt die Buchungen in der Liste. Zeigt man auf eine
 * Buchung (am Handy: antippen, dann ist sie aufgeklappt), leuchten ihre Wörter wie mit
 * Textmarker; steht der Cursor in einer Zeile, ist die Buchung markiert, aus der sie kommt.
 */
function herkunftAnlegen(ta, posten, liste, schalter) {
  var rahmen = document.createElement("div");
  rahmen.className = "herkunftrahmen";
  var spiegel = document.createElement("div");
  spiegel.className = "herkunft";
  spiegel.setAttribute("aria-hidden", "true");
  ta.parentNode.insertBefore(rahmen, ta);
  rahmen.appendChild(spiegel);
  rahmen.appendChild(ta);

  var reihen = Array.prototype.slice.call(liste.children);
  var stand = null, gezeigt = -1, bild = 0;

  // Schrift und Ränder vom Feld übernehmen: Am Handy setzt handy.css die Schriftgröße mit
  // !important, und ein Unterschied von einem Pixel bricht die Zeilen woanders um.
  var WERTE = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch", "lineHeight",
    "letterSpacing", "wordSpacing", "textTransform", "textIndent", "tabSize",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"];
  function lage() {
    var cs = getComputedStyle(ta);
    WERTE.forEach(function (k) { spiegel.style[k] = cs[k]; });
    spiegel.style.top = ta.offsetTop + ta.clientTop + "px";
    spiegel.style.left = ta.offsetLeft + ta.clientLeft + "px";
    spiegel.style.width = ta.clientWidth + "px";
    spiegel.style.height = ta.clientHeight + "px";
    spiegel.scrollTop = ta.scrollTop;
  }

  function zeichnen() {
    var an = herkunftAn();
    rahmen.classList.toggle("aus", !an);
    liste.classList.toggle("mitherkunft", an);
    if (schalter) {
      schalter.setAttribute("aria-pressed", String(an));
      schalter.title = an ? "Farben ausblenden" : "Zeigen, welche Wörter aus welcher Buchung kommen";
    }
    spiegel.textContent = "";
    if (!an) return;
    var text = ta.value;
    stand = herkunftFinden(text, posten);
    reihen.forEach(function (r, i) {
      var f = stand.farben[i];
      for (var k = 0; k < HERKUNFT_FARBEN; k++) r.classList.remove("hkf" + k);
      r.classList.remove("nichtimtext");
      if (f >= 0) r.classList.add("hkf" + f);
      if (f >= 0 && !stand.getroffen[i]) r.classList.add("nichtimtext");
    });
    var bis = 0;
    stand.stellen.forEach(function (s) {
      if (s.von > bis) spiegel.appendChild(document.createTextNode(text.slice(bis, s.von)));
      var w = document.createElement("span");
      w.className = "hk hkf" + stand.farben[s.p];
      w.setAttribute("data-p", s.p);
      w.textContent = text.slice(s.von, s.bis);
      spiegel.appendChild(w);
      bis = s.bis;
    });
    // Eine Zeile mehr als das Feld: Sonst endet der Spiegel vor dem Feld, wenn man ganz nach
    // unten scrollt, und die Striche rutschen gegen den Text.
    spiegel.appendChild(document.createTextNode(text.slice(bis) + "\n​"));
    hervorheben();
    cursorZeile();
  }
  function bald() {
    cancelAnimationFrame(bild);
    bild = requestAnimationFrame(function () { zeichnen(); lage(); });
  }

  // Gezeigt wird die Buchung unter der Maus, sonst die aufgeklappten (am Handy angetippt).
  function hervorheben() {
    var welche = [];
    if (gezeigt >= 0) welche.push(gezeigt);
    else reihen.forEach(function (r, i) { if (r.classList.contains("offen")) welche.push(i); });
    spiegel.classList.toggle("zeigt", welche.length > 0);
    Array.prototype.forEach.call(spiegel.querySelectorAll(".hk"), function (w) {
      w.classList.toggle("an", welche.indexOf(+w.getAttribute("data-p")) !== -1);
    });
  }
  function cursorZeile() {
    var p = -1;
    if (stand && document.activeElement === ta) {
      var pos = ta.selectionStart;
      stand.zeilen.forEach(function (z) { if (pos >= z.von && pos <= z.bis) p = z.p; });
    }
    reihen.forEach(function (r, i) { r.classList.toggle("hier", i === p && herkunftAn()); });
  }

  reihen.forEach(function (r, i) {
    r.addEventListener("mouseenter", function () { gezeigt = i; hervorheben(); });
    r.addEventListener("mouseleave", function () { gezeigt = -1; hervorheben(); });
    // Der Klick klappt die Buchung auf (postenSektion); erst danach steht fest, ob sie offen ist.
    r.addEventListener("click", function () { setTimeout(hervorheben, 0); });
  });
  ta.addEventListener("input", bald);
  ta.addEventListener("scroll", function () { spiegel.scrollTop = ta.scrollTop; spiegel.scrollLeft = ta.scrollLeft; });
  ["keyup", "click", "focus", "select"].forEach(function (ev) { ta.addEventListener(ev, cursorZeile); });
  ta.addEventListener("blur", cursorZeile);
  if (window.ResizeObserver) {
    var beobachter = new ResizeObserver(function () {
      if (!ta.isConnected) { beobachter.disconnect(); return; }
      lage();
    });
    beobachter.observe(ta);
  } else window.addEventListener("resize", lage);
  if (schalter) schalter.addEventListener("click", function () {
    herkunftSetzen(!herkunftAn());
    zeichnen(); lage();
  });

  zeichnen();
  requestAnimationFrame(lage);
  return { zeichnen: bald };
}
