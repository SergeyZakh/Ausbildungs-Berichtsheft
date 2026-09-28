/* ============================================================
 * Tagesansicht: Bausteine der Karten und der Tagbereich
 *
 * Die Reiterzeile steht in reiter.js, das Wochenblatt in wochenblatt.js.
 * ========================================================== */

/* ---------- Bausteine ---------- */

/** Abgegrenzter Bereich mit Beschriftungsband, wie im Vordruck. `kurz` steht am Handy statt
 *  eines langen Titels: In Großbuchstaben lief „Unterweisungen, Lehrgespräche …“ dort über vier Zeilen. */
function sektion(titel, klasse, kurz) {
  var wurzel = document.createElement("section");
  wurzel.className = "sektion" + (klasse ? " " + klasse : "");
  var kopf = document.createElement("h3");
  kopf.className = "sektionskopf";
  var beschriftung = document.createElement("span");
  if (kurz) {
    beschriftung.innerHTML = '<span class="lang">' + sicher(titel) + '</span><span class="kurz">' + sicher(kurz) + "</span>";
    beschriftung.title = titel;
  } else beschriftung.textContent = titel;
  kopf.appendChild(beschriftung);
  var leib = document.createElement("div");
  leib.className = "sektionsleib";
  wurzel.appendChild(kopf);
  wurzel.appendChild(leib);
  return { wurzel: wurzel, kopf: kopf, leib: leib };
}

/** Beschriftetes Eingabepaar. */
function feldPaar(text, element, fuer) {
  var box = document.createElement("div");
  box.className = "feldpaar";
  var e = document.createElement("label");
  e.className = "feldetikett";
  if (fuer) e.setAttribute("for", fuer);
  e.textContent = text;
  box.appendChild(e);
  box.appendChild(element);
  return box;
}

/**
 * Zurücksetzen erst nach Rückfrage: Der erste Klick fragt am Knopf selbst, erst der zweite
 * handelt. Ohne zweiten Klick kehrt der Knopf nach vier Sekunden zurück.
 */
function mitRueckfrage(knopf, tat) {
  var text = knopf.textContent, uhr = null;
  knopf.addEventListener("click", function () {
    if (!knopf.classList.contains("sicher")) {
      knopf.classList.add("sicher");
      knopf.textContent = "Sicher? Nochmal klicken";
      uhr = setTimeout(function () { knopf.classList.remove("sicher"); knopf.textContent = text; }, 4000);
      return;
    }
    clearTimeout(uhr);
    tat();
  });
}

function sektionsknopf(text, klasse) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "sektionsknopf" + (klasse ? " " + klasse : "");
  b.textContent = text;
  return b;
}

/* ---------- Der Tagbereich ---------- */

function zeichneTag() {
  var bereich = $("tagbereich");
  bereich.innerHTML = "";

  if (!aktiveWoche) { zeichneLeerbild(bereich); return; }
  if (aktiverTag === 7) { zeichneWochenblatt(bereich); return; }

  var datum = plus(vonIso(aktiveWoche), aktiverTag), key = iso(datum), t = tage[key];
  var art = tagArt(key);
  var istSchule = istSchultag(art);
  var istFrei = !!art && !istSchule;

  var panel = document.createElement("div");
  panel.className = "tagpanel" + (istFrei ? " frei" : "");
  panel.appendChild(artSektion(datum, key, t, art, istFrei));

  if (istFrei) {
    var ruhig = document.createElement("p");
    ruhig.className = "ruhig";
    ruhig.textContent = art + " — für diesen Tag ist kein Eintrag erforderlich.";
    panel.appendChild(ruhig);
  } else {
    // Hat die Woche Themen für die Berufsschule, zählt ein Tag ohne eigenen Text schon dazu.
    if (tagImWochenfeld(key)) panel.appendChild(wochenfeldHinweis());
    var flaeche = document.createElement("div");
    flaeche.className = "tagflaeche";
    var textKarte = textSektion(key, t, art, istSchule);
    flaeche.appendChild(textKarte);
    if (t && t.posten && t.posten.length) flaeche.appendChild(postenSektion(t.posten, textKarte.querySelector("textarea")));
    panel.appendChild(flaeche);
  }

  bereich.appendChild(panel);
}

