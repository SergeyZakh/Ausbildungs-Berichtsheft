#!/usr/bin/env node
/**
 * Sicherung: speichern, in einem leeren Browser laden, in Firefox laden.
 *
 * Ohne Konto ist die Sicherung der einzige Weg, ein Heft auf einen anderen Rechner oder in
 * einen anderen Browser zu bringen. Geht dabei etwas verloren, merkt das niemand, bis die
 * alten Daten weg sind.
 *
 * Firefox läuft mit, wenn Playwright ihn kennt (npx playwright install firefox). Fehlt er,
 * sagt der Test das und prüft nur Chromium.
 *
 *   node test/sicherung.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { firefox } = require('playwright');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Sicherung: speichern und in anderen Browsern laden');
const EIGENER_TEXT = 'Netzwerkdose im Lager geprüft und beschriftet.';
const NAME = 'Muster, Mia';

/** Was eine geladene Seite vom Heft zeigt: Zahl der Tage, ein Tagestext, der Name. */
async function stand(seite) {
  return seite.evaluate((schluessel) => {
    const roh = JSON.parse(localStorage.getItem(schluessel) || 'null');
    const tage = roh ? Object.values(roh.tage) : [];
    return {
      tage: tage.length,
      eigenerText: tage.some((t) => (t.text || '').includes('Netzwerkdose im Lager')),
      name: roh && roh.stamm ? roh.stamm.name : '',
    };
  }, h.SPEICHER);
}

async function neueSeite(browser) {
  const kontext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const seite = await kontext.newPage();
  await h.ohneRundgang(seite);
  const fehler = h.fehlerSammeln(seite);
  await h.oeffnen(seite);
  await seite.waitForTimeout(800);
  return { seite, fehler, kontext };
}

/** Sicherung laden und warten, bis die Seite neu geladen ist. */
async function laden(seite, datei) {
  await Promise.all([
    seite.waitForEvent('load'),
    seite.setInputFiles('#sicherungsdatei', datei),
  ]);
  await seite.waitForTimeout(800);
}

