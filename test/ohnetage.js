#!/usr/bin/env node
/**
 * Vordruck „wöchentlich, nur die Tätigkeiten“: dasselbe Wochenblatt ohne Überschrift je Tag, wie
 * es manche Ausbilder wollen (ohneTage() in src/js/ausgabe/word.js).
 *
 * Gleiche Zeilen stehen nur einmal, freie Tage als eine Zeile am Ende, die Berufsschule ohne
 * Wochentag. Geschrieben wird weiter je Tag, auch im Blatt. Geprüft am Beispiel, Mittwoch als
 * Urlaub.
 *
 *   node test/ohnetage.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Vordruck ohne Wochentage: nur die Tätigkeiten der Woche');

const TAGE = /Montag|Dienstag|Donnerstag|Freitag/;

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
  await page.evaluate(() => window.__tagSetzen('2026-09-09', { art: 'Urlaub', text: '' }));

  const zurWoche = () => page.evaluate(() => document.getElementById('reiter-woche').click());
  const blatt = () => page.evaluate(() => {
    const feld = (f) => [...document.querySelectorAll('.vorschaubuehne [data-feld="' + f + '"] .kasten > p')]
      .map((p) => ({ klasse: p.className, datum: p.getAttribute('data-datum'), text: p.textContent.replace('•', '').trim() }));
    return { betrieb: feld('betrieb'), schule: feld('schule'), koepfe: document.querySelectorAll('.vorschaubuehne .tagkopf').length };
  });

  /* ---------- Umschalten ---------- */
  await zurWoche();
  await page.waitForTimeout(900);
  const vorher = await blatt();
  pruefe('Vorgabe: Wochentage als Überschrift', vorher.koepfe >= 4 && vorher.betrieb.some((p) => p.text.startsWith('Montag')),
    vorher.koepfe + ' Köpfe');
  await h.stammdatenOeffnen(page);
  await h.stammReiter(page, '#f-vordruck');
  pruefe('„Deine Daten“ bietet die Wahl ohne Wochentage an',
    (await page.locator('#f-vordruck option[value="ohnetage"]').textContent()).includes('ohne Wochentage'));
  await page.selectOption('#f-vordruck', 'ohnetage');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(900);

  const b = await blatt();
  const texte = b.betrieb.map((p) => p.text);
  pruefe('Im Blatt keine Überschrift je Tag', b.koepfe === 0 && !texte.some((t) => TAGE.test(t)), texte.join(' | '));
  pruefe('Gleiche Zeilen nur einmal (Teambesprechung an Montag und Dienstag)',
    texte.filter((t) => t === 'Kurze Teambesprechung zum Tagesstart').length === 1 && texte.length === 13, texte.length + ' Zeilen');
  pruefe('Die Zeilen stehen in der Reihenfolge der Tage', texte[1].startsWith('Einführung') && texte[5].startsWith('Netzwerk') &&
    texte[8].startsWith('Infrastruktur: Warnmeldungen'), texte.slice(0, 9).join(' | '));
  const frei = b.betrieb[b.betrieb.length - 1];
  pruefe('Der freie Tag steht als eine Zeile am Ende', frei.text === 'Urlaub am Mittwoch' && /frei/.test(frei.klasse) && !frei.datum,
    JSON.stringify(frei));
  pruefe('Jede Zeile behält ihren Tag, damit man im Blatt je Tag schreibt',
    b.betrieb[0].datum === '2026-09-07' && b.betrieb[5].datum === '2026-09-08' && b.betrieb[8].datum === '2026-09-11',
    b.betrieb.map((p) => p.datum).join(' '));
  pruefe('Berufsschule ohne Wochentag, nur die Themen',
    b.schule.length === 1 && b.schule[0].text.startsWith('Lernfeld 4') && b.schule[0].datum === '2026-09-10', JSON.stringify(b.schule));

  /* ---------- Im Blatt schreiben, je Tag ---------- */
  const felder = await page.evaluate(() => [...document.querySelectorAll('.blattfeld.feld-tag')].map((f) => f.getAttribute('data-datum') ||
    (f.querySelector('textarea') && f.querySelector('textarea').getAttribute('aria-label'))));
  pruefe('Über den Zeilen jedes Tags liegt sein Feld', felder.length === 4, felder.join(' | '));
  pruefe('Kein Tag mit Text steht als „ohne Text“ über dem Blatt', !(await page.locator('.blattfehlt').isVisible()));
  const freitag = page.locator('.blattfeld.feld-tag textarea[aria-label^="Freitag"]');
  await freitag.click();
  await freitag.press('Control+End');
  await page.keyboard.type('\nServer neu gestartet');
  await page.locator('.vorschaubuehne').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(900);
  const nachher = await blatt();
  pruefe('Geschrieben wird in den Tag, im Blatt steht es ohne Wochentag',
    (await page.evaluate(() => window.__tage()['2026-09-11'].text)).endsWith('Server neu gestartet') &&
      nachher.betrieb.some((p) => p.text === 'Server neu gestartet' && p.datum === '2026-09-11') && nachher.koepfe === 0,
    nachher.betrieb.map((p) => p.text).slice(-3).join(' | '));

  /* ---------- Word und Druck ---------- */
  await page.click('#btn-export');
  await page.click('#btn-wochenblatt');
  await h.exportTrotzdem(page);
  const woche = await h.warteAufDatei(dateien, 'Wochenblatt');
  const text = woche ? h.sichtbarerText((await h.docxLesen(woche.daten)).dokument) : '';
  pruefe('Word: Tätigkeiten ohne Wochentage, die Teambesprechung einmal, Urlaub am Ende',
    text.includes('Betriebliche Tätigkeit') && !TAGE.test(text) && text.split('Kurze Teambesprechung').length === 2 &&
      text.includes('Urlaub am Mittwoch') && text.includes('Lernfeld 4'), text.slice(0, 200));

  await page.evaluate(() => { window.print = () => {}; });
  await page.click('#btn-export');
  await page.click('#btn-pdf-woche');
  await h.exportTrotzdem(page);
  await page.waitForTimeout(500);
  const druck = await page.evaluate(() => {
    const d = document.querySelector('#druck .blatt');
    return { koepfe: d ? d.querySelectorAll('.tagkopf').length : -1, text: d ? d.textContent : '' };
  });
  pruefe('Druck: dasselbe Blatt ohne Wochentage', druck.koepfe === 0 && druck.text.includes('Urlaub am Mittwoch') &&
    !TAGE.test(druck.text), JSON.stringify(druck).slice(0, 160));

  /* ---------- Eine volle Woche auf zwei Blättern ---------- */
  await page.evaluate(() => {
    const lang = (tag) => Array.from({ length: 18 }, (_, i) => tag + ': ausführliche Tätigkeit Nummer ' + (i + 1) +
      ' mit einer Beschreibung, die über die halbe Zeile hinausgeht und Platz braucht').join('\n');
    ['2026-09-07', '2026-09-08', '2026-09-11'].forEach((d, i) => window.__tagSetzen(d, { text: lang('Teil ' + i) }));
  });
  await zurWoche();
  await page.waitForTimeout(1200);
  const voll = await page.evaluate(() => [...document.querySelectorAll('.vorschaubuehne .bogen')].map((b) => ({
    passt: window.__blattHoehe(b.innerHTML) <= window.__satzHoehe() + 1,
    koepfe: b.querySelectorAll('.tagkopf').length,
    frei: b.textContent.includes('Urlaub am Mittwoch'),
  })));
  pruefe('Volle Woche: mehrere Blätter, jedes passt, nirgends ein Wochentag, Urlaub auf dem letzten',
    voll.length >= 2 && voll.every((x) => x.passt && x.koepfe === 0) && voll[voll.length - 1].frei, JSON.stringify(voll));

  /* ---------- Neuladen und zurück ---------- */
  await page.reload();
  await page.waitForTimeout(900);
  await zurWoche();
  await page.waitForTimeout(900);
  pruefe('Nach dem Neuladen bleibt die Wahl', (await blatt()).koepfe === 0);
  await h.stammdatenOeffnen(page);
  await h.stammReiter(page, '#f-vordruck');
  await page.selectOption('#f-vordruck', '');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(900);
  const zurueck = await blatt();
  pruefe('Zurück: wieder mit Wochentagen', zurueck.koepfe >= 3 && zurueck.betrieb.some((p) => p.text.startsWith('Montag')),
    zurueck.koepfe + ' Köpfe');

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
