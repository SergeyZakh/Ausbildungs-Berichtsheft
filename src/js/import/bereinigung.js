/* ============================================================
 * Bereinigung: was gar nicht erst ins Heft soll
 *
 * Ticketnummern, Rechnernamen, Personen- und Kundennamen gehören nicht
 * in einen Ausbildungsnachweis. Entfernt werden sie mit regulären
 * Ausdrücken, nicht vom Sprachmodell: Ausdrücke sind nachvollziehbar und
 * liefern immer dasselbe.
 *
 * Kennungen werden durch ihre Gattung ersetzt statt gestrichen
 * ("SRV01 neu gestartet" -> "Server neu gestartet"), damit der Satz ein
 * Satz bleibt.
 *
 * Angewandt wird das beim Erzeugen des Entwurfs und noch einmal vor der
 * Anfrage an das Modell. Die Regeln sind idempotent. In der Postenliste
 * stehen die Buchungen weiter im Original.
 *
 * Jede Regeländerung braucht einen Fall in test/korpus.js – vor allem
 * für das, was stehen bleiben muss.
 * ========================================================== */

/* Zeilen, die nach der Bereinigung nur noch daraus bestehen, fallen weg.
   Die Kimai-Vorgaben ("Task", "Meeting" …) zählen nur als ganze Zeile,
   nicht als Wort im Satz. */
var MUELLWOERTER = [
  "erledigt", "fertig", "done", "ok", "okay", "passt", "läuft",
  "todo", "offen", "wip", "in arbeit", "nichts", "kein text",
  "na", "n a", "keine angabe", "test", "xxx", "abc", "diverses",
  "sonstiges", "verschiedenes", "arbeit", "tagesgeschäft",
  "task", "meeting", "abstimmung", "kontrolle", "termin", "sonstige"
];

/** Bleibt nur eine Statusnotiz übrig, ist die Zeile wertlos. */
function istMuell(text) {
  var k = schluessel(text);
  if (!k) return true;
  if (k.length < 3) return true;
  return MUELLWOERTER.indexOf(k) !== -1;
}

/* ---------- Bausteine für die Namenserkennung ----------
   Ein Nachname allein ist nicht erkennbar ("Müller" kann eine Firma
   sein). Erkannt wird ein Name deshalb nur mit Anrede, Titel oder einem
   bekannten Vornamen davor. Weitere Namen pflegt man unter
   "Deine Daten" (f-namen). */
var VORNAMEN = ("alexander|alex|andré|andrea|andreas|angelika|anna|anne|annika|anton|barbara|" +
"bastian|benjamin|bernd|bernhard|birgit|björn|brigitte|christian|christina|christine|christoph|" +
"claudia|clemens|daniel|daniela|david|dennis|dieter|dirk|dominik|doris|elena|elias|elisabeth|" +
"emma|erik|eva|fabian|felix|florian|frank|franziska|friedrich|gabriele|georg|gerhard|günther|" +
"hannah|hans|heike|heinrich|heinz|helena|helmut|henrik|holger|ingrid|jan|jana|janina|jens|" +
"jessica|joachim|johanna|johannes|jonas|jörg|josef|julia|julian|jürgen|kai|karin|karl|katharina|" +
"katrin|kevin|klaus|konstantin|kristina|larissa|lars|laura|lena|leon|linda|lisa|lukas|maik|" +
"manfred|manuel|marc|marcel|marco|maria|marie|marion|mario|marius|markus|martin|martina|mathias|" +
"matthias|max|maximilian|melanie|michael|michaela|mike|monika|nadine|nico|nicole|niklas|nils|" +
"norbert|oliver|patrick|paul|peter|petra|philipp|rainer|ralf|rebecca|renate|rene|robert|" +
"roland|rolf|ronny|rudolf|sabine|sandra|sascha|sebastian|sergej|sergey|simon|simone|sonja|" +
"stefan|stefanie|steffen|stephan|susanne|sven|tanja|thomas|thorsten|tim|tobias|tom|torsten|" +
"ulrich|ulrike|ursula|uwe|vanessa|verena|viktor|vladimir|volker|walter|werner|wolfgang|yvonne").split("|");

