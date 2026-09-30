/* ============================================================
 * Stichpunkte über ein lokales Sprachmodell (Ollama)
 *
 * Optional: Ohne Adresse unter "Deine Daten" gibt es die Funktion nicht.
 *
 * Aus den Tätigkeiten eines Tages – egal wie vielen – sollen ein paar
 * Halbsätze werden, die den Tag zusammenfassen. Das Ergebnis bleibt ein
 * Entwurf: Der alte Text wird aufgehoben und die Freigabe des Tages fällt
 * weg, bis ein Mensch gegengelesen hat.
 *
 * Die Zahl der Absätze setzt der Code durch, nicht der Prompt. Gemessen an
 * Tagen mit 14 und 22 Positionen (qwen2.5:7b-instruct und qwen3.5:4b, dazu
 * acht Prompt- und Strukturvarianten) kamen immer 8 bis 19 Absätze zurück:
 * Ein Modell richtet sich nach den Themen des Tages, nicht nach der
 * verlangten Zahl. Der Text selbst ist knapp genug (rund 500 Zeichen beim
 * 7b-Modell), nur eben auf zu viele Absätze verteilt – und jeder Absatz
 * kostet im Vordruck eine Zeile.
 * ========================================================== */

/* Der Systemprompt macht das Format am Beispiel vor, statt es zu
   beschreiben: Ein kleines Modell schreibt eine beschriebene Schablone
   wie "Kategorie: Beschreibung" sonst wörtlich ab. Die Zeilenzahl kommt
   aus "Deine Daten" (stichpunkteJeTag()).

   Das Maß für "zusammengefasst" hat ein Ausbilder vorgegeben: Zwei
   Ubuntu- und eine Debian-Installation sind "Installation Ubuntu 2x und
   Installation Debian 1x" – gezählt statt aufgezählt, ohne Geräte.

   Gefragt sind Arbeitsbereiche, nicht Einzelheiten: Mit der Regel "Namen
   unverändert abschreiben" und einem ausführlichen Beispiel kamen im Schnitt
   elf Wörter je Zeile samt Ports, Programmen und Stockwerken zurück.

   Herstellernamen sagen nichts über den Tag – der Name eines Fernwartungs-
   werkzeugs ist austauschbar, "Fernwartung" benennt die Arbeit. Betriebssysteme
   und verbreitete Technik bleiben dagegen stehen: Sie zeigen das Gelernte,
   und der Ausbilder liest sie so auch im Ausbildungsrahmenplan. */
var KI_BEISPIEL_EINGABE = [
  "Möbelaufbau: Bürostühle aufgebaut",
  "Möbelaufbau: Schränke und Schreibtische montiert",
  "Ubuntu auf Notebook installiert",
  "Ubuntu auf zweitem Notebook installiert",
  "Debian auf Server installiert",
  "GitLab: Notizen ausformuliert",
  "WireGuard verbessert",
  "Kundengespräch per Telefon",
  "Tickets bearbeitet",
  "Kollege geholfen"
];
var KI_BEISPIEL_AUSGABE = [
  "Möbelmontage für neue Arbeitsplätze",
  "Installation Ubuntu 2x und Installation Debian 1x",
  "Dokumentation und Pflege des VPN",
  "Kundensupport, Tickets und Unterstützung im Team"
];

/** "höchstens vier Zeilen", "höchstens einer Zeile" – für Prompt und Auftrag. */
function zeilenAngabe(n) {
  if (n === 1) return "höchstens einer Zeile";
  return "höchstens " + (["", "", "zwei", "drei", "vier", "fünf", "sechs"][n] || n) + " Zeilen";
}

