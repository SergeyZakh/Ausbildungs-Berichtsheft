#!/usr/bin/env node
/**
 * Hinweise und Übersicht: was beim Öffnen fehlt, wann eine Sicherung fällig ist, der Tipp fürs
 * iPhone, die Übersicht aller Wochen mit Schul-, Urlaubs- und Krankheitstagen. Dazu die kleinen
 * Dinge am Rand: Buchung als Zeile übernehmen, ruhiger Start ohne Woche, Legende im Kalender,
 * dunkler Modus, kurze Überschriften und eingeklappte Meldung am Handy.
 *
 *   node test/hinweise.js
 */
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Hinweise, Übersicht und kleine Dinge am Rand');

const TAG = 86400000;
const vorTagen = (n) => new Date(Date.now() - n * TAG).toISOString();

/** ISO-Datum des Montags vor `wochen` Wochen. */
function montagVor(wochen) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * wochen);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function plusTage(isoDatum, n) {
  const d = new Date(isoDatum + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Einen Stand in den Speicher legen, bevor die Seite lädt. */
async function mitStand(ctx, stand) {
  const page = await ctx.newPage();
  await h.ohneRundgang(page);
  await page.addInitScript(([schluessel, s]) => {
    if (!sessionStorage.getItem('gesetzt')) {
      localStorage.setItem(schluessel, JSON.stringify(s));
      sessionStorage.setItem('gesetzt', '1');
    }
  }, [h.SPEICHER, stand]);
  return page;
}

const tag = (text, extra = {}) => ({ text, art: '', pausen: [], posten: [], geaendert: vorTagen(1), ...extra });

(async () => {
  const browser = await h.starteBrowser();

  /* ---------- Was fehlt noch? ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 } });
    // Beginn vor drei Wochen: Die vorletzte Woche ist fertig, die letzte hat zwei Lücken und einen
    // ungelesenen Tag, die laufende Woche zählt nicht.
    const beginn = montagVor(3), vorletzte = montagVor(2), letzte = montagVor(1);
    const tage = {};
    for (let i = 0; i < 5; i++) tage[plusTage(beginn, i)] = tag('Fertig ' + i, { geprueft: true });
    for (let i = 0; i < 5; i++) tage[plusTage(vorletzte, i)] = tag('Fertig ' + i, { geprueft: true });
    tage[plusTage(letzte, 0)] = tag('Montag fertig', { geprueft: true });
    tage[plusTage(letzte, 1)] = tag('Dienstag ungelesen');
    tage[plusTage(letzte, 2)] = tag('', { art: 'Urlaub' });
    const page = await mitStand(ctx, {
      stamm: { name: 'Muster, Max', beginn }, tage, wochen: {},
      hinweise: { gesichert: vorTagen(0) }, stand: { woche: beginn, tag: 0 },
    });
    const fehler = h.fehlerSammeln(page);
    await h.oeffnen(page);
    await page.waitForTimeout(900);
    const text = await page.locator('#hinweise').innerText().catch(() => '');
    // Donnerstag und Freitag der letzten Woche sind leer; ein Feiertag darunter wäre keine Lücke.
    const luecken = await page.evaluate((tage) => tage.filter((d) => !window.__feiertagAn(d, '')).length,
      [plusTage(letzte, 3), plusTage(letzte, 4)]);
    pruefe('Beim Öffnen: Hinweis auf die letzte Woche', await page.locator('#hinweise .hinweis.fehlt').isVisible(), text);
    pruefe('Er zählt Lücken und Ungelesenes der letzten Woche',
      text.includes('Letzte Woche') && text.includes('1 nicht gegengelesen') &&
        (!luecken || text.includes(luecken + (luecken === 1 ? ' Tag' : ' Tage') + ' ohne Text')), text);
    pruefe('Fertige Wochen und die laufende zählen nicht', !text.includes('ältere'), text);
    const tasten = await page.evaluate(() => [...document.querySelectorAll('#reiter button')]
      .map((k) => getComputedStyle(k, '::before').content.replace(/"/g, '')).join(''));
    pruefe('Am Rechner steht an jedem Reiter seine Taste, 1–7 und 8 für die Woche', tasten === '12345678', tasten);
    const bilanz = await page.evaluate((m) => window.__wochenBilanz(m), letzte);
    pruefe('Wochenbilanz: Urlaub braucht keinen Text, erster offener Tag ist Dienstag',
      bilanz.ohneText === luecken && bilanz.ungelesen === 1 && bilanz.fertig === 1 && bilanz.erster === 1, JSON.stringify(bilanz));

    await page.click('#hinweise .knopf.voll');
    await page.waitForTimeout(400);
    pruefe('„Letzte Woche öffnen“ springt auf den ersten offenen Tag',
      (await page.evaluate(() => document.querySelector('#reiter button[aria-selected="true"] .rkurz').textContent)) === 'DI');
    pruefe('Danach ist der Hinweis weg', !(await page.locator('#hinweise').isVisible()));

    /* ---------- Übersicht ---------- */
    await page.click('#btn-mehr');
    await page.click('#btn-uebersicht');
    await page.waitForTimeout(300);
    pruefe('Übersicht öffnet sich aus dem Menü', await page.locator('#dlg-uebersicht').isVisible());
    // Wie die Aktivität bei GitHub: je Woche eine Spalte Mo–Fr, die Felder Spalte für Spalte.
    const felder = await page.evaluate(() =>
      [...document.querySelectorAll('#dlg-uebersicht .uraster .utag')].map((k) => k.className.replace('utag ', '')));
    pruefe('Ein Feld je Werktag, im richtigen Zustand: zwei fertige Wochen, dann fertig, ungelesen, Urlaub',
      felder.slice(0, 10).every((k) => k === 'fertig') && felder[10] === 'fertig' && felder[11] === 'pruefen' &&
        felder[12] === 'frei', felder.slice(0, 15).join(','));
    pruefe('Monate stehen über den Spalten, Wochentage davor',
      (await page.locator('#dlg-uebersicht .umonat').count()) >= 1 &&
        (await page.locator('#dlg-uebersicht .uwt').allTextContents()).join() === 'Mo,Mi,Fr');
    const jahr = await page.locator('#dlg-uebersicht .ujahr h3').first().textContent();
    pruefe('Überschrift nennt das Ausbildungsjahr mit seinen echten Grenzen',
      jahr.startsWith('1. Ausbildungsjahr') && jahr.includes(beginn.split('-').reverse().join('.')), jahr);
    const tageZeile = await page.locator('#dlg-uebersicht .utage').first().textContent();
    pruefe('Urlaubstage werden gezählt', /1\s*Urlaub/.test(tageZeile), tageZeile);
    await page.locator('#dlg-uebersicht .uraster .utag').nth(11).click();
    await page.waitForTimeout(700);
    pruefe('Ein Klick auf ein Feld öffnet den Tag und schließt die Übersicht',
      !(await page.locator('#dlg-uebersicht').isVisible()) &&
        (await page.evaluate((s) => JSON.parse(localStorage.getItem(s)).stand.woche, h.SPEICHER)) === letzte);

    // Nach einem Import erscheint er nicht: Er gehört zum Öffnen, nicht zu jeder Änderung. Oben
    // steht dann nur das Ergebnis des Imports; ist es weg, bleibt es ruhig.
    await page.setInputFiles('#datei', h.testdatei('kimai-test.csv'));
    await page.waitForTimeout(900);
    const nachImport = await page.locator('#hinweise').textContent();
    pruefe('Nach einem Import nur die Karte zum Import, kein neuer Hinweis',
      nachImport.includes('Import fertig') && !nachImport.includes('Noch offen'), nachImport);
    await page.locator('#hinweise button', { hasText: 'Passt' }).click();
    pruefe('Nach „Passt“ ist oben Ruhe', !(await page.locator('#hinweise').isVisible()));
    pruefe('Keine JavaScript-Fehler (Was fehlt, Übersicht)', fehler.length === 0, fehler.join(' | '));
    await ctx.close();
  }

  /* ---------- Übersicht zählt Schule, Urlaub, Krank und Feiertage je Ausbildungsjahr ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 } });
    const page = await mitStand(ctx, {
      stamm: { beginn: '2025-08-01', ende: '2027-07-31', schultage: 'Di' },
      tage: {
        '2025-09-01': tag('', { art: 'Urlaub' }), '2025-09-02': tag('', { art: 'Urlaub' }),
        '2025-09-04': tag('', { art: 'Krank' }),
        '2026-08-03': tag('', { art: 'Krank' }),
      },
      wochen: {}, hinweise: { gesichert: vorTagen(0) },
    });
    await h.oeffnen(page);
    await page.waitForTimeout(700);
    const daten = await page.evaluate(() => {
      document.getElementById('btn-uebersicht').click();
      return [...document.querySelectorAll('#dlg-uebersicht .ujahr')].map((j) => ({
        titel: j.querySelector('h3').textContent, tage: j.querySelector('.utage').textContent,
      }));
    });
    pruefe('Zwei Ausbildungsjahre', daten.length === 2 &&
      daten[0].titel.includes('01.08.2025 – 31.07.2026') && daten[1].titel.includes('01.08.2026 – 31.07.2027'),
      JSON.stringify(daten.map((d) => d.titel)));
    // 1. Jahr: 52 Dienstage laut Plan, einer davon Urlaub (02.09.), dazu Feiertage an Dienstagen
    // fallen weg. Genau nachzählen ist Sache des Plans (test/schulplan.js); hier: die Größenordnung.
    const schule = Number((daten[0].tage.match(/(\d+)\s*Berufsschule/) || [])[1]);
    pruefe('1. Jahr: Berufsschule laut Plan, ohne den Urlaubsdienstag', schule >= 45 && schule <= 51, daten[0].tage);
    pruefe('1. Jahr: 2 Urlaub, 1 Krank, gesetzliche Feiertage',
      /2\s*Urlaub/.test(daten[0].tage) && /1\s*Krank/.test(daten[0].tage) && /\d+\s*Feiertag/.test(daten[0].tage), daten[0].tage);
    pruefe('2. Jahr: der Krankheitstag im August 2026', /1\s*Krank/.test(daten[1].tage), daten[1].tage);
    await ctx.close();
  }
  {
    // Drei Ausbildungsjahre passen auf einen Laptop mit 1366 × 768 ohne Scrollen.
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await mitStand(ctx, {
      stamm: { beginn: '2024-08-01', ende: '2027-07-31' }, tage: { '2025-03-03': tag('Etwas') }, wochen: {},
      hinweise: { gesichert: vorTagen(0) },
    });
    await h.oeffnen(page);
    await page.waitForTimeout(700);
    const mass = await page.evaluate(() => {
      document.getElementById('btn-uebersicht').click();
      const k = document.querySelector('#dlg-uebersicht .dkoerper');
      return { jahre: document.querySelectorAll('#dlg-uebersicht .ujahr').length, hoehe: k.scrollHeight, sichtbar: k.clientHeight };
    });
    pruefe('Übersicht: drei Jahre ohne Scrollen bei 1366 × 768', mass.jahre === 3 && mass.hoehe <= mass.sichtbar, JSON.stringify(mass));
    await ctx.close();
  }
  {
    // Ohne Ausbildungszeit reicht die Übersicht vom ersten Eintrag bis heute, oft nur ein paar
    // Wochen. Die Felder wuchsen dann auf die ganze Breite: bei zwei Wochen 456 px je Feld.
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await mitStand(ctx, {
      stamm: {}, tage: { '2026-09-29': tag('Etwas'), '2026-09-30': tag('Noch etwas') }, wochen: {},
      hinweise: { gesichert: vorTagen(0) },
    });
    await h.oeffnen(page);
    await page.waitForTimeout(700);
    const feld = await page.evaluate(() => {
      document.getElementById('btn-uebersicht').click();
      const r = document.querySelector('#dlg-uebersicht .utag').getBoundingClientRect();
      return { breite: r.width, hoehe: r.height };
    });
    pruefe('Übersicht mit wenigen Wochen: Felder bleiben klein', feld.breite <= 16.5 && feld.hoehe <= 16.5, JSON.stringify(feld));
    await ctx.close();
  }
  {
    // Das Ende fällt auf einen Samstag, dessen Montag noch im 1. Jahr liegt: Der Tag gehört ins 2. Jahr,
    // das dann keine eigene Woche hat. Früher brach die Übersicht daran ab.
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 } });
    const page = await mitStand(ctx, {
      stamm: { beginn: '2025-08-01', ende: '2026-08-01' },
      tage: { '2026-08-01': tag('', { art: 'Urlaub' }) }, wochen: {}, hinweise: { gesichert: vorTagen(0) },
    });
    const fehler = h.fehlerSammeln(page);
    await h.oeffnen(page);
    await page.waitForTimeout(700);
    const titel = await page.evaluate(() => {
      document.getElementById('btn-uebersicht').click();
      return [...document.querySelectorAll('#dlg-uebersicht .ujahr h3')].map((t) => t.textContent);
    });
    pruefe('Übersicht: ein Jahr ohne eigene Woche bricht nichts',
      fehler.length === 0 && titel.length === 2 && titel[1].includes('01.08.2026 – 01.08.2026'),
      JSON.stringify(titel) + ' ' + fehler.join(' | '));
    await ctx.close();
  }

  /* ---------- Sicherung fällig ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, acceptDownloads: true });
    const page = await mitStand(ctx, {
      stamm: {}, tage: { '2026-09-07': tag('Alter Text', { geaendert: vorTagen(20), geprueft: true }) },
      wochen: {}, stand: { woche: '2026-09-07', tag: 0 },
    });
    const dateien = h.downloadsSammeln(page);
    await h.oeffnen(page);
    await page.waitForTimeout(800);
    const text = await page.locator('#hinweise').innerText().catch(() => '');
    pruefe('Ohne Sicherung nach 14 Tagen: Erinnerung', await page.locator('#hinweise .hinweis.sicherung').isVisible(), text);
    pruefe('Sie sagt, dass noch keine Sicherung da ist', text.includes('noch keine Sicherung'), text);
    await page.click('#hinweise .knopf.voll');
    pruefe('„Sicherung speichern“ lädt die Datei', !!(await h.warteAufDatei(dateien, 'Berichtsheft-Sicherung-')));
    await page.waitForTimeout(300);
    const nachher = await page.evaluate(() => window.__hinweise());
    pruefe('Der Zeitpunkt steht im Stand', !!nachher.gesichert && Date.now() - Date.parse(nachher.gesichert) < 60000, JSON.stringify(nachher));
    pruefe('Danach ist die Erinnerung weg', !(await page.locator('#hinweise .hinweis.sicherung').isVisible()));
    await page.reload();
    await page.waitForTimeout(800);
    pruefe('Auch nach dem Neuladen', !(await page.locator('#hinweise .hinweis.sicherung').isVisible()));
    await ctx.close();
  }
  {
    // Letzte Sicherung alt, seitdem geändert, „Später“ schiebt die Erinnerung.
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 } });
    const page = await mitStand(ctx, {
      stamm: {}, tage: { '2026-09-07': tag('Neuer Text', { geaendert: vorTagen(2), geprueft: true }) },
      wochen: {}, hinweise: { gesichert: vorTagen(30) }, stand: { woche: '2026-09-07', tag: 0 },
    });
    await h.oeffnen(page);
    await page.waitForTimeout(800);
    const text = await page.locator('#hinweise').innerText().catch(() => '');
    pruefe('Alte Sicherung: nennt ihr Alter', text.includes('30 Tage alt'), text);
    await page.click('#hinweise .knopf:not(.voll)');
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForTimeout(800);
    pruefe('„Später“: beim nächsten Öffnen Ruhe', !(await page.locator('#hinweise .hinweis.sicherung').isVisible()));
    await ctx.close();
  }
  {
    // Seit der letzten Sicherung nichts geändert: keine Erinnerung, so alt sie auch ist.
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 } });
    const page = await mitStand(ctx, {
      stamm: {}, tage: { '2026-09-07': tag('Text', { geaendert: vorTagen(40), geprueft: true }) },
      wochen: {}, hinweise: { gesichert: vorTagen(30) }, stand: { woche: '2026-09-07', tag: 0 },
    });
    await h.oeffnen(page);
    await page.waitForTimeout(800);
    pruefe('Nichts geändert seit der Sicherung: keine Erinnerung', !(await page.locator('#hinweise .hinweis.sicherung').isVisible()));
    await ctx.close();
  }

  /* ---------- iPhone ---------- */
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    const page = await ctx.newPage();
    const fehler = h.fehlerSammeln(page);
    await h.ohneRundgang(page);
    await h.oeffnen(page);
    await page.waitForTimeout(800);
    const text = await page.locator('#hinweise').innerText().catch(() => '');
    pruefe('iPhone in Safari: Tipp zum Home-Bildschirm', await page.locator('#hinweise .hinweis.home').isVisible(), text);
    pruefe('Er warnt, dass die App dort leer beginnt', text.includes('Zum Home-Bildschirm') && text.includes('Sicherung'), text);
    pruefe('Die Seite kann als App auf den Home-Bildschirm', await page.evaluate(() =>
      !!document.querySelector('meta[name="apple-mobile-web-app-capable"][content="yes"]') &&
      /^data:image\/png;base64,/.test(document.querySelector('link[rel="apple-touch-icon"]').href)));
    await page.click('#hinweise .hinweis.home .knopf');
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForTimeout(800);
    pruefe('Einmal weggeklickt, bleibt er weg', !(await page.locator('#hinweise .hinweis.home').isVisible()));
    pruefe('Leerer Start bietet „Sicherung laden“ an', await page.locator('#btn-leer-sicherung').isVisible());
    pruefe('Keine JavaScript-Fehler (iPhone)', fehler.length === 0, fehler.join(' | '));
    await ctx.close();
  }

  /* ---------- Am Rechner: leerer Start, Legende, Buchung übernehmen, dunkler Modus ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, colorScheme: 'dark' });
    const page = await ctx.newPage();
    const fehler = h.fehlerSammeln(page);
    await h.ohneRundgang(page);
    await h.oeffnen(page);
    await page.waitForTimeout(700);
    pruefe('Leerer Start: kein Exportknopf, keine Wochenleiste',
      !(await page.locator('#btn-export').isVisible()) && !(await page.locator('#wochenlabel').isVisible()));
    pruefe('Leerer Start: das Menü bleibt', await page.locator('#btn-mehr').isVisible());
    pruefe('Kein Hinweis am Rechner ohne Daten', !(await page.locator('#hinweise').isVisible()));

    const farben = await page.evaluate(() => {
      const hell = (c) => { const z = c.match(/\d+(\.\d+)?/g).map(Number); return (z[0] + z[1] + z[2]) / 3; };
      return { grund: hell(getComputedStyle(document.body).backgroundColor), text: hell(getComputedStyle(document.body).color) };
    });
    pruefe('Dunkler Modus: dunkler Grund, helle Schrift', farben.grund < 40 && farben.text > 200, JSON.stringify(farben));

    await page.click('#btn-beispiel');
    await page.waitForTimeout(900);
    pruefe('Mit Woche: Export und Wochenleiste sind da',
      (await page.locator('#btn-export').isVisible()) && (await page.locator('#wochenlabel').isVisible()));

    await page.fill('.tagpanel textarea', '');
    await page.waitForTimeout(100);
    const plusKnoepfe = page.locator('.postenliste .pdazu');
    pruefe('Jede Buchung hat ein Plus', (await plusKnoepfe.count()) === 5, String(await plusKnoepfe.count()));
    await plusKnoepfe.nth(2).click();
    await plusKnoepfe.nth(0).click();
    await page.waitForTimeout(600);
    const text = await page.inputValue('.tagpanel textarea');
    pruefe('Das Plus hängt die bereinigte Zeile an',
      text === 'Kundensupport: Lagerdrucker am PC wieder eingebunden, Ticket geschlossen\nKurze Teambesprechung zum Tagesstart', JSON.stringify(text));
    pruefe('Kunde, Ticketnummer und Rechnername kommen nicht mit', !/Sonnenschein|48213|LAGER02/.test(text));
    pruefe('Übernommene Buchungen haben kein Plus mehr, auch keinen Haken',
      (await page.locator('.postenliste .pdazu:visible').count()) === 3 &&
      !(await plusKnoepfe.nth(2).isVisible()) && (await plusKnoepfe.nth(2).textContent()) === '+');
    await plusKnoepfe.nth(2).evaluate((k) => k.click());
    pruefe('Zweimal dieselbe Zeile gibt es nicht', (await page.inputValue('.tagpanel textarea')) === text);
    await page.fill('.tagpanel textarea', text.split('\n')[1]);
    pruefe('Fliegt die Zeile aus dem Text, ist das Plus wieder da', await plusKnoepfe.nth(2).isVisible());
    await page.fill('.tagpanel textarea', text);
    const gespeichert = await page.evaluate((s) => { window.__merkenJetzt(); return JSON.parse(localStorage.getItem(s)).tage['2026-09-07'].text; }, h.SPEICHER);
    pruefe('Übernommenes wird gespeichert', gespeichert === text, gespeichert);

    await page.click('#wochenlabel');
    await page.waitForTimeout(250);
    const legende = await page.locator('#dlg-wochen .legende').innerText();
    pruefe('Kalender erklärt die Marken', /Entwurf/.test(legende) && /KI/.test(legende) && /eigener Text/.test(legende) &&
      /fertig/.test(legende) && /Text fehlt/.test(legende) && /nichts eingetragen/.test(legende), legende);
    // Das Beispiel beginnt die Ausbildung am 1.8.2025; die Woche vor den Beispielwochen ist leer.
    const ersteZeile = await page.$$eval('#wochenliste button:first-of-type .wtag', (t) => t.map((x) => x.className));
    pruefe('Werktage der Ausbildung ohne Eintrag sind im Kalender blassrot, das Wochenende nicht',
      ersteZeile.slice(0, 5).every((k) => /\bfehlt\b/.test(k)) && ersteZeile.slice(5).every((k) => !/\bfehlt\b/.test(k)),
      JSON.stringify(ersteZeile));
    await page.click('#w-zu');

    await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
    await page.waitForTimeout(900);
    const blatt = await page.evaluate(() => {
      const b = document.querySelector('.vorschaubuehne .bogen');
      return getComputedStyle(b).backgroundColor;
    });
    pruefe('Dunkler Modus: das Blatt in der Vorschau bleibt weiß', blatt === 'rgb(255, 255, 255)', blatt);
    // Am Rechner schreibt man ins Blatt: Die Felder liegen auf ihren Kästen im Vordruck.
    const imBlatt = await page.evaluate(() => {
      const feld = document.querySelector('.blattfeld.feld-unterweisung').getBoundingClientRect();
      const kasten = [...document.querySelectorAll('.vorschaubuehne [data-feld="unterweisung"] .kasten')].pop().getBoundingClientRect();
      return { drauf: Math.abs(feld.top - kasten.top) < 2 && Math.abs(feld.width - kasten.width) < 2,
        hinweis: document.querySelector('.blattzeile').textContent, karten: document.querySelectorAll('.wochenspalte').length,
        leiste: document.querySelectorAll('.wochenstand').length,
        marke: (document.querySelector('.vorschaubuehne .tagkopf[data-datum="2026-09-07"] .vmarke') || {}).textContent };
    });
    pruefe('Am Rechner: Unterweisungen als Feld auf ihrem Kasten im Blatt, ohne Karten und ohne Leiste darüber',
      imBlatt.drauf && imBlatt.karten === 0 && imBlatt.leiste === 0, JSON.stringify(imBlatt));
    pruefe('Über dem Blatt nur, was man darin tun kann: hineinschreiben, einen Tag anklicken',
      /Gestrichelt: hier direkt reinschreiben/.test(imBlatt.hinweis) && /anklicken: den Tag bearbeiten/.test(imBlatt.hinweis), imBlatt.hinweis);
    pruefe('Was ein Tag noch braucht, steht an ihm im Blatt', /noch gegenlesen · öffnen/.test(imBlatt.marke || ''), imBlatt.marke);
    // Das Blatt zeichnet sich beim Schreiben neu; die Stelle, an der man schreibt, bleibt stehen.
    await page.evaluate(() => document.querySelector('.blattfeld.feld-unterweisung').scrollIntoView({ block: 'center' }));
    const scrollVorher = await page.evaluate(() => document.querySelector('#tagbereich > .tagpanel.woche').scrollTop);
    await page.click('.blattfeld.feld-unterweisung');
    await page.keyboard.type('Unterweisung Brandschutz', { delay: 20 });
    await page.waitForTimeout(700);
    const scrollNachher = await page.evaluate(() => document.querySelector('#tagbereich > .tagpanel.woche').scrollTop);
    pruefe('Beim Schreiben ins Blatt springt die Ansicht nicht nach oben',
      scrollVorher > 100 && Math.abs(scrollNachher - scrollVorher) < 5, scrollVorher + ' → ' + scrollNachher);
    const geschrieben = await page.evaluate(() => ({
      blatt: [...document.querySelectorAll('.vorschaubuehne [data-feld="unterweisung"] .kasten')].pop().textContent,
      gespeichert: window.__wochendaten()['2026-09-07'].unterweisungen,
    }));
    pruefe('Ins Blatt geschrieben: steht im Vordruck und ist gespeichert',
      geschrieben.blatt.includes('Unterweisung Brandschutz') && geschrieben.gespeichert.includes('Unterweisung Brandschutz'),
      JSON.stringify(geschrieben));
    await page.click('.vorschaubuehne .tagkopf[data-datum="2026-09-09"]');
    await page.waitForTimeout(300);
    pruefe('Ein Tag im Blatt öffnet den Tag', await page.locator('#feld-2026-09-09').isVisible());

    // Ohne Text steht ein Tag nicht im Blatt. Über dem Blatt steht dann, dass er fehlt, und führt hin.
    await page.evaluate(() => window.__tagSetzen('2026-09-10', { text: '', stunden: 8 }));
    await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
    await page.waitForTimeout(600);
    const fehlt = await page.locator('.blattfehlt').textContent();
    pruefe('Ein Tag ohne Text steht über dem Blatt', /^Donnerstag ohne Text/.test(fehlt) &&
      !(await page.locator('.vorschaubuehne .tagkopf[data-datum="2026-09-10"]').count()), fehlt);
    await page.click('.blattfehlt');
    await page.waitForTimeout(300);
    pruefe('… und ein Klick öffnet ihn', await page.locator('#feld-2026-09-10').isVisible());

    // Beim Drucken ist die Seite so breit wie A4, schmaler als 820 px. Hinter dem Druckfenster
    // baute sich die Woche deshalb in die Anordnung fürs Handy um.
    await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
    await page.waitForTimeout(600);
    const anordnung = () => page.evaluate(() => document.querySelector('.tagflaeche.blattwoche').classList.contains('imblatt'));
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(400);
    const imDruck = await anordnung();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.waitForTimeout(400);
    const nachDruck = await anordnung();
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(400);
    const schmal = await anordnung();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(400);
    pruefe('Während des Drucks bleibt die Woche, wie sie war; ohne Druck baut sie für schmale Fenster um',
      imDruck && nachDruck && !schmal && await anordnung(), JSON.stringify({ imDruck, nachDruck, schmal }));
    pruefe('Keine JavaScript-Fehler (Rechner)', fehler.length === 0, fehler.join(' | '));
    await ctx.close();
  }

  /* ---------- Hell oder dunkel per Knopf ---------- */
  {
    /** Alle Farbvariablen, die ein :root-Block setzt, mit ihrem berechneten Wert. */
    const variablen = (page) => page.evaluate(() => {
      const namen = new Set();
      const sammeln = (regeln) => [...regeln].forEach((r) => {
        if (r.cssRules) sammeln(r.cssRules);
        if (r.style && /:root/.test(r.selectorText || '')) {
          [...r.style].filter((n) => n.startsWith('--')).forEach((n) => namen.add(n));
        }
      });
      [...document.styleSheets].forEach((s) => sammeln(s.cssRules));
      const st = getComputedStyle(document.documentElement);
      return Object.fromEntries([...namen].sort().map((n) => [n, st.getPropertyValue(n).trim()]));
    });
    const grundHell = (page) => page.evaluate(() => {
      const z = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      return (z[0] + z[1] + z[2]) / 3;
    });
    /** Den Knopf drücken und warten, bis die Kreisblende (View Transition) durch ist. */
    const umschalten = async (page) => {
      const vorher = await page.getAttribute('#btn-farbe', 'aria-pressed');
      await page.click('#btn-farbe');
      await page.waitForFunction((v) => document.getElementById('btn-farbe').getAttribute('aria-pressed') !== v, vorher);
      await page.waitForFunction(() => !document.documentElement.getAnimations({ subtree: true }).length &&
        !document.documentElement.classList.contains('farbwechsel'));
    };

    const ctx = await browser.newContext({ viewport: { width: 1300, height: 850 }, colorScheme: 'light' });
    const page = await ctx.newPage();
    const fehler = h.fehlerSammeln(page);
    await h.ohneRundgang(page);
    await h.oeffnen(page);
    await page.waitForTimeout(600);
    pruefe('Knopf für hell/dunkel in der Kopfleiste, auch ohne Woche', await page.locator('#btn-farbe').isVisible());
    pruefe('Gerät hell: Seite hell, Knopf zeigt den Mond',
      (await grundHell(page)) > 200 && (await page.locator('#btn-farbe .mond').isVisible()) &&
        (await page.getAttribute('#btn-farbe', 'aria-pressed')) === 'false');
    await umschalten(page);
    pruefe('Ein Klick: dunkel, gemerkt, Knopf zeigt die Sonne',
      (await grundHell(page)) < 40 && (await page.locator('#btn-farbe .sonne').isVisible()) &&
        (await page.getAttribute('#btn-farbe', 'aria-pressed')) === 'true' &&
        (await page.evaluate(() => localStorage.getItem('berichtsheft-farbe'))) === 'dunkel');
    const vonHand = await variablen(page);
    await page.reload();
    await page.waitForTimeout(600);
    pruefe('Nach dem Neuladen bleibt es dunkel', (await grundHell(page)) < 40 &&
      (await page.evaluate(() => document.documentElement.getAttribute('data-farbe'))) === 'dunkel');
    await umschalten(page);
    pruefe('Zurück auf hell wie das Gerät: nichts mehr gemerkt',
      (await grundHell(page)) > 200 && (await page.evaluate(() =>
        localStorage.getItem('berichtsheft-farbe') === null && !document.documentElement.hasAttribute('data-farbe'))));
    pruefe('Keine JavaScript-Fehler (hell/dunkel)', fehler.length === 0, fehler.join(' | '));
    await ctx.close();

    // Die Farben stehen zweimal in basis.css, einmal für das Gerät und einmal für den Knopf.
    const dunkel = await browser.newContext({ viewport: { width: 1300, height: 850 }, colorScheme: 'dark' });
    const seite = await dunkel.newPage();
    await h.ohneRundgang(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(600);
    const vomGeraet = await variablen(seite);
    const abweichend = Object.keys(vomGeraet).filter((n) => vomGeraet[n] !== vonHand[n]);
    pruefe('Dunkel per Knopf und dunkel vom Gerät haben dieselben Farben',
      Object.keys(vomGeraet).length > 20 && abweichend.length === 0, abweichend.join(', '));
    await umschalten(seite);
    pruefe('Gerät dunkel: ein Klick macht hell und merkt es',
      (await grundHell(seite)) > 200 && (await seite.evaluate(() => localStorage.getItem('berichtsheft-farbe'))) === 'hell');
    await dunkel.close();

    // Mit „Bewegung reduzieren“ keine Blende: Die Farbe wechselt im selben Klick, ohne Animation.
    const ruhig = await browser.newContext({ viewport: { width: 1300, height: 850 }, reducedMotion: 'reduce' });
    const still = await ruhig.newPage();
    await h.ohneRundgang(still);
    await h.oeffnen(still);
    await still.waitForTimeout(600);
    const sofort = await still.evaluate(() => {
      document.getElementById('btn-farbe').click();
      return { farbe: document.documentElement.getAttribute('data-farbe'),
        animationen: document.documentElement.getAnimations({ subtree: true }).length };
    });
    pruefe('Bewegung reduziert: Wechsel sofort, ohne Blende', sofort.farbe === 'dunkel' && sofort.animationen === 0,
      JSON.stringify(sofort));
    await ruhig.close();
  }

  /* ---------- Am Handy: kurze Überschrift, Meldung schwebt und geht ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await h.ohneRundgang(page);
    await h.oeffnen(page);
    await page.waitForTimeout(600);
    const leiste = page.locator('.fussleiste');
    const leer = await page.evaluate(() => ({
      mitte: document.getElementById('mitte').getBoundingClientRect().bottom, hoehe: innerHeight }));
    pruefe('Am Handy ohne Meldung keine Leiste: der Inhalt reicht bis unten',
      !(await leiste.isVisible()) && leer.mitte >= leer.hoehe - 1, JSON.stringify(leer));
    await page.click('#btn-beispiel');
    await page.waitForTimeout(300);
    const frisch = await page.evaluate(() => {
      const f = document.querySelector('.fussleiste');
      return { lage: getComputedStyle(f).position, stand: getComputedStyle(document.getElementById('speicherstand')).display };
    });
    pruefe('Die Meldung schwebt über dem Inhalt, ohne „gespeichert“',
      (await leiste.isVisible()) && frisch.lage === 'fixed' && frisch.stand === 'none', JSON.stringify(frisch));
    await page.waitForTimeout(4400);
    pruefe('Nach vier Sekunden ist sie von selbst weg', !(await leiste.isVisible()));
    await page.evaluate(() => window.__sage('Das hat nicht geklappt.', 'warn'));
    await page.waitForTimeout(4600);
    pruefe('Eine Warnung bleibt stehen', await leiste.isVisible());
    await page.click('#notiz');
    pruefe('Antippen schließt sie', !(await leiste.isVisible()));
    await page.evaluate(() => window.__sage('Neue Meldung.', ''));
    pruefe('Die nächste Meldung zeigt sich wieder', await leiste.isVisible());
    const wisch = await leiste.boundingBox();
    await page.evaluate(([x, y]) => {
      const f = document.querySelector('.fussleiste');
      const t = (yy) => new Touch({ identifier: 1, target: f, clientX: x, clientY: yy });
      f.dispatchEvent(new TouchEvent('touchstart', { touches: [t(y)], changedTouches: [t(y)], bubbles: true }));
      f.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(y + 60)], bubbles: true }));
    }, [wisch.x + 40, wisch.y + 10]);
    pruefe('Nach unten wischen schließt sie auch', !(await leiste.isVisible()));
    // „Zurück“ nach „Fertig“ steht rechts neben dem Text, nicht in einer eigenen Zeile darunter.
    await page.click('.tagpanel .uebernehmen');
    await page.waitForTimeout(300);
    const zurueck = await page.evaluate(() => {
      const f = document.querySelector('.fussleiste').getBoundingClientRect();
      const k = document.querySelector('#notiz .notizknopf').getBoundingClientRect();
      return { text: document.querySelector('#notiz .notizknopf').textContent, rechts: f.right - k.right,
        mitte: Math.abs((k.top + k.bottom) / 2 - (f.top + f.bottom) / 2) };
    });
    pruefe('„Zurück“ steht rechts in der Meldung', zurueck.text === 'Zurück' && zurueck.rechts < 60 && zurueck.mitte < 6,
      JSON.stringify(zurueck));
    await page.click('#notiz-zu');

    await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
    await page.waitForTimeout(900);
    const kopf = await page.evaluate(() => {
      const k = document.querySelector('.wochenspalte .sektion.wachsend .sektionskopf');
      return { text: k.innerText, hoehe: k.getBoundingClientRect().height };
    });
    pruefe('Am Handy: kurzer Titel „Unterweisungen und Schulungen“ in einer Zeile',
      kopf.text.trim() === 'Unterweisungen und Schulungen' && kopf.hoehe < 50, JSON.stringify(kopf));
    await ctx.close();
  }

  await browser.close();
  abschluss();
})();
