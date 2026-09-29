#!/usr/bin/env node
/**
 * Am Handy: Die Seite ist offen, nichts ragt über den Rand, nichts liegt übereinander.
 *
 * Wer über einen geteilten Link kommt, sitzt meist am Handy. Früher sperrte dort eine Karte
 * das Werkzeug; die Handy-Ansicht darunter war nie geprüft und hatte Fehler: In der Woche war
 * die Vorschau halb so breit mit 640 px leerer Fläche darunter, die Wochenspalte ragte rechts
 * hinaus, die Meldung unten verdeckte drei Zeilen, und im Dialog „Spalten zuordnen“ saßen die
 * Knöpfe auf der Kante des scrollenden Bereichs.
 *
 * Geprüft wird bei 390 px (übliches Handy) und 320 px (kleinstes, das noch vorkommt).
 *
 *   node test/handy.js
 */
const path = require('path');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll('Am Handy: offen, nichts ragt heraus, nichts überlappt');

/**
 * Sichtbare Elemente, die links oder rechts über den Bildschirm ragen. Ausgenommen ist, was ein
 * Vorfahr mit overflow hidden/clip innerhalb des Bildschirms abschneidet (das verkleinerte Blatt).
 * Scrollende Kästen zählen mit: Seitliches Scrollen in einer Karte wäre am Handy genauso falsch.
 */
function ueberstand() {
  const w = window.innerWidth, raus = [];
  document.querySelectorAll('body *').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.display === 'none') return;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      if (/(hidden|clip)/.test(getComputedStyle(p).overflowX)) {
        const pr = p.getBoundingClientRect();
        if (pr.right <= w + 1 && pr.left >= -1) return;
      }
    }
    if (r.right > w + 1 || r.left < -1) {
      raus.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) +
        ' ' + Math.round(r.left) + '..' + Math.round(r.right));
    }
  });
  return raus.slice(0, 5);
}

/**
 * Nichts läuft unter den Leisten durch: Die Seite selbst scrollt nicht, Kopfleiste und
 * Fußleiste liegen außerhalb des einzigen Scrollbereichs .mitte, und kein Textfeld schneidet
 * seinen Text ab.
 */
function aufbau() {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const kopf = r('.leiste'), mitte = r('#mitte'), fuss = r('.fussleiste');
  const felder = [...document.querySelectorAll('.tagpanel textarea')]
    .filter((t) => t.offsetParent)
    .map((t) => t.scrollHeight - t.clientHeight);
  return {
    seiteScrollt: document.scrollingElement.scrollHeight > innerHeight + 1,
    kopfUeberMitte: kopf.bottom <= mitte.top + 1,
    fussUnterMitte: fuss.top >= mitte.bottom - 1,
    fussImBild: fuss.bottom <= innerHeight + 1,
    abgeschnitten: felder.filter((d) => d > 2),
  };
}

