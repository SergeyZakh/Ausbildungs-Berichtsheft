/* ============================================================
 * Dialog "Deine Daten": Stammdaten, Verarbeitung, Sprachmodell, Löschen
 * ========================================================== */

var dlg = $("dlg-stamm");

/* Pflichtangaben für den Vordruck. */
var PFLICHT = [
  ["f-name", "Name"], ["f-beruf", "Ausbildungsberuf"],
  ["f-betrieb", "Ausbildungsbetrieb"], ["f-beginn", "Vertragsbeginn"],
  ["f-ende", "Vertragsende"]
];

/** Zwischen den Reitern des Dialogs umschalten. */
function blattZeigen(ziel) {
  Array.prototype.forEach.call(dlg.querySelectorAll(".dlg-blatt"), function (b) {
    b.hidden = b.getAttribute("data-blatt") !== ziel;
  });
  Array.prototype.forEach.call(dlg.querySelectorAll(".blattleiste button"), function (b) {
    b.setAttribute("aria-selected", String(b.getAttribute("data-ziel") === ziel));
  });
  if (ziel !== "gefahr") gefahrSchliessen();
  if (ziel === "ki") kiModelleLaden();
}

/**
 * Die Modelle des eingetragenen Ollama zur Auswahl stellen. Läuft still: Ist nichts erreichbar,
 * bleibt das Feld ein gewöhnliches Textfeld – niemand soll ohne Ollama eine Fehlermeldung
 * bekommen, nur weil er den Reiter geöffnet hat.
 */
function kiModelleLaden() {
  var liste = $("ki-modelle");
  if (!liste) return;
  if (kiBereit()) {
    kiErreichbar().then(function (stand) {
      kiModelleZeigen(stand.namen);
    }).catch(function () { /* ohne Modell-Liste bleibt es ein Textfeld */ });
    return;
  }
  // Noch keine Adresse eingetragen: die möglichen durchprobieren, statt sie erraten zu lassen.
  // Antwortet eine, stehen Adresse und Modelle da, bevor jemand „Verbindung prüfen“ sucht.
  kiAdresseSuchen().then(function (treffer) {
    if (!treffer) return;
    kiModelleZeigen(treffer.namen);
    stammStandZeigen();
    var hinweis = $("ki-pruefhinweis");
    hinweis.className = "pruefhinweis gut";
    hinweis.textContent = "Sprachmodell unter „" + treffer.adresse + "“ gefunden.";
  }).catch(function () { /* ohne Fund bleibt das Feld leer */ });
}

/** Namen in die Auswahlliste; ist noch kein Modell eingetragen, das erste übernehmen. */
function kiModelleZeigen(namen) {
  var liste = $("ki-modelle"), pfeil = $("btn-ki-modelle"), feld = $("f-ki-modell");
  if (!liste) return;
  liste.innerHTML = "";
  (namen || []).forEach(function (name) {
    var knopf = document.createElement("button");
    knopf.type = "button";
    knopf.setAttribute("role", "option");
    knopf.setAttribute("aria-selected", String(name === feld.value.trim()));
    // Name und Haken getrennt, damit lange Namen abgeschnitten werden und der Haken stehen bleibt.
    var text = document.createElement("span");
    text.textContent = name;
    var haken = document.createElement("em");
    haken.textContent = "✓";
    knopf.appendChild(text);
    knopf.appendChild(haken);
    knopf.title = name;
    knopf.addEventListener("click", function () {
      feld.value = name;
      kiListeSchliessen();
      merken();
      stammStandZeigen();
    });
    liste.appendChild(knopf);
  });
  // Ohne erreichbaren Dienst bleibt es ein gewöhnliches Textfeld, ohne Pfeil.
  pfeil.hidden = !(namen && namen.length);
  if (!feld.value.trim() && namen && namen.length) {
    feld.value = namen[0];
    merken();
  }
}

function kiListeSchliessen() {
  $("ki-modelle").hidden = true;
  $("btn-ki-modelle").setAttribute("aria-expanded", "false");
}

