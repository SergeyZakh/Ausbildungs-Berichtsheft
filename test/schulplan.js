#!/usr/bin/env node
/**
 * Schulplan: Feste Schultage und Blockunterricht aus „Deine Daten → Schule“ füllen leere Tage
 * mit „Berufsschule“ vor. In den Schulferien entfallen die festen Schultage, Blöcke gelten weiter.
 * Blöcke und Ferien werden im Kalender gewählt (erster Tag, letzter Tag) und stehen als Marken da.
 *
 * Der Plan wirkt nur auf Tage ohne eigenen Inhalt. Ein Tag mit Buchungen kann in den
 * Schulferien liegen und bleibt deshalb, wie der Import ihn liefert. Gespeichert wird die Art
 * erst, wenn am Tag geschrieben oder gewählt wird; bis dahin zählt ein leerer Schultag als
 * dieselbe Lücke wie ein leerer Arbeitstag, im Heft wie auf dem Server.
 *
 *   node test/schulplan.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Schulplan: feste Schultage, Blockunterricht und Ferien');

/** Ein Tag, wie er gerade im Browserspeicher steht. */
const gespeichert = (page, datum) => page.evaluate(([schluessel, d]) => {
  try { return JSON.parse(localStorage.getItem(schluessel)).tage[d] || null; } catch (e) { return null; }
}, [h.SPEICHER, datum]);

const artAm = (page, datum) => page.evaluate((d) => window.__tagArt(d), datum);

/** Im Kalender für Zeiträume zum Monat blättern, in dem `datum` liegt, und den Tag antippen. */
async function kalenderTag(page, datum) {
  const monat = datum.slice(0, 7);
  for (let i = 0; i < 60; i++) {
    const tage = await page.$$eval('#zr-raster .zr-tag', (t) => t.map((x) => x.getAttribute('data-datum')));
    if (tage.some((d) => d.startsWith(monat))) break;
    await page.click(tage[0] < monat ? '#zr-vor' : '#zr-zurueck');
  }
  await page.click('#zr-raster [data-datum="' + datum + '"]');
}

/** Einen Zeitraum im Kalender wählen: erster Tag, letzter Tag. */
async function zeitraumWaehlen(page, von, bis) {
  await kalenderTag(page, von);
  await kalenderTag(page, bis);
}

const marken = (page, liste) => page.$$eval('#' + liste + ' .zchip', (m) => m.map((x) => x.firstChild.textContent));

/** Einen Schultag im Dialog an- oder abwählen; der Schalter selbst ist unsichtbar. */
async function schultagSchalten(page, kurz) {
  await page.click('#schultage-wahl input[value="' + kurz + '"] + span');
}

