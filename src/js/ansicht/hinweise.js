/* ============================================================
 * Hinweise über den Reitern: Home-Bildschirm, Sicherung, was noch fehlt
 *
 * Höchstens einer steht da, der wichtigste zuerst. Wer einen wegklickt, hat für diese Sitzung
 * Ruhe: Drei Hinweise nacheinander wären eine Kette, die man abarbeiten muss, bevor man schreibt.
 *
 * Am Handy steht jeder Hinweis in seiner kurzen Fassung (`kurz`): eine, höchstens zwei Zeilen und
 * ein Knopf. Die langen nahmen dort den halben Bildschirm, bevor man die Woche sah; der Tipp fürs
 * iPhone allein sechs Zeilen und zwei Knöpfe. „Wie?“ oder „Mehr“ zeigt die lange Fassung.
 * ========================================================== */

/* Safari löscht, was eine Seite gespeichert hat, nach sieben Tagen Safari-Nutzung ohne Besuch
   dieser Seite. Ein Heft, das nur im Browser liegt, wäre dann weg. Vom Home-Bildschirm aus gilt
   das nicht; dort hat die Seite aber einen eigenen Speicher und beginnt leer. */
function amIphone() {
  var ua = navigator.userAgent || "";
  // iPadOS meldet sich als Mac; verraten wird es von den Touchpunkten.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function alsApp() {
  try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) {}
  return navigator.standalone === true;
}

/* Ohne neue Sicherung nach so vielen Tagen erinnert das Werkzeug daran. */
var SICHERUNG_TAGE = 14;

function tageSeit(zeitIso) {
  var t = Date.parse(zeitIso);
  return isNaN(t) ? 0 : Math.floor((Date.now() - t) / 86400000);
}

/**
 * Ist eine Sicherung fällig? Erst wenn sich seit der letzten etwas geändert hat und sie (oder,
 * ohne Sicherung, die erste Eingabe) mindestens SICHERUNG_TAGE zurückliegt. „Später“ schiebt die
 * Erinnerung um dieselbe Zeit.
 */
function sicherungFaellig() {
  var zeiten = Object.keys(tage).map(function (k) { return tage[k].geaendert; }).filter(Boolean).sort();
  if (!zeiten.length) return false;
  var gesichert = browserHinweise.gesichert || "";
  if (gesichert && zeiten[zeiten.length - 1] <= gesichert) return false;
  var bezug = gesichert || zeiten[0];
  if (browserHinweise.sicherungSpaeter && browserHinweise.sicherungSpaeter > bezug) bezug = browserHinweise.sicherungSpaeter;
  return tageSeit(bezug) >= SICHERUNG_TAGE;
}

/**
 * Die Wochen vor der laufenden, in denen noch etwas fehlt, vom Ausbildungsbeginn an (ohne ihn
 * vom ersten Eintrag an). Die laufende Woche zählt nicht: An ihr wird noch geschrieben.
 */
function offeneWochen() {
  var anfang = $("f-beginn").value || ersterEingetragenerTag();
  if (!anfang) return [];
  var bis = montagVon(new Date()), out = [];
  for (var m = montagVon(vonIso(anfang)); m < bis; m = plus(m, 7)) {
    var b = wochenBilanz(iso(m));
    if (b.ohneText || b.ungelesen) out.push({ montag: iso(m), bilanz: b });
  }
  return out;
}

/** "2 Tage ohne Text, 1 nicht gegengelesen" */
function bilanzText(b) {
  var teile = [];
  if (b.ohneText) teile.push(mehrzahl(b.ohneText, " Tag", " Tage") + " ohne Text");
  if (b.ungelesen) teile.push(b.ungelesen + " nicht gegengelesen");
  return teile.join(", ");
}

/* Für diese Sitzung: „Was fehlt noch?“ nur, wenn beim Öffnen etwas fehlte. Nach einem Import oder
   dem Beispiel käme er sonst sofort und meldete die Lücken, die gerade erst entstanden sind. Er
   verschwindet, sobald alles da ist, und kommt dann nicht wieder; nach dem Wegklicken oder
   Hinspringen ist ganz Ruhe. */
var hinweisRuhe = false, fehltZeigen = false;

/* Welcher Hinweis am Handy aufgeklappt ist („Wie?“, „Mehr“): seine Art. */
var hinweisGross = "";

