/* ============================================================
 * Berufsschule schneller eintragen: Themen einer Blockwoche und Fächer zum Antippen
 *
 * Der Vordruck will je Woche die Themen des Unterrichts, nicht je Tag. In einer Blockwoche
 * (blockwoche() in zustand.js) steht deshalb nur ein Feld für die ganze Woche da. Die Fächer
 * kennt das Werkzeug aus dem, was schon geschrieben ist: jede Zeile „Fach: Thema“.
 * ========================================================== */

/**
 * Die Themen der Woche im Reiter „Woche“. Wie ein Tagestext: rot, bis „Fertig“ ihn übernimmt,
 * dann grün und schreibgeschützt. Jede Änderung hebt die Übernahme auf.
 */
function schulwocheSektion(vorschau) {
  var montagIso = aktiveWoche, block = blockwoche(montagIso);
  // Kurzer Titel: In der schmalen Spalte stießen „(Unterrichtsthemen)“ und „Fertig“ aneinander.
  var s = sektion("Berufsschule", "wachsend schulwoche");
  var w = wochendaten[montagIso] || {};

  var hinweis = document.createElement("p");
  hinweis.className = "ruhig schulhinweis";
  hinweis.textContent = block
    ? "Blockwoche: Die Themen gelten für alle Schultage dieser Woche. Einmal schreiben, einmal „Fertig“."
    : "Diese Themen gelten für jeden Werktag der Woche, der keinen eigenen Text hat.";
  s.leib.appendChild(hinweis);

  var ta = document.createElement("textarea");
  ta.id = "feld-schulwoche";
  ta.value = w.schule || "";
  ta.placeholder = "Welche Themen wurden in dieser Woche im Unterricht behandelt?\nz. B. LF5: Subnetting und VLANs";
  s.leib.appendChild(faecherLeiste(ta, iso(plus(vonIso(montagIso), 4)), montagIso));
  s.leib.appendChild(ta);
  textfeldWachsen(ta);

  ta.addEventListener("input", function (e) {
    var d = wocheDaten(montagIso);
    d.schule = e.target.value;
    delete d.schuleGeprueft;
    anzeigen();
    zeichneReiter(); zeichneWochenwahl();
    merken();
    vorschau.spaeter();
  });

  var uebernehmen = sektionsknopf("Fertig", "uebernehmen");
  uebernehmen.title = "Themen gelesen und in Ordnung: kommen so ins Heft";
  uebernehmen.addEventListener("click", function () {
    var d = wochendaten[montagIso];
    if (!d || !(d.schule || "").trim()) return;
    d.schuleGeprueft = true;
    merken();
    anzeigen();
    zeichneWochenwahl(); zeichneReiter();
    weiterNachFertig(iso(plus(vonIso(montagIso), 6)), "Themen der Woche als fertig markiert.");
  });

  var bearbeiten = sektionsknopf("", "bearbeiten");
  bearbeiten.innerHTML = '<span class="stift" aria-hidden="true">✎</span>Bearbeiten';
  bearbeiten.title = "Die fertigen Themen wieder zum Bearbeiten öffnen";
  bearbeiten.addEventListener("click", function () {
    var d = wochendaten[montagIso];
    if (!d) return;
    delete d.schuleGeprueft;
    merken();
    anzeigen();
    zeichneWochenwahl(); zeichneReiter();
    ta.focus();
    sage("Zum Bearbeiten geöffnet — danach wieder auf „Fertig“.", "warn");
  });

  s.kopf.appendChild(uebernehmen);
  s.kopf.appendChild(bearbeiten);

  function anzeigen() {
    var d = wochendaten[montagIso] || {};
    var voll = !!(d.schule || "").trim(), fertig = voll && !!d.schuleGeprueft;
    s.wurzel.className = "sektion wachsend schulwoche" + (fertig ? " fertig" : voll ? " pruefen" : "");
    uebernehmen.hidden = !voll || fertig;
    bearbeiten.hidden = !fertig;
    ta.readOnly = fertig;
  }
  anzeigen();
  return s.wurzel;
}

