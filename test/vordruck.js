#!/usr/bin/env node
/**
 * Tägliche Notierung: der zweite Vordruck der IHK, eine Zeile je Tag. Stunden stehen nicht darin,
 * wie im wöchentlichen Blatt: Die IHK fragt nach Tätigkeiten.
 *
 * Gewählt unter „Deine Daten → Verarbeitung“ oder gleich neben der Wochenvorschau. Er gilt für
 * Vorschau, Druck und Word, auch beim Ausbilder, weil er in den Stammdaten steht. Geprüft wird
 * am Beispiel (Montag bis Freitag mit gebuchten Stunden, donnerstags Berufsschule).
 *
 *   node test/vordruck.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Tägliche Notierung als zweiter Vordruck');

(async () => {
  const browser = await h.starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const jsFehler = h.fehlerSammeln(page);
  const dateien = h.downloadsSammeln(page);
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.waitForTimeout(700);
  await page.click('#btn-beispiel');
  await page.waitForTimeout(900);

  const vorschau = () => page.evaluate(() =>
    [...document.querySelectorAll('.vorschaubuehne .bogen')].map((b) => b.innerHTML).join(''));
  const zurWoche = () => page.evaluate(() => {
    const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click();
  });

  /* ---------- Umschalten neben der Vorschau ---------- */
  await zurWoche();
  await page.waitForTimeout(900);
  pruefe('Vorgabe ist die wöchentliche Notierung',
    (await vorschau()).includes('Betriebliche Tätigkeit') &&
      (await page.getAttribute('.umschalter [data-vordruck=""]', 'aria-checked')) === 'true');
  await page.click('.umschalter [data-vordruck="taeglich"]');
  await page.waitForTimeout(600);
  const blatt = await vorschau();
  pruefe('Umschalten zeigt sofort das Tagesblatt', blatt.includes('tagestabelle') && !blatt.includes('Betriebliche Tätigkeit'));
  const zeilen = await page.evaluate(() =>
    [...document.querySelectorAll('.vorschaubuehne .tagestabelle tbody tr')].map((z) => z.textContent));
  pruefe('Montag bis Freitag je eine Zeile, das leere Wochenende fehlt',
    ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'].every((t, i) => zeilen[i] && zeilen[i].startsWith(t)) &&
      !zeilen.some((z) => /Samstag|Sonntag/.test(z)), zeilen.map((z) => z.slice(0, 12)).join(' | '));
  pruefe('Jede Zeile trägt ihr Datum', zeilen[0].includes('07.09.') && zeilen[4].includes('11.09.'), zeilen[0].slice(0, 40));
  pruefe('Keine Stunden im Blatt, weder je Tag noch als Summe',
    !/Stunden|7,75|6,25|37,50/.test(blatt), (blatt.match(/.{0,30}(Stunden|7,75|37,50).{0,30}/) || [''])[0]);
  pruefe('Zwei Spalten: Tag und Tätigkeiten', await page.evaluate(() =>
    document.querySelectorAll('.vorschaubuehne .tagestabelle thead th').length === 2));
  pruefe('Der Schultag nennt seine Art', /Donnerstag10\.09\.Berufsschule/.test(zeilen[3]), zeilen[3].slice(0, 40));
  pruefe('Unterschriften stehen darunter', blatt.includes('Ausbilder / Datum'));
  pruefe('Die Wahl steht in den Stammdaten',
    (await page.evaluate((s) => { window.__merkenJetzt(); return JSON.parse(localStorage.getItem(s)).stamm.vordruck; }, h.SPEICHER)) === 'taeglich');

  /* ---------- Unterweisungen der Woche als letzte Zeile ---------- */
  await page.fill('#feld-unterweisungen', 'Unterweisung Brandschutz');
  await page.waitForTimeout(800);
  const mitUnterweisung = await page.evaluate(() =>
    [...document.querySelectorAll('.vorschaubuehne .tagestabelle tbody tr')].map((z) => z.textContent));
  pruefe('Unterweisungen stehen als letzte Zeile',
    /^Unterweisungen.*Brandschutz/.test(mitUnterweisung[mitUnterweisung.length - 1] || ''),
    mitUnterweisung.slice(-2).join(' | '));

  /* ---------- Word ---------- */
  await page.click('#btn-export');
  await page.click('#btn-wochenblatt');
  await h.exportTrotzdem(page);
  const woche = await h.warteAufDatei(dateien, 'Wochenblatt');
  const text = woche ? h.sichtbarerText((await h.docxLesen(woche.daten)).dokument) : '';
  pruefe('Word: Tabelle mit Tag und Tätigkeiten',
    text.includes('Ausgeführte Arbeiten, Unterweisungen, Berufsschulunterricht') && text.includes('Montag') &&
      text.includes('07.09.'), text.slice(0, 120));
  pruefe('Word: keine Stunden, weder je Tag noch als Summe', !/Stunden|7,75|37,50/.test(text),
    (text.match(/.{0,30}(Stunden|7,75|37,50).{0,30}/) || [''])[0]);
  pruefe('Word: kein Feld „Betriebliche Tätigkeit“', !text.includes('Betriebliche Tätigkeit'));

  const vorHeft = dateien.length;
  await page.click('#btn-export');
  await page.click('#btn-heft');
  await h.exportTrotzdem(page);
  const heft = await h.warteAufDatei(dateien, 'Berichtsheft', vorHeft);
  const heftText = heft ? h.sichtbarerText((await h.docxLesen(heft.daten)).dokument) : '';
  pruefe('Gesamtheft: Deckblatt nennt die tägliche Notierung', heftText.includes('tägliche Notierung'), heftText.slice(0, 120));

  /* ---------- Druck ---------- */
  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#btn-export');
  await page.click('#btn-pdf-woche');
  await h.exportTrotzdem(page);
  await page.waitForTimeout(500);
  pruefe('Druck: dasselbe Tagesblatt', await page.evaluate(() => !!document.querySelector('#druck .blatt.taeglich .tagestabelle')));

  /* ---------- Eine volle Woche teilt sich auf zwei Blätter ---------- */
  await page.evaluate(() => {
    const lang = Array.from({ length: 14 }, (_, i) => 'Ausführliche Tätigkeit Nummer ' + (i + 1) +
      ' mit einer Beschreibung, die über die halbe Zeile hinausgeht und Platz braucht').join('\n');
    ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-11'].forEach((d) => window.__tagSetzen(d, { text: lang }));
  });
  await zurWoche();
  await page.waitForTimeout(1200);
  const blaetter = await page.evaluate(() =>
    [...document.querySelectorAll('.vorschaubuehne .bogen .blatt')].map((b) => ({
      fortsetzung: b.classList.contains('fortsetzung'),
      unterschrift: !!b.querySelector('.unterschriften'),
    })));
  pruefe('Volle Woche: mehrere Blätter, das zweite als Fortsetzung',
    blaetter.length >= 2 && !blaetter[0].fortsetzung && blaetter[1].fortsetzung, JSON.stringify(blaetter));
  pruefe('Volle Woche: Unterschriften nur auf dem letzten Blatt',
    blaetter.slice(0, -1).every((b) => !b.unterschrift) && blaetter[blaetter.length - 1].unterschrift, JSON.stringify(blaetter));
  pruefe('Volle Woche: jedes Blatt passt auf A4', await page.evaluate(() =>
    [...document.querySelectorAll('.vorschaubuehne .bogen')].every((b) => {
      const html = b.innerHTML;
      return window.__blattHoehe(html) <= window.__satzHoehe() + 1;
    })));

  /* ---------- Zurück und nach dem Neuladen ---------- */
  await page.reload();
  await page.waitForTimeout(900);
  await zurWoche();
  await page.waitForTimeout(900);
  pruefe('Nach dem Neuladen bleibt die tägliche Notierung', (await vorschau()).includes('tagestabelle'));
  await h.stammdatenOeffnen(page);
  await h.stammReiter(page, '#f-vordruck');
  pruefe('Deine Daten zeigt dieselbe Wahl', (await page.inputValue('#f-vordruck')) === 'taeglich');
  await page.selectOption('#f-vordruck', '');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(900);
  pruefe('Zurück auf wöchentlich: wieder das Feld „Betriebliche Tätigkeit“',
    (await vorschau()).includes('Betriebliche Tätigkeit') &&
      (await page.getAttribute('.umschalter [data-vordruck=""]', 'aria-checked')) === 'true');

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
