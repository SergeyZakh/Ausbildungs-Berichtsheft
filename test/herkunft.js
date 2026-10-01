#!/usr/bin/env node
/**
 * Herkunft: Wörter im Tagestext, die aus einer Buchung kommen, sind in deren Farbe unterstrichen
 * (src/js/ansicht/herkunft.js).
 *
 * Geprüft wird die Zuordnung selbst (welche Zeile, welches Wort, welche Farbe) und der Spiegel
 * hinter dem Textfeld: Er muss genau so umbrechen und scrollen wie das Feld, sonst sitzen die
 * Striche unter den falschen Wörtern.
 *
 *   node test/herkunft.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Herkunft: Wörter aus Buchungen farbig unterstrichen');

// Wie im Beispiel (src/beispiel.csv), Montag.
const MONTAG = [
  { projekt: 'Ausbildung', taetigkeit: 'Besprechung', beschreibung: 'Kurze Teambesprechung zum Tagesstart' },
  { projekt: 'Ausbildung', taetigkeit: 'Einarbeitung', beschreibung: 'Einführung in das Ticketsystem und die Supportabläufe' },
  { projekt: 'Kundensupport', taetigkeit: 'Support', beschreibung: 'Lagerdrucker am PC-LAGER02 wieder eingebunden, Ticket #48213 geschlossen' },
  { projekt: 'Infrastruktur', taetigkeit: 'Hardware', beschreibung: 'Zwei Notebooks für neue Kolleginnen mit Windows 11 eingerichtet' },
  { projekt: 'Infrastruktur', taetigkeit: 'Dokumentation', beschreibung: 'Einrichtungsschritte in der Wissensdatenbank ergänzt' },
];
const ENTWURF = [
  'Kurze Teambesprechung zum Tagesstart',
  'Einführung in das Ticketsystem und die Supportabläufe',
  'Kundensupport: Lagerdrucker am PC wieder eingebunden, Ticket geschlossen',
  'Infrastruktur: Zwei Notebooks für neue Kolleginnen mit Windows 11 eingerichtet',
  'Infrastruktur: Einrichtungsschritte in der Wissensdatenbank ergänzt',
].join('\n');

(async () => {
  const browser = await h.starteBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const jsFehler = h.fehlerSammeln(page);
  await h.ohneRundgang(page);
  await h.oeffnen(page);

  /* ---------- Zuordnung ---------- */
  const finden = (text, posten) => page.evaluate(([t, p]) => {
    const e = window.__herkunftFinden(t, p);
    return { ...e, woerter: e.stellen.map((s) => t.slice(s.von, s.bis) + '@' + s.p) };
  }, [text, posten]);

  const e = await finden(ENTWURF, MONTAG);
  pruefe('Jede Zeile des Entwurfs gehört zu ihrer Buchung',
    JSON.stringify(e.zeilen.map((z) => z.p)) === '[0,1,2,3,4]', JSON.stringify(e.zeilen));
  pruefe('„Infrastruktur“ steht in zwei Buchungen und bekommt die Farbe seiner Zeile',
    e.woerter.includes('Infrastruktur@3') && e.woerter.includes('Infrastruktur@4') &&
    e.woerter.filter((w) => w.startsWith('Infrastruktur')).length === 2, e.woerter.join(' '));
  const fuell = e.woerter.filter((w) => /^(in|das|die|der|und|mit|für|neue|zum|am|PC|11)@/.test(w));
  pruefe('Füllwörter, Zahlen und Wörter unter drei Buchstaben bleiben ohne Strich', fuell.length === 0, fuell.join(' '));
  pruefe('Bis sechs Buchungen hat jede ihre eigene Farbe', JSON.stringify(e.farben) === '[0,1,2,3,4]', JSON.stringify(e.farben));
  pruefe('Jede Buchung kommt im Entwurf vor', e.getroffen.every(Boolean), JSON.stringify(e.getroffen));

  const eigen = await finden('Arbeitssicherheit nach Vorgabe geprüft\nMit dem Ausbilder über den Lagerdrucker im Lager gesprochen', MONTAG);
  pruefe('Eigene Zeilen bleiben ohne Strich, auch mit einem einzelnen Wort aus einer Buchung',
    e.stellen.length > 0 && eigen.stellen.length === 0 && eigen.zeilen.every((z) => z.p === -1), JSON.stringify(eigen.woerter));

  const plural = await finden('Notebook eingerichtet', MONTAG);
  pruefe('Dasselbe Wort mit kurzer Endung zählt („Notebook“ und „Notebooks“)',
    plural.woerter.join(' ') === 'Notebook@3 eingerichtet@3', plural.woerter.join(' '));

  const ki = await finden('Installation Ubuntu 2x und Installation Debian 1x', [
    { projekt: 'Infrastruktur', beschreibung: 'Installation Ubuntu auf Testrechner' },
    { projekt: 'Infrastruktur', beschreibung: 'Installation Ubuntu auf Laptop' },
    { projekt: 'Server', beschreibung: 'Installation Debian auf Server' },
  ]);
  pruefe('Eine zusammengefasste Zeile aus mehreren Buchungen trägt mehrere Farben',
    ki.woerter.includes('Debian@2') && ki.woerter.includes('Ubuntu@0') && ki.woerter.includes('Installation@0'), ki.woerter.join(' '));

  const viele = Array.from({ length: 9 }, (_, i) => ({ projekt: ['Netzwerk', 'Support', 'Server'][i % 3], beschreibung: 'Aufgabe Nummer ' + 'abcdefghi'[i] + 'xyz' }));
  const v = await finden('', viele);
  pruefe('Über sechs Buchungen teilen sich Buchungen eines Projekts eine Farbe',
    JSON.stringify(v.farben) === '[0,1,2,0,1,2,0,1,2]', JSON.stringify(v.farben));

  /* ---------- Spiegel im Tag ---------- */
  await page.click('#btn-beispiel');
  await page.waitForTimeout(900);
  const sicht = () => page.evaluate(() => {
    const ta = document.querySelector('.tagpanel textarea'), sp = document.querySelector('.herkunft');
    const a = ta.getBoundingClientRect(), b = sp.getBoundingClientRect();
    const zeile = parseFloat(getComputedStyle(ta).lineHeight);
    return {
      striche: sp.querySelectorAll('.hk').length,
      farben: [...new Set([...sp.querySelectorAll('.hk')].map((w) => w.getAttribute('data-p')))].sort().join(','),
      reihen: [...document.querySelectorAll('.postenliste p')].map((r) => (r.className.match(/hkf\d/) || ['-'])[0]).join(','),
      balken: [...document.querySelectorAll('.postenliste p')].every((r) => getComputedStyle(r).borderLeftColor !== 'rgba(0, 0, 0, 0)'),
      deckung: Math.abs(a.left + ta.clientLeft - b.left) < 1 && Math.abs(a.top + ta.clientTop - b.top) < 1 &&
        Math.abs(ta.clientWidth - b.width) < 1 && Math.abs(ta.clientHeight - b.height) < 1,
      // Der Spiegel hat eine Zeile mehr; sonst muss er genauso viele Zeilen haben wie das Feld.
      // Eine Zeile anders umbrochen wären über 20 px; am Handy ist das Feld 2 px höher als sein Text.
      zeilen: Math.round((sp.scrollHeight - zeile - ta.scrollHeight)),
      schrift: getComputedStyle(sp).fontSize === getComputedStyle(ta).fontSize && getComputedStyle(sp).color === 'rgba(0, 0, 0, 0)',
      grund: getComputedStyle(ta).backgroundColor,
    };
  });
  const s1 = await sicht();
  pruefe('Im Beispiel sind Wörter aller fünf Buchungen unterstrichen', s1.striche > 20 && s1.farben === '0,1,2,3,4', JSON.stringify(s1));
  pruefe('Jede Buchung trägt ihren Farbstrich in der Liste', s1.reihen === 'hkf0,hkf1,hkf2,hkf3,hkf4' && s1.balken, s1.reihen);
  pruefe('Der Spiegel liegt deckungsgleich hinter dem Feld, Schrift unsichtbar, Feld durchsichtig',
    s1.deckung && s1.schrift && s1.grund === 'rgba(0, 0, 0, 0)', JSON.stringify(s1));

  // Langer Text: bricht um und scrollt.
  const lang = ENTWURF + '\n' + Array.from({ length: 16 }, (_, i) => 'Zeile ' + i + ': Lagerdrucker eingebunden und Notebooks eingerichtet, dazu ein langer Satz, der in der Breite des Feldes umbrechen muss').join('\n');
  await page.fill('.tagpanel textarea', lang);
  await page.waitForTimeout(200);
  await page.evaluate(() => { const ta = document.querySelector('.tagpanel textarea'); ta.scrollTop = 240; });
  await page.waitForTimeout(150);
  const s2 = await sicht();
  const rollen = await page.evaluate(() => [document.querySelector('.tagpanel textarea').scrollTop, document.querySelector('.herkunft').scrollTop]);
  pruefe('Lange Zeilen brechen im Spiegel genauso um wie im Feld', Math.abs(s2.zeilen) <= 3, s2.zeilen + ' px Unterschied');
  pruefe('Der Spiegel scrollt mit dem Feld', rollen[0] > 0 && rollen[0] === rollen[1], JSON.stringify(rollen));

  // Tippen: eigene Zeile ohne Strich, das Plus bringt die Farbe zurück.
  await page.fill('.tagpanel textarea', 'Arbeitssicherheit nach Vorgabe geprüft');
  await page.waitForTimeout(150);
  const s3 = await sicht();
  const blass = await page.locator('.postenliste p.nichtimtext').count();
  pruefe('Eigener Text ohne Strich; Buchungen, die nicht im Text stehen, sind blass', s3.striche === 0 && blass === 5, s3.striche + ' / ' + blass);
  await page.locator('.postenliste .pdazu').nth(2).click();
  await page.waitForTimeout(150);
  const s4 = await sicht();
  pruefe('Nach dem Plus ist die übernommene Zeile in der Farbe ihrer Buchung unterstrichen',
    s4.farben === '2' && (await page.locator('.postenliste p.nichtimtext').count()) === 4, JSON.stringify(s4));

  // Zeigen: Maus auf einer Buchung hebt ihre Wörter hervor; der Cursor markiert die Buchung.
  await page.fill('.tagpanel textarea', ENTWURF);
  await page.waitForTimeout(150);
  await page.hover('.postenliste p >> nth=3');
  const zeigen = await page.evaluate(() => ({
    zeigt: document.querySelector('.herkunft').classList.contains('zeigt'),
    an: [...new Set([...document.querySelectorAll('.herkunft .hk.an')].map((w) => w.getAttribute('data-p')))].join(','),
  }));
  pruefe('Zeigt man auf eine Buchung, leuchten nur ihre Wörter', zeigen.zeigt && zeigen.an === '3', JSON.stringify(zeigen));
  await page.mouse.move(5, 5);
  await page.evaluate(() => {
    const ta = document.querySelector('.tagpanel textarea');
    ta.focus();
    const pos = ta.value.indexOf('Lagerdrucker');
    ta.setSelectionRange(pos, pos);
    ta.dispatchEvent(new Event('select'));
  });
  await page.keyboard.press('ArrowRight');
  const hier = await page.evaluate(() => [...document.querySelectorAll('.postenliste p')].findIndex((r) => r.classList.contains('hier')));
  pruefe('Steht der Cursor in einer Zeile, ist ihre Buchung markiert', hier === 2, String(hier));

  // Schalter: aus, gemerkt über das Neuladen, wieder an.
  await page.click('.herkunftknopf');
  const aus = await page.evaluate(() => ({
    gedrueckt: document.querySelector('.herkunftknopf').getAttribute('aria-pressed'),
    sichtbar: getComputedStyle(document.querySelector('.herkunft')).display !== 'none',
    balken: document.querySelector('.postenliste').classList.contains('mitherkunft'),
    gemerkt: localStorage.getItem('berichtsheft-herkunft'),
  }));
  pruefe('„Herkunft“ schaltet Striche und Farbbalken ab', aus.gedrueckt === 'false' && !aus.sichtbar && !aus.balken && aus.gemerkt === 'aus', JSON.stringify(aus));
  await page.reload();
  await page.waitForSelector('.herkunftknopf');
  pruefe('Die Wahl bleibt nach dem Neuladen', (await page.getAttribute('.herkunftknopf', 'aria-pressed')) === 'false');
  await page.click('.herkunftknopf');
  pruefe('Wieder an', (await page.getAttribute('.herkunftknopf', 'aria-pressed')) === 'true' &&
    (await page.locator('.herkunft .hk').count()) > 0 && (await page.evaluate(() => localStorage.getItem('berichtsheft-herkunft'))) === null);

  // Fertig: Der Text ist gesperrt, die Herkunft bleibt sichtbar. Ins Blatt kommt nichts davon.
  await page.click('.tagkarte .uebernehmen');
  await page.waitForTimeout(300);
  await page.evaluate(() => { const r = document.querySelectorAll('#reiter button')[0]; if (r) r.click(); });
  await page.waitForTimeout(300);
  pruefe('Auch am fertigen Tag sind die Striche zu sehen',
    (await page.locator('.tagpanel textarea[readonly]').count()) === 1 && (await page.locator('.herkunft .hk').count()) > 0);
  const blatt = await page.evaluate(() => window.__druckBlatt(1, '2026-09-07', { name: 'Max Muster', vordruck: '' }));
  pruefe('Ins Blatt kommt nichts vom Spiegel', blatt.includes('Lagerdrucker') && !/herkunft|hkf\d|\u200b/.test(blatt));

  /* ---------- Dunkel und am Handy ---------- */
  const handy = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  const hp = await handy.newPage();
  const hFehler = h.fehlerSammeln(hp);
  await h.ohneRundgang(hp);
  await h.oeffnen(hp);
  await hp.click('#btn-beispiel');
  await hp.waitForTimeout(900);
  await hp.fill('.tagpanel textarea', lang);
  await hp.waitForTimeout(300);
  const hs = await hp.evaluate(() => {
    const ta = document.querySelector('.tagpanel textarea'), sp = document.querySelector('.herkunft');
    const zeile = parseFloat(getComputedStyle(ta).lineHeight);
    const hell = (c) => { const z = c.match(/\d+(\.\d+)?/g).map(Number); return (z[0] + z[1] + z[2]) / 3; };
    return { hoehe: Math.abs(sp.getBoundingClientRect().height - ta.clientHeight) < 1, zeilen: Math.round(sp.scrollHeight - zeile - ta.scrollHeight),
      grund: hell(getComputedStyle(document.querySelector('.herkunftrahmen')).backgroundColor), striche: sp.querySelectorAll('.hk').length };
  });
  pruefe('Am Handy wächst der Spiegel mit dem Feld und bricht gleich um', hs.hoehe && Math.abs(hs.zeilen) <= 3 && hs.striche > 20, JSON.stringify(hs));
  pruefe('Dunkel: hinter dem Text bleibt die dunkle Fläche', hs.grund < 40, JSON.stringify(hs));
  // Am Handy: Antippen klappt die Buchung auf und hebt ihre Wörter hervor.
  await hp.locator('.postenliste p').nth(1).tap();
  await hp.waitForTimeout(100);
  const getippt = await hp.evaluate(() => [...new Set([...document.querySelectorAll('.herkunft .hk.an')].map((w) => w.getAttribute('data-p')))].join(','));
  pruefe('Am Handy hebt Antippen einer Buchung ihre Wörter hervor', getippt === '1', getippt);
  pruefe('Keine JavaScript-Fehler', !jsFehler.length && !hFehler.length, [...jsFehler, ...hFehler].join(' | '));

  await handy.close();
  await browser.close();
  abschluss();
})();