/**
 * Die Werktage einer Blockwoche mit ihrer Art: Wer an einem Tag krank war, trägt es hier ein, ohne
 * Tagesreiter. Ein Arbeitstag macht die Woche wieder tageweise; die Reiter kommen dann zurück.
 */
function blockTageSektion() {
  var s = sektion("Tage dieser Woche", "blocktage");
  var montag = vonIso(aktiveWoche), land = $("f-land").value;
  var liste = document.createElement("div");
  liste.className = "blocktageliste";
  for (var i = 0; i < 5; i++) {
    (function (datum) {
      var key = iso(datum), t = tage[key];
      var zeile = document.createElement("label");
      zeile.className = "blocktag";
      var name = document.createElement("span");
      name.className = "blocktagname";
      name.textContent = KURZ[datum.getDay()] + " " + dm(datum);
      zeile.appendChild(name);
      // Ein Feiertag ohne Eintrag bleibt Feiertag, wie in den Reitern.
      if (!tagHatInhalt(t) && feiertagAn(key, land)) {
        var fest = document.createElement("span");
        fest.className = "blocktagfest";
        fest.textContent = "Feiertag";
        zeile.appendChild(fest);
      } else {
        var wahl = document.createElement("select");
        wahl.setAttribute("data-datum", key);
        var art = tagArt(key);
        ARTEN.forEach(function (a) {
          var o = document.createElement("option");
          o.value = a; o.textContent = a === "" ? "Arbeitstag" : a;
          wahl.appendChild(o);
        });
        wahl.value = art;
        wahl.addEventListener("change", function (e) {
          if (!tage[key]) tage[key] = { von: null, bis: null, pausen: [], stunden: null, text: "" };
          tage[key].art = e.target.value;
          tage[key].artVonHand = true;
          merken(); zeichnen();
          if (!blockwoche(aktiveWoche)) sage("Keine Blockwoche mehr: Die Tage stehen wieder einzeln in den Reitern.", "warn");
        });
        zeile.appendChild(wahl);
      }
      liste.appendChild(zeile);
    })(plus(montag, i));
  }
  s.leib.appendChild(liste);
  return s.wurzel;
}

/* ---------- Fächer ---------- */

/* Mehr Knöpfe passen am Handy nicht in zwei Zeilen. */
var FAECHER_MAX = 8;

/** "LF5: Subnetting" -> "LF5". Nur kurze Köpfe mit Buchstaben, sonst ist es kein Fach. */
function fachAusZeile(zeile) {
  var m = String(zeile).match(/^\s*[-•*·]?\s*([^:\n]{1,32}?)\s*:/);
  if (!m) return "";
  var kopf = m[1].trim();
  if (!/[A-Za-zÄÖÜäöüß]/.test(kopf) || kopf.split(/\s+/).length > 4) return "";
  return kopf;
}

/**
 * Alle Schultexte vor und nach einem Tag, neueste zuerst: [{ datum, text }]. Tage mit Art
 * Berufsschule und die Themen der Blockwochen, ohne `ausser` (der Tag oder die Woche selbst).
 */
function schultexte(ausser) {
  var liste = [];
  Object.keys(tage).forEach(function (k) {
    var t = tage[k];
    if (k !== ausser && t.art === "Berufsschule" && (t.text || "").trim()) liste.push({ datum: k, text: t.text });
  });
  Object.keys(wochendaten).forEach(function (m) {
    var w = wochendaten[m];
    // Eine Woche datiert auf ihren Freitag: Sie steht dann nach ihrem Montag und vor der nächsten.
    if (m !== ausser && w && (w.schule || "").trim()) liste.push({ datum: iso(plus(vonIso(m), 4)), text: w.schule });
  });
  return liste.sort(function (a, b) { return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0; });
}

/** Die Fächer aus früheren Einträgen: zuletzt benutzte zuerst, jedes einmal. */
function bekannteFaecher(ausser) {
  var gesehen = {}, faecher = [];
  schultexte(ausser).forEach(function (e) {
    zeilen(e.text).forEach(function (z) {
      var f = fachAusZeile(z), k = f.toLowerCase();
      if (f && !gesehen[k]) { gesehen[k] = true; faecher.push(f); }
    });
  });
  return faecher.slice(0, FAECHER_MAX);
}

