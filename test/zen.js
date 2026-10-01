#!/usr/bin/env node
/**
 * Zen-Modus (src/js/ansicht/zen.js): Ein Knopf neben hell/dunkel blendet alles aus außer dem
 * Arbeitsbereich. Am Tag bleibt die Textkarte mit „Fertig“, mittig; in der Woche das Blatt.
 * Die Tasten 1–8 und Alt+←/→ wirken weiter. Esc oder derselbe Knopf beendet ihn; ein offenes
 * Fenster schließt Esc zuerst. Gemerkt wird er nicht. Der Knopf bleibt dabei, wo er ist, und der
 * Wechsel läuft als View Transition.
 *
 *   node test/zen.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Zen-Modus: nur der Arbeitsbereich');

const sichtbar = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((e) => {
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
}), sel);
const zen = (page) => page.evaluate(() => document.body.classList.contains('zen'));
const kartenDatum = (page) => page.evaluate(() => {
  const k = document.querySelector('.tagkarte > .sektionskopf');
  return k ? k.textContent : '';
});

(async () => {
  const browser = await h.starteBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const jsFehler = h.fehlerSammeln(page);
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.waitForTimeout(600);

  pruefe('Ohne Woche kein Zen-Knopf', !(await sichtbar(page, '#btn-zen')));
  await page.click('#btn-beispiel');
  await page.waitForTimeout(900);
  const nachbar = await page.evaluate(() => {
    const z = document.getElementById('btn-zen');
    return { neben: z.nextElementSibling && z.nextElementSibling.id, gedrueckt: z.getAttribute('aria-pressed') };
  });
  pruefe('Der Knopf steht neben hell/dunkel', nachbar.neben === 'btn-farbe' && nachbar.gedrueckt === 'false' &&
    await sichtbar(page, '#btn-zen'), JSON.stringify(nachbar));

  /* ---------- Tag ---------- */
  const knopfLage = () => page.evaluate(() => {
    const r = document.getElementById('btn-zen').getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map((x) => Math.round(x * 10) / 10).join(',');
  });
  const vorher = await knopfLage();
  // Der Wechsel gleitet: Kurz nach dem Klick läuft eine View Transition mit Karte und Knopf.
  const uebergang = await page.evaluate(async () => {
    document.getElementById('btn-zen').click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return document.getAnimations().map((a) => a.effect && a.effect.pseudoElement).filter(Boolean);
  });
  pruefe('Der Wechsel läuft als Übergang: Karte gleitet, Knopf steht', uebergang.some((p) => /zenarbeit/.test(p)) &&
    uebergang.some((p) => /zenknopf/.test(p)), uebergang.join(' '));
  await page.waitForTimeout(500);
  const weg = ['.reiter', '.wochensumme', '.wochenbalken', '#btn-farbe', '#btn-export', '#btn-mehr', '.sektion.posten', '.fussleiste', '.hinweise', '.herkunft'];
  const nochDa = [];
  for (const s of weg) if (await sichtbar(page, s)) nochDa.push(s);
  pruefe('Im Zen ist alles weg außer der Arbeit', (await zen(page)) && nochDa.length === 0, nochDa.join(' '));
  pruefe('Knopf gedrückt, Textfeld und „Fertig“ da',
    (await page.getAttribute('#btn-zen', 'aria-pressed')) === 'true' && await sichtbar(page, '.tagkarte textarea') &&
      await sichtbar(page, '.tagkarte .uebernehmen'));
  const lage = await page.evaluate(() => {
    const k = document.querySelector('.tagkarte').getBoundingClientRect();
    const z = document.getElementById('btn-zen').getBoundingClientRect();
    return { links: Math.round(k.left), rechts: Math.round(innerWidth - k.right), breite: Math.round(k.width),
      frei: z.bottom <= k.top };
  });
  pruefe('Die Karte steht mittig, höchstens 880 px breit, unter dem Knopf',
    Math.abs(lage.links - lage.rechts) <= 2 && lage.breite <= 880 && lage.frei, JSON.stringify(lage));
  pruefe('Der Knopf steht im Zen genau dort, wo er vorher stand', (await knopfLage()) === vorher, vorher + ' → ' + await knopfLage());

  // Schreiben geht wie sonst und wird gespeichert.
  const feld = page.locator('.tagkarte textarea');
  await feld.click();
  await feld.press('Control+End');
  await page.keyboard.type('\nIm Zen geschrieben');
  await page.waitForTimeout(300);
  pruefe('Im Zen geschrieben landet im Tag',
    (await page.evaluate(() => window.__tage()['2026-09-07'].text)).endsWith('Im Zen geschrieben'));

  /* ---------- Tasten ---------- */
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('2');
  await page.waitForTimeout(300);
  pruefe('Taste 2 wählt Dienstag, Zen bleibt', (await zen(page)) && (await kartenDatum(page)).includes('08.09.2026'),
    await kartenDatum(page));
  await page.keyboard.press('8');
  await page.waitForTimeout(900);
  pruefe('Taste 8: in der Woche nur das Blatt', (await zen(page)) && await sichtbar(page, '.vorschaubuehne .bogen') &&
    !(await sichtbar(page, '.blattzeile')) && !(await sichtbar(page, '.tageschalter')));
  await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForTimeout(600);
  pruefe('Alt+← blättert eine Woche zurück, Zen bleibt', (await zen(page)) &&
    (await page.evaluate(() => document.getElementById('wochenlabel').textContent)).includes('31'),
    await page.evaluate(() => document.getElementById('wochenlabel').textContent));
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForTimeout(600);

  /* ---------- Beenden ---------- */
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  pruefe('Esc beendet den Zen-Modus, der Knopf bleibt an seiner Stelle', !(await zen(page)) && await sichtbar(page, '.reiter') &&
    (await page.getAttribute('#btn-zen', 'aria-pressed')) === 'false' && (await knopfLage()) === vorher);

  // Ein offenes Fenster schließt Esc zuerst; erst das nächste Esc beendet Zen.
  await page.click('#btn-zen');
  await page.evaluate(() => document.getElementById('btn-stamm').click());
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const nachFenster = { zen: await zen(page), offen: await page.evaluate(() => !!document.querySelector('dialog[open]')) };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  pruefe('Esc schließt erst das Fenster, dann Zen', nachFenster.zen && !nachFenster.offen && !(await zen(page)),
    JSON.stringify(nachFenster));

  await page.click('#btn-zen');
  await page.waitForTimeout(200);
  await page.click('#btn-zen');
  await page.waitForTimeout(200);
  pruefe('Derselbe Knopf beendet ihn', !(await zen(page)) && await sichtbar(page, '#btn-export'));

  // „Fertig“ springt zum nächsten offenen Tag, im Zen wie sonst.
  await page.keyboard.press('1');
  await page.click('#btn-zen');
  await page.click('.tagkarte .uebernehmen');
  await page.waitForTimeout(400);
  pruefe('„Fertig“ führt im Zen zum nächsten Tag', (await zen(page)) && (await kartenDatum(page)).includes('08.09.2026') &&
    (await page.evaluate(() => window.__tage()['2026-09-07'].geprueft)) === true, await kartenDatum(page));

  await page.reload();
  await page.waitForTimeout(900);
  pruefe('Nach dem Neuladen ohne Zen', !(await zen(page)) && await sichtbar(page, '.reiter'));

  /* ---------- Handy ---------- */
  for (const w of [390, 320]) {
    const hctx = await browser.newContext({ viewport: { width: w, height: 844 }, isMobile: true, hasTouch: true });
    const hp = await hctx.newPage();
    const hFehler = h.fehlerSammeln(hp);
    await h.ohneRundgang(hp);
    await h.oeffnen(hp);
    await hp.click('#btn-beispiel');
    await hp.waitForTimeout(900);
    const knopf = () => hp.evaluate(() => {
      const r = document.getElementById('btn-zen').getBoundingClientRect();
      return Math.round(r.left) + ',' + Math.round(r.top);
    });
    const hVorher = await knopf();
    await hp.tap('#btn-zen');
    await hp.waitForTimeout(500);
    const handy = await hp.evaluate(() => {
      const z = document.getElementById('btn-zen').getBoundingClientRect();
      const k = document.querySelector('.tagkarte').getBoundingClientRect();
      return { knopfUnten: Math.round(z.bottom), karteOben: Math.round(k.top), kartenBreite: Math.round(k.width) };
    });
    pruefe(`Handy ${w} px: Knopf an seiner Stelle über der Karte, Karte so breit wie der Platz`,
      (await knopf()) === hVorher && handy.knopfUnten <= handy.karteOben && handy.kartenBreite >= w - 30 &&
        !(await sichtbar(hp, '.reiter')) && !(await sichtbar(hp, '.sektion.posten')), hVorher + ' ' + JSON.stringify(handy));
    await hp.tap('#btn-zen');
    await hp.waitForTimeout(500);
    pruefe(`Handy ${w} px: Antippen beendet ihn`, !(await zen(hp)) && await sichtbar(hp, '.reiter'));
    pruefe(`Handy ${w} px: keine JavaScript-Fehler`, hFehler.length === 0, hFehler.join(' | '));
    await hctx.close();
  }

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