/** Hinweis an einem Tag, der unter den Themen seiner Woche steht, mit dem Weg dorthin. */
function wochenfeldHinweis() {
  var p = document.createElement("p");
  p.className = "wochenfeldhinweis";
  p.appendChild(document.createTextNode("Diese Woche hat Themen für die Berufsschule im Reiter „Woche“. Ohne eigenen Text zählt dieser Tag dazu. "));
  var hin = document.createElement("button");
  hin.type = "button";
  hin.className = "textknopf";
  hin.textContent = "Themen ansehen";
  hin.addEventListener("click", function () { aktiverTag = 7; zeichneReiter(); zeichneTag(); });
  p.appendChild(hin);
  return p;
}

/**
 * Am Handy wächst ein Textfeld mit seinem Text. Dort scrollt der ganze Inhalt; ein Feld mit
 * eigenem Scrollbalken schnitt den Text unten ab. Am Rechner bleibt die feste Höhe der Karte.
 * Gemessen wird erst im nächsten Bild, wenn das Feld im Dokument steht.
 */
function textfeldWachsen(ta) {
  var anpassen = function () {
    if (!window.matchMedia || !window.matchMedia("(max-width: 820px)").matches) {
      ta.style.height = "";
      return;
    }
    ta.style.height = "auto";
    ta.style.height = (ta.scrollHeight + 2) + "px";
  };
  ta.addEventListener("input", anpassen);
  requestAnimationFrame(anpassen);
}

function zeichneLeerbild(bereich) {
  var leer = document.createElement("div");
  leer.className = "leerbild";
  leer.innerHTML = "<h2>Noch kein Export geladen</h2>" +
    "<p>Exportiere deine Zeiten als CSV – aus Clockify, Harvest, Jira/Tempo, Kimai, Toggl " +
    "oder einer Excel-Liste – und lade sie hier. Ziehen geht auch, " +
    "irgendwo ins Fenster. Daraus entstehen die Wochenblätter für deinen " +
    "Ausbildungsnachweis. Ohne Export beginnst du mit dieser Woche und schreibst die Tage selbst.</p>";
  var lb = document.createElement("button");
  lb.type = "button"; lb.className = "knopf voll"; lb.textContent = "Export laden";
  lb.addEventListener("click", function () { $("datei").click(); });
  leer.appendChild(lb);
  var bsp = document.createElement("button");
  bsp.type = "button"; bsp.className = "knopf"; bsp.id = "btn-beispiel"; bsp.textContent = "Beispiel ansehen";
  bsp.addEventListener("click", beispielLaden);
  leer.appendChild(bsp);
  // Ohne Export: mit der aktuellen Woche beginnen und von Hand schreiben.
  var ohne = document.createElement("button");
  ohne.type = "button"; ohne.className = "knopf"; ohne.textContent = "Ohne Export starten";
  ohne.addEventListener("click", function () {
    var heute = new Date();
    wocheZeigen(iso(montagVon(heute)), Math.min(tagIndex(heute), 4));
  });
  leer.appendChild(ohne);
  // Wer vom Home-Bildschirm aus neu anfängt oder das Gerät wechselt, bringt sein Heft als Sicherung mit.
  var weiter = document.createElement("p");
  weiter.className = "leerfuss";
  weiter.appendChild(document.createTextNode("Schon ein Heft angefangen? "));
  var laden = document.createElement("button");
  laden.type = "button"; laden.className = "textknopf"; laden.id = "btn-leer-sicherung";
  laden.textContent = "Sicherung laden";
  laden.addEventListener("click", function () { $("sicherungsdatei").click(); });
  weiter.appendChild(laden);
  leer.appendChild(weiter);
  bereich.appendChild(leer);
}

/** Kopf des Tages: Art des Tages und Stunden. Die Stunden kommen aus dem Import
 *  und sind nur Anzeige; im Nachweis steht keine Stundenzahl. */