(async () => {
  const browser = await h.starteBrowser();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const jsFehler = h.fehlerSammeln(page);
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.waitForTimeout(800);

  // kimai-test.csv: Buchungen an Mo 31.08., Di 01.09., Mi 02.09., Fr 04.09., Mo 07.09., Di 08.09.
  await page.setInputFiles('#datei', h.testdatei('kimai-test.csv'));
  await page.waitForTimeout(900);

  /* ---------- Einstellen ---------- */
  await h.stammdatenOeffnen(page);
  await h.stammFuellen(page, '#f-beginn', '2025-09-01');
  await h.stammFuellen(page, '#f-ende', '2028-08-31');
  await h.stammReiter(page, '#f-schulbloecke');
  await schultagSchalten(page, 'Mi');
  await schultagSchalten(page, 'Do');
  // Getippt wurde der Blockunterricht bis 0.1.1; so ein Stand kann Unlesbares enthalten.
  await page.evaluate(() => {
    const feld = document.getElementById('f-schulbloecke');
    feld.value = '11.05.–17.05.2026; 30.02.2026';
    feld.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const unklar = await page.locator('#schulbloecke-stand').textContent();
  pruefe('Blockunterricht aus altem Stand: Unlesbares steht rot als Marke',
    (await marken(page, 'schulbloecke-liste')).join('|') === '11.05.–17.05.2026|30.02.2026' &&
      (await page.locator('#schulbloecke-liste .zchip.unklar').count()) === 1 &&
      unklar.includes('Nicht lesbar'), unklar);
  await page.click('#schulbloecke-liste .zchip.unklar button');
  pruefe('Blockunterricht: × entfernt das Unlesbare, der Block bleibt',
    (await page.inputValue('#f-schulbloecke')) === '11.05.2026–17.05.2026' &&
      (await page.locator('#schulbloecke-stand').isHidden()), await page.inputValue('#f-schulbloecke'));

  // Schulferien im Kalender: erster Tag, letzter Tag, in beliebiger Reihenfolge der Zeiträume.
  await page.click('#schulferien-liste .zwahl');
  await page.waitForTimeout(200);
  pruefe('„Im Kalender wählen“ öffnet den Kalender', await page.locator('#dlg-zeitraum').isVisible());
  pruefe('Der Kalender zeigt am Rechner zwei Monate', (await page.locator('#zr-raster .zr-monat:visible').count()) === 2);
  await zeitraumWaehlen(page, '2026-10-12', '2026-10-23');
  await zeitraumWaehlen(page, '2026-05-15', '2026-05-11');
  pruefe('Kalender: zwei Zeiträume, sortiert, auch rückwärts gewählt',
    (await page.inputValue('#f-schulferien')) === '11.05.2026–15.05.2026; 12.10.2026–23.10.2026',
    await page.inputValue('#f-schulferien'));
  const band = await page.$$eval('#zr-raster .zr-tag.drin', (t) => t.map((x) => x.getAttribute('data-datum')));
  pruefe('Kalender: Die Tage eines Zeitraums stehen als Band',
    band.includes('2026-05-11') && band.includes('2026-05-13') && band.includes('2026-05-15') && !band.includes('2026-05-16'),
    band.slice(0, 6).join(','));
  pruefe('Kalender: Blockunterricht erscheint schraffiert, zur Orientierung',
    (await page.locator('#zr-raster [data-datum="2026-05-16"].anders').count()) === 1);
  await zeitraumWaehlen(page, '2026-10-20', '2026-10-30');
  pruefe('Kalender: Überlappendes wird ein Zeitraum',
    (await page.inputValue('#f-schulferien')) === '11.05.2026–15.05.2026; 12.10.2026–30.10.2026',
    await page.inputValue('#f-schulferien'));
  await page.click('#zr-liste .zchip:has-text("12.10.–30.10.2026") button');
  await zeitraumWaehlen(page, '2026-10-12', '2026-10-23');
  await page.click('#zr-fertig');
  await page.waitForTimeout(200);
  pruefe('Nach „Fertig“ stehen die Zeiträume als Marken im Reiter',
    (await marken(page, 'schulferien-liste')).join('|') === '11.05.–15.05.2026|12.10.–23.10.2026',
    (await marken(page, 'schulferien-liste')).join('|'));
  pruefe('Reiter „Schule“ passt ohne Scrollen in den Dialog', await page.evaluate(() => {
    const koerper = document.querySelector('#dlg-stamm .dkoerper');
    const leiste = document.querySelector('#dlg-stamm .blattleiste');
    return koerper.scrollHeight <= koerper.clientHeight && leiste.scrollWidth <= leiste.clientWidth;
  }));
  await page.click('#dlg-fertig');
  await page.waitForTimeout(400);

  const stamm = await page.evaluate((s) => JSON.parse(localStorage.getItem(s)).stamm, h.SPEICHER);
  pruefe('Schultage, Blöcke und Ferien landen in den Stammdaten',
    stamm.schultage === 'Mi, Do' && stamm.schulbloecke === '11.05.2026–17.05.2026' &&
      stamm.schulferien === '11.05.2026–15.05.2026; 12.10.2026–23.10.2026', JSON.stringify(stamm));

  /* ---------- Welche Tage der Plan trifft ---------- */
  pruefe('Leerer Donnerstag ist Berufsschule', (await artAm(page, '2026-09-03')) === 'Berufsschule');
  pruefe('Mittwoch mit Buchungen bleibt, wie der Import ihn liefert (Schulferien)',
    (await artAm(page, '2026-09-02')) === '');
  pruefe('Leerer Freitag bleibt Arbeitstag', (await artAm(page, '2026-09-11')) === '');
  pruefe('Vor dem Ausbildungsbeginn gilt kein Plan', (await artAm(page, '2025-08-27')) === '');
  pruefe('Nach dem Ausbildungsende gilt kein Plan', (await artAm(page, '2028-09-06')) === '');
  pruefe('Blockunterricht: jeder Werktag im Block',
    (await artAm(page, '2026-05-11')) === 'Berufsschule' && (await artAm(page, '2026-05-12')) === 'Berufsschule');
  pruefe('Blockunterricht: Feiertag im Block bleibt frei (Christi Himmelfahrt)',
    (await artAm(page, '2026-05-14')) === '');
  pruefe('Blockunterricht: Wochenende im Block zählt nicht', (await artAm(page, '2026-05-16')) === '');
  pruefe('Blockunterricht: der Tag nach dem Block zählt nicht', (await artAm(page, '2026-05-18')) === '');
  pruefe('Schulferien: kein fester Schultag darin (Mi und Do)',
    (await artAm(page, '2026-10-14')) === '' && (await artAm(page, '2026-10-22')) === '');
  pruefe('Schulferien: danach gilt der Plan wieder', (await artAm(page, '2026-10-29')) === 'Berufsschule');
  pruefe('Schulferien: Blockunterricht darin bleibt Schule', (await artAm(page, '2026-05-12')) === 'Berufsschule');
  pruefe('Ein leerer Schultag bleibt eine Lücke wie ein leerer Arbeitstag',
    await page.evaluate(() => window.__fehlenderWerktag('2026-09-03')));
  const bloecke = await page.evaluate(() => [
    window.__schulbloeckeLesen('28.12.–08.01.2027').bloecke[0],
    window.__schulbloeckeLesen('2026-03-02 bis 2026-03-06').bloecke[0],
    window.__schulbloeckeLesen('20.03.2026–02.03.2026').unklar.length,
    window.__schulbloeckeLesen('05.10.2026').bloecke[0],
  ]);
  pruefe('Blockunterricht: über Neujahr, ISO-Daten, verdreht, ein einzelner Tag',
    JSON.stringify(bloecke) === JSON.stringify([
      { von: '2026-12-28', bis: '2027-01-08' }, { von: '2026-03-02', bis: '2026-03-06' }, 1,
      { von: '2026-10-05', bis: '2026-10-05' },
    ]), JSON.stringify(bloecke));

  /* ---------- In der Tagesansicht ---------- */
  // Nach dem Import steht die neueste Woche offen: 7.–13. September.
  const reiterDo = await page.locator('#reiter button >> nth=3').textContent();
  pruefe('Der Reiter zeigt den leeren Schultag als Schule', reiterDo.includes('Schule'), reiterDo);
  await page.click('#reiter button >> nth=3');
  await page.waitForTimeout(300);
  pruefe('Art des Tages steht auf Berufsschule', (await page.inputValue('#feld-art')) === 'Berufsschule');
  pruefe('Das Feld fragt nach den Unterrichtsthemen',
    (await page.locator('.sektion.wachsend .sektionskopf').textContent()).includes('Unterrichtsthemen'));
  pruefe('Solange der Tag leer ist, wird nichts gespeichert', (await gespeichert(page, '2026-09-10')) === null);
  await page.fill('.tagpanel textarea', 'Lernfeld 5: Subnetting');
  await page.waitForTimeout(600);
  const geschrieben = await gespeichert(page, '2026-09-10');
  pruefe('Mit dem ersten Wort wird die Art gespeichert',
    geschrieben && geschrieben.art === 'Berufsschule' && geschrieben.text === 'Lernfeld 5: Subnetting',
    JSON.stringify(geschrieben));

  // Ein Mittwoch in den Ferien: von Hand auf Arbeitstag, und dabei bleibt es.
  await page.click('#reiter button >> nth=2');
  await page.waitForTimeout(300);
  await page.selectOption('#feld-art', '');
  await page.waitForTimeout(600);
  pruefe('„Arbeitstag“ von Hand bleibt stehen', (await page.inputValue('#feld-art')) === '');
  const vonHand = await gespeichert(page, '2026-09-09');
  pruefe('„Arbeitstag“ von Hand wird gespeichert', vonHand && vonHand.artVonHand === true && vonHand.art === '',
    JSON.stringify(vonHand));

  await page.reload();
  await page.waitForTimeout(900);
  pruefe('Nach dem Neuladen: Plan, gewählte und geschriebene Art sind noch da',
    (await artAm(page, '2026-09-03')) === 'Berufsschule' && (await artAm(page, '2026-09-09')) === '' &&
      (await artAm(page, '2026-09-10')) === 'Berufsschule');

  /* ---------- Plan ändern ---------- */
  await h.stammdatenOeffnen(page);
  await h.stammReiter(page, '#f-schulbloecke');
  pruefe('Die Schalter zeigen den gespeicherten Plan', await page.evaluate(() =>
    [...document.querySelectorAll('#schultage-wahl input[type=checkbox]')]
      .filter((k) => k.checked).map((k) => k.value).join() === 'Mi,Do'));
  await schultagSchalten(page, 'Do');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(400);
  pruefe('Ohne Donnerstag im Plan ist der leere Donnerstag wieder Arbeitstag',
    (await artAm(page, '2026-09-03')) === '');
  pruefe('Ein beschriebener Schultag bleibt Berufsschule, auch ohne Plan',
    (await artAm(page, '2026-09-10')) === 'Berufsschule');

  /* ---------- Neuer Import ---------- */
  // Der 1. Mai ist Feiertag, der Import setzt ihn so. Wer dort gearbeitet hat und
  // „Arbeitstag“ wählt, behält das auch nach dem nächsten Import derselben Datei.
  const maiCsv = { name: 'mai.csv', mimeType: 'text/csv',
    buffer: Buffer.from('Datum;Von;Bis;Dauer;Beschreibung\n2026-05-01;08:00;12:00;04:00;Serverraum aufgeräumt\n') };
  await page.setInputFiles('#datei', maiCsv);
  await page.waitForTimeout(900);
  const alsFeiertag = await gespeichert(page, '2026-05-01');
  pruefe('Import setzt den Feiertag', alsFeiertag && alsFeiertag.art === 'Feiertag', JSON.stringify(alsFeiertag));
  await page.evaluate(() => { document.getElementById('wochensuche').value = ''; });
  await page.click('#wochenlabel');
  await page.fill('#wochensuche', '01.05.2026');
  await page.waitForTimeout(400);
  await page.click('#reiter button >> nth=4');
  await page.waitForTimeout(300);
  await page.selectOption('#feld-art', '');
  await page.waitForTimeout(600);
  await page.setInputFiles('#datei', maiCsv);
  await page.waitForTimeout(900);
  const nachImport = await gespeichert(page, '2026-05-01');
  pruefe('Nach dem nächsten Import bleibt „Arbeitstag“ von Hand',
    nachImport && nachImport.art === '' && nachImport.artVonHand === true, JSON.stringify(nachImport));

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));

  /* ---------- Beispiel ---------- */
  const bsp = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const bspFehler = h.fehlerSammeln(bsp);
  await h.ohneRundgang(bsp);
  await h.oeffnen(bsp);
  await bsp.waitForTimeout(800);
  await bsp.click('#btn-beispiel');
  await bsp.waitForTimeout(900);
  pruefe('Beispiel: donnerstags Berufsschule, der leere 17.09. zeigt es',
    (await artAm(bsp, '2026-09-17')) === 'Berufsschule' &&
      (await bsp.evaluate((s) => JSON.parse(localStorage.getItem(s)).stamm.schultage, h.SPEICHER)) === 'Do');
  pruefe('Beispiel: der Plan legt keine Tage an',
    (await bsp.evaluate(() => Object.keys(window.__tage()).length)) === 7);
  pruefe('Beispiel ohne JavaScript-Fehler', bspFehler.length === 0, bspFehler.join(' | '));

  /* ---------- Kalender am Handy ---------- */
  for (const breite of [390, 320]) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 780 }, isMobile: true, hasTouch: true });
    const handy = await ctx.newPage();
    const handyFehler = h.fehlerSammeln(handy);
    await h.ohneRundgang(handy);
    await h.oeffnen(handy);
    await handy.waitForTimeout(600);
    await h.stammdatenOeffnen(handy);
    await h.stammReiter(handy, '#f-schulbloecke');
    await handy.click('#schulbloecke-liste .zwahl');
    await handy.waitForTimeout(200);
    const lage = await handy.evaluate(() => {
      const d = document.getElementById('dlg-zeitraum').getBoundingClientRect();
      const tag = document.querySelector('#zr-raster .zr-tag').getBoundingClientRect();
      return { links: d.left, rechts: d.right, breite: innerWidth, tagHoehe: tag.height,
        monate: [...document.querySelectorAll('#zr-raster .zr-monat')].filter((m) => m.offsetParent).length };
    });
    pruefe('Kalender am Handy: ein Monat, im Bildschirm, Tage groß genug zum Tippen (' + breite + ' px)',
      lage.monate === 1 && lage.links >= 0 && lage.rechts <= lage.breite && lage.tagHoehe >= 38, JSON.stringify(lage));
    const tage = await handy.$$eval('#zr-raster .zr-tag', (t) => t.map((x) => x.getAttribute('data-datum')));
    await handy.click('#zr-raster [data-datum="' + tage[2] + '"]');
    await handy.click('#zr-raster [data-datum="' + tage[4] + '"]');
    pruefe('Kalender am Handy: Antippen trägt den Zeitraum ein (' + breite + ' px)',
      (await handy.locator('#zr-liste .zchip').count()) === 1);
    pruefe('Kalender am Handy ohne JavaScript-Fehler (' + breite + ' px)', handyFehler.length === 0, handyFehler.join(' | '));
    await ctx.close();
  }

  await browser.close();
  abschluss();
})();
