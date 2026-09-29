/* ============================================================
 * Ausbildungsberuf: Auswahl mit Suchliste und Fachrichtung
 *
 * Statt einer <datalist> (sah in jedem Browser anders aus, am iPhone kaum zu finden) eine eigene
 * Liste unter dem Feld: nach Bereichen, der getippte Teil fett. Hat der Beruf Fachrichtungen,
 * stehen sie darunter zum Antippen. Gespeichert wird wie bisher ein Text in f-beruf, etwa
 * „Fachinformatiker/in – Systemintegration“; jeder andere Beruf lässt sich frei eintippen.
 * ========================================================== */

/* Häufige Berufe, nach Bereichen; Fachrichtungen nur, wo die Ausbildungsordnung welche kennt. */
var BERUFE = [
  ["IT", [
    ["Fachinformatiker/in", ["Anwendungsentwicklung", "Systemintegration", "Daten- und Prozessanalyse", "Digitale Vernetzung"]],
    ["IT-System-Elektroniker/in"],
    ["Kaufmann/Kauffrau für IT-System-Management"],
    ["Kaufmann/Kauffrau für Digitalisierungsmanagement"],
    ["Kaufmann/Kauffrau im E-Commerce"],
    ["Mathematisch-technische/r Softwareentwickler/in"]
  ]],
  ["Kaufmännisch und Verwaltung", [
    ["Kaufmann/Kauffrau für Büromanagement"],
    ["Industriekaufmann/Industriekauffrau"],
    ["Kaufmann/Kauffrau im Einzelhandel"],
    ["Kaufmann/Kauffrau im Groß- und Außenhandelsmanagement", ["Großhandel", "Außenhandel"]],
    ["Bankkaufmann/Bankkauffrau"],
    ["Kaufmann/Kauffrau für Versicherungen und Finanzanlagen"],
    ["Kaufmann/Kauffrau für Spedition und Logistikdienstleistung"],
    ["Kaufmann/Kauffrau für Marketingkommunikation"],
    ["Immobilienkaufmann/Immobilienkauffrau"],
    ["Steuerfachangestellte/r"],
    ["Verwaltungsfachangestellte/r"],
    ["Medizinische/r Fachangestellte/r"]
  ]],
  ["Technik und Handwerk", [
    ["Elektroniker/in für Betriebstechnik"],
    ["Elektroniker/in für Geräte und Systeme"],
    ["Mechatroniker/in"],
    ["Industriemechaniker/in"],
    ["Zerspanungsmechaniker/in"],
    ["Kraftfahrzeugmechatroniker/in"],
    ["Anlagenmechaniker/in für Sanitär-, Heizungs- und Klimatechnik"],
    ["Mediengestalter/in Digital und Print", ["Beratung und Planung", "Konzeption und Visualisierung", "Gestaltung und Technik"]]
  ]],
  ["Lager und Logistik", [
    ["Fachkraft für Lagerlogistik"],
    ["Fachlagerist/in"]
  ]]
];

/** Den Beruf zu einem Namen, gleich wie geschrieben; sonst null. */
function berufSuchen(name) {
  var n = String(name || "").trim().toLowerCase(), treffer = null;
  BERUFE.forEach(function (g) {
    g[1].forEach(function (b) { if (b[0].toLowerCase() === n) treffer = b; });
  });
  return treffer;
}

/** "Fachinformatiker/in – Systemintegration" -> Beruf und Fachrichtung. Alles andere ist ein Beruf. */
function berufTeilen(wert) {
  var w = String(wert || "").trim(), i = w.lastIndexOf(" – ");
  if (i !== -1) {
    var b = berufSuchen(w.slice(0, i)), fach = w.slice(i + 3).trim();
    if (b && b[1] && b[1].indexOf(fach) !== -1) return { beruf: b[0], fach: fach };
  }
  return { beruf: w, fach: "" };
}

/**
 * Ein Berufsfeld verdrahten: Eingabe, Liste darunter und die Knöpfe der Fachrichtung. Jede Änderung
 * geht sofort in f-beruf und löst dort `input` aus (speichern, Pflichtangaben). Gibt `zeigen()`
 * zurück, das die Felder aus f-beruf füllt, und `fachFehlt()` für „Weiter“ in der Einrichtung.
 */
