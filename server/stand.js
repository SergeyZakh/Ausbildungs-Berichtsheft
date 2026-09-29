/**
 * Stand eines Tages und einer Woche – dieselben Regeln wie im Browser (src/js/kern/zustand.js),
 * nur ohne die Herkunft des Texts: Auf dem Server zählt, ob Text da ist und ob er übernommen wurde.
 *
 *   fertig  übernommen (geprueft)
 *   offen   Text da, aber nicht übernommen
 *   frei    Urlaub, Krank, Feiertag
 *   fehlt   Werktag im Ausbildungszeitraum ohne Text
 *
 * Berufsschule und Betriebsversammlung sind nicht frei: Sie haben ein eigenes Feld im Vordruck
 * und brauchen Text wie ein Arbeitstag (istSchultag() im Browser).
 *
 * Ein gesetzlicher Feiertag ohne Eintrag zählt als frei, nicht als fehlend (feiertage.js). Ein
 * Eintrag ohne Text, Art und Stunden zählt wie keiner, etwa nach „Importierte Daten entfernen“.
 *
 * Hat eine Woche Themen für die Berufsschule (Blockwoche, wochen.schule), steht jeder Werktag ohne
 * eigenen Text, der nicht frei ist, unter ihnen und hat ihren Stand. Der Server kennt den Schulplan
 * nicht; der Browser zählt deshalb genauso (tagImWochenfeld() in src/js/kern/zustand.js).
 */
'use strict';

const { istFeiertag } = require('./feiertage');

const SCHULTAGE = ['Berufsschule', 'Betriebsversammlung'];

function tagStand(tag) {
  if (!tag) return 'fehlt';
  if (tag.art && !SCHULTAGE.includes(tag.art)) return 'frei';
  if (!String(tag.text || '').trim()) return 'fehlt';
  return tag.geprueft ? 'fertig' : 'offen';
}

/** Steht der Tag unter den Themen seiner Woche: nicht frei und ohne eigenen Text? */
function imWochenfeld(tag) {
  return !tag || (!(tag.art && !SCHULTAGE.includes(tag.art)) && !String(tag.text || '').trim());
}

/** Kein Eintrag oder einer, in dem nichts steht. */
function ohneEintrag(tag) {
  return !tag || (!tag.art && !String(tag.text || '').trim() && !Number(tag.stunden));
}

/** "JJJJ-MM-TT" des Montags der Woche, in der das Datum liegt. */
function montag(datum) {
  const d = new Date(datum + 'T00:00:00Z');
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (tag - 1));
  return d.toISOString().slice(0, 10);
}

function istWerktag(datum) {
  const tag = new Date(datum + 'T00:00:00Z').getUTCDay();
  return tag >= 1 && tag <= 5;
}

/** Alle Werktage von `von` bis `bis` (jeweils einschließlich). */
function werktage(von, bis) {
  const tage = [];
  const d = new Date(von + 'T00:00:00Z');
  const ende = new Date(bis + 'T00:00:00Z');
  while (d <= ende) {
    const datum = d.toISOString().slice(0, 10);
    if (istWerktag(datum)) tage.push(datum);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return tage;
}

/**
 * Zählt je Woche, wie viele Werktage fertig, offen, frei oder noch offen sind.
 * Für die Übersicht des Ausbilders: welche Wochen sind durch, wo fehlt etwas.
 *
 * @param {string} von, bis  Zeitraum (Werktage)
 * @param {Array}  tage      Zeilen aus der Tabelle „tage“
 * @param {string} land      Kürzel des Bundeslands aus den Stammdaten, leer = bundesweit
 * @param {Array}  angaben   Zeilen aus der Tabelle „wochen“, für die Themen einer Blockwoche
 * @returns {Array} [{ montag, fertig, offen, frei, fehlt, stand }]
 */
function wochenUebersicht(von, bis, tage, land = '', angaben = []) {
  const nachDatum = new Map(tage.map((t) => [t.datum, t]));
  const schulwochen = new Map(angaben.filter((w) => String(w.schule || '').trim()).map((w) => [w.montag, w]));
  const wochen = new Map();
  for (const datum of werktage(von, bis)) {
    const schluessel = montag(datum);
    const woche = wochen.get(schluessel) || { montag: schluessel, fertig: 0, offen: 0, frei: 0, fehlt: 0 };
    const tag = nachDatum.get(datum);
    const block = schulwochen.get(schluessel);
    if (ohneEintrag(tag) && istFeiertag(datum, land)) woche.frei++;
    else if (block && imWochenfeld(tag)) woche[block.schuleGeprueft ? 'fertig' : 'offen']++;
    else woche[tagStand(tag)]++;
    wochen.set(schluessel, woche);
  }
  return [...wochen.values()].map((w) => ({
    ...w,
    // Eine Woche ist erst fertig, wenn kein Werktag mehr offen ist oder fehlt.
    stand: w.offen ? 'offen' : (w.fehlt ? 'fehlt' : 'fertig'),
  })).sort((a, b) => a.montag.localeCompare(b.montag));
}

module.exports = { SCHULTAGE, tagStand, montag, istWerktag, werktage, wochenUebersicht };