function artSektion(datum, key, t, art, istFrei) {
  var s = sektion(dmy(datum), "artkopf");
  // Am Handy steht der Wochentag schon im gewählten Reiter; dort fällt er hier weg (handy.css).
  var wochentag = document.createElement("span");
  wochentag.className = "wochentag";
  wochentag.textContent = WOCHENTAGE[datum.getDay()] + ", ";
  s.kopf.firstChild.insertBefore(wochentag, s.kopf.firstChild.firstChild);

  var wahl = document.createElement("select");
  wahl.id = "feld-art";
  wahl.className = art ? "gesetzt" : "";
  wahl.setAttribute("aria-label", "Art des Tages am " + dmy(datum));
  ARTEN.concat(art && ARTEN.indexOf(art) === -1 ? [art] : []).forEach(function (a) {
    var o = document.createElement("option");
    o.value = a; o.textContent = a === "" ? "Arbeitstag" : a;
    wahl.appendChild(o);
  });
  wahl.value = art;
  if (art && !(t && t.art)) wahl.title = "Schultag laut Deine Daten → Schule";
  wahl.addEventListener("change", function (e) {
    if (!tage[key]) tage[key] = { von: null, bis: null, pausen: [], stunden: null, text: "" };
    tage[key].art = e.target.value;
    tage[key].artVonHand = true;
    merken(); zeichnen();
  });
  s.leib.appendChild(feldPaar("Art des Tages", wahl, "feld-art"));

  if (!istFrei) {
    var wrap = document.createElement("span");
    wrap.className = "stdwrap";
    var stdFeld = document.createElement("span");
    stdFeld.id = "feld-stunden";
    stdFeld.className = "stdfeld";
    stdFeld.textContent = t && t.stunden ? stundenText(t.stunden) : "—";
    stdFeld.setAttribute("aria-label", "Stunden am " + dmy(datum));
    wrap.appendChild(stdFeld);
    var einheit = document.createElement("span");
    einheit.className = "einheit";
    einheit.textContent = "h";
    wrap.appendChild(einheit);
    s.leib.appendChild(feldPaar("Stunden", wrap));
  }
  return s.wurzel;
}

/**
 * Das Textfeld des Tages mit Herkunftsfahne, Fertig/Bearbeiten,
 * optionalem KI-Knopf und Zeilenstand.
 *
 * Solange der Text nicht übernommen ist, ist der Kasten rot. Übernommen
 * ist er grün und schreibgeschützt; "Bearbeiten" öffnet ihn wieder. Jede
 * Änderung hebt die Freigabe auf.
 */
