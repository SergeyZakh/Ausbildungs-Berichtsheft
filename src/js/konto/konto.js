/* ============================================================
 * Konto und Abgleich mit dem Server (freiwillig)
 *
 * Ohne Server ändert sich nichts: Die Datei läuft im Browser, alles bleibt
 * im localStorage, es geht keine Anfrage hinaus. Liegt das Werkzeug dagegen
 * auf einem Berichtsheft-Server, meldet man sich dort an, und die Einträge
 * liegen im Konto – auf jedem Gerät derselbe Stand, und der Ausbilder sieht,
 * welche Wochen fertig sind.
 *
 * Hochgeladen wird nur, was im Nachweis steht: Tagestext, Art, Stunden,
 * "übernommen" und die Stammdaten. Die importierten Buchungen mit Kunden,
 * Tickets und Kollegennamen bleiben hier.
 * ========================================================== */

// `runde` zählt, wie oft der Stand im Browser verworfen wurde: Eine Antwort aus einer alten
// Runde gehört zu Daten, die es nicht mehr gibt. `nachholen` merkt einen Abgleich vor, der
// warten musste, weil noch einer lief.
var KONTO = { moeglich: false, person: null, seit: null, gesendet: null, laeuft: false, offen: false, gewarnt: false, weiterleitung: false, runde: 0, nachholen: false };
var KONTO_SPEICHER = "berichtsheft-konto";
/** Nach einem gescheiterten Abgleich erneut versuchen, bis der Server wieder antwortet. */
var KONTO_WIEDERHOLEN_MS = 20000;

/* ---------- Anmeldung als Pflicht (ANMELDUNG_PFLICHT am Server) ---------- */

var KONTO_VERSUCHE = "berichtsheft-anmeldeversuche";

/**
 * Ohne Konto kommt man nicht ins Werkzeug. Beim Öffnen geht es gleich zum Anmeldedienst.
 * Hält die Anmeldung nicht (etwa ein Secure-Cookie über http), käme man sonst endlos zum
 * Anbieter und zurück; nach drei Versuchen in einer Minute bleibt die Seite deshalb stehen und
 * sagt es. Läuft die Sitzung beim Arbeiten ab, wird nicht mitten im Tippen weitergeleitet:
 * Dann sperrt ein Hinweis mit Knopf, und die Eingaben bleiben im Browser.
 */
function anmeldungVerlangen(anlass) {
  var jetzt = Date.now(), versuche = null;
  try {
    versuche = JSON.parse(sessionStorage.getItem(KONTO_VERSUCHE) || "[]").filter(function (t) {
      return jetzt - t < 60000;
    });
  } catch (e) { /* ohne sessionStorage keine Weiterleitung, sonst droht die Schleife */ }

  if (anlass === "start" && versuche && versuche.length < 3) {
    versuche.push(jetzt);
    try {
      sessionStorage.setItem(KONTO_VERSUCHE, JSON.stringify(versuche));
      KONTO.weiterleitung = true;
      location.replace("anmeldung");
      return;
    } catch (e) { /* weiter mit dem Hinweis */ }
  }

  $("anmelden-text").textContent = anlass === "start"
    ? "Die Anmeldung hat nicht gehalten. Öffne das Berichtsheft über die Adresse, die dein Betrieb " +
      "eingerichtet hat, und versuche es noch einmal. Hilft das nicht, frag die Technik."
    : "Deine Anmeldung ist abgelaufen. Was du geschrieben hast, liegt im Browser und geht nach " +
      "der Anmeldung ins Konto.";
  var dlg = $("dlg-anmelden");
  if (!dlg.open) dlg.showModal();
}

function anmeldungGelungen() {
  try { sessionStorage.removeItem(KONTO_VERSUCHE); } catch (e) { /* egal */ }
}

/** 401 vom Server: Anmelden anbieten oder, wenn der Betrieb es verlangt, erzwingen. */
function nichtAngemeldet(antwort, anlass) {
  KONTO.person = null;
  kontoZeigen();
  return antwort.json().catch(function () { return {}; }).then(function (daten) {
    if (daten && daten.anmeldungPflicht) anmeldungVerlangen(anlass);
  });
}

// Esc schließt den Hinweis nicht; ohne Anmeldung geht es nicht weiter.
if ($("dlg-anmelden")) $("dlg-anmelden").addEventListener("cancel", function (e) { e.preventDefault(); });

/** Bei file:// (Einzeldatei) gibt es nie einen Server. */
function kontoMoeglich() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function kontoStandLaden() {
  try { return JSON.parse(localStorage.getItem(KONTO_SPEICHER) || "null") || {}; } catch (e) { return {}; }
}