/* Nach einem Import steht das Ergebnis als Karte oben, mit „Spalten prüfen“. Sie bleibt, bis man
   sie schließt: Als Knopf in der Meldung war die Korrektur am Handy nach Sekunden verschwunden. */
var importKarte = null;

function importKarteZeigen(k) { importKarte = k; hinweiseZeigen(); }
function importKarteWeg() { importKarte = null; hinweiseZeigen(); }

function importHinweis(k) {
  var titel = (k.profil ? k.profil + "-Import" : "Import") + " fertig.";
  // Vorgeschlagene Schultage zuerst: Nichts wird Berufsschule, bevor man es hier bestätigt.
  if (k.vorschlag && k.vorschlag.length) {
    var entscheiden = function (uebernehmen) {
      var ja = uebernehmen ? k.vorschlag.filter(function (v) { return v.an; }).map(function (v) { return v.tag; }) : [];
      var nein = k.vorschlag.map(function (v) { return v.tag; }).filter(function (d) { return ja.indexOf(d) === -1; });
      schultageAblehnen(nein);
      if (ja.length) schultageUebernehmen(ja);
      k.vorschlag = null;
      k.schule = (k.schule || 0) + ja.length;
      hinweiseZeigen();
      sage(ja.length ? mehrzahl(ja.length, " Tag", " Tage") + " als Berufsschule übernommen." : "Alle Tage bleiben Arbeitstage.", "gut");
    };
    return {
      art: "import schulwahl", titel: titel,
      text: mehrzahl(k.neue, " Tag", " Tage") + " aus „" + k.name + "“. " +
        (k.vorschlag.length === 1 ? "Dieser Tag sieht" : "Diese Tage sehen") + " nach Berufsschule aus:",
      liste: schulVorschlagListe(k.vorschlag),
      knoepfe: [["Als Berufsschule übernehmen", function () { entscheiden(true); }, true],
        ["Alles Betrieb", function () { entscheiden(false); }], ["Spalten prüfen", importKorrigieren]],
      kurz: {
        titel: mehrzahl(k.neue, " Tag", " Tage") + " importiert.",
        text: "Nach Berufsschule " + (k.vorschlag.length === 1 ? "sieht" : "sehen") + " aus:",
        link: ["Spalten prüfen", importKorrigieren],
        knoepfe: [["Übernehmen", function () { entscheiden(true); }, true], ["Alles Betrieb", function () { entscheiden(false); }]]
      },
      zu: importKarteWeg
    };
  }
  return {
    art: "import", titel: (k.profil ? k.profil + "-Import" : "Import") + " fertig.",
    text: mehrzahl(k.neue, " Tag", " Tage") + " aus „" + k.name + "“" +
      (k.schule ? ", davon " + k.schule + " Berufsschule" : "") +
      (k.gesamt > k.neue ? " — " + k.gesamt + " Tage im Heft" : "") +
      ". Stimmt etwas nicht, ordne die Spalten neu zu.",
    knoepfe: [["Spalten prüfen", importKorrigieren], ["Passt", importKarteWeg, true]],
    kurz: {
      titel: mehrzahl(k.neue, " Tag", " Tage") + " importiert" + (k.schule ? ", " + k.schule + " Berufsschule." : "."),
      link: ["Spalten prüfen", importKorrigieren],
      knoepfe: [["Passt", importKarteWeg, true]]
    },
    zu: importKarteWeg
  };
}

/** Die vorgeschlagenen Schultage zum Abhaken: Tag, Datum und was gebucht ist. */
function schulVorschlagListe(vorschlag) {
  var liste = document.createElement("div");
  liste.className = "schulwahl-liste";
  vorschlag.forEach(function (v) {
    var zeile = document.createElement("label");
    zeile.className = "schulwahl-zeile";
    var haken = document.createElement("input");
    haken.type = "checkbox";
    haken.checked = v.an;
    haken.setAttribute("data-datum", v.tag);
    haken.addEventListener("change", function () { v.an = haken.checked; });
    var tag = document.createElement("b");
    tag.textContent = KURZ[vonIso(v.tag).getDay()] + " " + dm(vonIso(v.tag));
    var was = document.createElement("span");
    was.textContent = schulVorschauText(v.tag);
    zeile.appendChild(haken);
    zeile.appendChild(tag);
    zeile.appendChild(was);
    liste.appendChild(zeile);
  });
  return liste;
}

