/* ============================================================
 * Einrichtung beim ersten Start
 *
 * Statt eines Rundgangs über eine leere Seite fragt das Werkzeug zuerst, was im Kopf jedes
 * Wochenblatts steht: Name, Beruf, Betrieb, Vertragslaufzeit, Bundesland, Schule und Vordruck.
 * Danach ist alles vorbereitet. Jede Eingabe geht sofort in das Feld von „Deine Daten“, das
 * `data-feld` nennt, und wird dort gespeichert wie beim Tippen im Dialog.
 * ========================================================== */

var ER_SCHRITTE = ["start", "du", "ausbildung", "schule", "vordruck", "los"];

/* Was vor „Weiter“ dastehen muss, je Schritt: Feld und wie es im Satz heißt. */
var ER_PFLICHT = {
  du: [["w-vorname", "deinen Vornamen"], ["w-nachname", "deinen Nachnamen"],
       ["w-beruf", "den Ausbildungsberuf"], ["w-betrieb", "den Betrieb"]],
  ausbildung: [["w-beginn", "den Beginn"], ["w-ende", "das Ende"]]
};

var erIndex = 0;
var erBeruf = berufsfeld($("w-beruf"), $("w-berufliste"), $("w-fach"));
var erDlg = $("dlg-einrichtung");
var erFelder = Array.prototype.slice.call(erDlg.querySelectorAll("[data-feld]"));
var erSchultage = Array.prototype.slice.call($("w-schultage").querySelectorAll("input[type=checkbox]"));
var erKarten = Array.prototype.slice.call(erDlg.querySelectorAll(".er-karte"));

// Dieselben Bundesländer wie in „Deine Daten“, nur einmal gepflegt.
$("w-land").innerHTML = $("f-land").innerHTML;

/* Der Schlüssel stammt aus der Zeit, als Azubis beim ersten Start einen Rundgang bekamen. Wer ihn
   gesehen hat, fing vor der Einrichtung an und braucht sie nicht. */
var EINRICHTUNG_GESEHEN = "berichtsheft-onboarding";

function einrichtungGesehen() {
  try { return localStorage.getItem(EINRICHTUNG_GESEHEN) === "1"; } catch (e) { return true; }
}

/**
 * Braucht es die Einrichtung? Nur für Azubis und nur, solange nichts eingetragen ist: Wer schon
 * Tage oder Stammdaten hat, fing vor der Einrichtung an, auch auf einem anderen Gerät mit Konto.
 */
function einrichtungNoetig() {
  if (document.body.classList.contains("alsausbilder") || einrichtungGesehen()) return false;
  return !Object.keys(tage).length && !$("f-name").value.trim() && !$("f-beginn").value;
}

function einrichtungStarten() {
  // Was schon in „Deine Daten“ steht, steht auch hier: nach „Später“ oder aus dem Konto.
  erFelder.forEach(function (el) { el.value = $(el.getAttribute("data-feld")).value; });
  nameZeigen($("w-vorname"), $("w-nachname"));
  erBeruf.zeigen();
  erSchultageZeigen();
  erBloeckeZeigen();
  erVordruckZeigen();
  erJahrZeigen();
  $("er-wo").textContent = mitKontoAbgleich()
    ? "Alles liegt in deinem Konto." : "Alles bleibt in diesem Browser.";
  if (!erDlg.open) erDlg.showModal();
  erZeigen(0);
}

function erZeigen(i) {
  erIndex = i;
  var name = ER_SCHRITTE[i];
  Array.prototype.forEach.call(erDlg.querySelectorAll(".er-schritt"), function (s) {
    s.hidden = s.getAttribute("data-schritt") !== name;
  });
  $("er-punkte").innerHTML = ER_SCHRITTE.map(function (_, j) {
    return '<li class="' + (j < i ? "war" : j === i ? "jetzt" : "") + '"></li>';
  }).join("");
  $("er-zurueck").style.visibility = i === 0 ? "hidden" : "";
  $("er-weiter").hidden = name === "los";
  $("er-weiter").textContent = i === 0 ? "Los geht's" : "Weiter";
  $("er-spaeter").hidden = name === "los";
  erFehlt("");
  // Das erste Feld, am Handy nicht: Der Fokus holte bei jedem Schritt die Tastatur hoch. Ohne Feld
  // die Überschrift, sonst blieb der Fokus auf „Später“ stehen, das der Dialog beim Öffnen wählt.
  var amHandy = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  var schritt = erDlg.querySelector('.er-schritt[data-schritt="' + name + '"]');
  var erstes = schritt.querySelector("input:not([type=checkbox])");
  if (erstes && !amHandy) erstes.focus();
  else if (!erstes) { var titel = schritt.querySelector("h2"); titel.tabIndex = -1; titel.focus({ preventScroll: true }); }
}

function erFehlt(text) {
  $("er-fehlt").textContent = text;
  Array.prototype.forEach.call(erDlg.querySelectorAll(".fehlt"), function (el) { el.classList.remove("fehlt"); });
}

/** "a", "a und b", "a, b und c" */
function aufzaehlen(liste) {
  return liste.length < 2 ? liste.join("") : liste.slice(0, -1).join(", ") + " und " + liste[liste.length - 1];
}