function kontoStandMerken(daten) {
  try { localStorage.setItem(KONTO_SPEICHER, JSON.stringify(daten)); } catch (e) { /* ohne Speicher */ }
}

function kontoAnfrage(weg, koerper) {
  return fetch("api/" + weg, {
    method: koerper ? "POST" : "GET",
    headers: koerper ? { "Content-Type": "application/json" } : {},
    body: koerper ? JSON.stringify(koerper) : undefined,
    credentials: "same-origin"
  });
}

/* ---------- Anzeige in der Kopfleiste ---------- */

function kontoZeigen() {
  var feld = $("konto");
  if (!feld) return;
  if (!KONTO.moeglich) { feld.hidden = true; return; }
  feld.hidden = false;
  if (!KONTO.person) {
    feld.innerHTML = '<a class="knopf" id="konto-anmelden" href="anmeldung">Anmelden</a>';
    return;
  }
  feld.innerHTML = '<span class="kontoname" id="kontoname"></span>' +
    '<span class="kontostand" id="kontostand"></span>' +
    '<a class="kontolink" href="abmeldung">Abmelden</a>';
  $("kontoname").textContent = KONTO.person.name;
  kontoStandZeigen();
}

/**
 * Ein Satz, der sagt, wo die Einträge liegen. „Abgeglichen“ versteht niemand,
 * „im Konto gesichert“ schon.
 */
function kontoStandZeigen(text) {
  var feld = $("kontostand");
  if (!feld) return;
  feld.textContent = text || (KONTO.offen ? "nur auf diesem Gerät" : (KONTO.seit ? "im Konto gesichert" : ""));
  feld.className = "kontostand" + (KONTO.offen ? " offen" : "");
  feld.title = KONTO.offen
    ? "Die letzten Änderungen sind noch nicht im Konto. Sie gehen gleich hin."
    : "Deine Einträge liegen im Konto und sind auf jedem Gerät da.";
}

/* ---------- Abgleich ---------- */

/**
 * Was seit dem letzten Abgleich neu ist. Ohne Zeitraum: Der Server schickt alles zurück,
 * was zu diesem Konto gehört – ein frischer Browser weiß ja noch nicht, welche Wochen es gibt.
 *
 * Zwei Marken, weil zwei Uhren im Spiel sind: `seit` kommt von der Datenbank und steuert, was
 * herunterkommt. `gesendet` ist die Browseruhr beim letzten erfolgreichen Hochladen; nur mit ihr
 * lassen sich die Stempel der eigenen Tage vergleichen. Mit `seit` gingen sonst Eingaben verloren,
 * die während eines laufenden Abgleichs entstanden oder deren Rechneruhr nachgeht.
 */
function kontoPaket(seit, gesendet) {
  var paket = { seit: seit || null, tage: [], wochen: [] };
  Object.keys(tage).forEach(function (datum) {
    var t = tage[datum];
    if (!t.geaendert || (gesendet && t.geaendert <= gesendet)) return;
    paket.tage.push({
      datum: datum, text: t.text || "", art: t.art || "",
      stunden: t.stunden == null ? null : t.stunden,
      geprueft: !!t.geprueft, geaendert: t.geaendert
    });
  });
  // Nur die Wochen, die selbst geändert wurden, jede mit ihrem eigenen Stempel.
  Object.keys(wochendaten).forEach(function (montag) {
    var stempel = wochenGeaendert[montag];
    if (!stempel || (gesendet && stempel <= gesendet)) return;
    var w = wochendaten[montag] || {};
    paket.wochen.push({
      montag: montag, abteilung: w.abteilung || "",
      unterweisungen: w.unterweisungen || "", geaendert: stempel
    });
  });
  if (stammGeaendert && (!gesendet || stammGeaendert > gesendet)) {
    paket.stamm = { daten: nachweisStamm(), geaendert: stammGeaendert };
  }
  return paket;
}

/**
 * Die Stammdaten ohne das, was im Browser bleibt: Namensliste, Ausblendlisten, Sprachmodell.
 * Dieselbe Liste steht auf dem Server (NUR_IM_BROWSER in server/datenbank.js).
 */
var NUR_IM_BROWSER = ["namen", "ausblenden", "projektraus", "kiAdresse", "kiModell", "kiAnweisungen", "kiStichpunkte"];
function nachweisStamm() {
  var s = stammdaten();
  NUR_IM_BROWSER.forEach(function (k) { delete s[k]; });
  return s;
}

