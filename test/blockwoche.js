#!/usr/bin/env node
/**
 * Berufsschule schneller eintragen:
 *
 *   Blockwoche   Ist jeder Werktag einer Woche Berufsschule oder frei (ab zwei Schultagen, ohne
 *                eigene Tagestexte, wöchentlicher Vordruck), gibt es statt der Tagesreiter ein
 *                Feld für die Themen der ganzen Woche. Es deckt jeden Werktag ohne eigenen Text.
 *                Über dem Feld steht nichts, was vom Schreiben ablenkt.
 *   Weiter       „Fertig“ springt zum nächsten Tag, der noch etwas braucht, auch in eine andere Woche.
 *
 *   node test/blockwoche.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Blockwoche und weiter nach „Fertig“');

/* Blöcke: 01.–12.06.2026 (Fronleichnam am Do 04.06. ist in NRW frei) und 14.–25.09.2026.
   Fester Schultag Donnerstag. Die Woche ab 07.09. ist eine gewöhnliche mit Schule am Donnerstag. */
const STAND = {
  stamm: {
    name: 'Max Muster', beruf: 'Fachinformatiker', betrieb: 'Beispiel IT GmbH', land: 'NW', abteilung: 'IT',
    schule: 'Berufskolleg Musterstadt', schultage: 'Do', schulbloecke: '01.06.2026–12.06.2026; 14.09.2026–25.09.2026',
    beginn: '2025-09-01', ende: '2028-08-31', vordruck: '',
  },
  tage: {
    '2026-09-07': { text: 'Drucker eingerichtet', art: '', geprueft: true },
    '2026-09-08': { text: 'Switch getauscht', art: '', geprueft: true },
    '2026-09-09': { text: 'Monitoring angepasst', art: '', geprueft: true },
    '2026-09-10': { text: 'LF5: Schleifen und Arrays\nDeutsch: Bewerbungsschreiben\nWiSo: Tarifvertrag', art: 'Berufsschule', geprueft: true },
    '2026-09-11': { text: 'Notebooks eingerichtet', art: '', geprueft: true },
  },
  wochen: {},
  stand: { woche: '2026-09-14', tag: 0 },
};

const reiter = (page) => page.$$eval('#reiter button', (b) => b.map((x) => x.id || x.textContent));
const auf = (page, fn, arg) => page.evaluate(fn, arg);