$("er-weiter").addEventListener("click", function () {
  var name = ER_SCHRITTE[erIndex];
  var fehlt = (ER_PFLICHT[name] || []).filter(function (f) { return !$(f[0]).value.trim(); });
  if (fehlt.length) {
    erFehlt("Bitte noch " + aufzaehlen(fehlt.map(function (f) { return f[1]; })) + " eintragen.");
    fehlt.forEach(function (f) { $(f[0]).classList.add("fehlt"); });
    $(fehlt[0][0]).focus();
    return;
  }
  if (name === "du" && erBeruf.fachFehlt()) {
    erFehlt("Bitte noch die Fachrichtung wählen.");
    $("w-fach").classList.add("fehlt");
    return;
  }
  if (name === "ausbildung" && $("w-ende").value <= $("w-beginn").value) {
    erFehlt("Das Ende liegt vor dem Beginn.");
    $("w-ende").classList.add("fehlt");
    $("w-ende").focus();
    return;
  }
  erZeigen(erIndex + 1);
});
$("er-zurueck").addEventListener("click", function () { if (erIndex > 0) erZeigen(erIndex - 1); });

/* Eingaben gehen gleich in „Deine Daten“; deren Listener speichern und rechnen das Lehrjahr. */
erFelder.forEach(function (el) {
  ["input", "change"].forEach(function (ereignis) {
    el.addEventListener(ereignis, function () {
      var feld = $(el.getAttribute("data-feld"));
      el.classList.remove("fehlt");
      if (feld.value === el.value) return;
      feld.value = el.value;
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      if (el.id === "w-beginn") erJahrZeigen();
    });
  });
});

/* Vor- und Nachname: zwei Felder hier, gespeichert wird f-name (stammdaten.js). */
[$("w-vorname"), $("w-nachname")].forEach(function (el) {
  el.addEventListener("input", function () {
    el.classList.remove("fehlt");
    nameUebernehmen($("w-vorname"), $("w-nachname"));
  });
});

function erJahrZeigen() {
  var jahr = ausbildungsjahr({ beginn: $("w-beginn").value }, berichtsdatum());
  $("er-jahr").textContent = jahr ? "Du bist im " + jahr + ". Ausbildungsjahr." : "";
}

/* Schultage: dieselben Schalter wie in „Deine Daten“, gespeichert wird f-schultage. */
function erSchultageZeigen() {
  var gewaehlt = schultageLesen($("f-schultage").value);
  erSchultage.forEach(function (k) { k.checked = gewaehlt.indexOf(WERKTAGE_KURZ.indexOf(k.value)) !== -1; });
}
erSchultage.forEach(function (k) {
  k.addEventListener("change", function () {
    $("f-schultage").value = erSchultage
      .filter(function (x) { return x.checked; })
      .map(function (x) { return x.value; }).join(", ");
    merken();
  });
});

/* Blockunterricht: Marken und Kalender wie in „Deine Daten“ (zeitraum.js). */
function erBloeckeZeigen() { zeitraumListe($("w-bloecke"), "f-schulbloecke", true, false); }
$("f-schulbloecke").addEventListener("input", function () { if (erDlg.open) erBloeckeZeigen(); });

function erVordruckZeigen() {
  erKarten.forEach(function (k) {
    k.setAttribute("aria-checked", String(k.getAttribute("data-vordruck") === $("f-vordruck").value));
  });
}
erKarten.forEach(function (k) {
  k.addEventListener("click", function () {
    $("f-vordruck").value = k.getAttribute("data-vordruck");
    $("f-vordruck").dispatchEvent(new Event("input", { bubbles: true }));
    erVordruckZeigen();
  });
});

/**
 * Schließen, merken, dass sie gesehen ist, und dann `danach`. Auch „Später“ und Escape zählen als
 * gesehen: Wer fertig werden will, findet die Angaben unter „Deine Daten“, und die Startkarte
 * bietet die Einrichtung an, solange Pflichtangaben fehlen.
 */
function einrichtungBeenden(danach) {
  try { localStorage.setItem(EINRICHTUNG_GESEHEN, "1"); } catch (e) { /* ohne Speicher */ }
  if (erDlg.open) erDlg.close();
  merkenJetzt();
  zeichnen();
  if (danach) danach();
}
erDlg.addEventListener("close", function () {
  try { localStorage.setItem(EINRICHTUNG_GESEHEN, "1"); } catch (e) { /* ohne Speicher */ }
});

$("er-spaeter").addEventListener("click", function () {
  einrichtungBeenden(function () { sage("Deine Angaben kannst du jederzeit unter ⋯ → Deine Daten ergänzen."); });
});
$("er-beispiel").addEventListener("click", function () { einrichtungBeenden(beispielLaden); });
$("er-sicherung").addEventListener("click", function () {
  einrichtungBeenden(function () { $("sicherungsdatei").click(); });
});
$("er-laden").addEventListener("click", function () {
  einrichtungBeenden(function () { $("datei").click(); });
});
$("er-schreiben").addEventListener("click", function () {
  einrichtungBeenden(function () {
    var heute = new Date();
    wocheZeigen(iso(montagVon(heute)), Math.min(tagIndex(heute), 4));
  });
});

/** Fehlt noch eine Pflichtangabe für den Vordruck? Für die Startkarte. */
function angabenFehlen() {
  return PFLICHT.some(function (f) { return pflichtFehlt(f[0]); });
}