$("btn-ki-modelle").addEventListener("click", function (e) {
  e.stopPropagation();
  var liste = $("ki-modelle");
  if (!liste.hidden) return kiListeSchliessen();
  // Der Haken steht beim Modell, das gerade im Feld steht.
  var wert = $("f-ki-modell").value.trim();
  Array.prototype.forEach.call(liste.children, function (k) {
    k.setAttribute("aria-selected", String(k.firstChild.textContent === wert));
  });
  liste.hidden = false;
  this.setAttribute("aria-expanded", "true");
});
document.addEventListener("click", function (e) {
  if (!$("ki-modelle").hidden && !$("ki-modelle").contains(e.target)) kiListeSchliessen();
});
$("f-ki-modell").addEventListener("keydown", function (e) {
  if (e.key === "Escape" && !$("ki-modelle").hidden) { e.stopPropagation(); kiListeSchliessen(); }
});

function stammStandZeigen() {
  var fehlt = PFLICHT.filter(function (f) { return !$(f[0]).value.trim(); });
  var feld = $("stamm-stand");
  if (!fehlt.length) {
    feld.className = "hinweis-stamm";
    feld.textContent = "Alles da, was der Vordruck verlangt. Gespeichert wird schon beim Tippen.";
    return;
  }
  feld.className = "hinweis-stamm fehlt";
  feld.textContent = "Für den Vordruck fehlt noch: " +
    fehlt.map(function (f) { return f[1]; }).join(", ") + ".";
}

Array.prototype.forEach.call(dlg.querySelectorAll(".blattleiste button"), function (b) {
  b.addEventListener("click", function () { blattZeigen(b.getAttribute("data-ziel")); });
});

$("btn-stamm").addEventListener("click", function () {
  menueSchliessen(); lehrjahrZeigen(); stammStandZeigen(); anweisungenZaehlen(); gefahrZeilenZeigen();
  schulplanZeigen();
  blattZeigen("ausbildung"); dlg.showModal();
});
$("dlg-zu").addEventListener("click", function () { dlg.close(); });
$("dlg-fertig").addEventListener("click", function () { dlg.close(); });

/* Beim Schließen speichern und neu zeichnen: Abteilung, Listen und
   Modelladresse wirken auf die Tagesansicht. Nach "Alles löschen" darf
   nichts gespeichert werden (dlgLeerSchliessen). */
var dlgLeerSchliessen = false;
dlg.addEventListener("close", function () {
  gefahrSchliessen();
  if (dlgLeerSchliessen) { dlgLeerSchliessen = false; return; }
  merkenJetzt(); zeichnen();
});

// Die drei Listen verändern jeden Entwurf.
["f-ausblenden", "f-namen", "f-projektraus"].forEach(function (id) {
  $(id).addEventListener("change", function () { entwuerfeNeu(); zeichnen(); merken(); });
});

["f-name", "f-beruf", "f-betrieb", "f-abteilung", "f-ausbilder", "f-schule", "f-schulbloecke", "f-schulferien",
 "f-vordruck", "f-beginn", "f-ende",
 "f-geburtsort", "f-geburtsdatum", "f-anschrift", "f-zweig", "f-land", "f-vertragAm", "f-vertreterName", "f-vertreterAnschrift",
 "f-ausblenden", "f-namen", "f-projektraus", "f-ki-adresse", "f-ki-modell", "f-ki-anweisungen", "f-ki-stichpunkte"]
  .forEach(function (id) {
    var datum = id === "f-beginn" || id === "f-ende";
    $(id).addEventListener("input", function () {
      if (datum) lehrjahrZeigen();
      merken(); stammStandZeigen();
    });
    if (datum) {
      $(id).addEventListener("change", function () { lehrjahrZeigen(); merken(); stammStandZeigen(); });
    }
  });

/* ---------- Schulplan ----------
   Gespeichert und abgeglichen wird nur das versteckte Feld f-schultage ("Di, Mi"). Beim Laden
   und aus dem Konto kommt allein sein Wert; die Schalter holen ihn sich, wenn der Dialog aufgeht. */