/** Der Systemprompt für n Zeilen; das Beispiel wird auf dieselbe Zahl zusammengelegt. */
function kiPrompt(n) {
  n = n || stichpunkteJeTag();
  return [
    "Du fasst die Tätigkeiten eines Arbeitstages für einen Ausbildungsnachweis zusammen.",
    "",
    "Du bekommst sie als Liste und antwortest mit " + zeilenAngabe(n) + ", die den Tag",
    "zusammenfassen: kurze Halbsätze im Nominalstil, je Zeile ein Arbeitsbereich,",
    "ohne Punkt am Ende. Wer den Nachweis liest, soll auf einen Blick sehen, woran",
    "gearbeitet wurde – nicht, wie im Einzelnen.",
    "",
    "Regeln:",
    "- Allgemein bleiben: Oberbegriffe statt Einzelheiten, höchstens sechs Wörter je",
    "  Zeile. Programme, Versionen, Ports, Ticketnummern, Räume, Kunden und Gründe",
    "  lässt du weg. Aus \"Teamviewer auf Kunden-PC installiert\" wird",
    "  \"Softwareinstallation\", aus \"Port 443 und HTTP-Requests geprüft\" wird",
    "  \"Netzwerkanalyse\".",
    "- Wie viele Tätigkeiten in der Liste stehen, spielt keine Rolle. Verwandtes fasst",
    "  du unter einem Oberbegriff zusammen, Nebensächliches lässt du weg.",
    "- Dieselbe Tätigkeit an mehreren Geräten oder Stellen nennst du einmal und zählst:",
    "  \"Installation Ubuntu 2x und Installation Debian 1x\". Welche Geräte, lässt du weg.",
    "- Du erfindest nichts dazu und verwendest nur, was in der Liste steht.",
    "- Namen von Herstellern und Werkzeugen ersetzt du durch die Gattung, nicht die",
    "  Marke: Fernwartung, Ticketsystem, Zeiterfassung, Fernüberwachung, Virenschutz.",
    "  Betriebssysteme und verbreitete Technik behältst du – Windows, Linux, VPN,",
    "  RAID, Active Directory sagen, was gelernt wurde.",
    "- Steht \"Kunde\" oder \"Kollege\" in der Liste, formulierst du damit natürlich",
    "  weiter: Kundensupport, Unterstützung im Team.",
    "- Jede Zeile ist ein durchgehender Halbsatz ohne Doppelpunkt. Ein Thema aus der",
    "  Liste stellst du nicht voran, sondern baust es ein: \"Serverwartung\",",
    "  \"Einrichtung von Notebooks\".",
    "- Du antwortest ausschließlich mit den Zeilen. Keine Nummerierung, keine Striche,",
    "  keine Einleitung, keine Erklärung. Du denkst nicht laut.",
    "",
    "Beispiel",
    "",
    "Eingabe:"
  ].concat(KI_BEISPIEL_EINGABE.map(function (z) { return "- " + z; }), [
    "",
    "Ausgabe:"
  ], zusammenlegen(KI_BEISPIEL_AUSGABE, n)).join("\n");
}

/* Eigene Anweisungen aus "Deine Daten" werden angehängt, nicht eingesetzt. */
var KI_ANWEISUNGEN_MAX = 500;

function kiSystem(grundprompt) {
  var eigene = kiEinstellungen().anweisungen;
  if (!eigene) return grundprompt;
  return grundprompt + "\n\n" +
    "Zusätzliche Wünsche der Person, die das Heft führt:\n" + eigene + "\n\n" +
    "Diese Wünsche gelten nur, soweit sie den Regeln oben nicht widersprechen. " +
    "Das Format und das Verbot, etwas zu erfinden, gehen immer vor.";
}

/* ---------- Einstellungen und Verbindung ---------- */

function kiEinstellungen() {
  var adresse = ($("f-ki-adresse") ? $("f-ki-adresse").value : "").trim();
  var modell = ($("f-ki-modell") ? $("f-ki-modell").value : "").trim();
  var anweisungen = ($("f-ki-anweisungen") ? $("f-ki-anweisungen").value : "").trim();
  return {
    adresse: adresse, modell: modell,
    anweisungen: anweisungen.slice(0, KI_ANWEISUNGEN_MAX)
  };
}
function kiBereit() { return !!kiEinstellungen().adresse; }

/** "http://host:11434", "http://host:11434/" und "/ki" ergeben alle <adresse>/api/chat. */
function kiEndpunkt(adresse) {
  return adresse.replace(/\/+$/, "") + "/api/chat";
}

