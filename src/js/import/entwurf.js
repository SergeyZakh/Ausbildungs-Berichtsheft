/* ============================================================
 * Entwurf: aus den importierten Buchungen eines Tages wird ein Text
 *
 * Eine Zeile je Buchung, "Projekt: Beschreibung", in der Reihenfolge des
 * Tages, bereinigt und ohne Uhrzeiten. Doppelte Buchungen erscheinen
 * einmal. Mehr als ENTWURF_MAX Zeilen werden zu Gruppen benachbarter
 * Buchungen zusammengezogen.
 *
 * Nach Dauer wird nicht gefiltert: Eine Viertelstunde "Netzteil
 * getauscht" gehört ins Heft. Wer etwas draußen halten will, pflegt die
 * Liste "Nicht ins Heft übernehmen".
 * ========================================================== */

var ENTWURF_MAX = 10;

function listeAusFeld(id) {
  var feld = $(id);
  return (feld ? feld.value : "").split(/[;,]/)
    .map(schluessel).filter(Boolean);
}

/** Projekte und Tätigkeiten, die nie ins Heft sollen. */
function ausnahmen() { return listeAusFeld("f-ausblenden"); }

function ausgeblendet(p, liste) {
  if (!liste.length) return false;
  var a = schluessel(p.projekt), b = schluessel(p.taetigkeit);
  return liste.some(function (x) { return x === a || x === b; });
}

/** Projektnamen, die nicht vorangestellt werden sollen. */
function stummeProjekte() { return listeAusFeld("f-projektraus"); }

/**
 * Trägt der Projektname etwas zur Tätigkeit bei?
 *
 * Oft ist das Projekt nur die Schublade ("Ausbildung", "intern") oder
 * ein Leistungsschein ("LS KW37 32600222"). Vorangestellt stünde dann in
 * jeder Zeile dasselbe. Ein Name wie "Support Kundenportal" bleibt.
 */
function projektTaugt(name) {
  var n = String(name || "").trim();
  if (!n) return false;
  // Auftrags- und Leistungsscheinnummern
  if (/\d{4,}/.test(n)) return false;
  var k = schluessel(n);
  if (!k) return false;
  return stummeProjekte().indexOf(k) === -1;
}

/** Steht der Name schon in der Zeile? Wortweise: "KI" trifft "KI Schulung", nicht "Kimai". */
function nenntSchon(text, name) {
  var k = schluessel(name);
  if (!k) return false;
  return (" " + schluessel(text) + " ").indexOf(" " + k + " ") !== -1;
}

/** Eine Buchung als Zeile: "Projekt: Beschreibung", ohne Leerlauf. */
function postenZeile(p) {
  var roh = (p.projekt || "").trim();
  var name = projektTaugt(roh) ? saeubern(roh) : "";
  var was = saeubern((p.beschreibung || "").trim() || (p.taetigkeit || "").trim());
  if (istMuell(was)) was = "";
  // Das Projekt nur voranstellen, wenn es nicht schon in der Tätigkeit steht
  // ("KI: KI Schulung").
  if (name && was && !nenntSchon(was, name)) return name + ": " + was;
  if (was) return was;
  // Ohne brauchbares Projekt bleibt die Tätigkeit als letzter Anhalt.
  if (!name) {
    var ersatz = saeubern((p.taetigkeit || "").trim());
    return istMuell(ersatz) ? "" : ersatz;
  }
  return istMuell(name) ? "" : name;
}

/** Der Entwurf eines Tages aus seinen Buchungen. */
function rohtext(posten) {
  var alle = posten || [];
  if (!alle.length) return "";
  var raus = ausnahmen();
  var liste = alle.filter(function (p) { return !ausgeblendet(p, raus); });

  var gesehen = {}, eindeutig = [];
  liste.forEach(function (p) {
    var z = postenZeile(p);
    if (!z) return;
    var k = schluessel(z);
    if (!k || gesehen[k]) return;
    gesehen[k] = true;
    eindeutig.push({ text: z, projekt: p.projekt || "" });
  });
  if (eindeutig.length <= ENTWURF_MAX) {
    return eindeutig.map(function (x) { return x.text; }).join("\n");
  }

  /* Zu viele Zeilen: benachbarte Buchungen in gleich große Gruppen legen.
     Nach Projekt zu bündeln ginge schief, sobald fast alles im selben
     Projekt steht – dann entstünde eine einzige Riesenzeile. */
  var proGruppe = Math.ceil(eindeutig.length / ENTWURF_MAX);
  var gebuendelt = [];
  for (var i = 0; i < eindeutig.length; i += proGruppe) {
    var teil = eindeutig.slice(i, i + proGruppe);

    // Ein gemeinsames Projekt steht einmal vorn statt in jedem Stück.
    var kopf = projektTaugt(teil[0].projekt) ? saeubern(teil[0].projekt.trim()) : "";
    var gleich = !!kopf && teil.every(function (x) {
      return schluessel(x.projekt) === schluessel(teil[0].projekt);
    });

    var stuecke = teil.map(function (x) {
      if (!gleich) return x.text;
      var j = x.text.indexOf(": ");
      return j === -1 ? x.text : x.text.slice(j + 2);
    });
    // Nach einem Punkt ist das Semikolon überflüssig.
    var rumpf = stuecke.join("; ").replace(/\.;\s*/g, ". ");
    gebuendelt.push(gleich ? kopf + ": " + rumpf : rumpf);
  }
  return gebuendelt.join("\n");
}

/** Entwürfe neu bauen, etwa nach Änderung der Ausnahmelisten. Selbst Geschriebenes bleibt. */
function entwuerfeNeu() {
  Object.keys(tage).forEach(function (k) {
    var t = tage[k];
    if (!t.posten || !t.posten.length) return;
    if (t.entwurf != null && t.text !== t.entwurf) return;
    // Zusammengeführte Schultage stehen unter den Themen der Woche (schule.js).
    if (tagImWochenfeld(k)) return;
    t.text = tagesEntwurf(t);
    t.entwurf = t.text;
    delete t.geprueft;
  });
}