var schultagSchalter = Array.prototype.slice.call($("schultage-wahl").querySelectorAll("input[type=checkbox]"));

function schulplanZeigen() {
  var gewaehlt = schultageLesen($("f-schultage").value);
  schultagSchalter.forEach(function (k) {
    k.checked = gewaehlt.indexOf(WERKTAGE_KURZ.indexOf(k.value)) !== -1;
  });
  bloeckeStandZeigen();
}

schultagSchalter.forEach(function (k) {
  k.addEventListener("change", function () {
    $("f-schultage").value = schultagSchalter
      .filter(function (x) { return x.checked; })
      .map(function (x) { return x.value; }).join(", ");
    merken();
  });
});

/* Blockunterricht und Ferien stehen als Marken da, gewählt im Kalender (zeitraum.js). */
function bloeckeStandZeigen() { zeitraeumeZeigen(); }
$("f-schulbloecke").addEventListener("input", bloeckeStandZeigen);
$("f-schulferien").addEventListener("input", bloeckeStandZeigen);

/** Zeichenzähler unter den eigenen Anweisungen. */
function anweisungenZaehlen() {
  $("ki-anweisungen-zahl").textContent = $("f-ki-anweisungen").value.length + " / " + KI_ANWEISUNGEN_MAX;
}
$("f-ki-anweisungen").addEventListener("input", anweisungenZaehlen);

/* ---------- Verbindung zum Sprachmodell prüfen ---------- */
$("btn-ki-pruefen").addEventListener("click", async function () {
  var knopf = this;
  var ampel = $("ki-ampel"), hinweis = $("ki-pruefhinweis");
  var e = kiEinstellungen();
  if (!e.adresse) {
    ampel.hidden = true;
    hinweis.className = "pruefhinweis schlecht";
    hinweis.textContent = "Erst eine Adresse eintragen.";
    return;
  }
  knopf.disabled = true;
  ampel.hidden = true;
  hinweis.className = "pruefhinweis";
  hinweis.textContent = "wird geprüft …";
  try {
    // Mindestens gut eine Sekunde warten, sonst sieht niemand, dass geprüft wurde.
    var beides = await Promise.all([
      kiErreichbar(),
      new Promise(function (r) { setTimeout(r, 1100); })
    ]);
    var stand = beides[0];
    kiModelleZeigen(stand.namen);
    // Die Liste kann ein leeres Modellfeld gerade mit dem ersten Modell gefüllt haben. Dann gilt
    // dieses – sonst meldete die Prüfung ein Modell als fehlend, das nun im Feld steht.
    var modell = $("f-ki-modell").value.trim();
    var gefunden = !!modell && stand.namen.some(function (n) {
      return n === modell || n.split(":")[0] === modell.split(":")[0];
    });
    ampel.hidden = false;
    if (gefunden) {
      ampel.className = "ampel gut";
      hinweis.className = "pruefhinweis gut";
      hinweis.textContent = 'Erreichbar, "' + modell + '" ist installiert.';
    } else {
      ampel.className = "ampel schlecht";
      hinweis.className = "pruefhinweis schlecht";
      hinweis.textContent = stand.namen.length
        ? 'Erreichbar, aber "' + modell + '" ist dort nicht installiert. Wähle eines aus der Liste im Feld Modell: ' +
          stand.namen.slice(0, 4).join(", ")
        : 'Erreichbar, aber dort ist kein Modell installiert (ollama pull qwen3.5:4b).';
    }
  } catch (fehler) {
    ampel.hidden = false;
    ampel.className = "ampel schlecht";
    hinweis.className = "pruefhinweis schlecht";
    hinweis.textContent = fehler.message;
  } finally {
    knopf.disabled = false;
  }
});

/* ---------- Gefahrenbereich ----------
   Zwei Schritte: erst sagen, was verloren geht, dann "LÖSCHEN" tippen lassen. */
var gefahrTat = null;   // "import" | "alles"

function gefahrSchliessen() {
  $("gefahrhinweis").hidden = true;
  $("gefahrfrage").hidden = true;
  $("gefahrwort").value = "";
  $("gefahr-ja").disabled = true;
  gefahrTat = null;
}