/* Vornamen, die auch normale Wörter sind ("Max Wert", "Jan Februar"):
   nur nach einer Präposition eindeutig. */
var ZWEIDEUTIG = ["max", "jan", "marie", "kai"];

function grossKlein(n) { return "[" + n.charAt(0).toUpperCase() + n.charAt(0) + "]" + n.slice(1); }
function gross(n) { return n.charAt(0).toUpperCase() + n.slice(1); }

var VOR_BEIDE = "(?:" + VORNAMEN.map(grossKlein).join("|") + ")";
var VOR_GROSS = "(?:" + VORNAMEN.filter(function (n) {
  return ZWEIDEUTIG.indexOf(n) === -1;
}).map(gross).join("|") + ")";
var GROSSWORT = "[A-ZÄÖÜ][a-zäöüß]+(?:[-'][A-ZÄÖÜ]?[a-zäöüß]+)*";
var TITEL = "(?:(?:[Dd]r|[Pp]rof|[Dd]ipl|[Ii]ng)\\.?\\s+|[Dd]oktor\\s+)?";
var NAME = "(?:" + VOR_GROSS + "\\s+)?" + GROSSWORT;

/* "Friedrich Brandt GmbH" ist ein Lieferant, kein Kollege. Beide Formen
   (mit und ohne Nachnamen) ausschließen, sonst findet das Backtracking
   doch noch einen Treffer. */
var FIRMA = "(?:GmbH|AG|KG|mbH|SE|OHG|GbR|e\\.?K\\.?|&\\s*Co)\\b";
var KEINE_FIRMA = "(?!\\s+" + FIRMA + ")(?!\\s+" + GROSSWORT + "\\s+" + FIRMA + ")";

/* Alltagswörter sind nie ein Nachname: "Lena Server aufgesetzt" soll
   nicht als "Vorname Nachname" gelten. */
var ALLTAGSWORT = "(?:Server|Rechner|Notebook|Laptop|Drucker|Monitor|Kabel|Switch|Router|Firewall|" +
  "Netzwerk|Backup|Update|Upgrade|System|Software|Hardware|Zugang|Zugriff|Konto|Postfach|Datei|" +
  "Ordner|Bericht|Protokoll|Wartung|Prüfung|Installation|Einrichtung|Support|Störung|Fehler|" +
  "Meeting|Besprechung|Termin|Konferenz|Schulung|Einweisung|Anleitung|Dokumentation|Doku|" +
  "Auswertung|Projekt|Aufgabe|Liste|Tabelle|Formular|Vertrag|Angebot|Rechnung|Bestellung|" +
  "Lieferung|Inventur|Lager|Raum|Büro|Standort|Abteilung|Firma|Kunde|Kunden|Lieferant|Lizenz|" +
  "Telefon|Handy|Tablet|Mail|Kalender|Passwort|Benutzer|Gruppe|Freigabe|Domäne|Schnittstelle|" +
  "Datenbank|Anwendung|Programm|Version|Konfiguration|Umstellung|Migration|Umzug|Aufbau|Abbau|" +
  "Hilfe|Unterstützung|Beratung|Abstimmung|Rücksprache|Anruf|Besuch|Übergabe|Einweisung|Vertretung)";
var NACHNAME = "(?!" + ALLTAGSWORT + "\\b)" + GROSSWORT;

/* Eine Präposition direkt vor dem Entfernten geht mit weg:
   "Fehler an PC11 behoben" -> "Fehler behoben". Wo nichts entfernt
   wird, bleibt sie ("Backup von gestern geprüft"). */
