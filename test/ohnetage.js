#!/usr/bin/env node
/**
 * Wochenblatt ohne Wochentage: dasselbe Blatt ohne Überschrift je Tag, nur die Tätigkeiten
 * untereinander, wie es manche Ausbilder wollen (ohneTage() in src/js/ausgabe/word.js). Geschaltet
 * über dem Blatt im Reiter „Woche“; die Auswahl des Vordrucks bleibt bei wöchentlich und täglich.
 *
 * Gleiche Zeilen stehen nur einmal, freie Tage als eine Zeile am Ende, die Berufsschule ohne
 * Wochentag. Geschrieben wird weiter je Tag, auch im Blatt. Geprüft am Beispiel, Mittwoch als
 * Urlaub.
 *
 *   node test/ohnetage.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Wochenblatt ohne Wochentage: nur die Tätigkeiten der Woche');

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
  const optionen = await page.$$eval('#f-vordruck option', (o) => o.map((x) => x.value));
  pruefe('Der Vordruck bleibt wöchentlich oder täglich, ohne dritte Wahl', JSON.stringify(optionen) === '["","taeglich"]',
    JSON.stringify(optionen));
  const schalter = page.locator('.tageschalter');
  pruefe('Über dem Blatt steht der Schalter „Wochentage“, an',
    (await schalter.isVisible()) && (await schalter.textContent()).includes('Wochentage') &&
      (await schalter.getAttribute('role')) === 'switch' && (await schalter.getAttribute('aria-checked')) === 'true');
  await schalter.click();
  await page.waitForTimeout(900);
  pruefe('Ein Klick schaltet ihn aus und merkt es sich',
    (await page.getAttribute('.tageschalter', 'aria-checked')) === 'false' &&
      (await page.evaluate((k) => { window.__merkenJetzt(); return JSON.parse(localStorage.getItem(k)).stamm.ohneTage; }, h.SPEICHER)) === 'ja');

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
  pruefe('Nach dem Neuladen bleibt die Wahl', (await blatt()).koepfe === 0 &&
    (await page.getAttribute('.tageschalter', 'aria-checked')) === 'false');
  await page.click('.tageschalter');
  await page.waitForTimeout(900);
  const zurueck = await blatt();
  pruefe('Wieder an: wieder mit Wochentagen', zurueck.koepfe >= 3 && zurueck.betrieb.some((p) => p.text.startsWith('Montag')) &&
    (await page.getAttribute('.tageschalter', 'aria-checked')) === 'true', zurueck.koepfe + ' Köpfe');

  // Für kurze Zeit stand „ohne Wochentage“ als dritter Vordruck in der Auswahl. Wer es so
  // gespeichert hat, behält es: als wöchentlichen Vordruck mit ausgeschaltetem Schalter.
  await page.evaluate((k) => {
    window.__merkenJetzt();
    const st = JSON.parse(localStorage.getItem(k));
    st.stamm.vordruck = 'ohnetage'; st.stamm.ohneTage = '';
    localStorage.setItem(k, JSON.stringify(st));
  }, h.SPEICHER);
  await page.reload();
  await page.waitForTimeout(900);
  await zurWoche();
  await page.waitForTimeout(900);
  pruefe('Ein alter Stand mit „ohnetage“ wird wöchentlich ohne Wochentage',
    (await page.inputValue('#f-vordruck')) === '' && (await blatt()).koepfe === 0 &&
      (await page.getAttribute('.tageschalter', 'aria-checked')) === 'false');

  /* ---------- Lange Berufsschule im PDF ----------
     Unterweisungen und Berufsschule standen ganz auf dem letzten Blatt. Waren sie länger als eine
     Seite, schnitten Firefox und Safari ab, was nicht passte (break-inside: avoid). */
  await page.evaluate(() => {
    const lang = (tag) => Array.from({ length: 18 }, (_, i) => tag + ': Unterrichtsthema Nummer ' + (i + 1) +
      ' mit einer Beschreibung, die über die halbe Zeile hinausgeht und Platz braucht').join('\n');
    ['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11'].forEach((d, i) =>
      window.__tagSetzen(d, { art: 'Berufsschule', text: lang('Schule ' + i) }));
    window.print = () => {};
  });
  await page.click('#btn-export');
  await page.click('#btn-pdf-woche');
  await h.exportTrotzdem(page);
  await page.waitForTimeout(500);
  const schule = await page.evaluate(() => {
    const bl = [...document.querySelectorAll('#druck .blatt')];
    const sp = [...document.querySelectorAll('#druck .sp')].map((p) => p.textContent);
    return {
      blaetter: bl.length,
      passen: bl.every((b) => window.__blattHoehe(b.outerHTML) <= window.__satzHoehe() + 1),
      koepfe: bl.every((b) => !!b.querySelector('.kopfleiste')),
      unterschrift: bl.map((b) => !!b.querySelector('.unterschriften')).join(','),
      zeilen: [0, 1, 2, 3].map((i) => sp.filter((t) => t.includes('Schule ' + i + ':')).length).join(','),
    };
  });
  pruefe('PDF: lange Berufsschule läuft über mehrere Blätter, jedes passt, keine Zeile fehlt',
    schule.blaetter >= 2 && schule.passen && schule.koepfe && schule.zeilen === '18,18,18,18' &&
      schule.unterschrift === Array.from({ length: schule.blaetter }, (_, i) => i === schule.blaetter - 1).join(','),
    JSON.stringify(schule));

  // Beim täglichen Vordruck gibt es keine Wochentage zum Weglassen, also auch keinen Schalter.
  await h.stammdatenOeffnen(page);
  await h.stammReiter(page, '#f-vordruck');
  await page.selectOption('#f-vordruck', 'taeglich');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(900);
  pruefe('Täglicher Vordruck: kein Schalter, das Tagesblatt wie immer',
    !(await page.locator('.tageschalter').count()) &&
      (await page.evaluate(() => !!document.querySelector('.vorschaubuehne .tagestabelle'))));

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
