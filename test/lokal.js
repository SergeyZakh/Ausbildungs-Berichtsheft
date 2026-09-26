#!/usr/bin/env node
/**
 * Prüft die Einzeldatei dist/Berichtsheft.html so, wie sie weitergegeben
 * wird: per file://, ohne Netz, ohne Nachbardateien.
 *
 * Außerdem muss die Word-Bibliothek im Klartext eingebettet sein. Eine
 * als Zeichenkette abgelegte und per eval ausgeführte Bibliothek meldet
 * Windows Defender als Fund.
 *
 *   node test/lokal.js
 */
const fs = require('fs');
const { pathToFileURL } = require('url');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll("Einzeldatei: offline und ohne Zugriff nach außen");

(async () => {
  const browser = await h.starteBrowser();
  const quelle = fs.readFileSync(h.EINZELDATEI, 'utf8');

  // Verboten ist, was der Browser von sich aus holt: src= und <link href=. Ein <a href> holt
  // nichts – dort klickt ein Mensch. Deshalb getrennt geprüft, und zwar auch, wohin er zeigt.
  const holt = quelle.match(/(?:\bsrc\s*=\s*["']https?:|<link\b[^>]*\bhref\s*=\s*["']https?:)[^"']*/gi) || [];
  pruefe('Nichts in der Datei lädt von außen', holt.length === 0, holt.join(' | '));
  const links = quelle.match(/<a\b[^>]*\bhref\s*=\s*["']https?:[^"']*/gi) || [];
  pruefe('Nach außen zeigt nur der Link zum Projekt',
    links.length === 1 && /github\.com\/SergeyZakh\/berichtsheft/.test(links[0]), links.join(' | '));
  pruefe('Die Schrift liegt in der Seite',
    /@font-face[\s\S]{0,600}url\(data:font\/woff2;base64,/.test(quelle));
  pruefe('Bibliothek liegt im Klartext, nicht als ausgewertete Zeichenkette',
    !/\(0,\s*eval\)/.test(quelle) && !/\beval\s*\(\s*["'`]/.test(quelle));
  pruefe('Lizenzkopf steht in der Datei (die Schrift verlangt ihn)',
    /\/\*!\s[\s\S]{0,600}SIL Open Font License/.test(quelle) && /MIT-Lizenz/.test(quelle));
  pruefe('Keine Zeichenfolge, die den HTML-Parser aushebelt',
    !quelle.includes('<!--') && (quelle.match(/<\/script/gi) || []).length === 2,
    (quelle.match(/<\/script/gi) || []).length + '× </script');

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await h.ohneRundgang(page);
  const jsFehler = h.fehlerSammeln(page);
  const dateien = h.downloadsSammeln(page);

  // Jeden Zugriff nach draußen abfangen und mitschreiben.
  const versuche = [];
  await page.route(/^https?:\/\//, (r) => { versuche.push(r.request().url()); r.abort(); });
  await h.oeffnen(page, pathToFileURL(h.EINZELDATEI).href);
  await page.waitForTimeout(900);

  pruefe('Word-Bibliothek ist geladen',
    await page.evaluate(() => typeof window.docx === 'object' && !!window.docx.Packer));
  pruefe('Oberfläche ist aufgebaut',
    (await page.locator('header.leiste').count()) === 1 &&
    (await page.locator('.leerbild h2').count()) === 1);

  const signatur = await page.locator('.signatur').innerText();
  pruefe('Die Fußleiste nennt Projekt, Autor, Zweck und Lizenz',
    /Berichtsheft/.test(signatur) && /Sergey Zakharov/.test(signatur) &&
    /Azubis und Ausbilder/.test(signatur) && /MIT/.test(signatur), signatur);

  await page.setInputFiles('#datei', h.testdatei('kimai-test.csv'));
  await page.waitForTimeout(900);
  pruefe('CSV wird eingelesen', (await page.locator('#notiz').textContent()).includes('geladen'));

  await page.click('#btn-export');
  await page.click('#btn-wochenblatt');
  await h.exportTrotzdem(page);
  const datei = await h.warteAufDatei(dateien, 'Wochenblatt');
  pruefe('Wochenblatt wird ohne Netz erzeugt',
    !!datei && datei.daten.length > 5000, datei ? datei.daten.length + ' Bytes' : 'keine Datei');

  // Die übrigen Wege, auf denen Daten die Seite verlassen könnten. Das README verspricht,
  // dass außer zum eigenen Ollama nichts hinausgeht; den KI-Weg prüft test/ki.js.
  const vorHeft = dateien.length;
  await page.click('#btn-export');
  await page.click('#btn-heft');
  await h.exportTrotzdem(page);
  pruefe('Gesamtheft wird ohne Netz erzeugt', !!(await h.warteAufDatei(dateien, 'Berichtsheft', vorHeft)));
  await page.evaluate(() => { window.print = () => {}; });   // Der Druckdialog hielte den Test an.
  for (const knopf of ['#btn-pdf-woche', '#btn-pdf-heft']) {
    await page.click('#btn-export');
    await page.click(knopf);
    await h.exportTrotzdem(page);
    await page.waitForTimeout(600);
  }
  await page.click('#btn-mehr');
  await page.click('#btn-sicherung');
  pruefe('Sicherung wird ohne Netz erzeugt', !!(await h.warteAufDatei(dateien, 'Berichtsheft-Sicherung-')));
  await h.stammdatenOeffnen(page);
  await page.click('#dlg-fertig');

  const beispiel = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await h.ohneRundgang(beispiel);
  await beispiel.route(/^https?:\/\//, (r) => { versuche.push(r.request().url()); r.abort(); });
  await h.oeffnen(beispiel, pathToFileURL(h.EINZELDATEI).href);
  await beispiel.waitForTimeout(600);
  await beispiel.click('#btn-beispiel');
  await beispiel.waitForTimeout(900);
  pruefe('Das Beispielheft lädt ohne Netz', (await beispiel.locator('.reiter button').count()) > 0);

  pruefe('Keine Anfrage nach draußen: Import, Word, PDF, Sicherung, Stammdaten, Beispiel',
    versuche.length === 0, versuche.join(' | '));

  // Gegenprobe: Die Falle muss eine Anfrage auch wirklich sehen, sonst hieße „keine“ nichts.
  const probe = [];
  await beispiel.unroute(/^https?:\/\//);
  await beispiel.route(/^https?:\/\//, (r) => { probe.push(r.request().url()); r.abort(); });
  await beispiel.evaluate(() => fetch('https://example.org/probe').catch(() => {}));
  await beispiel.waitForTimeout(300);
  pruefe('Gegenprobe: eine echte Anfrage wird erkannt', probe.length === 1, probe.join(' | '));
  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));

  await browser.close();
  abschluss();
})();