var VORWEG = "(?:\\b(?:[Aa]n|[Aa]m|[Aa]uf|[Ff]ür|[Vv]on|[Vv]om|[Mm]it|[Bb]ei|[Bb]eim|[Ii]n|[Ii]m|[Zz]u|[Zz]ur|[Zz]um|[Nn]ach|[Üü]ber|[Aa]us|[Dd]urch)\\s+)?";

/* Präfixe, hinter denen eine Zahl sicher eine Ticketnummer ist.
   "Störung", "Problem" und "Fall" fehlen bewusst: Das sind normale Wörter. */
var TICKETWORT = "ticket|tkt|tck|inc|incident|req|request|chg|change|sr|sd|prb|vorgang|auftrag|nr";

function R(muster, schalter) { return new RegExp(muster, schalter || "g"); }

/* Personen werden durch ihre Rolle ersetzt. Die Beugung hängt an der
   Präposition davor. */
var ROLLE = {
  "von": "von einem Kollegen", "vom": "von einem Kollegen",
  "mit": "mit einem Kollegen", "bei": "bei einem Kollegen",
  "beim": "bei einem Kollegen", "durch": "durch einen Kollegen",
  "für": "für einen Kollegen", "an": "an einen Kollegen",
  "zu": "zu einem Kollegen", "zur": "zu einem Kollegen",
  "zum": "zu einem Kollegen", "nach": "zu einem Kollegen"
};
function rolle(treffer) {
  var m = String(treffer).match(/^\s*([A-Za-zÄÖÜäöüß]+)\s/);
  var wort = m ? ROLLE[m[1].toLowerCase()] : null;
  var vorn = /^\s/.test(treffer) ? " " : "";
  return wort ? vorn + wort : vorn + "Kollege";
}

/* Ticketnummern: Die Nummer geht, das Wort bleibt ("Ticket gelöst"). */
var TICKETERSATZ = {
  ticket: "Ticket", tkt: "Ticket", tck: "Ticket", inc: "Störung",
  incident: "Störung", req: "Anfrage", request: "Anfrage",
  chg: "Änderung", change: "Änderung", sr: "Anfrage", sd: "Anfrage",
  prb: "Problem", vorgang: "Vorgang", auftrag: "Auftrag", nr: ""
};
function ticketwort(_treffer, wort) {
  var w = TICKETERSATZ[String(wort).toLowerCase()];
  return w === undefined ? "" : w;
}

/* Gerätenamen: Die Kennung geht, die Gattung bleibt. */
var GATTUNG = {
  pc: "PC", nb: "Notebook", lt: "Notebook", ws: "Arbeitsplatzrechner",
  srv: "Server", tsrv: "Terminalserver", dc: "Domänencontroller",
  fs: "Dateiserver", ap: "Access Point", sw: "Switch", fw: "Firewall",
  prt: "Drucker", nas: "NAS", drucker: "Drucker", notebook: "Notebook",
  laptop: "Laptop", rechner: "Rechner", client: "Client", host: "Host",
  wks: "Arbeitsplatzrechner", server: "Server", esx: "Server",
  vm: "virtuelle Maschine", ts: "Terminalserver"
};
function gattung(_treffer, kuerzel) {
  return GATTUNG[String(kuerzel).toLowerCase()] || "";
}