/** Was vom Server kam, in den eigenen Stand übernehmen. true, wenn sich etwas geändert hat. */
function kontoUebernehmen(antwort) {
  var neu = false;
  (antwort.tage || []).forEach(function (s) {
    var t = tage[s.datum];
    if (t && t.geaendert && s.geaendert <= t.geaendert) return;
    if (!t) { t = tage[s.datum] = { pausen: [], posten: [] }; }
    t.text = s.text || "";
    t.art = s.art || "";
    t.stunden = s.stunden == null ? null : Number(s.stunden);
    t.geprueft = !!s.geprueft;
    t.geaendert = s.geaendert;
    zuletztGesichert[s.datum] = tagKennung(t);
    neu = true;
  });
  (antwort.wochen || []).forEach(function (s) {
    var eigen = wochenGeaendert[s.montag];
    if (eigen && s.geaendert <= eigen) return;
    wochendaten[s.montag] = { abteilung: s.abteilung || "", unterweisungen: s.unterweisungen || "" };
    wochenGeaendert[s.montag] = s.geaendert;
    zuletztGesichert["__woche:" + s.montag] = wocheKennung(wochendaten[s.montag]);
    neu = true;
  });
  if (antwort.stamm && (!stammGeaendert || antwort.stamm.geaendert > stammGeaendert)) {
    Object.keys(antwort.stamm.daten || {}).forEach(function (k) {
      var feld = stammFeld(k);
      if (feld && typeof antwort.stamm.daten[k] === "string") feld.value = antwort.stamm.daten[k];
    });
    stammGeaendert = antwort.stamm.geaendert;
    neu = true;
  }
  if (neu) zuletztGesichert.__stamm = JSON.stringify(stammdaten());
  return neu;
}

/**
 * Einmal hin und zurück. Läuft nie doppelt; wer zwischendurch tippt, löst den
 * nächsten Abgleich aus, sobald dieser fertig ist.
 */
function kontoAbgleichen() {
  if (!KONTO.person || KONTO.laeuft) return Promise.resolve(false);
  KONTO.laeuft = true;
  kontoStandZeigen("wird gesichert …");
  // Vor dem Packen gemerkt: Was danach geändert wird, geht beim nächsten Mal mit.
  var gepackt = new Date().toISOString();
  var runde = KONTO.runde;
  var paket = kontoPaket(KONTO.seit, KONTO.gesendet);
  return kontoAnfrage("abgleich", paket).then(function (antwort) {
    if (antwort.status === 401) return nichtAngemeldet(antwort, "abgelaufen").then(function () { return false; });
    if (!antwort.ok) throw new Error("Server antwortet mit " + antwort.status);
    return antwort.json().then(function (daten) {
      // Wurde der Browser währenddessen geleert, gehören Antwort und Marken zum alten Stand.
      // Beides zu übernehmen machte das Leeren rückgängig; der Abgleich der neuen Runde folgt.
      if (runde !== KONTO.runde) return false;
      if (KONTO.gewarnt) sage("Wieder verbunden. Deine Einträge liegen im Konto.", "gut");
      KONTO.gewarnt = false;
      var geaendert = kontoUebernehmen(daten);
      KONTO.seit = daten.stand_vom;
      KONTO.gesendet = gepackt;
      KONTO.offen = false;
      kontoStandMerken({ seit: KONTO.seit, gesendet: KONTO.gesendet, person: KONTO.person.id });
      if (geaendert) { merkenJetzt(); zeichnen(); }
      kontoStandZeigen();
      return geaendert;
    });
  }).catch(function (e) {
    KONTO.offen = true;
    kontoStandZeigen("nur auf diesem Gerät");
    // Einmal sagen, nicht bei jedem neuen Versuch. „Failed to fetch“ versteht niemand:
    // Ohne Antwort ist der Server schlicht nicht erreichbar.
    if (!KONTO.gewarnt) {
      var grund = e instanceof TypeError ? "Server nicht erreichbar." : e.message + ".";
      sage("Kein Abgleich: " + grund + " Deine Eingaben bleiben im Browser und gehen ins Konto, sobald er wieder antwortet.", "warn");
    }
    KONTO.gewarnt = true;
    // Sonst ginge der offene Stand erst mit der nächsten Eingabe hinaus.
    clearTimeout(kontoTimer);
    kontoTimer = setTimeout(kontoAbgleichen, KONTO_WIEDERHOLEN_MS);
    return false;
  }).then(function (ergebnis) {
    KONTO.laeuft = false;
    if (KONTO.nachholen) {
      KONTO.nachholen = false;
      clearTimeout(kontoTimer);
      kontoAbgleichen();
    }
    return ergebnis;
  });
}

/**
 * Den Stand aus dem Konto vollständig neu holen, nachdem dieser Browser geleert wurde.
 * Ohne die Marken fragt der Abgleich nicht nur nach Neuem, sondern nach allem. Läuft gerade
 * einer, wird er nicht einfach übersprungen: Seine Antwort verfällt mit der Runde, und der
 * neue Abgleich beginnt, sobald der alte zurück ist.
 */
