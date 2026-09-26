/**
 * Gesetzliche Feiertage – dieselben Regeln wie feiertagAn() im Browser (src/js/kern/grundlagen.js).
 * Ein Feiertag ohne Eintrag ist kein fehlender Werktag. test/lauf.js vergleicht beide Seiten Tag
 * für Tag über zwei Jahre und alle Länder; wer hier etwas ändert, ändert es dort mit.
 */
'use strict';

function datum(jahr, monat, tag) {
  return new Date(Date.UTC(jahr, monat, tag));
}

function plus(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

const iso = (d) => d.toISOString().slice(0, 10);

function ostersonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return datum(jahr, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

/** Buß- und Bettag: der Mittwoch vor dem 23. November. */
function bussUndBettag(jahr) {
  let tag = datum(jahr, 10, 22);
  while (tag.getUTCDay() !== 3) tag = plus(tag, -1);
  return tag;
}

const cache = new Map();

/** Menge der Feiertage eines Jahres als "JJJJ-MM-TT"; `land` ist das Kürzel, leer heißt bundesweit. */
function feiertage(jahr, land) {
  const schluessel = jahr + (land || '');
  if (cache.has(schluessel)) return cache.get(schluessel);
  const ostern = ostersonntag(jahr);
  const tage = [
    datum(jahr, 0, 1), plus(ostern, -2), plus(ostern, 1), datum(jahr, 4, 1),
    plus(ostern, 39), plus(ostern, 50), datum(jahr, 9, 3), datum(jahr, 11, 25), datum(jahr, 11, 26),
  ];
  const landesweit = [
    ['BW BY ST', datum(jahr, 0, 6)],                         // Heilige Drei Könige
    ['BE MV', datum(jahr, 2, 8)],                            // Frauentag
    ['BW BY HE NW RP SL', plus(ostern, 60)],                 // Fronleichnam
    ['SL', datum(jahr, 7, 15)],                              // Mariä Himmelfahrt
    ['TH', datum(jahr, 8, 20)],                              // Weltkindertag
    ['BB HB HH MV NI SN ST SH TH', datum(jahr, 9, 31)],      // Reformationstag
    ['BW BY NW RP SL', datum(jahr, 10, 1)],                  // Allerheiligen
    ['SN', bussUndBettag(jahr)],                             // Buß- und Bettag
  ];
  if (land) {
    for (const [laender, tag] of landesweit) if (laender.split(' ').includes(land)) tage.push(tag);
  }
  const menge = new Set(tage.map(iso));
  cache.set(schluessel, menge);
  return menge;
}

function istFeiertag(tagIso, land) {
  return feiertage(Number(tagIso.slice(0, 4)), land).has(tagIso);
}

module.exports = { istFeiertag };