function textSektion(key, t, art, istSchule) {
  var s = sektion(
    istSchule ? (art === "Berufsschule" ? "Berufsschule (Unterrichtsthemen)" : "Inhalte")
              : "Betriebliche Tätigkeit",
    "wachsend");

  var ta = document.createElement("textarea");
  ta.id = "feld-" + key;
  ta.value = (t && t.text) || "";
  ta.placeholder = istSchule
    ? "Welche Themen wurden im Unterricht behandelt?"
    : "Was hast du an diesem Tag gemacht?";
  ta.addEventListener("input", function (e) {
    if (!tage[key]) tage[key] = { von: null, bis: null, pausen: [], stunden: null, art: art };
    // Zeigt der Schulplan den leeren Tag als Berufsschule, wird er mit dem ersten Zeichen eine.
    else if (art && !tage[key].art) tage[key].art = art;
    tage[key].text = e.target.value;
    delete tage[key].geprueft;
    standAnzeigen();
    pruefstandAnzeigen();
    // Reiter und Wochenknopf zeigen den neuen Stand gleich mit.
    zeichneReiter(); zeichneWochenwahl();
    merken();
  });
  textfeldWachsen(ta);
  s.leib.appendChild(ta);

  var uebernehmen = sektionsknopf("Fertig", "uebernehmen");
  uebernehmen.title = "Text gelesen und in Ordnung: kommt so ins Heft";
  uebernehmen.addEventListener("click", function () {
    if (!tage[key]) return;
    tage[key].geprueft = true;
    merken();
    pruefstandAnzeigen();
    zeichneWochenwahl(); zeichneReiter();
    weiterNachFertig(key, "Als fertig markiert.");
  });

  var bearbeiten = sektionsknopf("", "bearbeiten");
  bearbeiten.innerHTML = '<span class="stift" aria-hidden="true">✎</span>Bearbeiten';
  bearbeiten.title = "Den fertigen Text wieder zum Bearbeiten öffnen";
  bearbeiten.addEventListener("click", function () {
    if (!tage[key]) return;
    delete tage[key].geprueft;
    merken();
    pruefstandAnzeigen();
    zeichneWochenwahl(); zeichneReiter();
    ta.focus();
    try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {}
    sage("Zum Bearbeiten geöffnet — danach wieder auf „Fertig“.", "warn");
  });

  // Die Fahne sagt, woraus der Text stammt.
  var fahne = document.createElement("span");
  fahne.className = "sektionsfahne";
  var FAHNEN = {
    roh:   ["Entwurf", "Noch der unveränderte Vorschlag aus deinen Buchungen"],
    ki:    ["KI", "Vom Sprachmodell formuliert — bitte gegenlesen"],
    eigen: ["Eigener Text", "Selbst geschrieben, aber noch nicht als fertig markiert"]
  };

  function pruefstandAnzeigen() {
    var stand = tagStand(tage[key]);
    var offen = stand !== "fertig" && stand !== "leer";
    var fertig = stand === "fertig";
    s.wurzel.className = "sektion wachsend" + (offen ? " pruefen" : fertig ? " fertig" : "");
    uebernehmen.hidden = !offen;
    bearbeiten.hidden = !fertig;
    ta.readOnly = fertig;
    var m = FAHNEN[stand];
    fahne.hidden = !m;
    if (m) { fahne.textContent = m[0]; fahne.title = m[1]; }
  }
  s.kopf.appendChild(fahne);
  s.kopf.appendChild(uebernehmen);
  s.kopf.appendChild(bearbeiten);

  // Der Kasten im Vordruck ist endlich; der Stand steht deshalb am Feld.
  // Links daneben der KI-Knopf. Läuft das Modell an genau diesem Tag,
  // steht an seiner Stelle der Fortschritt (zeichneFortschritt).
  var fuss = document.createElement("div");
  fuss.className = "textfuss";
  if (kiBereit()) {
    var slot = document.createElement("span");
    slot.className = "kislot";
    slot.setAttribute("data-key", key);
    slot.appendChild(kiKnopf(key, t));
    fuss.appendChild(slot);
  }
  var stand = document.createElement("span");
  stand.className = "textstand";
  fuss.appendChild(stand);
  s.leib.appendChild(fuss);
  function standAnzeigen() {
    var n = zeilenBedarf(ta.value);
    if (!n) {
      fuss.className = "textfuss leer";
      stand.textContent = "noch nichts geschrieben";
      return;
    }
    var platz = stichpunkteJeTag(), passt = n <= platz;
    fuss.className = "textfuss " + (passt ? "passt" : "eng");
    stand.textContent = n + " von rund " + platz + " Zeilen — " +
      (passt ? "passt aufs Blatt" : "wird im Blatt eng");
  }
  standAnzeigen();
  pruefstandAnzeigen();
  return s.wurzel;
}

/** "Mit KI kürzen" lässt das Modell kürzen, "Original zurück" stellt den Text davor wieder her. */
function kiKnopf(key, t) {
  var zurueck = t && t.vorKi != null;
  var knopf = sektionsknopf(zurueck ? "Original zurück" : "Mit KI kürzen",
    "kiknopf" + (zurueck ? " zurueck" : ""));
  knopf.title = zurueck
    ? "Den Text von vor der KI-Kürzung wiederherstellen"
    : "Das lokale Sprachmodell macht aus jeder Zeile einen kurzen Stichpunkt";
  knopf.disabled = kiLaeuft() || (!zurueck && !(t && (t.text || "").trim()));

  if (zurueck) {
    mitRueckfrage(knopf, function () {
      var d = tage[key];
      if (!d || d.vorKi == null) return;
      d.text = d.vorKi;
      delete d.vorKi;
      delete d.kiText;
      delete d.geprueft;
      merken(); zeichnen();
      sage("Ursprünglicher Text wiederhergestellt — der Tag ist wieder offen.", "warn");
    });
    return knopf;
  }

  knopf.addEventListener("click", async function () {
    if (!tage[key]) return;
    var d = tage[key];
    knopf.disabled = true;
    knopf.textContent = "KI kürzt …";
    await tagKuerzen(key, WOCHENTAGE[vonIso(key).getDay()], d, aktiveWoche);
  });
  return knopf;
}