(async () => {
  const browser = await h.starteBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const jsFehler = h.fehlerSammeln(page);
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [h.SPEICHER, STAND]);
  await page.reload();
  await page.waitForSelector('#reiter button');

  /* ---------- Erkennen ---------- */
  const erkannt = await auf(page, () => ({
    block: window.__blockwoche('2026-09-14'),
    zweite: window.__blockwoche('2026-09-21'),
    gewoehnlich: window.__blockwoche('2026-09-07'),
    feiertag: window.__blockwoche('2026-06-01'),
  }));
  pruefe('Blockwoche erkannt, auch mit Feiertag darin; eine Woche mit einem Schultag ist keine',
    erkannt.block && erkannt.zweite && erkannt.feiertag && !erkannt.gewoehnlich, JSON.stringify(erkannt));

  /* ---------- Ansicht ---------- */
  pruefe('Blockwoche: ein einziger Reiter statt sieben Tagen und der Woche',
    (await reiter(page)).join() === 'reiter-block', (await reiter(page)).join());
  pruefe('Der Reiter nennt die Woche und dass Mo–Fr Schule ist',
    (await page.locator('#reiter-block').innerText()).replace(/\s+/g, ' ').includes('Berufsschule Mo–Fr'));
  // Die Tage stehen nicht mehr als Karte über dem Blatt, der Reiter öffnet sie als Menü.
  pruefe('Themenfeld der Woche, die Tage erst hinter dem Reiter',
    await page.locator('#feld-schulwoche').isVisible() && !(await page.locator('.blocktag select').first().isVisible()) &&
    (await page.getAttribute('#reiter-block', 'aria-expanded')) === 'false' &&
    (await page.locator('#reiter-block').innerText()).includes('Tage ändern'));
  await page.click('#reiter-block');
  pruefe('Ein Klick auf den Reiter: die fünf Tage mit ihrer Art',
    (await page.locator('.blocktag select:visible').count()) === 5 &&
    (await page.$$eval('.blocktag select', (s) => s.every((x) => x.value === 'Berufsschule'))) &&
    (await page.getAttribute('#reiter-block', 'aria-expanded')) === 'true');
  await page.keyboard.press('Escape');
  pruefe('Escape schließt sie wieder', !(await page.locator('#menue-blocktage').isVisible()) &&
    (await page.getAttribute('#reiter-block', 'aria-expanded')) === 'false');
  pruefe('Leere Blockwoche: fünf Tage ohne Text, wie fünf leere Schultage',
    await auf(page, () => window.__wochenBilanz('2026-09-14').ohneText === 5 && window.__wochenStand('2026-09-14') === ''));

  /* ---------- Schreiben ---------- */
  pruefe('Blockwoche: das Feld liegt im Blatt auf dem Kasten „Berufsschule“, ohne Sätze darüber',
    await auf(page, () => {
      const huelle = document.getElementById('feld-schulwoche').closest('.blattfeld.feld-schule');
      const kasten = [...document.querySelectorAll('.vorschaubuehne [data-feld="schule"] .kasten')].pop();
      return !!huelle && Math.abs(huelle.getBoundingClientRect().top - kasten.getBoundingClientRect().top) < 2 &&
        !document.querySelector('.faecher, .fach, .schulhinweis');
    }));
  pruefe('„Fertig“ für die Themen sitzt am Feld im Blatt, keine Leiste darüber',
    !(await page.locator('.wochenstand').count()) &&
    (await page.locator('.blattfeld.feld-schule .blattknoepfe .uebernehmen').count()) === 1);
  pruefe('Platzhalter ist eine schlichte Frage, ohne Beispiel',
    (await page.getAttribute('#feld-schulwoche', 'placeholder')) === 'Welche Themen wurden diese Woche im Unterricht behandelt?');
  await page.fill('#feld-schulwoche', 'LF5: Subnetting, VLANs\nDeutsch: Protokoll\nWiSo: Kündigungsschutz');
  await page.waitForTimeout(500);
  pruefe('Mit Themen zeigt sich „Fertig“ unten am Feld', await page.locator('.blattfeld.feld-schule .uebernehmen').isVisible());

  /* ---------- Stand ---------- */
  const offen = await auf(page, () => ({
    stand: window.__wochenStand('2026-09-14'), anteil: window.__wochenAnteil('2026-09-14'),
    bilanz: window.__wochenBilanz('2026-09-14'), lage: window.__tagLage('2026-09-16'),
  }));
  pruefe('Mit Themen, noch nicht fertig: fünf Tage ungelesen, rot im Raster',
    offen.stand === 'pruefen' && offen.anteil.von === 5 && offen.anteil.fertig === 0 &&
    offen.bilanz.ungelesen === 5 && offen.lage === 'voll', JSON.stringify(offen));
  pruefe('Reiter der Blockwoche rot, solange nicht übernommen',
    (await page.getAttribute('#reiter-block', 'class')) === 'pruefen');

  await page.click('#btn-export');
  await page.click('#btn-pdf-woche');
  await page.waitForSelector('#dlg-pruefung[open]');
  pruefe('Vor dem Export: nicht übernommene Themen der Blockwoche werden genannt',
    (await page.locator('#dlg-pruefung').innerText()).includes('Blockwoche 14.–20. Sep — Themen nicht übernommen'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const druck = await auf(page, () => window.__druckBlatt(1, '2026-09-14', { name: 'Max Muster', vordruck: '' }));
  pruefe('Wochenblatt: die Themen im Feld Berufsschule, ohne Wochentag davor',
    /LF5: Subnetting, VLANs/.test(druck) && !/>Montag</.test(druck));

  await page.click('.schulwoche .sektionsknopf.uebernehmen');
  await page.waitForTimeout(300);
  const nachFertig = await auf(page, () => ({
    w: window.__wochendaten()['2026-09-14'], woche: document.getElementById('wochenlabel').textContent,
    notiz: document.getElementById('notiz').textContent,
  }));
  pruefe('„Fertig“ übernimmt die Themen der Woche', nachFertig.w.schuleGeprueft === true, JSON.stringify(nachFertig.w));
  pruefe('… bleibt in der Woche und bietet die nächste offene Stelle an, hier die zweite Blockwoche',
    nachFertig.woche.startsWith('14.–20. Sep') && nachFertig.notiz.includes('Die Woche ist fertig') &&
    nachFertig.notiz.includes('Weiter: Blockwoche 21.–27. Sep'), JSON.stringify(nachFertig));
  const fertig = await auf(page, () => ({
    stand: window.__wochenStand('2026-09-14'), anteil: window.__wochenAnteil('2026-09-14'), lage: window.__tagLage('2026-09-14'),
  }));
  pruefe('Übernommen: die Woche ist fertig, 5/5, grün im Raster',
    fertig.stand === 'fertig' && fertig.anteil.fertig === 5 && fertig.anteil.von === 5 && fertig.lage === 'fertig', JSON.stringify(fertig));
  await page.click('#notiz .notizknopf');
  await page.waitForTimeout(200);
  pruefe('„Weiter“ hinter der Meldung öffnet sie', (await page.textContent('#wochenlabel')).startsWith('21.–27. Sep'),
    await page.textContent('#wochenlabel'));
  await page.click('#woche-zurueck');
  await page.waitForTimeout(200);
  pruefe('Zurück in der Blockwoche davor', (await page.textContent('#wochenlabel')).startsWith('14.–20. Sep') &&
    await page.locator('#reiter-block').isVisible());
  pruefe('Übernommen ist schreibgeschützt', await page.locator('#feld-schulwoche').getAttribute('readonly') !== null);

  /* ---------- Tage der Blockwoche ---------- */
  await page.click('#reiter-block');
  await page.selectOption('.blocktag select[data-datum="2026-09-16"]', 'Krank');
  await page.waitForTimeout(200);
  pruefe('Krank an einem Tag: bleibt Blockwoche, der Reiter nennt den freien Tag',
    await auf(page, () => window.__blockwoche('2026-09-14')) &&
    (await page.locator('#reiter-block').innerText()).includes('frei: Mi'));
  pruefe('… und der kranke Tag zählt nicht mehr mit', await auf(page, () => window.__wochenAnteil('2026-09-14').von === 4));
  pruefe('Die Tage bleiben offen, falls noch einer dazukommt', await page.locator('#menue-blocktage').isVisible());
  await page.selectOption('.blocktag select[data-datum="2026-09-18"]', '');
  await page.waitForTimeout(200);
  pruefe('Ein Arbeitstag von Hand macht die Woche wieder tageweise, mit Hinweis',
    !(await auf(page, () => window.__blockwoche('2026-09-14'))) && (await reiter(page)).length === 8 &&
    (await page.textContent('#notiz')).includes('Keine Blockwoche mehr'));
  // Übernommen und damit schreibgeschützt: im Blatt als Text, „Bearbeiten“ unten an seinem Kasten.
  pruefe('Die Themen bleiben im Reiter „Woche“ stehen',
    (await auf(page, () => [...document.querySelectorAll('.vorschaubuehne [data-feld="schule"] .kasten')].pop().textContent))
      .includes('LF5: Subnetting') && await page.locator('.blattfeld.feld-schule.fest .bearbeiten').isVisible());
  // Zurück auf Berufsschule über den Tag selbst.
  await page.click('#reiter button >> nth=4');
  await page.selectOption('#feld-art', 'Berufsschule');
  await page.waitForTimeout(200);
  pruefe('Wieder Berufsschule: wieder Blockwoche', await auf(page, () => window.__blockwoche('2026-09-14')));

  // Ein eigener Tagestext bleibt, wo er steht: Die Woche bleibt dann tageweise.
  await auf(page, () => window.__tagSetzen('2026-09-22', { text: 'LF6: Tickets', art: 'Berufsschule' }));
  pruefe('Ein Tag mit eigenem Text: keine Blockwoche', !(await auf(page, () => window.__blockwoche('2026-09-21'))));
  await auf(page, () => { delete window.__tage()['2026-09-22']; window.__merkenJetzt(); });

  /* ---------- Feiertag im Block, ein einzelner Schultag ---------- */
  await page.click('#wochenlabel');
  await page.fill('#wochensuche', '04.06.2026');
  await page.waitForTimeout(300);
  pruefe('Fronleichnam im Block: steht als Feiertag, der Reiter nennt ihn frei',
    (await page.locator('.blocktag', { hasText: 'Do 04.06.' }).innerText()).includes('Feiertag') &&
    (await page.locator('#reiter-block').innerText()).includes('frei: Do'));
  await auf(page, () => {
    ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'].forEach((d) => { window.__tage()[d] = { art: 'Urlaub', artVonHand: true, text: '' }; });
    window.__merkenJetzt();
  });
  pruefe('Urlaubswoche mit dem festen Schultag: keine Blockwoche', !(await auf(page, () => window.__blockwoche('2026-10-05'))));

  /* ---------- Speichern, Heft ---------- */
  await page.reload();
  await page.waitForSelector('#reiter button');
  const nachLaden = await auf(page, () => window.__wochendaten()['2026-09-14']);
  pruefe('Nach dem Neuladen sind die Themen und „übernommen“ noch da',
    nachLaden && nachLaden.schule.startsWith('LF5: Subnetting') && nachLaden.schuleGeprueft === true, JSON.stringify(nachLaden));

  /* ---------- Tägliche Notierung ---------- */
  await auf(page, () => {
    document.getElementById('f-vordruck').value = 'taeglich';
    window.__merkenJetzt();
  });
  await page.click('#wochenlabel');
  await page.fill('#wochensuche', '14.09.2026');
  await page.waitForTimeout(300);
  pruefe('Tägliche Notierung: wieder Tagesreiter, der Vordruck braucht eine Zeile je Tag',
    !(await auf(page, () => window.__blockwoche('2026-09-14'))) && (await reiter(page)).length === 8);
  pruefe('Ein Tag unter den Themen sagt, wo sie stehen', await page.locator('.wochenfeldhinweis').isVisible());
  const taeglich = await auf(page, () => window.__druckBlatt(1, '2026-09-14', { name: 'Max Muster', vordruck: 'taeglich' }));
  pruefe('Tägliches Blatt: die Tage als Berufsschule, die Themen als eigene Zeile der Woche',
    (taeglich.match(/class="tart">Berufsschule</g) || []).length === 4 && /wochenzeile[\s\S]*Berufsschule[\s\S]*LF5: Subnetting/.test(taeglich));
  await page.click('.wochenfeldhinweis .textknopf');
  pruefe('„Themen ansehen“ öffnet den Reiter der Woche', await page.locator('#feld-schulwoche').isVisible());
  await auf(page, () => { document.getElementById('f-vordruck').value = ''; window.__merkenJetzt(); });

  /* ---------- Ein gewöhnlicher Schultag, weiter nach „Fertig“ ----------
     Der Schultag liegt in der Vergangenheit: Nur Tage bis heute können fehlen. */
  await page.click('#wochenlabel');
  await page.fill('#wochensuche', '03.09.2026');
  await page.waitForTimeout(300);
  pruefe('Schultag: nur das Feld mit schlichter Frage, keine Vorschläge darüber',
    !(await page.locator('.faecher, .fach').count()) &&
    (await page.getAttribute('#feld-2026-09-03', 'placeholder')) === 'Welche Themen wurden im Unterricht behandelt?');
  await page.fill('#feld-2026-09-03', 'WiSo: Betriebsrat');
  pruefe('Wer schreibt, macht den Tag zur Berufsschule',
    await auf(page, () => { window.__merkenJetzt(); return window.__tage()['2026-09-03'].art === 'Berufsschule'; }));
  await page.click('.sektion .uebernehmen');
  await page.waitForTimeout(300);
  pruefe('„Fertig“ am Tag springt zum nächsten offenen Tag',
    (await page.textContent('#notiz')).includes('Weiter mit Freitag, 04.09.') &&
    await page.locator('#reiter button[aria-selected="true"]', { hasText: '04.09.' }).isVisible(),
    await page.textContent('#notiz'));
  // Am Freitag „Fertig“: kein Sprung in die nächste Woche, die Woche bleibt stehen.
  const wocheVorher = await page.textContent('#wochenlabel');
  await page.fill('#feld-2026-09-04', 'Patchday vorbereitet');
  await page.click('.sektion .uebernehmen');
  await page.waitForTimeout(300);
  const freitag = await page.textContent('#notiz');
  pruefe('„Fertig“ am Freitag bleibt in der Woche und bietet an, was offen ist',
    (await page.textContent('#wochenlabel')) === wocheVorher &&
    await page.locator('#reiter button[aria-selected="true"]', { hasText: '04.09.' }).isVisible() &&
    /In dieser Woche ist noch .* offen|Die Woche ist fertig/.test(freitag) &&
    (await page.locator('#notiz .notizknopf').count()) === 1, wocheVorher + ' | ' + freitag);
  pruefe('Gesucht wird nur nach vorn; der früheste offene Tag liegt am Beginn der Ausbildung',
    await auf(page, () => window.__naechsterOffenerTag('2099-01-01') === null && window.__ersterOffenerTag() === '2025-09-01'));
  // Nach dem letzten offenen Tag kein Sprung zurück an den Anfang, nur ein Knopf dorthin. Alles
  // nach dem 28.09. bis heute ist erledigt, egal wann der Test läuft.
  await auf(page, () => {
    const tage = window.__tage();
    ['2026-09-04', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].forEach((d) => {
      tage[d] = { text: 'erledigt', art: '', geprueft: true };
    });
    Object.keys(tage).filter((d) => d > '2026-09-28').forEach((d) => { delete tage[d]; });
    // Bis zum Ende von heute, sonst fehlt heute am Vormittag; Datum in Ortszeit wie in der App.
    const heute = new Date();
    heute.setHours(23, 59, 59, 999);
    for (const d = new Date('2026-09-29T12:00:00'); d <= heute; d.setDate(d.getDate() + 1)) {
      const t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      tage[t] = { text: 'erledigt', art: '', geprueft: true };
    }
    window.__merkenJetzt();
  });
  await page.click('#wochenlabel');
  await page.fill('#wochensuche', '28.09.2026');
  await page.waitForTimeout(300);
  await page.fill('#feld-2026-09-28', 'Server gepatcht');
  await page.click('.sektion .uebernehmen');
  await page.waitForTimeout(300);
  pruefe('Nach dem letzten offenen Tag: bleibt stehen, Knopf zum frühesten offenen Tag',
    (await page.textContent('#notiz')).includes('Danach ist nichts mehr offen') &&
    (await page.textContent('#notiz .notizknopf')).includes('01.09.') &&
    (await page.textContent('#wochenlabel')).startsWith('28. Sep'), await page.textContent('#notiz'));
  await page.click('#notiz .notizknopf');
  await page.waitForTimeout(200);
  pruefe('… der Knopf öffnet ihn', (await page.textContent('#wochenlabel')).startsWith('1.–7. Sep'),
    await page.textContent('#wochenlabel'));

  /* ---------- Am Handy ---------- */
  const handy = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const handyFehler = h.fehlerSammeln(handy);
  await h.ohneRundgang(handy);
  await h.oeffnen(handy);
  await handy.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [h.SPEICHER, STAND]);
  await handy.reload();
  await handy.waitForSelector('#reiter-block');
  const breit = await handy.evaluate(() => ({
    seite: document.documentElement.scrollWidth,
    reiter: document.getElementById('reiter-block').getBoundingClientRect().width,
  }));
  pruefe('Handy: ein breiter Reiter, nichts ragt über den Rand', breit.seite <= 390 && breit.reiter > 300, JSON.stringify(breit));
  pruefe('Handy: das Themenfeld steht oben, gleich unter seiner Überschrift',
    await handy.locator('.schulwoche .sektionsleib > textarea:first-child').isVisible());
  pruefe('Handy ohne JavaScript-Fehler', handyFehler.length === 0, handyFehler.join(' | '));

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