/** Hinweis im Dialog: Die Fußleiste mit sage() liegt hinter dem offenen Dialog. */
function gefahrHinweis(text) {
  gefahrSchliessen();
  $("gefahrhinweis").textContent = text;
  $("gefahrhinweis").hidden = false;
}

function gefahrFragen(was, text) {
  $("gefahrhinweis").hidden = true;
  gefahrTat = was;
  $("gefahrtext").textContent = text;
  $("gefahrfrage").hidden = false;
  $("gefahrwort").value = "";
  $("gefahr-ja").disabled = true;
  $("gefahrwort").focus();
}

$("btn-import-weg").addEventListener("click", function () {
  var liste = Object.keys(tage).filter(function (k) { return ausImport(tage[k]); });
  if (!liste.length) {
    // Das Konto kennt nur die fertigen Texte, nicht Buchungen und Entwürfe. Was von dort kommt,
    // lässt sich also nicht mehr als importiert erkennen.
    gefahrHinweis(mitKontoAbgleich()
      ? "Hier gibt es nichts zu verwerfen: Das gilt nur für Importe in diesem Browser. Texte aus " +
        "deinem Konto zählen als geschrieben – ändern oder leeren kannst du sie direkt am Tag."
      : "Es sind keine importierten Daten geladen.");
    return;
  }
  var bleiben = liste.filter(function (k) { return eigenerText(tage[k]); }).length;
  gefahrFragen("import",
    liste.length + " importierte Tage werden entfernt: Buchungen, Stunden und " +
    "jeder Text, der aus dem Entwurf oder vom Sprachmodell stammt – auch überarbeitet. " +
    (bleiben ? "Bei " + bleiben + (bleiben === 1 ? " Tag bleibt" : " Tagen bleibt") +
      " der komplett selbst geschriebene Text stehen. " : "") +
    "Stammdaten und Wochenangaben bleiben.");
});

$("btn-alles-weg").addEventListener("click", function () {
  gefahrFragen("alles", mitKontoAbgleich()
    ? "Der gesamte Stand wird aus diesem Browser gelöscht: " +
      Object.keys(tage).length + " Tage, " + wochen.length + " Wochen, " +
      "alle Texte und deine Stammdaten. Dein Konto bleibt unberührt: Der Stand dort " +
      "wird gleich danach neu geladen, und wer dich betreut, sieht ihn weiter."
    : "Der gesamte Stand wird aus diesem Browser gelöscht: " +
      Object.keys(tage).length + " Tage, " + wochen.length + " Wochen, " +
      "alle Texte und deine Stammdaten. Es gibt keine Sicherung.");
});

/** Angemeldet als Azubi: Der eigene Stand wird mit dem Konto abgeglichen. */
function mitKontoAbgleich() {
  return !!(KONTO.person && KONTO.person.rolle !== "ausbilder");
}

/** Mit Konto brächte „Alles löschen“ nichts: Der Stand käme gleich wieder aus dem Konto. */
function gefahrZeilenZeigen() {
  var konto = mitKontoAbgleich();
  $("zeile-alles-weg").hidden = konto;
  $("zeile-konto-loeschen").hidden = !konto;
}

$("gefahrwort").addEventListener("input", function (e) {
  $("gefahr-ja").disabled = e.target.value.trim().toUpperCase() !== "LÖSCHEN";
});
$("gefahr-nein").addEventListener("click", gefahrSchliessen);

$("gefahr-ja").addEventListener("click", function () {
  if (gefahrTat === "import") importDatenVerwerfen();
  else if (gefahrTat === "alles") allesLoeschen();
});

/** Kam dieser Tag aus einem Import? */
function ausImport(t) {
  return !!(t && ((t.posten && t.posten.length) || t.entwurf != null || t.kiText != null || t.vorKi != null));
}

/**
 * Ist der Text eines importierten Tags ganz selbst geschrieben? Nein, sobald er
 * vom Sprachmodell kommt oder eine Zeile aus dem Entwurf enthält –
 * auch wenn daneben etwas geändert wurde.
 */