(async () => {
  const browser = await h.starteBrowser();
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'berichtsheft-sicherung-'));

  /* ---------- 1. Heft anlegen und sichern ---------- */
  const a = await neueSeite(browser);
  const dateien = h.downloadsSammeln(a.seite);
  await a.seite.setInputFiles('#datei', h.testdatei('kimai-test.csv'));
  await a.seite.waitForTimeout(900);
  await a.seite.locator('.tagpanel textarea').first().fill(EIGENER_TEXT);
  await h.stammdatenOeffnen(a.seite);
  await h.stammFuellen(a.seite, '#f-name', NAME);
  await a.seite.click('#dlg-fertig');
  await a.seite.waitForTimeout(400);
  const vorher = await stand(a.seite);

  await a.seite.click('#btn-mehr');
  await a.seite.click('#btn-sicherung');
  const sicherung = await h.warteAufDatei(dateien, 'Berichtsheft-Sicherung-');
  pruefe('Sicherung wird als Datei angeboten', !!sicherung, sicherung ? sicherung.name : 'keine Datei');
  if (!sicherung) { await browser.close(); abschluss(); return; }
  pruefe('Dateiname trägt das Datum', /^Berichtsheft-Sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(sicherung.name), sicherung.name);

  const datei = path.join(ordner, sicherung.name);
  fs.writeFileSync(datei, sicherung.daten);
  let inhalt = null;
  try { inhalt = JSON.parse(sicherung.daten.toString('utf8')); } catch (e) { /* bleibt null */ }
  pruefe('Die Sicherung ist lesbares JSON', !!inhalt);
  pruefe('Sie enthält alle Tage, den eigenen Text und den Namen',
    !!inhalt && Object.keys(inhalt.tage).length === vorher.tage && vorher.tage > 0 &&
    JSON.stringify(inhalt).includes('Netzwerkdose im Lager') && inhalt.stamm.name === NAME,
    vorher.tage + ' Tage im Browser');

  /* ---------- 2. In einem leeren Browser laden ---------- */
  const b = await neueSeite(browser);
  await laden(b.seite, datei);
  const leerGeladen = await stand(b.seite);
  pruefe('Leerer Browser: alles ist nach dem Laden da',
    leerGeladen.tage === vorher.tage && leerGeladen.eigenerText && leerGeladen.name === NAME,
    JSON.stringify(leerGeladen));
  pruefe('Leerer Browser: die Seite zeigt das Heft', (await b.seite.locator('.reiter button').count()) > 0);

  /* ---------- 3. Über einen vorhandenen Stand laden ---------- */
  const c = await neueSeite(browser);
  await c.seite.setInputFiles('#datei', h.testdatei('kimai-volle-woche.csv'));
  await c.seite.waitForTimeout(900);
  const eigenerStand = await stand(c.seite);
  await c.seite.setInputFiles('#sicherungsdatei', datei);
  await c.seite.waitForTimeout(400);
  pruefe('Vorhandener Stand: es kommt eine Rückfrage', await c.seite.locator('#dlg-frage').isVisible());
  pruefe('Die Rückfrage nennt beide Tageszahlen',
    (await c.seite.locator('#frage-text').textContent()).includes(String(vorher.tage)),
    await c.seite.locator('#frage-text').textContent());
  await c.seite.click('#frage-nein');
  await c.seite.waitForTimeout(400);
  pruefe('„Abbrechen“ lässt den Stand unberührt',
    JSON.stringify(await stand(c.seite)) === JSON.stringify(eigenerStand));
  await c.seite.setInputFiles('#sicherungsdatei', datei);
  await c.seite.waitForTimeout(400);
  await Promise.all([c.seite.waitForEvent('load'), c.seite.click('#frage-ja')]);
  await c.seite.waitForTimeout(800);
  const ersetzt = await stand(c.seite);
  pruefe('„Ersetzen“ lädt die Sicherung', ersetzt.eigenerText && ersetzt.name === NAME, JSON.stringify(ersetzt));

  /* ---------- 4. Falsche Datei ---------- */
  const fremd = path.join(ordner, 'irgendwas.json');
  fs.writeFileSync(fremd, JSON.stringify({ hallo: 'welt' }));
  await c.seite.setInputFiles('#sicherungsdatei', fremd);
  await c.seite.waitForTimeout(500);
  pruefe('Eine fremde JSON-Datei wird abgewiesen',
    (await c.seite.locator('#notiz').textContent()).includes('keine Sicherung'),
    await c.seite.locator('#notiz').textContent());
  pruefe('… und der Stand bleibt', (await stand(c.seite)).eigenerText);

  /* ---------- 5. Stand aus 0.1.0: ein Stempel für alle Wochen ---------- */
  // Die Stempel entscheiden mit Konto, welcher Stand gewinnt. Nach dem Laden dürfen sie nicht
  // verloren gehen, sonst gälte der alte Stand als eben geändert. Eine geladene Sicherung landet
  // genauso im Speicher; hier liegt sie schon vor dem Öffnen dort, ohne Umweg über das Neuladen.
  const altFormat = JSON.parse(JSON.stringify(inhalt));
  altFormat.wochen = { '2026-08-31': { abteilung: 'Lager', unterweisungen: 'Arbeitsschutz' } };
  altFormat.geaendert = { stamm: '2026-09-01T08:00:00.000Z', wochen: '2026-09-02T08:00:00.000Z' };
  const dKontext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const d = { seite: await dKontext.newPage() };
  await h.ohneRundgang(d.seite);
  await d.seite.addInitScript(([schluessel, wert]) => {
    try { if (!localStorage.getItem(schluessel)) localStorage.setItem(schluessel, wert); } catch (e) {}
  }, [h.SPEICHER, JSON.stringify(altFormat)]);
  d.fehler = h.fehlerSammeln(d.seite);
  await h.oeffnen(d.seite);
  await d.seite.waitForTimeout(800);
  await d.seite.evaluate(() => window.__tagSetzen('2026-09-04', { text: 'Nach dem Laden geschrieben' }));
  const stempel = await d.seite.evaluate((s) => JSON.parse(localStorage.getItem(s)).geaendert, h.SPEICHER);
  pruefe('Alter Stand: der Stempel der Stammdaten bleibt',
    stempel.stamm === '2026-09-01T08:00:00.000Z', JSON.stringify(stempel));
  pruefe('… und jede Woche erbt den gemeinsamen Stempel',
    (stempel.jeWoche || {})['2026-08-31'] === '2026-09-02T08:00:00.000Z', JSON.stringify(stempel));

  pruefe('Keine JavaScript-Fehler in Chromium',
    [a, b, c, d].every((x) => x.fehler.length === 0), [a, b, c, d].flatMap((x) => x.fehler).join(' | '));
  await browser.close();

  /* ---------- 6. In Firefox laden ---------- */
  let ff = null;
  try { ff = await firefox.launch(); } catch (e) { ff = null; }
  if (!ff) {
    console.log('\n  Firefox fehlt, dieser Teil ist übersprungen: npx playwright install firefox');
  } else {
    const f = await neueSeite(ff);
    await laden(f.seite, datei);
    const imFirefox = await stand(f.seite);
    pruefe('Firefox: die Sicherung aus Chromium lädt vollständig',
      imFirefox.tage === vorher.tage && imFirefox.eigenerText && imFirefox.name === NAME,
      JSON.stringify(imFirefox));
    pruefe('Firefox: die Seite zeigt das Heft', (await f.seite.locator('.reiter button').count()) > 0);
    pruefe('Firefox: keine JavaScript-Fehler', f.fehler.length === 0, f.fehler.join(' | '));
    await ff.close();
  }

  fs.rmSync(ordner, { recursive: true, force: true });
  abschluss();
})();
