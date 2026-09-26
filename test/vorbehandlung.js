#!/usr/bin/env node
/**
 * Prüft die Bereinigung: was verschwinden muss und – wichtiger – was
 * Wort für Wort stehen bleiben muss. Die Fälle stehen in korpus.js.
 *
 *   node test/vorbehandlung.js
 */
const h = require('./hilfen');
const { RAUS, BLEIBT_EXAKT, UMFORMEN, MUELL } = require('./korpus');

const { pruefe, abschluss } = h.protokoll("Bereinigung der Buchungstexte");

(async () => {
  const browser = await h.starteBrowser();
  const page = await browser.newPage();
  await h.ohneRundgang(page);
  const jsFehler = h.fehlerSammeln(page);
  await h.oeffnen(page);
  await page.waitForTimeout(700);

  // Die Namensliste wie im echten Betrieb füllen.
  await h.stammdatenOeffnen(page);
  await h.stammFuellen(page, '#f-namen', 'Weber, Schmidt, mweber, PRJ');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(400);

  const saeubere = (t) => page.evaluate((x) => window.__saeubern(x), t);

  const offen = await page.evaluate(() => typeof window.__saeubern === 'function');
  pruefe('Bereinigung ist für den Test erreichbar', offen);
  if (!offen) abschluss();

  /* ---------- Was verschwinden muss ---------- */
  for (const [eingabe, verboten] of RAUS) {
    const raus = await saeubere(eingabe);
    pruefe('entfernt ' + JSON.stringify(verboten),
      !raus.toLowerCase().includes(verboten.toLowerCase()), eingabe + '  →  ' + raus);
  }

  /* ---------- Was Wort für Wort stehen bleiben muss ---------- */
  for (const eingabe of BLEIBT_EXAKT) {
    const raus = await saeubere(eingabe);
    pruefe('unverändert ' + JSON.stringify(eingabe), raus === eingabe, '→ ' + raus);
  }

  /* ---------- Was umgeformt wird ---------- */
  for (const [eingabe, erwartet] of UMFORMEN) {
    const raus = await saeubere(eingabe);
    pruefe('formt um ' + JSON.stringify(eingabe), raus === erwartet,
      JSON.stringify(raus) + ' statt ' + JSON.stringify(erwartet));
  }

  /* ---------- Zeilen, die ganz wegfallen ---------- */
  for (const m of MUELL) {
    const wertlos = await page.evaluate((t) => window.__istMuell(window.__saeubern(t)), m);
    pruefe('verwirft ' + JSON.stringify(m), wertlos === true);
  }

  /* ---------- Was ans Modell geht ---------- */
  const roh = [
    'Kundenportal: Suchindex neu aufgebaut',
    'Kundenportal: Suchindex neu aufgebaut',
    'erledigt',
    'Warenwirtschaft: CSV-Import: Fehler: behoben',
  ].join('\n');
  const fuers = await page.evaluate((t) => window.__fuersModell(t), roh);
  const fz = fuers.split('\n').map((z) => z.trim()).filter(Boolean);
  pruefe('Das Modell bekommt eine schlichte Liste',
    fz.every((z) => z.startsWith('- ')), JSON.stringify(fz));
  const ohneStrich = fz.map((z) => z.slice(2));
  pruefe('Doppelte Zeilen gehen nur einmal ans Modell', ohneStrich.length === 2, JSON.stringify(ohneStrich));
  pruefe('Wertlose Zeilen gehen gar nicht hin', !fuers.includes('erledigt'));
  pruefe('Je Zeile bleibt höchstens ein Doppelpunkt',
    ohneStrich.every((z) => (z.match(/:/g) || []).length <= 1), JSON.stringify(ohneStrich));
  pruefe('Die Tätigkeit bleibt ganz erhalten',
    ohneStrich[0] === 'Kundenportal: Suchindex neu aufgebaut', ohneStrich[0]);

  /* ---------- Der Filter gilt auch für getippten Text ---------- */
  const getippt = [
    'Support: Ticket #149725 gelöst durch Analyse',
    'Ausbildung: Unterstützung von Michael bei einem Ticket',
  ].join('\n');
  const gefiltert = await page.evaluate((t) => window.__fuersModell(t), getippt);
  pruefe('Ticketnummer erreicht das Modell nicht', !gefiltert.includes('149725'), gefiltert);
  pruefe('Vorname erreicht das Modell nicht', !gefiltert.includes('Michael'), gefiltert);
  pruefe('Der Rest der Zeile bleibt erhalten',
    gefiltert.includes('gelöst durch Analyse') && gefiltert.includes('bei einem Ticket'), gefiltert);

  /* ---------- Kundennamen aus der Kundenspalte ---------- */
  await page.evaluate(() => {
    window.__kundeMerken('Brennwerk');
    window.__kundeMerken('Intern');            // allgemein, bleibt
  });
  const mitKunde = await saeubere('Support Brennwerk: Störung behoben');
  pruefe('Kundenname fällt weg', !mitKunde.includes('Brennwerk'), mitKunde);
  pruefe('Die Tätigkeit bleibt stehen', mitKunde.includes('Störung behoben'), mitKunde);
  const intern = await saeubere('Intern: Ablage sortiert');
  pruefe('„Intern“ ist kein Kunde, sondern eine Kategorie', intern === 'Intern: Ablage sortiert', intern);

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));

  await browser.close();
  abschluss(true);
})();