/* Die Regeln laufen der Reihe nach; die Reihenfolge ist Teil der Logik. */
var REGELN = [
  /* --- 1. Ticketnummern ---
     Nur mit Ticketwort davor oder in Klammern. Freie Kennungen wie
     AES256, ISO9001 oder RFC1918 bleiben stehen. */
  [R("\\b(" + TICKETWORT + ")[\\s.:#-]*\\d{2,}\\b", "gi"), ticketwort],
  [R(VORWEG + "#\\s?\\d{2,}\\b"), ""],
  [R(VORWEG + "\\[\\s*\\d{2,}\\s*\\]"), ""],

  /* --- 2. Rechner- und Gerätenamen ---
     Kürzel und Ziffer hängen direkt aneinander: "PC-07", "NB1234",
     "Drucker3" gehen; "Windows 10", "RAID 5", "Apache2", "Office-365"
     bleiben. Jahreszahlen sind ausgenommen ("WS2019" ist Windows Server). */
  [R("\\b(pc|nb|lt|ws|srv|tsrv|dc|fs|ap|sw|fw|prt|nas)[-_]?(?!(?:19|20)\\d{2}\\b)\\d{1,5}\\b", "gi"), gattung],
  [R("\\b(pc|nb|ws|srv|dc|fs|ap|prt|nas)[-_][a-z]{1,5}[-_]?\\d{1,5}\\b", "gi"), gattung],
  [R("\\b(drucker|notebook|laptop|rechner|client|host)[-_]?\\d{1,3}\\b", "gi"), gattung],
  // Hostnamen ohne Ziffern (PC-ANNA-MINI): nach dem Trennstrich alles groß,
  // damit "PC-Support" und "AP-Modus" heil bleiben.
  [R("\\b(PC|NB|WS|WKS|SRV|DC|FS|AP|PRT|NAS|TS)[-_][A-Z0-9][A-Z0-9]*(?:[-_][A-Z0-9]+)*\\b"), gattung],
  // Kürzel mitten im Namen (ABCSRVEX04, ABCWKS11): von Großbuchstaben
  // umgeben und auf Ziffern endend.
  [R("\\b[A-Z]{2,5}(SRV|WKS|SERVER|NAS|ESX|VM|PRT|DC)[A-Z0-9]{0,6}\\d{1,3}\\b"), gattung],

  /* --- 3. Personen ---
     Kein /i, wo [A-ZÄÖÜ] im Muster steht: Der Schalter würde die Klasse
     aufweichen und das Verb dahinter mitnehmen. */
  // Anrede + Name. Ein zweites großgeschriebenes Wort nur nach Titel oder
  // bekanntem Vornamen, sonst ginge "Dr. Meyer Zugang angelegt" mit.
  [R(VORWEG + "\\b(?:[Hh]err(?:n)?|[Ff]rau|[Kk]olleg(?:e|in))\\s+" + TITEL + NAME), rolle],
  // Abgekürzte Anrede nur mit Punkt, sonst verschwinden "HR" und "MS Office".
  [R(VORWEG + "\\b(?:[Hh]rn|[Hh]r|[Ff]r|[Mm]rs|[Mm]r|[Mm]s|[Dd]r|[Pp]rof)\\.\\s*" + NAME), rolle],
  // Erwähnungen und Mailadressen
  [R(VORWEG + "@[\\wäöüß.\\-]+"), ""],
  [R(VORWEG + "\\b[\\wäöüß.\\-]+@[\\wäöüß.\\-]+\\.[a-z]{2,}\\b", "gi"), ""],
  // Initiale und Name: "M. Weber", "Weber M." – aber nicht "z. B. Drucker".
  [R("(?<![a-zäöüß]\\.\\s?)" + VORWEG + "\\b[A-ZÄÖÜ]\\.\\s?[A-ZÄÖÜ][a-zäöüß]{2,}\\b"), ""],
  [R(VORWEG + "\\b[A-ZÄÖÜ][a-zäöüß]{2,}\\s+[A-ZÄÖÜ]\\.(?!\\w)"), ""],
  // Präposition + Vorname, Nachname wahlweise
  [R("\\b(?:[Ff]ür|[Vv]on|[Mm]it|[Bb]ei|[Aa]n|[Dd]urch|[Zz]u)\\s+" + VOR_BEIDE + "(?:\\s+" + GROSSWORT + ")?\\b" + KEINE_FIRMA), rolle],
  // Vorname + Nachname
  [R(VOR_GROSS + "\\s+" + NACHNAME + "\\b" + KEINE_FIRMA), rolle],
  // Vorname allein ("Johannes Hilfe bei …"). Muss nach den beiden Regeln
  // darüber stehen.
  [R("\\b" + VOR_GROSS + "\\b(?!\\.)"), "Kollege"],

  /* --- 4. Uhrzeiten und Datumsangaben ---
     Versionsnummern wie "Ubuntu 24.04" bleiben, dort fehlt das Jahr. */
  [/\b\d{1,2}:\d{2}\s*(?:-|–|bis)\s*\d{1,2}:\d{2}\b/g, ""],
  [/\b\d{1,2}:\d{2}\s*Uhr\b/gi, ""],
  [/\b(?:am\s+)?\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, ""],
  [/\bam\s+\d{1,2}\.\d{1,2}\.(?!\d)/g, ""],

  /* --- 5. Trennzeichen vereinheitlichen ---
     Bindestriche innerhalb von Wörtern (E-Mail, IT-Einrichtung) bleiben,
     sie haben keinen Leerraum um sich. */
  [/^\s*[-–—*•·>]+\s+/, ""],
  [/\s*[-–—]{2,}\s*/g, " "],
  [/\s+[-–—]\s+/g, ", "],
  [/\s+[|]\s+/g, ", "],
  [/\s+\/\s+/g, ", "],
  [/\s*[•·]\s*/g, ", "],

  /* --- 6. Statusnotizen --- */
  [/^(?:erledigt|fertig|done|todo|offen|wip|status)\b[\s.:,;!-]*/i, ""],
  [/[,;]\s*(?:erledigt|fertig|done|ok|okay|passt|läuft|todo|offen|wip|in arbeit)\s*[.!]?\s*$/i, ""],
  // Ohne Trenner davor nur die eindeutigen Wörter; "läuft" und "offen"
  // können am Satzende etwas aussagen.
  [/\s+\b(?:erledigt|fertig|done|todo|wip|ok)\b\s*[.!]?\s*$/i, ""],
  [/\s*[(\[](?:erledigt|fertig|done|ok|todo|offen|wip)[)\]]\s*/gi, " "]
];