function eigenerText(t) {
  if (!(t.text || "").trim() || t.kiText != null || t.vorKi != null) return false;
  if (t.entwurf == null) return true;
  var ausEntwurf = {};
  zeilen(t.entwurf).forEach(function (z) { ausEntwurf[z.trim()] = true; });
  return !zeilen(t.text).some(function (z) { return ausEntwurf[z.trim()]; });
}

/**
 * Alles Importierte entfernen: Buchungen, Zeiten, Entwürfe und daraus
 * entstandene Texte. Ein Tag bleibt nur mit ganz eigenem Text oder
 * einer selbst gewählten Art (Urlaub, Berufsschule …), dann ohne Zeiten.
 */
function importDatenVerwerfen() {
  var weg = 0, behalten = 0;
  Object.keys(tage).forEach(function (k) {
    var t = tage[k];
    if (!ausImport(t)) return;
    var text = eigenerText(t);
    // Mit Konto bleibt der Tag leer stehen: Nur so geht „jetzt leer“ an den Server.
    // Ein entfernter Tag käme dort nie an, der Text bliebe im Konto und beim Ausbilder.
    if (!text && !t.art && !mitKontoAbgleich()) { delete tage[k]; weg++; return; }
    if (!text) { t.text = ""; delete t.geprueft; }
    else behalten++;
    ["posten", "entwurf", "kiText", "vorKi"].forEach(function (f) { delete t[f]; });
    t.von = null; t.bis = null; t.pausen = []; t.pauseMinuten = 0; t.stunden = null;
    weg++;
  });
  gefahrSchliessen();
  wochenNeu();
  if (!wochen.length) aktiveWoche = null;
  dlg.close();   // speichert und zeichnet neu
  // Das Schließen speichert nur; ohne Anstoß ginge die Änderung erst mit der nächsten Eingabe ins Konto.
  kontoAbgleichBald();
  sage("Importierte Daten entfernt: " + mehrzahl(weg, " Tag", " Tage") +
    (behalten ? ", " + behalten + " mit eigenem Text behalten." : "."), "gut");
}

/** Den gesamten Stand löschen, auch die Stammdatenfelder – sonst schriebe
 *  das Schließen des Dialogs sie gleich wieder in den Speicher. */
function allesLoeschen() {
  tage = {}; wochendaten = {}; kunden.length = 0; browserHinweise = {};
  aktiveWoche = null; aktiverTag = 0; monatAnker = null;

  Object.keys(stammdaten()).forEach(function (k) {
    var feld = stammFeld(k);
    if (feld) feld.value = "";
  });
  lehrjahrZeigen();
  $("ki-ampel").hidden = true;
  $("ki-pruefhinweis").textContent = "";

  // Das Leeren selbst ist keine Änderung: Sonst stempelte die nächste Eingabe die leeren
  // Stammdaten als neu, und der Abgleich überschriebe damit die im Konto.
  stammGeaendert = null; wochenGeaendert = {};
  zuletztGesichert = { __stamm: JSON.stringify(stammdaten()) };

  gefahrSchliessen();
  dlgLeerSchliessen = true;
  dlg.close();
  // Ein ausstehendes Speichern schriebe den Speicher gleich wieder an.
  speichernVerwerfen();
  try { localStorage.removeItem(SPEICHER); } catch (e) { /* ohne Speicher */ }
  wochenNeu(); zeichnen();
  standZeigen(null);

  if (!mitKontoAbgleich()) {
    sage("Alles gelöscht. Das Werkzeug steht wieder am Anfang.", "gut");
    return;
  }
  // Mit Konto wird nur dieser Browser leer. Ohne die Marke des letzten Abgleichs fragte er
  // sonst nur nach Neuem, und der Stand im Konto käme hier nie wieder an.
  try { localStorage.removeItem(KONTO_SPEICHER); } catch (e) { /* ohne Speicher */ }
  sage("Browser geleert. Dein Stand wird aus dem Konto neu geladen.", "gut");
  kontoNeuLaden();
}