/**
 * Läuft dort ein Ollama, und kennt es das Modell? Geprüft über
 * /api/tags, das in Millisekunden antwortet – eine echte Anfrage würde
 * erst das Modell laden.
 */
/**
 * Liegt das Werkzeug auf einem Server, erlaubt dessen Sicherheitsregel (CSP connect-src 'self')
 * nur Anfragen an die eigene Adresse; der Weg zu Ollama ist dort /ki. Eine fremde Adresse
 * blockiert der Browser, und fetch meldet das genauso wie einen ausgeschalteten Rechner.
 */
function kiNichtErreichbar(adresse, grundsatz) {
  var fremd = false;
  try {
    fremd = /^https?:$/.test(location.protocol) && new URL(adresse, location.href).origin !== location.origin;
  } catch (e) { /* keine gültige Adresse */ }
  if (fremd) {
    return new Error("Auf dem Server geht die KI über die Adresse „/ki“. Direkte Adressen wie " +
      adresse + " lässt der Browser hier nicht zu.");
  }
  return new Error(grundsatz);
}

/** Die Namen der Modelle, die unter dieser Adresse installiert sind. Wirft, wenn dort nichts ist. */
async function kiTags(adresse, frist) {
  var steuerung = new AbortController();
  var uhr = setTimeout(function () { steuerung.abort(); }, frist || 8000);
  try {
    var antwort = await fetch(adresse.replace(/\/+$/, "") + "/api/tags", { signal: steuerung.signal });
    if (!antwort.ok) throw new Error("Der Dienst antwortete mit " + antwort.status + ".");
    var daten = await antwort.json();
    return ((daten && daten.models) || []).map(function (m) { return m.name || m.model || ""; });
  } finally {
    clearTimeout(uhr);
  }
}

async function kiErreichbar() {
  var e = kiEinstellungen();
  if (!e.adresse) throw new Error("Keine Adresse für das Sprachmodell hinterlegt.");
  try {
    var namen = await kiTags(e.adresse);
    // "qwen3" meint "qwen3:latest" und soll als Treffer gelten. Leeres Feld: jedes Modell passt.
    var gefunden = !e.modell ? namen.length > 0 : namen.some(function (n) {
      return n === e.modell || n.split(":")[0] === e.modell.split(":")[0];
    });
    return { namen: namen, gefunden: gefunden, genau: namen.indexOf(e.modell) !== -1 };
  } catch (fehler) {
    if (fehler.name === "AbortError") throw new Error("Keine Antwort innerhalb von acht Sekunden.");
    if (fehler instanceof TypeError) {
      throw kiNichtErreichbar(e.adresse, "Unter " + e.adresse + " ist nichts erreichbar.");
    }
    throw fehler;
  }
}

/**
 * Welche Adressen kommen hier überhaupt in Frage?
 *
 * Auf einem Server liegt Ollama hinter „/ki“ – eine fremde Adresse ließe die Sicherheitsregel
 * (CSP connect-src 'self') dort ohnehin nicht zu. Als Einzeldatei gibt es kein „/ki“, dort ist
 * es das Ollama auf dem eigenen Rechner. Über „npm start“ kann beides stimmen, deshalb in
 * dieser Reihenfolge: erst die eigene Adresse, dann der eigene Rechner.
 */
function kiAdressen() {
  if (location.protocol === "file:") return ["http://localhost:11434"];
  return ["/ki", "http://localhost:11434"];
}

/**
 * Die erste Adresse, unter der ein Ollama antwortet, ins Feld schreiben.
 *
 * Wer das Werkzeug öffnet, weiß nicht, ob sein Ollama hinter „/ki“ oder unter Port 11434
 * liegt – beide Wege auszuprobieren ist schneller als jede Erklärung. Kurze Frist: Das läuft
 * nebenher, während der Dialog schon offen ist.
 */