/* Präpositionen und Bindewörter, die nach dem Entfernen allein dastehen. */
var HAENGEND = /\s*\b(?:an|am|im|in|für|von|mit|bei|auf|zu|über|durch|nach|aus|vom|beim|zum|zur)\b(?=\s*(?:[,;.:]|und\b|oder\b|sowie\b|$))/gi;
var BINDEWORT = /\s*\b(?:und|oder|sowie|bzw\.?)\b(?=\s*(?:[,;.:]|und\b|oder\b|sowie\b|$))/gi;

/* ---------- Notizsprache in Deutsch ----------
   In der Zeiterfassung steht "Kunde Call" oder "Vorbereitung f. Schicht".
   Übersetzt wird per Tabelle statt per Modell, damit das Ergebnis immer
   gleich ist. Läuft nach der Kundenersetzung; das Besondere steht vor
   dem Allgemeinen. */
var NOTIZSPRACHE = [
  [/\bKunden?[-\s]+Call\b/gi, "Kundengespräch per Telefon"],
  [/\bCall\s+(?:mit|beim?|für|f\.)\s+(?:dem\s+|den\s+|der\s+)?Kunden?\b/gi,
    "Kundengespräch per Telefon"],
  [/\bCall\s+Kunden?\b/gi, "Kundengespräch per Telefon"],
  [/\bCall\b/gi, "Telefonat"],
  [/\bWeekly\b/gi, "wöchentliche Teambesprechung"],
  [/\bDailys?\b/gi, "tägliche Abstimmung"],
  [/\bJour\s?fixe\b/gi, "regelmäßige Besprechung"],

  // Abkürzungen, jeweils mit Wortgrenze davor ("Prof." bleibt)
  [/\bdiesbzgl\.?(?=\s|$)/gi, "diesbezüglich"],
  [/\bbzgl\.?(?=\s|$)/gi, "bezüglich"],
  [/\bu\.\s*a\.(?=\s|$)/gi, "unter anderem"],
  [/\bz\.\s*T\.(?=\s|$)/g, "zum Teil"],
  [/\bggf\.?(?=\s|$)/gi, "gegebenenfalls"],
  [/\bf\.\s+(?=[A-Za-zÄÖÜäöü])/g, "für "],
  [/\bv\.\s+(?=[A-Za-zÄÖÜäöü])/g, "von "],
  [/\bu\.\s+(?=[a-zäöü])/g, "und "]
];