async function durchgang(browser, breite) {
  const ctx = await browser.newContext({
    viewport: { width: breite, height: 780 }, isMobile: true, hasTouch: true
  });
  const page = await ctx.newPage();
  const jsFehler = h.fehlerSammeln(page);
  const bei = ' (' + breite + ' px)';
  const nichtsRaus = async (wo) => {
    const raus = await page.evaluate(ueberstand);
    pruefe(wo + ': nichts ragt über den Rand' + bei, raus.length === 0, raus.join(' | '));
  };
  const nichtsDarunter = async (wo) => {
    const a = await page.evaluate(aufbau);
    pruefe(wo + ': nichts läuft unter den Leisten durch' + bei,
      !a.seiteScrollt && a.kopfUeberMitte && a.fussUnterMitte && a.fussImBild, JSON.stringify(a));
    pruefe(wo + ': kein Textfeld schneidet Text ab' + bei, a.abgeschnitten.length === 0, JSON.stringify(a.abgeschnitten));
  };
  await h.oeffnen(page);
  await page.waitForTimeout(600);

  // Beim ersten Start kommt die Einrichtung, am Handy im Vollbild; „Weiter“ steht im Bild.
  const einrichtung = await page.evaluate(() => {
    const d = document.getElementById('dlg-einrichtung');
    const r = d.getBoundingClientRect(), w = document.getElementById('er-weiter').getBoundingClientRect();
    return { offen: d.open, breite: r.width, hoehe: r.height, weiterUnten: w.bottom, bild: innerHeight, bildBreite: innerWidth };
  });
  pruefe('Einrichtung beim ersten Start, im Vollbild' + bei,
    einrichtung.offen && einrichtung.breite >= einrichtung.bildBreite - 1 && einrichtung.hoehe >= einrichtung.bild - 1 &&
    einrichtung.weiterUnten <= einrichtung.bild, JSON.stringify(einrichtung));
  await page.click('#er-weiter');
  await nichtsRaus('Einrichtung');
  await page.click('#er-spaeter');
  await page.waitForTimeout(300);

  // Sichtbar reicht nicht: Unter der alten Sperrkarte war der Knopf sichtbar, aber verdeckt.
  pruefe('Keine Sperre, der Startknopf ist klickbar' + bei, await page.evaluate(() => {
    const k = document.getElementById('btn-beispiel');
    const r = k.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === k;
  }));
  pruefe('Kein Rundgang am Handy' + bei, !(await page.locator('.onb-karte').isVisible().catch(() => false)));
  pruefe('Nach „Später“ bietet die Startkarte die Einrichtung an' + bei, await page.locator('#btn-leer-einrichtung').isVisible());
  await nichtsRaus('Start');

  // Dialog „Spalten zuordnen“: Der Fuß beginnt unter dem scrollenden Bereich, nicht darin.
  await page.setInputFiles('#datei', h.testdatei(path.join('formate', 'unbekannt.csv')));
  await page.waitForSelector('#dlg-zuordnung[open]', { timeout: 3000 }).catch(() => {});
  const dlg = await page.evaluate(() => {
    const d = document.getElementById('dlg-zuordnung');
    const k = d.querySelector('.dkoerper').getBoundingClientRect();
    const f = d.querySelector('.dfuss').getBoundingClientRect();
    const knopf = d.querySelector('#zu-nein').getBoundingClientRect();
    const box = d.getBoundingClientRect();
    return { koerperUnten: k.bottom, fussOben: f.top, knopfOben: knopf.top, dlgUnten: box.bottom, hoehe: innerHeight };
  });
  pruefe('Zuordnung: Knöpfe unter dem scrollenden Bereich' + bei,
    dlg.knopfOben >= dlg.koerperUnten + 8 && dlg.fussOben >= dlg.koerperUnten - 1, JSON.stringify(dlg));
  pruefe('Zuordnung: Dialog passt auf den Bildschirm' + bei, dlg.dlgUnten <= dlg.hoehe, JSON.stringify(dlg));
  await nichtsRaus('Zuordnung');
  await page.click('#zu-nein');
  await page.waitForTimeout(300);

  await h.oeffnen(page);
  await page.waitForTimeout(600);
  await page.click('#btn-beispiel');
  await page.waitForTimeout(1200);
  pruefe('Das Beispiel öffnet einen Tag' + bei, await page.locator('.tagpanel textarea').isVisible());
  pruefe('Am Handy keine Tasten an den Reitern' + bei, await page.evaluate(() =>
    [...document.querySelectorAll('#reiter button')].every((k) => getComputedStyle(k, '::before').content === 'none')));
  await nichtsRaus('Tag');
  await nichtsDarunter('Tag');
  // Die Wochentage saßen auf der Trennlinie der Kopfleiste, ihr oberer Rand war abgeschnitten.
  const reiter = await page.evaluate(() => {
    const leiste = document.querySelector('.leiste').getBoundingClientRect().bottom;
    const knoepfe = [...document.querySelectorAll('#reiter button')];
    const oben = Math.min(...knoepfe.map((k) => k.getBoundingClientRect().top));
    const raus = [];
    knoepfe.forEach((k) => {
      const r = k.getBoundingClientRect();
      k.querySelectorAll('*').forEach((c) => {
        const cr = c.getBoundingClientRect();
        if (cr.width && (cr.left < r.left + 1 || cr.right > r.right - 1)) raus.push(k.textContent.trim().slice(0, 12));
      });
    });
    return { abstand: oben - leiste, raus };
  });
  pruefe('Wochentage mit Abstand zur Kopfleiste' + bei, reiter.abstand >= 8, reiter.abstand.toFixed(1) + ' px');
  pruefe('Wochentage: kein Text über den Reiter hinaus' + bei, reiter.raus.length === 0, reiter.raus.join(' | '));
  // Die Summe füllt die erste Zeile bis zu den Knöpfen; vorher stand dazwischen eine leere Lücke.
  // Und auch bei 320 px bleibt es bei zwei Zeilen: Summe und Knöpfe, darunter die Woche.
  const kopf = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return { summeRechts: r('#wochensumme').right, knopfLinks: r('#btn-farbe').left,
      summeOben: r('#wochensumme').top, knopfOben: r('#btn-farbe').top, hoehe: r('.leiste').height };
  });
  pruefe('Kopfleiste: keine Lücke zwischen Summe und Knöpfen' + bei,
    kopf.knopfLinks - kopf.summeRechts <= 10 && Math.abs(kopf.summeOben - kopf.knopfOben) < 2, JSON.stringify(kopf));
  pruefe('Kopfleiste: zwei Zeilen' + bei, kopf.hoehe < 110, kopf.hoehe + ' px');
  // Tippen lässt das Feld mitwachsen, statt den Text in einen Scrollbalken zu schieben.
  await page.locator('.tagpanel textarea').first().press('End');
  await page.keyboard.type('\nNoch eine Zeile\nUnd noch eine\nUnd eine dritte');
  await page.waitForTimeout(200);
  await nichtsDarunter('Tag nach dem Tippen');
  await page.evaluate(() => document.getElementById('mitte').scrollTo(0, 99999));
  await page.waitForTimeout(200);
  await nichtsDarunter('Tag ganz unten');
  // Eine lange Meldung, wie nach einem Import; unten klebend darf sie höchstens zwei Zeilen belegen.
  const notiz = await page.evaluate(() => {
    const n = document.getElementById('notiz');
    n.textContent = 'Import fertig: 23 Tage mit 118 Buchungen übernommen, 4 Tage mit eigenem Text ' +
      'blieben unverändert. Neue Tage stehen als Entwurf da und brauchen noch „Fertig“.';
    return { hoehe: n.getBoundingClientRect().height, zeile: parseFloat(getComputedStyle(n).lineHeight) };
  });
  pruefe('Meldung unten höchstens zwei Zeilen' + bei, notiz.hoehe <= notiz.zeile * 2 + 2, JSON.stringify(notiz));
  await page.click('#notiz');
  const offen = await page.evaluate(() => document.getElementById('notiz').getBoundingClientRect().height);
  pruefe('Ein Tippen zeigt die ganze Meldung' + bei, offen > notiz.hoehe, offen + ' statt ' + notiz.hoehe);

  // Safari am iPhone zoomt beim Tippen in Felder unter 16 px; danach ließ sich „Deine Daten“
  // seitlich verschieben. Chromium zoomt nicht, deshalb wird die Ursache geprüft.
  const kleineFelder = await page.evaluate(() => [...document.querySelectorAll('input, select, textarea')]
    .filter((e) => e.type !== 'file' && e.type !== 'hidden' && parseFloat(getComputedStyle(e).fontSize) < 16)
    .map((e) => (e.id || e.className) + ' ' + getComputedStyle(e).fontSize));
  pruefe('Alle Eingabefelder mindestens 16 px, sonst zoomt Safari' + bei, kleineFelder.length === 0, kleineFelder.join(' | '));
  // Safari am iPhone vergrößerte die Schrift im Druck um rund 20 %; die Messung sah davon nichts.
  pruefe('Keine selbsttätige Schriftvergrößerung (text-size-adjust)' + bei, await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return (s.webkitTextSizeAdjust || s.textSizeAdjust) === '100%';
  }));
  // Safari auf iOS setzt den Druck rund 22 % zu groß; blatt.css gleicht das nur dort aus.
  // Chromium kennt -webkit-touch-callout nicht und kann den Druck nicht nachstellen, deshalb
  // wird die Regel selbst geprüft.
  pruefe('Druck unter iOS auf 82 % gesetzt (Ausgleich für Safari)' + bei, await page.evaluate(() => {
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    return /@supports\s*\(-webkit-touch-callout:\s*none\)\s*\{\s*#druck\s*\{\s*zoom:\s*\.82/.test(css);
  }));
  // Am iPhone druckt Safari enger als am Rechner; gemessen wird deshalb mit weniger Platz.
  pruefe('Druck am Handy mit Satzhöhe 251 mm' + bei, (await page.evaluate(() => window.__satzHoehe())) === 251);

  await page.click('#btn-mehr');
  pruefe('Kein Rundgang im Menü' + bei, !(await page.locator('#btn-hilfe').count()));
  await nichtsRaus('Menü');
  await page.click('#btn-mehr');

  await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
  await page.waitForTimeout(1200);
  const innen = await page.evaluate(() => document.querySelector('.tagflaeche.dreispaltig').clientWidth);
  const breiteVon = (sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().width, sel);
  for (const [name, sel] of [['Angaben der Woche', '.tagflaeche.dreispaltig > .wochenspalte'],
    ['Vorschau', '.tagflaeche.dreispaltig > .sektion.vorschau'],
    ['Karte „Wochenblatt“', '.tagflaeche.dreispaltig > .seitenspalte']]) {
    const b = await breiteVon(sel);
    pruefe('Woche: ' + name + ' genau so breit wie der Platz' + bei, Math.abs(b - innen) <= 1,
      Math.round(b) + ' von ' + innen + ' px');
  }
  // Die Bühne umschließt das verkleinerte Blatt; war sie so hoch wie die Desktop-Spalte breit,
  // blieb darunter eine große leere Fläche.
  const leer = await page.evaluate(() => {
    const b = document.querySelector('.tagflaeche.dreispaltig .vorschaubuehne');
    const r = b.querySelector('.bogenrahmen:last-child');
    return b.getBoundingClientRect().bottom - r.getBoundingClientRect().bottom;
  });
  pruefe('Woche: unter dem Blatt keine leere Fläche' + bei, leer < 60, Math.round(leer) + ' px');
  pruefe('Woche: der Umfang des Blatts steht neben der Vorschau' + bei,
    await page.locator('.seitenspalte .textstand').first().isVisible());
  await nichtsRaus('Woche');
  await nichtsDarunter('Woche');

  pruefe('Keine JavaScript-Fehler' + bei, jsFehler.length === 0, jsFehler.join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await h.starteBrowser();
  await durchgang(browser, 390);
  await durchgang(browser, 320);
  await browser.close();
  abschluss();
})();