function kiAdresseSuchen() {
  var feld = $("f-ki-adresse");
  if (!feld || feld.value.trim()) return Promise.resolve(null);
  return kiAdressen().reduce(function (kette, adresse) {
    return kette.then(function (treffer) {
      if (treffer) return treffer;
      return kiTags(adresse, 2500).then(function (namen) {
        return { adresse: adresse, namen: namen };
      }).catch(function () { return null; });
    });
  }, Promise.resolve(null)).then(function (treffer) {
    if (!treffer || feld.value.trim()) return null;
    feld.value = treffer.adresse;
    merken();
    return treffer;
  });
}

/**
 * Eine Anfrage an das Modell. Wirft bei jedem Problem.
 *
 * Kümmert sich um Zeitablauf, Abbruch (signal vom Wochenlauf),
 * Denkschritte und Aufzählungszeichen in der Antwort.
 *
 * Sampling nach der Qwen-Empfehlung für den Modus ohne Denkschritt
 * (top_p 0.8, top_k 20), aber mit niedriger Temperatur, weil nur gekürzt
 * werden soll. Der feste seed macht die Antwort wiederholbar.
 */
async function kiAnfrage(system, auftrag, signal, saat, waerme) {
  var e = kiEinstellungen();
  if (!e.adresse) throw new Error("Keine Adresse für das Sprachmodell hinterlegt.");

  var steuerung = new AbortController();
  var uhr = setTimeout(function () { steuerung.abort(); }, 220000);
  var weiterreichen = function () { steuerung.abort(); };
  if (signal) {
    if (signal.aborted) steuerung.abort();
    else signal.addEventListener("abort", weiterreichen);
  }
  try {
    // Leeres Feld heißt: das Modell, das dort installiert ist. Das Feld füllt sich sonst erst in
    // „Deine Daten“; lädt Docker das Modell beim ersten Start noch, bleibt es dort leer.
    if (!e.modell) {
      var namen = await kiTags(e.adresse);
      if (!namen.length) {
        throw new Error("Dort ist noch kein Modell installiert. Mit Docker lädt es beim ersten " +
          "Start noch, sonst: ollama pull qwen3.5:4b");
      }
      e.modell = namen[0];
      if ($("f-ki-modell")) { $("f-ki-modell").value = e.modell; merken(); }
    }
    var antwort = await fetch(kiEndpunkt(e.adresse), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: steuerung.signal,
      body: JSON.stringify({
        model: e.modell,
        stream: false,
        think: false,
        options: {
          temperature: waerme || 0.2, top_p: 0.8, top_k: 20,
          repeat_penalty: 1.05, seed: saat || 7
        },
        messages: [
          { role: "system", content: system },
          { role: "user", content: auftrag }
        ]
      })
    });
    if (!antwort.ok) {
      var grund = antwort.status === 404
        ? 'Modell "' + e.modell + '" ist dort nicht installiert.'
        : "Das Sprachmodell antwortete mit " + antwort.status + ".";
      throw new Error(grund);
    }
    var daten = await antwort.json();
    var inhalt = ohneDenken((daten && daten.message && daten.message.content) || "");
    var raus = inhalt.split(/\r?\n/)
      .map(function (z) { return z.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim(); })
      .filter(Boolean);
    if (!raus.length) throw new Error("Das Sprachmodell hat nichts zurückgegeben.");
    return raus.join("\n");
  } catch (fehler) {
    if (fehler.name === "AbortError") {
      throw new Error(signal && signal.aborted
        ? "Abgebrochen."
        : "Das Sprachmodell hat nicht rechtzeitig geantwortet.");
    }
    if (fehler instanceof TypeError) {
      throw kiNichtErreichbar(e.adresse, "Das Sprachmodell ist unter " + e.adresse + " nicht erreichbar.");
    }
    throw fehler;
  } finally {
    clearTimeout(uhr);
    if (signal) signal.removeEventListener("abort", weiterreichen);
  }
}

/**
 * Denkschritte wegschneiden. Modelle wie qwen3 schreiben sie trotz
 * think: false in die Antwort, wenn die Ollama-Fassung das Feld nicht
 * kennt. Ein offener Block ohne Ende gilt bis zum Schluss als Denken.
 */