/* ---------- Kunden ----------
   Kundennamen kommen aus der Kundenspalte des Exports und werden im Text
   durch "Kunde" ersetzt. Allgemeine Einträge wie "Intern" sind eine
   Kategorie, keine Kundschaft. */
var ALLGEMEINE_KUNDEN = [
  "intern", "internal", "allgemein", "sonstiges", "sonstige", "extern",
  "inhouse", "eigen", "eigene", "haus", "diverse", "divers"
];
var kunden = [];

function kundeMerken(name) {
  var n = String(name || "").trim();
  if (n.length < 3) return;
  if (ALLGEMEINE_KUNDEN.indexOf(n.toLowerCase()) !== -1) return;
  if (kunden.some(function (k) { return k.toLowerCase() === n.toLowerCase(); })) return;
  kunden.push(n);
}

/** Namen und Kürzel aus "Deine Daten". */
function eigeneNamen() {
  var feld = $("f-namen");
  return (feld ? feld.value : "").split(/[;,]/)
    .map(function (n) { return n.trim(); })
    .filter(function (n) { return n.length >= 2; });
}

function ohneSonderzeichen(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Einen Text bereinigen. */
function saeubern(text) {
  var s = String(text || "");
  REGELN.forEach(function (r) { s = s.replace(r[0], r[1]); });

  eigeneNamen().forEach(function (n) {
    var e = ohneSonderzeichen(n);
    // Eigenes Kürzel mit Nummer, wahlweise mit Ticketwort davor
    s = s.replace(new RegExp(VORWEG + "(?:\\b(?:" + TICKETWORT + ")\\b[\\s.:#-]*)?\\b" +
      e + "[-_\\s]?\\d{1,6}\\b", "gi"), "");
    s = s.replace(new RegExp(VORWEG + "\\b" + e + "\\b", "gi"), "");
  });

  kunden.forEach(function (n) {
    s = s.replace(new RegExp("\\b" + ohneSonderzeichen(n) + "\\b", "gi"), "Kunde");
  });

  NOTIZSPRACHE.forEach(function (r) { s = s.replace(r[0], r[1]); });

  return aufraeumen(s);
}

/** Reste der Ersetzungen glätten: leere Klammern, Dopplungen, Satzzeichen. */
function aufraeumen(text) {
  var s = String(text || "")
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, "")
    .replace(/\s{2,}/g, " ");
  s = s.replace(HAENGEND, "").replace(BINDEWORT, "");
  // "mit einem Kollegen und Kollege" -> "mit Kollegen"
  s = s.replace(/\b(?:einem|einen|ein)\s+Kollegen?\s*(?:,|und|sowie|oder)\s*(?:(?:einem|einen|ein)\s+)?Kollegen?\b/gi, "Kollegen");
  // "Notebook NB1234" wurde zu "Notebook Notebook"
  s = s.replace(/\b([A-Za-zÄÖÜäöüß]{2,})(\s+\1)+\b/gi, "$1");
  // "PC-01, PC-02 und PC-03" wurde zu "PC, PC und PC"
  var vorher;
  do {
    vorher = s;
    s = s.replace(/\b([A-Za-zÄÖÜäöüß]{2,})((?:\s*,|\s+und|\s+sowie)\s+\1\b)+/gi, "$1");
  } while (s !== vorher);
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:\-–])\s*([,.;:])/g, "$2")
    .replace(/^\s*(?:und|oder|sowie)\b\s*/i, "")
    .replace(/^[\s,;:.\-–•*]+/, "")
    .replace(/[\s,;:\-–]+$/, "")
    .trim();
}
