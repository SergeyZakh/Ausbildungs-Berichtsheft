/* ============================================================
 * Blockwoche: die Themen der Berufsschule für die ganze Woche
 *
 * Der Vordruck will je Woche die Themen des Unterrichts, nicht je Tag. In einer Blockwoche
 * (blockwoche() in zustand.js) steht deshalb nur ein Feld für die ganze Woche da, ohne Beiwerk
 * darüber: Schreiben soll so einfach sein wie ein Blatt Papier.
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

  // In einer Blockwoche sagt der Reiter schon alles. Nur wenn die Woche keine mehr ist, braucht es
  // den Satz, wofür die Themen noch gelten.
  if (!block) {
    var hinweis = document.createElement("p");
    hinweis.className = "ruhig schulhinweis";
    hinweis.textContent = "Diese Themen gelten für jeden Werktag der Woche, der keinen eigenen Text hat.";
    s.leib.appendChild(hinweis);
  }

  var ta = document.createElement("textarea");
  ta.id = "feld-schulwoche";
  ta.value = w.schule || "";
  ta.placeholder = "Welche Themen wurden diese Woche im Unterricht behandelt?";
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
