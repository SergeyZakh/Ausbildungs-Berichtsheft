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
  // Ein freier Tag hat nur seinen Kopf; sonst stehen Art und Stunden im Kopf der Textkarte.
  if (istFrei) panel.appendChild(artSektion(datum, key, t, art, istFrei));

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
    var textKarte = textSektion(key, t, art, istSchule, datum);
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

/**
 * Die Startkarte ohne Woche: zwei Wege, die Tage zu füllen, als Knöpfe; Beispiel und Sicherung
 * als leise Links darunter. Fehlen noch Angaben für den Vordruck, bietet sie die Einrichtung an.
 */
function zeichneLeerbild(bereich) {
  var leer = document.createElement("div");
  leer.className = "leerbild";
  leer.innerHTML = "<h2>Womit fängst du an?</h2>" +
    "<p>Lädst du den Export deiner Zeiterfassung, steht für jeden Tag schon ein Entwurf da. Das geht " +
    "mit Clockify, Harvest, Jira/Tempo, Kimai, Toggl und Excel, auch per Ziehen ins Fenster. " +
    "Ohne Zeiterfassung schreibst du die Tage selbst.</p>";
  var knopf = function (text, klasse, tat, id) {
    var b = document.createElement("button");
    b.type = "button"; b.className = klasse; b.textContent = text;
    if (id) b.id = id;
    b.addEventListener("click", tat);
    return b;
  };
  leer.appendChild(knopf("Zeiterfassung laden (CSV)", "knopf voll", function () { $("datei").click(); }));
  leer.appendChild(knopf("Selbst schreiben", "knopf", function () {
    var heute = new Date();
    wocheZeigen(iso(montagVon(heute)), Math.min(tagIndex(heute), 4));
  }));
  // Wer vom Home-Bildschirm aus neu anfängt oder das Gerät wechselt, bringt sein Heft als Sicherung mit.
  var fuss = document.createElement("p");
  fuss.className = "leerfuss";
  fuss.appendChild(knopf("Beispiel ansehen", "textknopf", beispielLaden, "btn-beispiel"));
  fuss.appendChild(document.createTextNode(" · "));
  fuss.appendChild(knopf("Sicherung laden", "textknopf", function () { $("sicherungsdatei").click(); }, "btn-leer-sicherung"));
  leer.appendChild(fuss);
  if (angabenFehlen()) {
    var einrichten = document.createElement("p");
    einrichten.className = "leerfehlt";
    einrichten.appendChild(document.createTextNode("Für den Vordruck fehlen noch deine Angaben. "));
    einrichten.appendChild(knopf("Jetzt einrichten", "textknopf", einrichtungStarten, "btn-leer-einrichtung"));
    leer.appendChild(einrichten);
  }
  bereich.appendChild(leer);
}

/** Kopf eines freien Tages: nur Datum und Art. */
function artSektion(datum, key, t, art, istFrei) {
  var s = sektion(dmy(datum), "artkopf");
  tagTitel(s, datum);
  s.leib.appendChild(tagFelder(datum, key, t, art, istFrei));
  return s.wurzel;
}

/** Der Wochentag vor dem Datum im Titel. Am Handy steht er schon im Reiter (handy.css). */
function tagTitel(s, datum) {
  var wochentag = document.createElement("span");
  wochentag.className = "wochentag";
  wochentag.textContent = WOCHENTAGE[datum.getDay()] + ", ";
  s.kopf.firstChild.insertBefore(wochentag, s.kopf.firstChild.firstChild);
}

/** Art des Tages und Stunden. Die Stunden kommen aus dem Import und sind nur Anzeige; im
 *  Nachweis steht keine Stundenzahl. Die Beschriftungen sind nur für Vorleser da. */
function tagFelder(datum, key, t, art, istFrei) {
  var felder = document.createElement("div");
  felder.className = "tagfelder";
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
  felder.appendChild(feldPaar("Art des Tages", wahl, "feld-art"));

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
    felder.appendChild(feldPaar("Stunden", wrap));
  }
  return felder;
}

/**
 * Neuer Text eines Tages, hier und aus dem Wochenblatt. Jede Änderung hebt die Freigabe auf.
 * `art` ist die des Tages laut tagArt().
 */
function tagTextSetzen(key, text, art) {
  if (!tage[key]) tage[key] = { von: null, bis: null, pausen: [], stunden: null, art: art };
  // Zeigt der Schulplan den leeren Tag als Berufsschule, wird er mit dem ersten Zeichen eine.
  else if (art && !tage[key].art) tage[key].art = art;
  tage[key].text = text;
  delete tage[key].geprueft;
}

