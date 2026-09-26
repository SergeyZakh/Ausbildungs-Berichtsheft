/* ============================================================
 * Sicherung: der ganze Stand als JSON-Datei
 *
 * Alles liegt nur im localStorage dieses Browsers. Die Sicherung ist
 * genau dieser Eintrag, lesbar formatiert. Laden ersetzt den Stand und
 * lädt die Seite neu; start.js stellt dann alles wie gewohnt her.
 * ========================================================== */

function sicherungSpeichern() {
  clearTimeout(speicherTimer);
  merkenJetzt();
  var stand = geladen();
  if (!stand) { sage("Es gibt noch nichts zu sichern.", "warn"); return; }
  var name = "Berichtsheft-Sicherung-" + iso(new Date()) + ".json";
  dateiAnbieten(new Blob([JSON.stringify(stand, null, 2)], { type: "application/json" }), name);
}

/** Eine Frage mit zwei Knöpfen; Escape heißt nein. */
function frage(titel, text, jaText) {
  var dlg = $("dlg-frage");
  $("frage-titel").textContent = titel;
  $("frage-text").textContent = text;
  $("frage-ja").textContent = jaText;
  return new Promise(function (fertig) {
    function schliessen(antwort) {
      $("frage-ja").removeEventListener("click", ja);
      $("frage-nein").removeEventListener("click", nein);
      dlg.removeEventListener("close", nein);
      if (dlg.open) dlg.close();
      fertig(antwort);
    }
    function ja() { schliessen(true); }
    function nein() { schliessen(false); }
    $("frage-ja").addEventListener("click", ja);
    $("frage-nein").addEventListener("click", nein);
    dlg.addEventListener("close", nein);
    dlg.showModal();
  });
}

function sicherungLaden(datei) {
  var leser = new FileReader();
  leser.onload = async function () {
    var stand;
    try { stand = JSON.parse(leser.result); } catch (e) { stand = null; }
    if (!stand || typeof stand !== "object" || typeof stand.tage !== "object" || !stand.tage) {
      sage(datei.name + " ist keine Sicherung des Berichtshefts.", "warn");
      return;
    }
    var anzahl = Object.keys(stand.tage).length;
    if (Object.keys(tage).length) {
      var ok = await frage("Sicherung laden?",
        "Der Stand in diesem Browser (" + mehrzahl(Object.keys(tage).length, " Tag", " Tage") +
        ") wird durch die Sicherung (" + mehrzahl(anzahl, " Tag", " Tage") + ") ersetzt. " +
        "Wer den jetzigen Stand behalten will, speichert vorher eine Sicherung.",
        "Ersetzen");
      if (!ok) return;
    }
    clearTimeout(speicherTimer);
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(stand));
    } catch (e) {
      sage("Die Sicherung ließ sich nicht speichern: " + e.message, "warn");
      return;
    }
    location.reload();
  };
  leser.readAsText(datei);
}

$("btn-sicherung").addEventListener("click", sicherungSpeichern);
$("btn-sicherung-laden").addEventListener("click", function () { $("sicherungsdatei").click(); });
$("sicherungsdatei").addEventListener("change", function (e) {
  if (e.target.files && e.target.files[0]) sicherungLaden(e.target.files[0]);
  e.target.value = "";
});
