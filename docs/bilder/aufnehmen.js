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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.waitForTimeout(500);
  await h.markieren(page, [
    ['.leerbild .knopf.voll', 1, 'darunter'],          // Export laden
    ['#btn-beispiel', 2, 'darunter'],                  // Beispiel ansehen
    ['.leerbild .knopf:last-of-type', 3, 'darunter'],  // Ohne Export starten
    ['#btn-mehr', 4, 'darunter'],          // Weitere Aktionen: Sicherung, Deine Daten
  ]);
  await page.screenshot({ path: ziel('start.png') });

  await h.markieren(page, []);
  await page.click('#btn-beispiel');
  await page.waitForTimeout(800);
  await h.markieren(page, [
    ['.reiter button', 1, 'rechts'],                 // Montag bis Sonntag, Farbe zeigt den Stand
    ['.tagpanel > .sektion', 2],                     // Art des Tages und Stunden
    ['.tagflaeche .sektion.wachsend textarea', 3],   // Text, der ins Heft kommt
    ['.sektionsknopf.uebernehmen', 4, 'unten-rechts'],  // Entwurf oder fertig
    ['.sektion.posten', 5, 'rechts'],                // Buchungen aus dem Import
    ['#wochensumme', 6, 'davor'],                    // Stunden der Woche
  ]);
  await page.screenshot({ path: ziel('tag.png') });

  await h.markieren(page, []);
  await page.click('.reiter button >> nth=7');
  await page.waitForTimeout(900);
  await h.markieren(page, [
    ['#wochenlabel', 1, 'danach'],             // Woche wählen
    ['#feld-abteilung', 2, 'rechts'],          // gilt für die ganze Woche
    ['#feld-unterweisungen', 3],
    ['.sektion.vorschau', 4],                  // so wird das Blatt gedruckt
    ['.seitenspalte .seitenkarte', 5],         // Umfang, KI und Herunterladen
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
