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
 * Nichts läuft unter der Kopfleiste durch: Die Seite selbst scrollt nicht, die Kopfleiste liegt
 * außerhalb des einzigen Scrollbereichs .mitte, und kein Textfeld schneidet seinen Text ab. Eine
 * Fußleiste gibt es am Handy nicht: .mitte reicht bis unten, eine Meldung schwebt darüber.
 */
function aufbau() {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const kopf = r('.leiste'), mitte = r('#mitte'), fuss = r('.fussleiste');
  // Die Felder im Wochenblatt sind am Handy durchsichtig; geschrieben wird dort im großen Feld.
  const felder = [...document.querySelectorAll('.tagpanel textarea')]
    .filter((t) => t.offsetParent && !t.closest('.blattfeld'))
    .map((t) => t.scrollHeight - t.clientHeight);
  return {
    seiteScrollt: document.scrollingElement.scrollHeight > innerHeight + 1,
    kopfUeberMitte: kopf.bottom <= mitte.top + 1,
    // Am Handy weicht innerHeight in der Wochenansicht um bis zu zwei Pixel ab; eine Leiste wäre 28 px hoch.
    mitteBisUnten: mitte.bottom >= innerHeight - 3,
    meldungImBild: fuss.height === 0 || (fuss.top >= 0 && fuss.bottom <= innerHeight + 1),
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
    pruefe(wo + ': nichts läuft unter der Kopfleiste durch, der Inhalt reicht bis unten' + bei,
      !a.seiteScrollt && a.kopfUeberMitte && a.mitteBisUnten && a.meldungImBild, JSON.stringify(a));
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
  // Die Buchungen stehen unter dem Text und waren lang zu scrollen: Hat der Tag Text, sind sie
  // eingeklappt, im Kopf Zahl und Stunden in einer Zeile; aufgeklappt steht oben der Balken, wohin
  // die Zeit ging.
  const klapp = () => page.evaluate(() => {
    const s = document.querySelector('.sektion.posten'), k = s.querySelector('.sektionskopf');
    const mitten = [...k.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width).map((r) => (r.top + r.bottom) / 2);
    const leiste = s.querySelector('.zbleiste');
    return { zu: s.classList.contains('zu'), liste: !!s.querySelector('.postenliste').offsetParent,
      knopf: s.querySelector('.postenklapp').getAttribute('aria-expanded'), zahl: s.querySelector('.postenzahl').innerText,
      eineZeile: Math.max(...mitten) - Math.min(...mitten) < 6,
      legende: [...s.querySelectorAll('.zblegende span')].map((x) => x.textContent),
      balken: Math.round([...s.querySelectorAll('.zbleiste span')].reduce((n, x) => n + x.getBoundingClientRect().width, 0)),
      leiste: leiste ? Math.round(leiste.getBoundingClientRect().width) : 0 };
  });
  const zu = await klapp();
  pruefe('Buchungen mit Text eingeklappt, im Kopf Zahl und Stunden in einer Zeile' + bei,
    zu.zu && !zu.liste && zu.knopf === 'false' && zu.zahl.includes('7,75') && zu.eineZeile, JSON.stringify(zu));
  await page.locator('.sektion.posten .sektionskopf > span').first().tap();
  const auf = await klapp();
  pruefe('Ein Tipp auf den Kopf klappt auf, oben der Balken nach Projekt' + bei,
    !auf.zu && auf.liste && auf.knopf === 'true' && auf.legende.length === 4 &&
    auf.legende[0] === 'Infrastruktur 3,75\u00a0h' && Math.abs(auf.balken + 6 - auf.leiste) <= 2, JSON.stringify(auf));
  await nichtsRaus('Buchungen aufgeklappt');
  await page.locator('#reiter button').nth(1).click();
  await page.waitForTimeout(300);
  pruefe('Aufgeklappt bleibt aufgeklappt, auch am nächsten Tag' + bei, !(await klapp()).zu);
  // Nach dem Neuladen und ohne Text stehen sie offen: Dann braucht man sie zum Schreiben.
  await page.reload();
  await page.waitForSelector('#reiter button');
  await page.locator('#reiter button').nth(0).click();
  await page.waitForTimeout(300);
  const montag = await page.inputValue('.tagpanel textarea');
  await page.fill('.tagpanel textarea', '');
  await page.locator('#reiter button').nth(1).click();
  await page.waitForTimeout(200);
  const dienstag = (await klapp()).zu;
  await page.locator('#reiter button').nth(0).click();
  await page.waitForTimeout(200);
  pruefe('Ohne Text stehen die Buchungen offen, mit Text eingeklappt' + bei, !(await klapp()).zu && dienstag);
  await page.fill('.tagpanel textarea', montag);
  await page.evaluate(() => { const z = document.querySelector('.hinweiszu'); if (z) z.click(); const n = document.getElementById('notiz-zu'); if (n) n.click(); });
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
    return { summeRechts: r('#wochensumme').right, knopfLinks: r('#btn-zen').left,
      summeOben: r('#wochensumme').top, knopfOben: r('#btn-zen').top, hoehe: r('.leiste').height };
  });
  pruefe('Kopfleiste: keine Lücke zwischen Summe und Knöpfen' + bei,
    kopf.knopfLinks - kopf.summeRechts <= 10 && Math.abs(kopf.summeOben - kopf.knopfOben) < 2, JSON.stringify(kopf));
  pruefe('Kopfleiste: zwei Zeilen' + bei, kopf.hoehe < 110, kopf.hoehe + ' px');
  // Kalenderleiste: Jeder Tag gleich breit, auch ein leeres Wochenende, und angetippt springt nichts.
  // Vorher war es schmaler und wurde gewählt breit. Der Stand steht in der Farbe des Kreises.
  const kalender = async () => page.evaluate(() => {
    const tage = [...document.querySelectorAll('#reiter .tagreiter')];
    const farbe = (k) => getComputedStyle(k.querySelector('.rzahl')).backgroundColor;
    return { breiten: tage.map((k) => Math.round(k.getBoundingClientRect().width * 10) / 10),
      kreise: tage.map((k) => Math.round(k.querySelector('.rzahl').getBoundingClientRect().width)),
      zahlen: tage.map((k) => k.querySelector('.rzahl').textContent).join(' '),
      leer: farbe(tage[6]), pruefen: farbe(tage[4]), gewaehlt: farbe(tage.find((k) => k.getAttribute('aria-selected') === 'true')),
      name: tage[0].getAttribute('aria-label') };
  });
  const k1 = await kalender();
  await page.locator('#reiter .tagreiter').nth(5).click();
  await page.waitForTimeout(200);
  const k2 = await kalender();
  await page.locator('#reiter .tagreiter').nth(0).click();
  await page.waitForTimeout(200);
  pruefe('Kalenderleiste: alle Tage gleich breit, gewählt oder nicht' + bei,
    new Set(k1.breiten.concat(k2.breiten)).size === 1 && new Set(k1.kreise).size === 1 && k1.zahlen === '7 8 9 10 11 12 13',
    JSON.stringify([k1.breiten, k2.breiten, k1.zahlen]));
  pruefe('Kalenderleiste: Kreis rot zum Gegenlesen, leer ohne Farbe, gewählt ausgefüllt' + bei,
    k1.leer === 'rgba(0, 0, 0, 0)' && k1.pruefen !== k1.leer && k1.gewaehlt !== k1.pruefen && k2.gewaehlt !== k1.leer,
    JSON.stringify(k1) + ' ' + k2.gewaehlt);
  pruefe('Kalenderleiste: Vorleser hören Tag, Stand und Stunden' + bei,
    k1.name === 'Montag, 07.09., Entwurf: noch unverändert aus dem Import, 7,75 h', k1.name);
  // Tippen lässt das Feld mitwachsen, statt den Text in einen Scrollbalken zu schieben.
  await page.locator('.tagpanel textarea').first().press('End');
  await page.keyboard.type('\nNoch eine Zeile\nUnd noch eine\nUnd eine dritte');
  await page.waitForTimeout(200);
  await nichtsDarunter('Tag nach dem Tippen');
  await page.evaluate(() => document.getElementById('mitte').scrollTo(0, 99999));
  await page.waitForTimeout(200);
  await nichtsDarunter('Tag ganz unten');
  // Eine lange Meldung, wie nach einem Import: Sie schwebt ganz lesbar über dem Inhalt, statt
  // unten eine Leiste zu belegen.
  await page.evaluate(() => window.__sage('Import fertig: 23 Tage mit 118 Buchungen übernommen, 4 Tage mit ' +
    'eigenem Text blieben unverändert. Neue Tage stehen als Entwurf da und brauchen noch „Fertig“.', 'gut'));
  const schwebt = await page.evaluate(() => {
    const f = document.querySelector('.fussleiste'), n = document.getElementById('notiz'), r = f.getBoundingClientRect();
    return { lage: getComputedStyle(f).position, oben: r.top, unten: r.bottom, links: r.left, rechts: r.right,
      ganz: n.scrollHeight <= n.clientHeight + 1, mitte: document.getElementById('mitte').getBoundingClientRect().bottom };
  });
  pruefe('Meldung schwebt ganz lesbar über dem Inhalt, der bis unten reicht' + bei,
    schwebt.lage === 'fixed' && schwebt.ganz && schwebt.unten <= 780 && schwebt.links >= 8 &&
    schwebt.rechts <= breite - 8 && schwebt.mitte >= 779, JSON.stringify(schwebt));
  await nichtsRaus('Mit Meldung');
  await page.click('#notiz-zu');
  pruefe('× schließt die Meldung' + bei, !(await page.locator('.fussleiste').isVisible()));

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
  const innen = await page.evaluate(() => document.querySelector('.tagflaeche.blattwoche').clientWidth);
  const breiteVon = (sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().width, sel);
  const b = await breiteVon('.tagflaeche.blattwoche > .sektion.vorschau');
  pruefe('Woche: das Blatt genau so breit wie der Platz' + bei, Math.abs(b - innen) <= 1,
    Math.round(b) + ' von ' + innen + ' px');
  // Die ganze Woche in einer Zeile; die Woche stand vorher breit in einer zweiten.
  const zeile = await page.evaluate(() => {
    const k = [...document.querySelectorAll('#reiter button')].map((b) => b.getBoundingClientRect());
    return { eineZeile: Math.max(...k.map((r) => r.top)) < Math.min(...k.map((r) => r.bottom)),
      hoehe: Math.round(Math.max(...k.map((r) => r.bottom)) - Math.min(...k.map((r) => r.top))) };
  });
  pruefe('Woche: alle Reiter in einer Zeile' + bei, zeile.eineZeile && zeile.hoehe < 70, JSON.stringify(zeile));
  // Die Bühne umschließt das verkleinerte Blatt; war sie so hoch wie die Desktop-Spalte breit,
  // blieb darunter eine große leere Fläche.
  const leer = await page.evaluate(() => {
    const b = document.querySelector('.tagflaeche.blattwoche .vorschaubuehne');
    const r = b.querySelector('.bogenrahmen:last-child');
    return b.getBoundingClientRect().bottom - r.getBoundingClientRect().bottom;
  });
  pruefe('Woche: unter dem Blatt keine leere Fläche' + bei, leer < 60, Math.round(leer) + ' px');
  // Eine lange Woche braucht zwei Blätter. Die Bühne war am Handy auf 80vh begrenzt, die Karte
  // darum schnitt ab: Das zweite Blatt war halb weg, und weiter scrollen ging nicht.
  const vorherFreitag = await page.evaluate(() => window.__tage()['2026-09-11'].text);
  await page.evaluate((t) => window.__tagSetzen('2026-09-11', { text: t + '\n' + Array(24).fill('Noch eine Zeile').join('\n') }), vorherFreitag);
  await page.evaluate(() => { const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
  await page.waitForTimeout(1200);
  const zwei = await page.evaluate(() => {
    const m = document.getElementById('mitte');
    m.scrollTo(0, 99999);
    const karte = document.querySelector('.tagflaeche.blattwoche > .sektion.vorschau').getBoundingClientRect();
    const boegen = [...document.querySelectorAll('.vorschaubuehne .bogenrahmen')].map((b) => b.getBoundingClientRect());
    const letztes = boegen[boegen.length - 1];
    return { blaetter: boegen.length, letztesUnten: Math.round(letztes.bottom), karteUnten: Math.round(karte.bottom),
      sichtUnten: Math.round(m.getBoundingClientRect().bottom), fenster: window.scrollY };
  });
  pruefe('Woche mit zwei Blättern: beide ganz zu sehen und bis unten scrollbar' + bei,
    zwei.blaetter === 2 && zwei.letztesUnten <= zwei.karteUnten && zwei.letztesUnten <= zwei.sichtUnten && zwei.fenster === 0,
    JSON.stringify(zwei));
  await page.evaluate((t) => window.__tagSetzen('2026-09-11', { text: t }), vorherFreitag);
  await page.evaluate(() => { document.getElementById('mitte').scrollTo(0, 0); const r = document.querySelectorAll('#reiter button'); r[r.length - 1].click(); });
  await page.waitForTimeout(1200);
  // Stand und Export stehen in der Kopfleiste; eine eigene Leiste darüber war doppelt.
  pruefe('Woche: keine Leiste und keine Karten, die Felder liegen im Blatt' + bei,
    !(await page.locator('.wochenstand').count()) && !(await page.locator('.wochenspalte').count()) &&
    await page.locator('.blattfeld.feld-unterweisung').isVisible());
  await nichtsRaus('Woche');
  await nichtsDarunter('Woche');
  // Im verkleinerten Blatt tippt man nicht: Ein Tipp öffnet das Feld groß, von unten.
  await page.locator('.blattfeld.feld-unterweisung').tap();
  // Gleich nach dem Tipp steht das Blatt noch unten und fährt herein; der Fokus hatte es früher
  // sofort ins Bild geschoben, das Hereinfahren war nicht zu sehen.
  const kommt = await page.evaluate(() => {
    const b = document.querySelector('#dlg-schreiben .schreiben-blatt');
    return { unten: Math.round(b.getBoundingClientRect().top) > innerHeight * 0.8,
      faehrt: b.getAnimations().some((a) => a.transitionProperty === 'transform' && a.playState === 'running') };
  });
  pruefe('Woche: das große Feld fährt von unten herein' + bei, kommt.unten && kommt.faehrt, JSON.stringify(kommt));
  await h.schreibfeldSteht(page);
  const gross = await page.evaluate(() => {
    const d = document.getElementById('dlg-schreiben'), r = d.querySelector('.schreiben-blatt').getBoundingClientRect();
    return { offen: d.open, oben: Math.round(r.top), unten: Math.round(r.bottom), bild: innerHeight,
      titel: document.getElementById('schreiben-titel').textContent,
      fokus: document.activeElement && document.activeElement.id };
  });
  // Am Touchgerät holt erst ein Tipp ins Textfeld die Tastatur: Kämen beide zugleich, sprang das Feld.
  pruefe('Woche: ein Tipp aufs Feld öffnet es groß, unten im Bild, noch ohne Tastatur' + bei,
    gross.offen && Math.abs(gross.unten - gross.bild) <= 1 && gross.oben > gross.bild / 3 && gross.fokus === 'dlg-schreiben' &&
    gross.titel === 'Unterweisungen und Schulungen', JSON.stringify(gross));
  // Wischen daneben schiebt die Seite dahinter nicht mit; sonst blieb unten eine Lücke.
  const gesperrt = await page.evaluate(() => getComputedStyle(document.getElementById('dlg-schreiben')).touchAction === 'none' &&
    getComputedStyle(document.getElementById('schreiben-text')).touchAction === 'pan-y');
  pruefe('Woche: hinter dem Feld scrollt nichts mit, im Textfeld schon' + bei, gesperrt);
  await nichtsRaus('Schreibfeld');
  // Am Griff nach oben ziehen: Das Blatt gibt ein Stück nach, darunter ist Blatt, nicht die Seite.
  const hoch = await page.evaluate(() => {
    const griff = document.querySelector('.schreiben-griff'), blatt = document.querySelector('.schreiben-blatt');
    const g = griff.getBoundingClientRect(), x = g.left + 10, y = g.top + 2;
    const t = (yy) => new Touch({ identifier: 1, target: griff, clientX: x, clientY: yy });
    griff.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(y)], changedTouches: [t(y)] }));
    for (let i = 1; i <= 10; i++) griff.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [t(y - 40 * i)], changedTouches: [t(y - 40 * i)] }));
    const r = { hoch: Math.round(innerHeight - blatt.getBoundingClientRect().bottom),
      darunter: blatt.contains(document.elementFromPoint(innerWidth / 2, innerHeight - 4)) };
    griff.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [] }));
    return r;
  });
  pruefe('Woche: hochgezogen gibt das Feld kaum nach, und darunter ist keine Lücke' + bei,
    hoch.hoch > 0 && hoch.hoch <= 40 && hoch.darunter, JSON.stringify(hoch));
  await h.schreibfeldSteht(page);
  // Safari ab iOS 26 meldet als sichtbar nur, was über seiner Leiste liegt, zeigt die Seite aber auch
  // darunter. Dort soll Blatt sein, nicht die helle Seite: hier nachgestellt mit einem kürzeren Dialog.
  const leiste = await page.evaluate(async () => {
    const d = document.getElementById('dlg-schreiben'), blatt = d.querySelector('.schreiben-blatt'), vorher = d.style.height;
    d.style.height = (innerHeight - 60) + 'px';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const r = { unten: Math.round(blatt.getBoundingClientRect().bottom), bild: innerHeight,
      mitte: blatt.contains(document.elementFromPoint(innerWidth / 2, innerHeight - 4)),
      rand: blatt.contains(document.elementFromPoint(2, innerHeight - 30)) };
    d.style.height = vorher;
    return r;
  });
  pruefe('Woche: unter einer Browserleiste geht das Feld bis ganz nach unten weiter' + bei,
    leiste.unten === leiste.bild - 60 && leiste.mitte && leiste.rand, JSON.stringify(leiste));
  await page.fill('#schreiben-text', 'Unterweisung Arbeitssicherheit');
  await page.click('#schreiben-fertig');
  // Es fährt erst hinaus, dann ist es zu; vorher verschwand es von einem Bild aufs nächste.
  const geht = await page.evaluate(() => {
    const d = document.getElementById('dlg-schreiben'), b = d.querySelector('.schreiben-blatt');
    return { offen: d.open, geht: d.classList.contains('geht'),
      faehrt: b.getAnimations().some((a) => a.transitionProperty === 'transform') };
  });
  pruefe('Woche: „Fertig“ lässt das Feld nach unten hinausfahren' + bei,
    geht.offen && geht.geht && geht.faehrt, JSON.stringify(geht));
  await page.waitForTimeout(500);
  const danach = await page.evaluate(() => ({
    offen: document.getElementById('dlg-schreiben').open,
    feld: document.getElementById('feld-unterweisungen').value,
    blatt: [...document.querySelectorAll('.vorschaubuehne [data-feld="unterweisung"] .kasten')].pop().textContent,
  }));
  pruefe('Woche: Geschriebenes steht danach im Blatt' + bei,
    !danach.offen && danach.feld === 'Unterweisung Arbeitssicherheit' && danach.blatt.includes('Unterweisung Arbeitssicherheit'),
    JSON.stringify(danach));

  await page.setInputFiles('#datei', path.join(__dirname, 'daten', 'formate', 'kimai-schule.csv'));
  await page.waitForTimeout(700);
  pruefe('Nach dem Import: Karte oben mit „Spalten prüfen“, keine schwebende Meldung darüber' + bei,
    (await page.locator('#hinweise .hinweis').isVisible()) && !(await page.locator('.fussleiste').isVisible()) &&
    (await page.locator('#hinweise button', { hasText: 'Spalten prüfen' }).count()) === 1);
  // Kurz: eine Zeile Text, die Tage zum Abhaken, eine Zeile Knöpfe. Vorher fast der halbe Bildschirm.
  const karte = await page.evaluate(() => {
    const k = document.querySelector('#hinweise .hinweis');
    const kn = [...k.querySelectorAll('.hinweisknoepfe > *')].map((b) => { const r = b.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2); });
    return { kurz: k.classList.contains('kurz'), hoehe: Math.round(k.getBoundingClientRect().height),
      tage: k.querySelectorAll('.schulwahl-zeile').length, knopfZeilen: new Set(kn).size };
  });
  // Bei 320 px rutscht „Spalten prüfen“ unter die beiden Knöpfe.
  pruefe('Nach dem Import: die Karte kurz, Knöpfe in einer Zeile' + bei,
    karte.kurz && karte.knopfZeilen <= (breite < 360 ? 2 : 1) && karte.hoehe < 90 + karte.tage * 26 + (breite < 360 ? 30 : 0),
    JSON.stringify(karte));
  await nichtsRaus('Mit Import-Karte');

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