function kontoNeuLaden() {
  KONTO.runde++;
  KONTO.seit = null;
  KONTO.gesendet = null;
  clearTimeout(kontoTimer);
  if (KONTO.laeuft) { KONTO.nachholen = true; return Promise.resolve(false); }
  return kontoAbgleichen();
}

var kontoTimer = null;
/** Nach dem Speichern bald abgleichen, aber nicht bei jedem Tastendruck. */
function kontoAbgleichBald() {
  if (!KONTO.person) return;
  KONTO.offen = true;
  kontoStandZeigen();
  clearTimeout(kontoTimer);
  kontoTimer = setTimeout(kontoAbgleichen, 3000);
}

/* ---------- Start ---------- */

function kontoSeiteZeigen() {
  // Lädt die Seite gleich neu (speicherNeuLaden() in grundlagen.js), bleibt sie bis dahin verborgen.
  if (NEU_LADEN) return;
  document.documentElement.classList.remove("konto-prueft");
}

/**
 * Meldet sich jemand anderes in demselben Browser an, gehört der Stand im localStorage
 * noch der vorigen Person. Er muss weg, bevor der erste Abgleich läuft: Sonst lädt er
 * fremde Tage in das neue Konto, und der Ausbilder sähe sie dort als Arbeit dieser Person.
 *
 * Nur beim Wechsel. Wer vorher ohne Konto im Browser gearbeitet hat, steht mit keiner
 * Person im Speicher – seine Einträge bleiben und gehen mit ins Konto.
 */
function fremdenStandVerwerfen() {
  tage = {}; wochendaten = {}; kunden.length = 0;
  aktiveWoche = null; aktiverTag = 0; monatAnker = null;

  Object.keys(stammdaten()).forEach(function (k) {
    var feld = stammFeld(k);
    if (feld) feld.value = "";
  });
  lehrjahrZeigen();

  // Das Leeren selbst ist keine Änderung: Sonst stempelte der Abgleich die leeren
  // Stammdaten als neu und überschriebe damit die im Konto.
  stammGeaendert = null; wochenGeaendert = {};
  zuletztGesichert = { __stamm: JSON.stringify(stammdaten()) };

  // Ein ausstehendes Speichern schriebe den Stand des vorigen Kontos zurück.
  speichernVerwerfen();
  try { localStorage.removeItem(SPEICHER); } catch (e) { /* ohne Speicher */ }
  wochenNeu();
  zeichnen();
  sage("Anderes Konto: Der Stand des vorigen Kontos wurde aus diesem Browser entfernt. " +
    "Deine Einträge kommen gleich aus deinem Konto.", "gut");
}

/** Gibt es hier einen Server, und bin ich angemeldet? */
function kontoStarten() {
  KONTO.moeglich = kontoMoeglich();
  // grundlagen.js hält die Seite verborgen, bis klar ist, ob es zum Anmeldedienst geht.
  // Antwortet der Server nicht bald, lieber ohne ihn arbeiten als vor einer leeren Seite warten.
  var notfall = setTimeout(kontoSeiteZeigen, 4000);
  var zeigen = function () {
    clearTimeout(notfall);
    if (!KONTO.weiterleitung) kontoSeiteZeigen();
  };
  if (!KONTO.moeglich) { zeigen(); return Promise.resolve(); }
  return kontoAnfrage("ich").then(function (antwort) {
    if (antwort.status === 404 || antwort.status === 501) return zeigen();   // Werkzeug ohne Server
    KONTO.moeglich = true;
    if (antwort.status === 401) return nichtAngemeldet(antwort, "start").then(zeigen);
    if (!antwort.ok) return zeigen();
    return antwort.json().then(function (person) {
      anmeldungGelungen();
      KONTO.person = person;
      var stand = kontoStandLaden();
      // Nach einem Kontowechsel im selben Browser nicht auf dem alten Stand aufsetzen.
      var gleich = stand.person === person.id;
      if (stand.person && !gleich) fremdenStandVerwerfen();
      KONTO.seit = gleich ? stand.seit || null : null;
      KONTO.gesendet = gleich ? stand.gesendet || null : null;
      kontoZeigen();
      zeigen();
      if (person.rolle === "ausbilder") return ausbilderStarten();
      return kontoAbgleichen();
    });
  }).catch(function () {
    // Keine Antwort: dann eben ohne Konto.
    KONTO.moeglich = false;
    kontoZeigen();
    zeigen();
  });
}

// Beim Verlassen der Seite noch schnell hochladen, was offen ist.
window.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden" && KONTO.person && KONTO.offen) kontoAbgleichen();
});
