#!/usr/bin/env node
/**
 * Nimmt die Bilder für das README auf, mit dem ausgedachten Beispielheft.
 *
 *   npm run build && node docs/bilder/aufnehmen.js
 *
 * Jedes Bild trägt nummerierte Marken (h.markieren), zu denen im Text eine Liste mit
 * denselben Nummern steht: README.md und docs/START.md. Wer hier eine Marke ändert,
 * ändert dort die Zeile mit. Fällt ein Element weg, bricht die Aufnahme ab.
 */
const path = require('path');
const h = require('../../test/hilfen');

const ziel = (name) => path.join(__dirname, name);

(async () => {
  const browser = await h.starteBrowser();

  // Die Einrichtung beim ersten Start, im zweiten Schritt mit ausgedachten Angaben.
  const erst = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await h.oeffnen(erst);
  await erst.waitForSelector('#dlg-einrichtung[open]');
  await erst.click('#er-weiter');
  await erst.fill('#w-vorname', 'Max');
  await erst.fill('#w-nachname', 'Muster');
  await erst.fill('#w-beruf', 'Fachinformatiker/in – Systemintegration');
  await erst.fill('#w-betrieb', 'Beispiel IT GmbH');
  await erst.evaluate(() => document.activeElement && document.activeElement.blur());
  await h.markieren(erst, [
    ['#er-punkte', 1, 'danach'],                                    // wie weit es noch ist
    ['.er-schritt[data-schritt="du"] .felder', 2, 'rechts'],        // die Angaben dieses Schritts
    ['#er-weiter', 3, 'davor'],                                     // weiter
  ]);
  await erst.screenshot({ path: ziel('einrichtung.png') });
  await erst.close();

  // Das Startbild nach der Einrichtung: Die Angaben stehen schon da.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.evaluate((s) => localStorage.setItem(s, JSON.stringify({ stamm: {
    name: 'Muster, Max', beruf: 'Fachinformatiker/in', betrieb: 'Beispiel IT GmbH',
    beginn: '2025-08-01', ende: '2028-07-31' } })), h.SPEICHER);
  await page.reload();
  await page.waitForTimeout(500);
  await h.markieren(page, [
    ['.leerbild .knopf.voll', 1, 'davor'],          // Zeiterfassung laden
    ['.leerbild .knopf:not(.voll)', 2, 'danach'],    // Selbst schreiben
    ['#btn-beispiel', 3, 'darunter'],                  // Beispiel ansehen
    ['#btn-mehr', 4, 'darunter'],          // Menü: Deine Daten, Übersicht, Sicherung, Rundgang
  ]);
  await page.screenshot({ path: ziel('start.png') });
  // Für die weiteren Bilder wie bisher ohne gespeicherten Stand.
  await page.evaluate((s) => localStorage.removeItem(s), h.SPEICHER);
  await page.reload();
  await page.waitForTimeout(500);

  await h.markieren(page, []);
  await page.click('#btn-beispiel');
  await page.waitForTimeout(800);
  await h.markieren(page, [
    ['.reiter button', 1, 'rechts'],                 // Montag bis Sonntag, Farbe zeigt den Stand
    ['.tagkarte .tagfelder', 2, 'unten-links'],      // Art des Tages und Stunden
    ['.tagflaeche .sektion.wachsend textarea', 3],   // Text, der ins Heft kommt
    ['.sektionsknopf.uebernehmen', 4, 'unten-rechts'],  // Fertig
    ['.sektion.posten', 5, 'rechts'],                // Buchungen aus dem Import
    ['#wochensumme', 6, 'danach'],                   // Stunden der Woche
  ]);
  await page.screenshot({ path: ziel('tag.png') });

  await h.markieren(page, []);
  await page.click('.reiter button >> nth=7');
  await page.waitForTimeout(900);
  await h.markieren(page, [
    ['#wochenlabel', 1, 'rechts'],             // Woche wählen: der Titel öffnet den Kalender
    ['#feld-abteilung', 2, 'rechts'],          // gilt für die ganze Woche
    ['#feld-unterweisungen', 3],
    ['.sektion.vorschau', 4],                  // so wird das Blatt gedruckt
    ['.seitenspalte .seitenkarte', 5],         // Umfang und KI
    ['#btn-export', 6, 'unten-links'],   // Wochenblatt oder Gesamtheft
  ]);
  await page.screenshot({ path: ziel('woche.png') });

  await h.markieren(page, []);
  await page.setInputFiles('#datei', h.testdatei('formate/clockify-mehrdeutig.csv'));
  await page.waitForSelector('#dlg-zuordnung[open]');
  await page.waitForTimeout(300);
  await h.markieren(page, [
    ['#zu-datum', 1, 'davor'],
    ['#zu-dauer', 2, 'danach'],
    ['#zu-beschreibung', 3, 'danach'],
    ['#zu-reihenfolge', 4, 'davor'],
    ['#zu-vorschau', 5, 'davor'],                       // die ersten Zeilen zur Kontrolle
  ]);
  await page.screenshot({ path: ziel('zuordnung.png') });

  await browser.close();
})();