function hinweiseBeimOeffnen() {
  fehltZeigen = wochen.length > 0 && offeneWochen().length > 0;
  hinweiseZeigen();
}

function hinweisWeg() {
  hinweisRuhe = true;
  hinweiseZeigen();
}

/** Der wichtigste Hinweis, der gerade gilt, sonst null. */
function hinweisWaehlen() {
  // zeichnen() kann laufen, bevor konto.js geladen ist; dann gibt es noch kein KONTO.
  if (typeof KONTO === "undefined" || (KONTO.person && KONTO.person.rolle === "ausbilder")) return null;
  var ohneKonto = !KONTO.person;
  var imNetz = location.protocol === "http:" || location.protocol === "https:";

  if (ohneKonto && imNetz && amIphone() && !alsApp() && !browserHinweise.homeBildschirm) {
    return {
      art: "home", titel: "Tipp fürs iPhone",
      text: "Safari löscht die Daten einer Seite, die du sieben Tage nicht öffnest. Vom Home-Bildschirm " +
        "aus passiert das nicht: Teilen antippen, dann „Zum Home-Bildschirm“. Dort beginnt das Heft leer; " +
        "deinen Stand nimmst du mit einer Sicherung mit.",
      knoepfe: (Object.keys(tage).length ? [["Sicherung speichern", sicherungSpeichern, true]] : [])
        .concat([["Verstanden", function () { browserHinweise.homeBildschirm = true; merkenJetzt(); hinweisWeg(); }]]),
      kurz: { titel: "Tipp:", text: "Über Teilen → „Zum Home-Bildschirm“, sonst löscht Safari nach 7 Tagen.", mehr: "Wie?" },
      zu: function () { browserHinweise.homeBildschirm = true; merkenJetzt(); hinweisWeg(); }
    };
  }

  if (ohneKonto && sicherungFaellig()) {
    var alt = browserHinweise.gesichert ? tageSeit(browserHinweise.gesichert) : 0;
    return {
      art: "sicherung warn", titel: "Zeit für eine Sicherung",
      text: (alt ? "Deine letzte Sicherung ist " + alt + " Tage alt. " : "Du hast noch keine Sicherung gespeichert. ") +
        "Dein Heft liegt nur in diesem Browser. Leg die Datei an einen sicheren Ort, etwa in deine Cloud." +
        (amIphone() && !alsApp() ? " Safari löscht Seitendaten nach sieben Tagen ohne Besuch." : ""),
      knoepfe: [
        ["Sicherung speichern", function () { sicherungSpeichern(); hinweisWeg(); }, true],
        ["Später", function () { browserHinweise.sicherungSpaeter = new Date().toISOString(); merkenJetzt(); hinweisWeg(); }]
      ],
      kurz: {
        titel: "Sicherung fällig:", text: alt ? "die letzte ist " + alt + " Tage alt." : "noch keine gespeichert.", mehr: "Mehr",
        knoepfe: [["Sichern", function () { sicherungSpeichern(); hinweisWeg(); }, true]]
      },
      zu: hinweisWeg
    };
  }

  if (fehltZeigen && wochen.length) {
    var offen = offeneWochen();
    if (!offen.length) { fehltZeigen = false; return null; }
    var letzteMontag = iso(plus(montagVon(new Date()), -7));
    var letzte = offen[offen.length - 1].montag === letzteMontag ? offen[offen.length - 1] : null;
    var aeltere = offen.length - (letzte ? 1 : 0);
    var frueheste = offen[0];
    var saetze = [];
    if (letzte) saetze.push("Letzte Woche (KW " + kalenderwoche(vonIso(letzte.montag)) + "): " + bilanzText(letzte.bilanz) + ".");
    if (aeltere) {
      saetze.push((letzte ? "Dazu " + mehrzahl(aeltere, " ältere Woche", " ältere Wochen")
        : mehrzahl(aeltere, " Woche ist", " Wochen sind") + " noch nicht fertig") +
        (aeltere > 1 || !letzte ? ", die früheste KW " + kalenderwoche(vonIso(frueheste.montag)) +
          " (" + kurzSpanne(vonIso(frueheste.montag)) + " " + vonIso(frueheste.montag).getFullYear() + ")" : "") + ".");
    }
    var ziel = letzte || frueheste;
    var oeffnen = function () {
      hinweisRuhe = true;
      wocheZeigen(ziel.montag, Math.max(0, ziel.bilanz.erster));   // zeichnet, auch die Hinweise
    };
    return {
      art: "fehlt warn", titel: "Noch offen",
      text: saetze.join(" "),
      knoepfe: [
        [letzte ? "Letzte Woche öffnen" : "Früheste öffnen", oeffnen, true],
        ["Übersicht", function (e) { hinweisRuhe = true; hinweiseZeigen(); uebersichtOeffnen(e); }]
      ],
      kurz: {
        titel: "Noch offen:",
        text: letzte ? "KW " + kalenderwoche(vonIso(letzte.montag)) + ", " + bilanzText(letzte.bilanz) +
          (aeltere ? " · " + mehrzahl(aeltere, " ältere Woche", " ältere Wochen") : "")
          : mehrzahl(aeltere, " Woche", " Wochen") + ", ab KW " + kalenderwoche(vonIso(frueheste.montag)),
        knoepfe: [["Öffnen", oeffnen, true]]
      },
      zu: hinweisWeg
    };
  }
  return null;
}