function ohneDenken(text) {
  var s = String(text || "");
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  s = s.replace(/<\|?(?:begin_of_thought|thinking)\|?>[\s\S]*?<\|?(?:end_of_thought|\/thinking)\|?>/gi, "");
  var offen = s.lastIndexOf("</think>");
  if (offen !== -1) s = s.slice(offen + 8);
  else if (/<think>/i.test(s)) s = s.replace(/<think>[\s\S]*$/i, "");
  return s.trim();
}

/** Die Tätigkeiten eines Tages durch das Modell zusammenfassen lassen. */
function kiStichpunkte(text, signal) {
  var n = stichpunkteJeTag();
  return kiAnfrage(kiSystem(kiPrompt(n)),
    "Fasse diesen Arbeitstag in " + zeilenAngabe(n) + " zusammen.\n\n" + text, signal);
}

/* ---------- Auf den Platz im Vordruck bringen ---------- */

/**
 * Zwei Halbsätze zu einem. Das Thema des zweiten wandert in Klammern,
 * damit nur ein Doppelpunkt in der Zeile steht.
 */
function verschmelzen(a, b) {
  var ea = String(a).trim().replace(/\s*[.;,]+\s*$/, "");
  var eb = String(b).trim().replace(/\s*[.;,]+\s*$/, "");
  var t = eb.match(/^([^:]{2,40}):\s*(.*)$/);
  if (t) eb = t[2] ? t[1] + " (" + t[2] + ")" : t[1];
  return ea + ", " + eb;
}

/**
 * Mehr Absätze als Platz: zusammenlegen statt abschneiden, denn eine
 * weggeworfene Zeile wäre eine fehlende Tätigkeit. Verschmolzen wird
 * immer das Nachbarpaar mit der kleinsten Zeichensumme, damit die Zeilen
 * ähnlich lang bleiben und keine über ZEICHEN_JE_ZEILE hinauswächst.
 */
function zusammenlegen(liste, hoechstens) {
  var out = liste.slice();
  while (out.length > hoechstens && out.length > 1) {
    var beste = 0, kleinste = Infinity;
    for (var i = 0; i + 1 < out.length; i++) {
      var summe = out[i].length + out[i + 1].length;
      if (summe < kleinste) { kleinste = summe; beste = i; }
    }
    out.splice(beste, 2, verschmelzen(out[beste], out[beste + 1]));
  }
  return out;
}

/* ---------- Einen Tag kürzen ---------- */

/** Tage einer Woche, die sich kürzen lassen: mit Text und noch nicht gekürzt. */
function kiTageDerWoche(montagIso) {
  var montag = vonIso(montagIso), out = [];
  for (var i = 0; i < TAGE_JE_WOCHE; i++) {
    var key = iso(plus(montag, i)), t = tage[key];
    if (!t || t.vorKi != null) continue;
    if (t.art && !istSchultag(t.art)) continue;
    if (!(t.text || "").trim()) continue;
    // Eine Fächerliste aus dem Import ist schon so knapp, wie das Feld sie will.
    if (schulEntwurf(t)) continue;
    out.push({ key: key, tag: WOCHENTAGE[plus(montag, i).getDay()], daten: t });
  }
  return out;
}

/**
 * Einen Tag durch das Modell schicken. Wirft weiter, was schiefgeht.
 *
 * Eine Anfrage, dann auf stichpunkteJeTag() Absätze zusammenlegen. Danach steht
 * die Zusammenfassung im Tag, der alte Text in vorKi, und die Freigabe ist
 * aufgehoben – gegengelesen wird von Hand.
 */
async function kiTagKuerzen(t, signal) {
  var vorher = t.text || "";
  var roh = zeilen(await kiStichpunkte(fuersModell(vorher), signal));
  // Den Schlusspunkt setzen die Modelle trotz Prompt oft; der Nachweis will keinen.
  var neu = zusammenlegen(roh, stichpunkteJeTag()).map(ohneSchlusspunkt).join("\n");

  t.vorKi = vorher;
  t.text = neu;
  // kiText erkennt beim nächsten Import, ob der Text seither von Hand
  // überarbeitet wurde (siehe verarbeite()).
  t.kiText = neu;
  delete t.geprueft;
}
