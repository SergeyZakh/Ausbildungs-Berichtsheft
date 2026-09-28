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
    const kaestchen = await page.evaluate(() =>
      [...document.querySelectorAll('#dlg-uebersicht .uraster .ukw')].map((k) => k.className.replace('ukw ', '')));
    pruefe('Ein Kästchen je Woche, im richtigen Zustand',
      kaestchen[0] === 'fertig' && kaestchen[1] === 'fertig' && kaestchen[2] === 'pruefen', kaestchen.slice(0, 5).join(','));
    const jahr = await page.locator('#dlg-uebersicht .ujahr h3').first().textContent();
    pruefe('Überschrift nennt das Ausbildungsjahr mit seinen echten Grenzen',
      jahr.startsWith('1. Ausbildungsjahr') && jahr.includes(beginn.split('-').reverse().join('.')), jahr);
    const tageZeile = await page.locator('#dlg-uebersicht .utage').first().textContent();
    pruefe('Urlaubstage werden gezählt', /1\s*Urlaub/.test(tageZeile), tageZeile);
    await page.locator('#dlg-uebersicht .ukw').nth(2).click();
    await page.waitForTimeout(700);
    pruefe('Ein Klick auf ein Kästchen öffnet die Woche und schließt die Übersicht',
      !(await page.locator('#dlg-uebersicht').isVisible()) &&
        (await page.evaluate((s) => JSON.parse(localStorage.getItem(s)).stand.woche, h.SPEICHER)) === letzte);

    // Nach einem Import erscheint er nicht: Er gehört zum Öffnen, nicht zu jeder Änderung.
    await page.setInputFiles('#datei', h.testdatei('kimai-test.csv'));
    await page.waitForTimeout(900);
    pruefe('Nach einem Import kein neuer Hinweis', !(await page.locator('#hinweise').isVisible()));
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
    pruefe('Übernommene Buchungen zeigen einen Haken',
      (await page.locator('.postenliste .pdazu.drin').count()) === 2);
    await plusKnoepfe.nth(2).click();
    pruefe('Zweimal dieselbe Zeile gibt es nicht', (await page.inputValue('.tagpanel textarea')) === text);
    const gespeichert = await page.evaluate((s) => { window.__merkenJetzt(); return JSON.parse(localStorage.getItem(s)).tage['2026-09-07'].text; }, h.SPEICHER);
    pruefe('Übernommenes wird gespeichert', gespeichert === text, gespeichert);

    await page.click('#wochenlabel');
    await page.waitForTimeout(250);
    const legende = await page.locator('#dlg-wochen .legende').innerText();
    pruefe('Kalender erklärt die Marken', /Entwurf/.test(legende) && /KI/.test(legende) && /eigener Text/.test(legende) &&
      /fertig/.test(legende) && /Text fehlt/.test(legende), legende);
    await page.click('#w-zu');

    await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
    await page.waitForTimeout(900);
    const blatt = await page.evaluate(() => {
      const b = document.querySelector('.vorschaubuehne .bogen');
      return getComputedStyle(b).backgroundColor;
    });
    pruefe('Dunkler Modus: das Blatt in der Vorschau bleibt weiß', blatt === 'rgb(255, 255, 255)', blatt);
    pruefe('Am Rechner steht der lange Titel der Unterweisungen',
      await page.locator('.wochenspalte .sektionskopf .lang').isVisible() &&
        !(await page.locator('.wochenspalte .sektionskopf .kurz').isVisible()));
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
    await page.click('#btn-farbe');
    pruefe('Ein Klick: dunkel, gemerkt, Knopf zeigt die Sonne',
      (await grundHell(page)) < 40 && (await page.locator('#btn-farbe .sonne').isVisible()) &&
        (await page.getAttribute('#btn-farbe', 'aria-pressed')) === 'true' &&
        (await page.evaluate(() => localStorage.getItem('berichtsheft-farbe'))) === 'dunkel');
    const vonHand = await variablen(page);
    await page.reload();
    await page.waitForTimeout(600);
    pruefe('Nach dem Neuladen bleibt es dunkel', (await grundHell(page)) < 40 &&
      (await page.evaluate(() => document.documentElement.getAttribute('data-farbe'))) === 'dunkel');
    await page.click('#btn-farbe');
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
    await seite.click('#btn-farbe');
    pruefe('Gerät dunkel: ein Klick macht hell und merkt es',
      (await grundHell(seite)) > 200 && (await seite.evaluate(() => localStorage.getItem('berichtsheft-farbe'))) === 'hell');
    await dunkel.close();
  }

  /* ---------- Am Handy: kurze Überschrift, Meldung wird leise ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await h.ohneRundgang(page);
    await h.oeffnen(page);
    await page.waitForTimeout(600);
    await page.click('#btn-beispiel');
    const zeile = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('notiz')).lineHeight));
    await page.waitForTimeout(8600);
    const still = await page.evaluate(() => {
      const n = document.getElementById('notiz');
      return { klasse: n.className, hoehe: n.getBoundingClientRect().height,
        leiste: getComputedStyle(n.closest('.fussleiste')).backgroundColor,
        flaeche: getComputedStyle(document.querySelector('.leiste .rundknopf')).backgroundColor };
    });
    pruefe('Nach acht Sekunden: Meldung auf einer Zeile', still.klasse.includes('still') && still.hoehe <= zeile + 2, JSON.stringify(still));
    pruefe('… und ohne farbige Leiste', still.leiste === still.flaeche, JSON.stringify(still));
    await page.click('#notiz');
    const ganz = await page.evaluate(() => document.getElementById('notiz').getBoundingClientRect().height);
    pruefe('Tippen zeigt sie wieder ganz', ganz > still.hoehe, ganz + ' statt ' + still.hoehe);

    await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
    await page.waitForTimeout(900);
    const kopf = await page.evaluate(() => {
      const k = document.querySelector('.wochenspalte .sektion.wachsend .sektionskopf');
      return { text: k.innerText, hoehe: k.getBoundingClientRect().height };
    });
    pruefe('Am Handy: kurzer Titel „Unterweisungen und Schulungen“ in einer Zeile',
      kopf.text.trim() === 'UNTERWEISUNGEN UND SCHULUNGEN' && kopf.hoehe < 50, JSON.stringify(kopf));
    await ctx.close();
  }

  await browser.close();
  abschluss();
})();