/** Den passenden Hinweis zeigen. Läuft bei jedem zeichnen(); ein unveränderter Hinweis bleibt
 *  stehen, statt bei jedem Wochenwechsel neu einzublenden. */
function hinweiseZeigen() {
  var feld = $("hinweise");
  if (!feld) return;
  var h = importKarte ? importHinweis(importKarte) : hinweisRuhe ? null : hinweisWaehlen();
  var kurz = h && h.kurz && meldungSchwebt() && hinweisGross !== h.art ? h.kurz : null;
  var inhalt = h ? h.art + "|" + h.text + "|" + h.knoepfe.length + (kurz ? "|kurz" : "") : "";
  if (feld.getAttribute("data-inhalt") === inhalt && feld.hidden === !h) return;
  feld.setAttribute("data-inhalt", inhalt);
  feld.innerHTML = "";
  feld.hidden = !h;
  if (!h) return;

  var karte = document.createElement("div");
  karte.className = "hinweis " + h.art + (kurz ? " kurz" : "") + (h.liste ? " mitliste" : "");
  karte.setAttribute("role", "status");
  var text = document.createElement("p");
  text.className = "hinweistext";
  var titel = document.createElement("b");
  titel.textContent = kurz ? kurz.titel : h.titel;
  text.appendChild(titel);
  if (kurz ? kurz.text : h.text) text.appendChild(document.createTextNode(" " + (kurz ? kurz.text : h.text)));
  // In der kurzen Fassung: ein Verweis im Text, auf die lange Fassung oder auf „Spalten prüfen“.
  // Mit einer Liste darunter steht er hinter den Knöpfen: Nach „… sehen aus:“ läse er sich wie ein Tag.
  var verweis = kurz && (kurz.mehr ? [kurz.mehr, function () { hinweisGross = h.art; hinweiseZeigen(); }] : kurz.link);
  var link = null;
  if (verweis) {
    link = document.createElement("button");
    link.type = "button";
    link.className = "hinweislink";
    link.textContent = verweis[0];
    link.addEventListener("click", verweis[1]);
    if (!h.liste) {
      text.appendChild(document.createTextNode(" "));
      text.appendChild(link);
    }
  }
  karte.appendChild(text);
  if (h.liste) karte.appendChild(h.liste);

  var knoepfe = document.createElement("div");
  knoepfe.className = "hinweisknoepfe";
  (kurz ? kurz.knoepfe || [] : h.knoepfe).forEach(function (k) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "knopf" + (k[2] ? " voll" : "");
    b.textContent = k[0];
    b.addEventListener("click", k[1]);
    knoepfe.appendChild(b);
  });
  if (link && h.liste) knoepfe.appendChild(link);
  karte.appendChild(knoepfe);

  var zu = document.createElement("button");
  zu.type = "button";
  zu.className = "hinweiszu";
  zu.setAttribute("aria-label", "Hinweis schließen");
  zu.textContent = "×";
  zu.addEventListener("click", function () { hinweisGross = ""; h.zu(); });
  karte.appendChild(zu);
  feld.appendChild(karte);
}