/**
 * Das Textfeld des Tages mit Herkunftsfahne, Fertig/Bearbeiten,
 * optionalem KI-Knopf und Zeilenstand.
 *
 * Solange der Text nicht übernommen ist, ist der Kasten rot. Übernommen
 * ist er grün und schreibgeschützt; "Bearbeiten" öffnet ihn wieder. Jede
 * Änderung hebt die Freigabe auf.
 */
function textSektion(key, t, art, istSchule, datum) {
  // Eine Karte je Tag: im Kopf das Datum mit Art, Stunden und „Fertig“, darüber dem Text das Feld
  // des Vordrucks, in das er kommt.
  var s = sektion(dmy(datum), "wachsend tagkarte");
  tagTitel(s, datum);
  s.kopf.appendChild(tagFelder(datum, key, t, art, false));
  var feldname = document.createElement("label");
  feldname.className = "vordruckfeld";
  feldname.htmlFor = "feld-" + key;
  feldname.textContent = istSchule
    ? (art === "Berufsschule" ? "Berufsschule (Unterrichtsthemen)" : "Inhalte")
    : "Betriebliche Tätigkeit";
  s.leib.appendChild(feldname);

  var ta = document.createElement("textarea");
  ta.id = "feld-" + key;
  ta.value = (t && t.text) || "";
  ta.placeholder = istSchule
    ? "Welche Themen wurden im Unterricht behandelt?"
    : "Was hast du an diesem Tag gemacht?";
  ta.addEventListener("input", function (e) {
    tagTextSetzen(key, e.target.value, art);
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

  // Nur ein Text vom Sprachmodell bekommt eine Fahne; dass ein Tag noch offen ist, sagen Farbe
  // und „Fertig“ schon.
  var fahne = document.createElement("span");
  fahne.className = "sektionsfahne";
  fahne.textContent = "KI";
  fahne.title = "Vom Sprachmodell formuliert — bitte gegenlesen";

  function pruefstandAnzeigen() {
    var stand = tagStand(tage[key]);
    var offen = stand !== "fertig" && stand !== "leer";
    var fertig = stand === "fertig";
    s.wurzel.className = "sektion wachsend tagkarte" + (offen ? " pruefen" : fertig ? " fertig" : "");
    uebernehmen.hidden = !offen;
    bearbeiten.hidden = !fertig;
    ta.readOnly = fertig;
    fahne.hidden = stand !== "ki";
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
 * Kundennamen und Ticketnummern abzutippen. Steht die Zeile schon im Text, fällt das Plus weg:
 * Ein Haken an jeder Buchung sah nach „erledigt“ aus und machte die Liste unruhig.
 * Welche Wörter im Text aus welcher Buchung kommen, zeigen farbige Striche (herkunft.js).
 *
 * Am Handy steht die Liste unter dem Text und war lang zu scrollen. Dort ist sie eingeklappt, sobald
 * der Tag Text hat, und zeigt im Kopf nur Zahl und Stunden; aufgeklappt steht oben ein Balken, wohin
 * die Zeit ging (zeitBalken). Ist der Text leer, steht sie offen: Dann braucht man sie zum Schreiben.
 * Wer auf- oder zuklappt, behält das für die Sitzung (buchungenAuf), auch an den anderen Tagen.
 */
function postenSektion(posten, ta) {
  var s = sektion("Buchungen", "posten");
  var minuten = posten.reduce(function (n, p) { return n + postenMinuten(p); }, 0);
  var zahl = document.createElement("span");
  zahl.className = "postenzahl";
  zahl.innerHTML = '<span class="lang">' + (posten.length === 1 ? "1 Posten" : posten.length + " Posten") +
    '</span><span class="kurz">' + posten.length + "</span>" +
    (minuten ? " · " + stundenText(minuten / 60) + "\u00a0h" : "");
  // Schaltet die farbigen Striche (herkunft.js) für diesen Browser an und aus.
  var schalter = null;
  if (ta) {
    schalter = document.createElement("button");
    schalter.type = "button";
    schalter.className = "herkunftknopf";
    schalter.innerHTML = '<span class="hkpunkte" aria-hidden="true"><i></i><i></i><i></i></span><span class="hktext">Herkunft</span>';
    schalter.setAttribute("aria-label", "Herkunft");
    s.kopf.appendChild(schalter);
  }
  s.kopf.appendChild(zahl);

  var klapp = document.createElement("button");
  klapp.type = "button";
  klapp.className = "postenklapp";
  s.kopf.appendChild(klapp);
  function zuklappen(zu) {
    s.wurzel.classList.toggle("zu", zu);
    klapp.setAttribute("aria-expanded", String(!zu));
    klapp.setAttribute("aria-label", zu ? "Buchungen aufklappen" : "Buchungen einklappen");
  }
  zuklappen(buchungenAuf == null ? !!(ta && ta.value.trim()) : !buchungenAuf);
  // Der ganze Kopf klappt, nur der Schalter „Herkunft“ nicht. Am Rechner ist der Knopf verborgen
  // und die Klasse wirkungslos.
  s.kopf.addEventListener("click", function (e) {
    if (e.target.closest(".herkunftknopf") || getComputedStyle(klapp).display === "none") return;
    buchungenAuf = s.wurzel.classList.contains("zu");
    zuklappen(!buchungenAuf);
  });

  var balken = zeitBalken(posten);
  if (balken) s.leib.appendChild(balken);

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
      dazu.textContent = "+";
      dazu.title = "Als Zeile in den Text übernehmen";
      dazu.setAttribute("aria-label", dazu.title + ": " + zeile);
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
      k.hidden = imText(ta.value, k.getAttribute("data-zeile"));
    });
  }
  if (ta) ta.addEventListener("input", postenAbgleichen);
  postenAbgleichen();
  if (ta) herkunftAnlegen(ta, posten, liste, schalter);
  return s.wurzel;
}

/** Am Handy: Buchungen aufgeklappt (true), zugeklappt (false) oder nach dem Text des Tages (null). */
var buchungenAuf = null;

/** Minuten einer Buchung: die Dauer, sonst die Spanne. */
function postenMinuten(p) {
  if (p.dauer) return p.dauer;
  if (p.von != null && p.bis != null) return p.bis >= p.von ? p.bis - p.von : p.bis + 1440 - p.von;
  return 0;
}

/**
 * Wohin die Zeit des Tages ging, nach Projekt (sonst Tätigkeit), größter Anteil zuerst: ein Balken
 * in Grau mit Legende. Grau, weil Farbe hier schon die einzelne Buchung heißt (herkunft.js). Mehr
 * als vier Anteile werden ab dem vierten zu „Sonstiges“. Nur bei mindestens zwei Anteilen.
 */
function zeitBalken(posten) {
  var anteile = [], gesamt = 0;
  posten.forEach(function (p) {
    var min = postenMinuten(p);
    if (!min) return;
    var name = projektTaugt(p.projekt) ? String(p.projekt).trim()
      : (p.taetigkeit && !istMuell(p.taetigkeit) ? String(p.taetigkeit).trim() : "Sonstiges");
    var a = anteile.filter(function (x) { return schluessel(x.name) === schluessel(name); })[0];
    if (!a) anteile.push(a = { name: name, min: 0 });
    a.min += min;
    gesamt += min;
  });
  if (anteile.length < 2) return null;
  anteile.sort(function (a, b) { return b.min - a.min; });
  if (anteile.length > 4) {
    var rest = anteile.splice(3);
    anteile.push({ name: "Sonstiges", min: rest.reduce(function (n, x) { return n + x.min; }, 0) });
  }
  var box = document.createElement("div");
  box.className = "zeitbalken";
  var leiste = document.createElement("div");
  leiste.className = "zbleiste";
  leiste.setAttribute("role", "img");
  var legende = document.createElement("p");
  legende.className = "zblegende";
  anteile.forEach(function (a, i) {
    var teil = document.createElement("span");
    teil.className = "zb" + i;
    teil.style.width = (a.min / gesamt * 100) + "%";
    leiste.appendChild(teil);
    var eintrag = document.createElement("span");
    eintrag.className = "zb" + i;
    eintrag.textContent = a.name + " " + stundenText(a.min / 60) + "\u00a0h";
    legende.appendChild(eintrag);
  });
  leiste.setAttribute("aria-label", "Zeit nach Projekt: " + anteile.map(function (a) {
    return a.name + " " + stundenText(a.min / 60) + " Stunden";
  }).join(", "));
  box.appendChild(leiste);
  box.appendChild(legende);
  return box;
}

/** Steht diese Zeile schon im Text? Groß- und Kleinschreibung und Satzzeichen zählen nicht. */
function imText(text, zeile) {
  var k = schluessel(zeile);
  return !!k && zeilen(text).some(function (z) { return schluessel(z) === k; });
}