/** Der letzte Schultext vor `datum` mit mindestens einem Fach: { datum, faecher } oder null. */
function letzteFaecher(datum, ausser) {
  var liste = schultexte(ausser);
  for (var i = 0; i < liste.length; i++) {
    if (liste[i].datum >= datum) continue;
    var faecher = zeilen(liste[i].text).map(fachAusZeile).filter(Boolean);
    if (faecher.length) return { datum: liste[i].datum, faecher: faecher };
  }
  return null;
}

/**
 * Knöpfe über einem Schultext: je bekanntes Fach einer, der „Fach: “ einfügt, dazu im leeren Feld
 * „Fächer wie am …“ mit allen Fächern des letzten Schultags. Steht das Fach schon im Text, geht
 * der Cursor ans Ende seiner Zeile. Ohne bekannte Fächer bleibt die Leiste leer; der Platzhalter
 * des Felds zeigt, wie man schreibt, damit es beim nächsten Mal Knöpfe gibt.
 * `datum` ist der Tag des Felds (bei einer Woche ihr Freitag), `ausser` der eigene Schlüssel.
 */
function faecherLeiste(ta, datum, ausser) {
  var leiste = document.createElement("div");
  leiste.className = "faecher";
  leiste.setAttribute("aria-label", "Fächer einfügen");

  var faecher = bekannteFaecher(ausser);
  var zuletzt = letzteFaecher(datum, ausser);

  function zeigen() {
    var leer = !ta.value.trim();
    Array.prototype.forEach.call(leiste.querySelectorAll(".fachwie"), function (k) { k.hidden = !leer; });
    leiste.hidden = !faecher.length;
  }

  if (zuletzt) {
    var wie = document.createElement("button");
    wie.type = "button";
    wie.className = "fach fachwie";
    wie.textContent = "Fächer wie am " + KURZ[vonIso(zuletzt.datum).getDay()] + " " + dm(vonIso(zuletzt.datum));
    wie.title = zuletzt.faecher.join(", ");
    wie.addEventListener("click", function () {
      ta.value = zuletzt.faecher.map(function (f) { return f + ": "; }).join("\n");
      var ende = zuletzt.faecher[0].length + 2;
      ta.focus();
      try { ta.setSelectionRange(ende, ende); } catch (e) {}
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    leiste.appendChild(wie);
  }

  faecher.forEach(function (f) {
    var k = document.createElement("button");
    k.type = "button";
    k.className = "fach";
    k.textContent = f;
    k.addEventListener("click", function () { fachEinfuegen(ta, f); });
    leiste.appendChild(k);
  });

  ta.addEventListener("input", zeigen);
  zeigen();
  return leiste;
}

/** „Fach: “ als neue Zeile anhängen oder, wenn es das Fach schon gibt, ans Ende seiner Zeile gehen. */
function fachEinfuegen(ta, fach) {
  var text = ta.value, zeilenListe = text.split("\n"), pos = -1, laenge = 0;
  for (var i = 0; i < zeilenListe.length; i++) {
    if (fachAusZeile(zeilenListe[i]).toLowerCase() === fach.toLowerCase()) {
      var z = zeilenListe[i];
      // Hinter dem Doppelpunkt schon ein Thema: ein Komma, damit das nächste dazukommt.
      if (!/:\s*$/.test(z)) zeilenListe[i] = z.replace(/[\s,;]+$/, "") + ", ";
      pos = laenge + zeilenListe[i].length;
      break;
    }
    laenge += zeilenListe[i].length + 1;
  }
  if (pos === -1) {
    var davor = text.replace(/\s+$/, "");
    ta.value = davor + (davor ? "\n" : "") + fach + ": ";
    pos = ta.value.length;
  } else {
    ta.value = zeilenListe.join("\n");
  }
  ta.focus();
  try { ta.setSelectionRange(pos, pos); } catch (e) {}
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}