function berufsfeld(eingabe, liste, fachBox) {
  var fach = "", aktiv = -1;
  var knoepfe = fachBox.querySelector(".fachknoepfe");

  function uebernehmen() {
    var b = berufSuchen(eingabe.value);
    var neu = eingabe.value.trim();
    if (b && b[1] && b[1].indexOf(fach) !== -1) neu += " – " + fach;
    if ($("f-beruf").value === neu) return;
    $("f-beruf").value = neu;
    $("f-beruf").dispatchEvent(new Event("input", { bubbles: true }));
  }

  function fachZeigen() {
    var b = berufSuchen(eingabe.value);
    fachBox.hidden = !(b && b[1]);
    knoepfe.innerHTML = "";
    if (fachBox.hidden) return;
    b[1].forEach(function (f) {
      var k = document.createElement("button");
      k.type = "button";
      k.className = "fachknopf";
      k.setAttribute("role", "radio");
      k.setAttribute("aria-checked", String(f === fach));
      k.textContent = f;
      k.addEventListener("click", function () {
        fach = f;
        fachBox.classList.remove("fehlt");
        fachZeigen();
        uebernehmen();
      });
      knoepfe.appendChild(k);
    });
  }

  /** Die Liste zum Getippten: Bereiche mit Treffern, der getippte Teil fett. */
  function listeZeigen() {
    var q = eingabe.value.trim().toLowerCase();
    liste.innerHTML = "";
    aktiv = -1;
    BERUFE.forEach(function (g) {
      var treffer = g[1].filter(function (b) { return !q || b[0].toLowerCase().indexOf(q) !== -1; });
      if (!treffer.length) return;
      var titel = document.createElement("p");
      titel.className = "bgruppe";
      titel.textContent = g[0];
      liste.appendChild(titel);
      treffer.forEach(function (b) {
        var o = document.createElement("button");
        o.type = "button";
        o.className = "boption";
        o.setAttribute("role", "option");
        o.setAttribute("tabindex", "-1");
        var i = q ? b[0].toLowerCase().indexOf(q) : -1;
        if (i === -1) o.textContent = b[0];
        else {
          o.appendChild(document.createTextNode(b[0].slice(0, i)));
          var fett = document.createElement("b");
          fett.textContent = b[0].slice(i, i + q.length);
          o.appendChild(fett);
          o.appendChild(document.createTextNode(b[0].slice(i + q.length)));
        }
        // Der Fokus bleibt im Feld: Sonst schlösse das Verlassen die Liste vor dem Klick.
        o.addEventListener("mousedown", function (e) { e.preventDefault(); });
        o.addEventListener("click", function () { waehlen(b[0]); });
        liste.appendChild(o);
      });
    });
    if (!liste.children.length) {
      var leer = document.createElement("p");
      leer.className = "bleer";
      leer.textContent = "Nicht in der Liste – wird so übernommen, wie du es schreibst.";
      liste.appendChild(leer);
    }
    // Steht genau ein bekannter Beruf im Feld, braucht es die Liste nicht.
    liste.hidden = !!berufSuchen(eingabe.value) && liste.querySelectorAll(".boption").length === 1;
    eingabe.setAttribute("aria-expanded", String(!liste.hidden));
  }

  function listeZu() {
    liste.hidden = true;
    eingabe.setAttribute("aria-expanded", "false");
  }

  function waehlen(name) {
    var b = berufSuchen(name);
    eingabe.value = b ? b[0] : name;
    if (!(b && b[1] && b[1].indexOf(fach) !== -1)) fach = "";
    listeZu();
    fachZeigen();
    uebernehmen();
  }

  function markieren(schritt) {
    var optionen = liste.querySelectorAll(".boption");
    if (!optionen.length) return;
    aktiv = (aktiv + schritt + optionen.length) % optionen.length;
    Array.prototype.forEach.call(optionen, function (o, i) { o.classList.toggle("aktiv", i === aktiv); });
    optionen[aktiv].scrollIntoView({ block: "nearest" });
  }

  eingabe.setAttribute("role", "combobox");
  eingabe.setAttribute("aria-autocomplete", "list");
  eingabe.setAttribute("aria-controls", liste.id);
  eingabe.setAttribute("aria-expanded", "false");
  eingabe.addEventListener("focus", listeZeigen);
  eingabe.addEventListener("input", function () {
    eingabe.classList.remove("fehlt");
    listeZeigen();
    fachZeigen();
    uebernehmen();
  });
  // Beim Verlassen: Wer „Fachinformatiker/in – Systemintegration“ ganz eintippt oder einfügt,
  // bekommt Beruf und Fachrichtung getrennt angezeigt.
  eingabe.addEventListener("blur", function () {
    listeZu();
    var t = berufTeilen(eingabe.value);
    if (!t.fach) return;
    eingabe.value = t.beruf;
    fach = t.fach;
    fachZeigen();
    uebernehmen();
  });
  eingabe.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (liste.hidden) listeZeigen();
      markieren(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && !liste.hidden && aktiv !== -1) {
      e.preventDefault();
      waehlen(liste.querySelectorAll(".boption")[aktiv].textContent);
    } else if (e.key === "Escape" && !liste.hidden) {
      // Nur die Liste schließen, nicht das Fenster darum.
      e.preventDefault();
      e.stopPropagation();
      listeZu();
    }
  });

  return {
    zeigen: function () {
      var t = berufTeilen($("f-beruf").value);
      eingabe.value = t.beruf;
      fach = t.fach;
      fachBox.classList.remove("fehlt");
      listeZu();
      fachZeigen();
    },
    fachFehlt: function () {
      var b = berufSuchen(eingabe.value);
      return !!(b && b[1] && b[1].indexOf(fach) === -1);
    }
  };
}

/* In „Deine Daten“; die Einrichtung verdrahtet ihr eigenes Feld (einrichtung.js). */
var stammBeruf = berufsfeld($("f-berufwahl"), $("f-berufliste"), $("f-fach"));