/**
 * Die importierten Buchungen neben dem Text, zum Gegenhalten beim Schreiben.
 * Projekt und Tätigkeit erscheinen nur, wenn sie etwas aussagen (gleiche
 * Regeln wie im Entwurf); die Beschreibung steht im Original.
 *
 * Das Plus hängt eine Buchung als Zeile an den Text, bereinigt wie im Entwurf (postenZeile):
 * Wer den Entwurf gelöscht hat und neu schreibt, holt sich so einzelne Zeilen zurück, ohne
 * Kundennamen und Ticketnummern abzutippen. Steht die Zeile schon im Text, zeigt der Knopf
 * einen Haken.
 */
function postenSektion(posten, ta) {
  var s = sektion("Buchungen", "posten");
  var zahl = document.createElement("span");
  zahl.className = "postenzahl";
  zahl.textContent = posten.length === 1 ? "1 Posten" : posten.length + " Posten";
  s.kopf.appendChild(zahl);

  var liste = document.createElement("div");
  liste.className = "postenliste";
  posten.forEach(function (pst) {
    var z = document.createElement("p");
    var vorn = document.createElement("span");
    vorn.className = "pzeit";
    vorn.textContent = (pst.von != null && pst.bis != null)
      ? spanne(pst.von, pst.bis) : (pst.dauer ? pst.dauer + " min" : "");
    z.appendChild(vorn);

    var stuecke = [];
    if (projektTaugt(pst.projekt)) stuecke.push(String(pst.projekt).trim());
    if (pst.taetigkeit && !istMuell(pst.taetigkeit)) stuecke.push(String(pst.taetigkeit).trim());
    if (pst.beschreibung) stuecke.push(String(pst.beschreibung).trim());
    var roh = stuecke.filter(Boolean).join(" · ");

    var hinten = document.createElement("span");
    hinten.className = roh ? "ptext" : "pleer";
    hinten.textContent = roh || "ohne Beschreibung";
    z.appendChild(hinten);
    // Lange Beschreibungen stehen gekürzt da; ein Klick zeigt sie ganz.
    if (roh) {
      z.title = "Klicken für den ganzen Text";
      z.addEventListener("click", function () { z.classList.toggle("offen"); });
    }
    var zeile = postenZeile(pst);
    if (ta && zeile) {
      var dazu = document.createElement("button");
      dazu.type = "button";
      dazu.className = "pdazu";
      dazu.setAttribute("data-zeile", zeile);
      dazu.addEventListener("click", function (e) {
        e.stopPropagation();
        if (imText(ta.value, zeile)) { sage("Steht schon im Text: " + zeile); return; }
        var t = tage[ta.id.slice("feld-".length)], warFertig = !!(t && t.geprueft);
        ta.value = ta.value.replace(/\s+$/, "") + (ta.value.trim() ? "\n" : "") + zeile;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        sage("In den Text übernommen: " + zeile + (warFertig ? " — der Tag ist wieder offen." : ""),
          warFertig ? "warn" : "gut");
      });
      z.appendChild(dazu);
    }
    liste.appendChild(z);
  });
  s.leib.appendChild(liste);

  function postenAbgleichen() {
    if (!ta) return;
    Array.prototype.forEach.call(liste.querySelectorAll(".pdazu"), function (k) {
      var drin = imText(ta.value, k.getAttribute("data-zeile"));
      k.classList.toggle("drin", drin);
      k.textContent = drin ? "✓" : "+";
      k.title = drin ? "Steht schon im Text" : "Als Zeile in den Text übernehmen";
      k.setAttribute("aria-label", k.title + ": " + k.getAttribute("data-zeile"));
    });
  }
  if (ta) ta.addEventListener("input", postenAbgleichen);
  postenAbgleichen();
  return s.wurzel;
}

/** Steht diese Zeile schon im Text? Groß- und Kleinschreibung und Satzzeichen zählen nicht. */
function imText(text, zeile) {
  var k = schluessel(zeile);
  return !!k && zeilen(text).some(function (z) { return schluessel(z) === k; });
}
