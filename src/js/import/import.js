/* ============================================================
 * Import einer CSV aus der Zeiterfassung: Dateiauswahl oder ins Fenster ziehen
 * ========================================================== */

/* Der letzte Import mit dem Stand davor: „Spalten prüfen“ kann ihn so
   mit geänderter Zuordnung wiederholen, ohne falsche Tage zu hinterlassen. */
var letzterImport = null;

/** Eine Datei lesen, Spalten erkennen, bei Unsicherheit nachfragen, dann einfügen. */
function verarbeite(datei) {
  if (/\.(xlsx|xls|ods|numbers)$/i.test(datei.name)) {
    sage("Tabellen bitte als CSV speichern – in Excel: Datei → Speichern unter → „CSV UTF-8“.", "warn");
    return;
  }
  var leser = new FileReader();
  leser.onload = async function () {
    var a;
    try {
      a = csvAnalysieren(csvDekodieren(leser.result));
    } catch (e) {
      sage(e.message, "warn");
      return;
    }
    if (!a.sicher) {
      a = await zuordnungFragen(a, datei.name);
      if (!a) { sage("Import abgebrochen.", ""); return; }
      zuordnungMerken(a.signatur, a);
    }
    importAnwenden(a, datei.name);
  };
  leser.onerror = function () { sage("Die Datei konnte nicht gelesen werden.", "warn"); };
  leser.readAsArrayBuffer(datei);
}

/**
 * Die gelesenen Tage in den vorhandenen Stand einfügen.
 *
 * Der Export ergänzt das Heft, er ersetzt es nicht: Tage aus dem neuen
 * Export bekommen den neuen Stand, alle anderen bleiben. Für einen
 * importierten Tag gewinnt nur selbst Geschriebenes gegen den frischen
 * Entwurf – ein unveränderter Entwurf oder eine unveränderte
 * Modellausgabe wird ersetzt, sonst gingen neue Buchungen verloren.
 */
function importAnwenden(a, name) {
  // Noch nicht gespeicherte Eingaben zuerst sichern, sonst überschreibt
  // der gespeicherte Stand sie gleich.
  clearTimeout(speicherTimer);
  merkenJetzt();
  var alt = geladen();
  var vorher = {
    tage: JSON.parse(JSON.stringify(tage)),
    wochen: JSON.parse(JSON.stringify(wochendaten)),
    kunden: kunden.slice()
  };
  try {
    var frisch = tageAusBuchungen(buchungenLesen(a).buchungen);
    if (alt && alt.wochen) wochendaten = alt.wochen;
    if (alt && alt.kunden) alt.kunden.forEach(kundeMerken);

    Object.keys(frisch).forEach(function (k) { tage[k] = frisch[k]; });

    // `texte` ist der Schlüssel aus älteren Fassungen.
    var gespeicherte = (alt && (alt.tage || alt.texte)) || null;
    if (gespeicherte) {
      Object.keys(frisch).forEach(function (k) {
        var g = gespeicherte[k], t = tage[k];
        if (!g || !t) return;
        if (g.art) t.art = g.art;
        var warEntwurf = g.entwurf != null && g.text === g.entwurf;
        // Ältere Stände ohne kiText: gesetztes vorKi heißt Modellausgabe.
        var warKi = g.kiText != null ? g.text === g.kiText : g.vorKi != null;
        if (g.text && !warEntwurf && !warKi) {
          t.text = g.text;
          if (g.vorKi != null) t.vorKi = g.vorKi;
          if (g.kiText != null) t.kiText = g.kiText;
          if (g.geprueft) t.geprueft = true;
        }
      });
    }
    aktiveWoche = null;
    aktiverTag = 0;
    wochenNeu();
    zeichnen();
    merkenJetzt();
    letzterImport = { analyse: a, name: name, vorher: vorher };
    var neue = Object.keys(frisch).length;
    var gesamt = Object.keys(tage).length;
    sage((a.profil ? a.profil + ": " : "") + name + " geladen, " + mehrzahl(neue, " Tag", " Tage") +
      (gesamt > neue ? " — " + gesamt + " Tage im Heft" : "") + ".", "gut");
    notizKnopf("Spalten prüfen", importKorrigieren);
  } catch (e) {
    // tageAusBuchungen() hat die Kundenliste schon geleert; ohne sie ginge
    // ungefilterter Text ans Modell.
    kunden = vorher.kunden;
    zeichnen();
    sage(e.message, "warn");
  }
}

/** Den letzten Import mit neuer Zuordnung wiederholen: erst den Stand davor zurück, dann neu einfügen. */
async function importKorrigieren() {
  if (!letzterImport) return;
  var li = letzterImport;
  li.analyse.gruende = [];
  var a = await zuordnungFragen(li.analyse, li.name);
  if (!a) return;
  zuordnungMerken(a.signatur, a);
  tage = li.vorher.tage;
  wochendaten = li.vorher.wochen;
  kunden = li.vorher.kunden;
  merkenJetzt();
  importAnwenden(a, li.name);
}

/** Ein kleiner Knopf hinter der Meldung in der Fußleiste. Die nächste Meldung entfernt ihn. */
function notizKnopf(text, aktion) {
  var knopf = document.createElement("button");
  knopf.type = "button";
  knopf.className = "notizknopf";
  knopf.textContent = text;
  knopf.addEventListener("click", aktion);
  $("notiz").appendChild(knopf);
}

$("datei").addEventListener("change", function (e) {
  if (e.target.files && e.target.files[0]) verarbeite(e.target.files[0]);
  e.target.value = "";
});
$("btn-laden").addEventListener("click", function () { $("datei").click(); });

/* ---------- Ziehen und Ablegen ----------
   Die Ablagefläche hält ein Wecker offen, den jedes dragover neu stellt.
   Ein Zähler über dragenter/dragleave verzählt sich, sobald ein Ereignis
   ausbleibt, und die Fläche bliebe dann für immer stehen. */
var ziehWecker = null;

function istDatei(e) {
  return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") !== -1;
}
function ziehenZeigen() {
  $("ablage").hidden = false;
  clearTimeout(ziehWecker);
  // dragover feuert laut Spezifikation mindestens alle 350 ms.
  ziehWecker = setTimeout(ziehenVerbergen, 600);
}
function ziehenVerbergen() {
  clearTimeout(ziehWecker);
  ziehWecker = null;
  $("ablage").hidden = true;
}

window.addEventListener("dragover", function (e) {
  if (!istDatei(e)) return;
  e.preventDefault();
  ziehenZeigen();
});
window.addEventListener("dragend", ziehenVerbergen);
// Eine Mausbewegung gibt es nur, wenn nichts gezogen wird.
window.addEventListener("mousemove", function () {
  if (!$("ablage").hidden) ziehenVerbergen();
});
window.addEventListener("drop", function (e) {
  if (!istDatei(e)) return;
  e.preventDefault();
  ziehenVerbergen();
  var datei = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!datei) return;
  if (/\.json$/i.test(datei.name)) { sicherungLaden(datei); return; }
  if (!/\.(csv|tsv|txt|xlsx|xls|ods|numbers)$/i.test(datei.name)) {
    sage("Das ist keine CSV-Datei. Erwartet wird ein Export aus der Zeiterfassung oder eine Sicherung.", "warn");
    return;
  }
  verarbeite(datei);
});
