/* ============================================================
 * Spalten zuordnen: der Dialog, wenn quellen.js unsicher ist
 *
 * Statt „Keine Datumsspalte gefunden“ zeigt das Werkzeug die Spalten der
 * Datei mit einem Beispielwert und eine Vorschau der ersten Buchungen.
 * Wer bestätigt, bekommt die Zuordnung für Dateien mit derselben
 * Kopfzeile gemerkt und wird beim nächsten Export nicht mehr gefragt.
 * ========================================================== */

/**
 * Fragt nach der Zuordnung. Ergebnis: die bestätigte Analyse oder null.
 * `a` wird dabei verändert (felder, reihenfolge).
 */
function zuordnungFragen(a, dateiname) {
  var dlg = $("dlg-zuordnung");
  var felderBox = $("zu-felder");

  $("zu-vorwort").textContent = (a.profil ? a.profil + "-Export erkannt. " : "") +
    "Sag kurz, welche Spalte von „" + dateiname + "“ was enthält. " +
    "Für Dateien mit denselben Spalten merkt sich das Werkzeug die Antwort.";
  var gruende = $("zu-gruende");
  gruende.innerHTML = "";
  a.gruende.forEach(function (g) {
    var li = document.createElement("li");
    li.textContent = g;
    gruende.appendChild(li);
  });
  gruende.hidden = !a.gruende.length;

  // Beispielwert je Spalte: der erste nicht leere.
  var beispiel = a.kopf.map(function (_, i) {
    for (var z = 0; z < a.daten.length && z < 30; z++) {
      var w = String(a.daten[z][i] || "").trim();
      if (w) return w.length > 28 ? w.slice(0, 27) + "…" : w;
    }
    return "";
  });

  felderBox.innerHTML = "";
  FELDER.forEach(function (f) {
    var label = document.createElement("label");
    var titel = document.createElement("span");
    titel.innerHTML = sicher(f.name) + (f.pflicht ? " <i>*</i>" : "");
    var wahl = document.createElement("select");
    wahl.id = "zu-" + f.id;
    var keine = document.createElement("option");
    keine.value = "-1"; keine.textContent = "— keine —";
    wahl.appendChild(keine);
    a.kopf.forEach(function (h, i) {
      var o = document.createElement("option");
      o.value = String(i);
      o.textContent = (h || "Spalte " + (i + 1)) + (beispiel[i] ? "  ·  " + beispiel[i] : "");
      wahl.appendChild(o);
    });
    wahl.value = String(a.felder[f.id]);
    wahl.addEventListener("change", function () {
      a.felder[f.id] = +wahl.value;
      if (f.id === "datum") reihenfolgeNeu();
      aktualisieren();
    });
    label.appendChild(titel);
    label.appendChild(wahl);
    felderBox.appendChild(label);
  });

  var reihe = $("zu-reihenfolge");
  function reihenfolgeNeu() {
    var auto = a.felder.datum !== -1
      ? datumsReihenfolge(a.daten.map(function (z) { return z[a.felder.datum]; })) : "tm";
    $("zu-reihenfolge-hinweis").textContent = auto ? "in dieser Datei eindeutig" : "bitte wählen, beides wäre möglich";
    if (auto) a.reihenfolge = auto;
    reihe.value = a.reihenfolge || "tm";
    if (!a.reihenfolge) a.reihenfolge = "tm";
  }
  reihe.onchange = function () { a.reihenfolge = reihe.value; aktualisieren(); };
  reihenfolgeNeu();

  function aktualisieren() {
    var gelesen = buchungenLesen(a);
    var f = a.felder;
    var ohneText = f.beschreibung === -1 && f.taetigkeit === -1 && f.projekt === -1;
    var tageZahl = {};
    gelesen.buchungen.forEach(function (b) { tageZahl[b.tag] = true; });

    var stand = $("zu-stand");
    if (f.datum === -1) {
      stand.textContent = "Ohne Datum geht es nicht: Welche Spalte enthält es?";
    } else if (!gelesen.buchungen.length) {
      stand.textContent = "In der gewählten Datumsspalte steht kein lesbares Datum.";
    } else if (ohneText) {
      stand.textContent = "Wähle mindestens Beschreibung, Tätigkeit oder Projekt, sonst bleiben die Tage leer.";
    } else {
      stand.textContent = mehrzahl(gelesen.buchungen.length, " Buchung", " Buchungen") + " an " +
        mehrzahl(Object.keys(tageZahl).length, " Tag", " Tagen") +
        (gelesen.ohneDatum ? " · " + mehrzahl(gelesen.ohneDatum, " Zeile", " Zeilen") + " ohne Datum übersprungen" : "");
    }
    stand.className = "zu-stand" + (f.datum === -1 || !gelesen.buchungen.length || ohneText ? " warn" : "");
    $("zu-ja").disabled = f.datum === -1 || !gelesen.buchungen.length || ohneText;

    var tabelle = $("zu-vorschau");
    tabelle.innerHTML = "<thead><tr><th>Datum</th><th>Zeit</th><th>Dauer</th><th>Text</th></tr></thead>";
    var koerper = document.createElement("tbody");
    gelesen.buchungen.slice(0, 5).forEach(function (b) {
      var tr = document.createElement("tr");
      var text = [b.projekt, b.taetigkeit, b.beschreibung].filter(Boolean).join(" · ");
      [dmy(vonIso(b.tag)),
       b.von != null ? uhrzeit(b.von) + (b.bis != null ? "–" + uhrzeit(b.bis) : "") : "",
       b.dauer ? stundenText(Math.round(b.dauer / 3) / 20) + " h" : "",
       text].forEach(function (w) {
        var td = document.createElement("td");
        td.textContent = w;
        tr.appendChild(td);
      });
      koerper.appendChild(tr);
    });
    tabelle.appendChild(koerper);
  }
  aktualisieren();

  return new Promise(function (fertig) {
    function schliessen(ergebnis) {
      $("zu-ja").removeEventListener("click", ja);
      $("zu-nein").removeEventListener("click", nein);
      dlg.removeEventListener("close", nein);
      if (dlg.open) dlg.close();
      fertig(ergebnis);
    }
    function ja() { schliessen(a); }
    function nein() { schliessen(null); }
    $("zu-ja").addEventListener("click", ja);
    $("zu-nein").addEventListener("click", nein);
    dlg.addEventListener("close", nein);
    dlg.showModal();
  });
}
