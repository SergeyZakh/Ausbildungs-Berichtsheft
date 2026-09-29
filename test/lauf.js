#!/usr/bin/env node
/**
 * Funktionstest: fährt die Oberfläche in einem echten Browser und prüft
 * das Ergebnis bis in das erzeugte Word-Dokument.
 *
 *   node test/lauf.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll("Oberfläche: von der CSV bis zum Word-Dokument");
const CSV = h.testdatei('kimai-test.csv');
const NAME = 'Mustermann, Max';

(async () => {
  const browser = await h.starteBrowser();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const jsFehler = h.fehlerSammeln(page);
  const dateien = h.downloadsSammeln(page);
  await h.ohneRundgang(page);
  await h.oeffnen(page);
  await page.waitForTimeout(1800);

  /* ---------- 1. Start ohne Daten ---------- */
  pruefe('Startet leer, ohne Beispieldaten',
    (await page.locator('.reiter button').count()) === 0,
    (await page.locator('.reiter button').count()) + ' Reiter');
  pruefe('Leerer Start erklärt, was zu tun ist',
    (await page.locator('.leerbild h2').count()) === 1);
  pruefe('Statuszeile steht fest im Fenster, nicht im Zeichenbereich',
    (await page.locator('footer .notiz#notiz').count()) === 1);

  /* ---------- 2. CSV einlesen ---------- */
  await page.setInputFiles('#datei', CSV);
  await page.waitForTimeout(900);
  const wochenText = await page.locator('#wochenlabel').textContent();
  pruefe('CSV geladen, neueste Woche aktiv',
    wochenText.includes('7.') && wochenText.includes('Sep'), wochenText);

  /* ---------- 3. Monatsraster ---------- */
  await page.click('#wochenlabel');
  await page.waitForTimeout(300);
  // Jede Kalenderwoche lässt sich öffnen; Wochen ohne Daten tragen die Klasse "neu".
  const anzahlWochen = await page.evaluate(() =>
    [...document.querySelectorAll('#wochenliste button')].filter((b) => !b.classList.contains('neu')).length);
  pruefe('Zwei Wochen aus dem Export erkannt', anzahlWochen === 2, 'gefunden: ' + anzahlWochen);
  pruefe('Monatsraster zeigt auch die Wochen ohne Zeiten, zum Öffnen',
    (await page.locator('#wochenliste button.neu:not([disabled])').count()) >= 1);
  pruefe('Jede Wochenzeile trägt sieben Tageszellen',
    (await page.locator('#wochenliste button >> nth=0 >> .wtag').count()) === 7);
  pruefe('Tageszellen zeigen ihren Zustand',
    (await page.locator('#wochenliste .wtag.voll, #wochenliste .wtag.offen').count()) >= 1);

  // Ein Werktag ganz ohne Eintrag ist eine Lücke – dieselbe Regel wie auf dem Server
  // (server/stand.js). Sonst sieht der Azubi eine grüne Woche, wo der Ausbilder eine
  // Lücke gemeldet bekommt: etwa an einem Urlaubstag, für den die Zeiterfassung nichts
  // liefert. Wochenenden und noch nicht erreichte Tage zählen nicht.
  const luecken = await page.evaluate(() => ({
    werktagVorbei: window.__fehlenderWerktag('2026-09-03'),
    sonntag: window.__fehlenderWerktag('2026-09-06'),
    zukunft: window.__fehlenderWerktag('2099-01-05'),
    vorDemErsten: window.__fehlenderWerktag('2026-08-28'),
  }));
  pruefe('Vergangener Werktag ohne Eintrag zählt als Lücke', luecken.werktagVorbei === true, JSON.stringify(luecken));
  pruefe('Wochenende zählt nicht als Lücke', luecken.sonntag === false, JSON.stringify(luecken));
  pruefe('Ein Tag in der Zukunft zählt nicht als Lücke', luecken.zukunft === false, JSON.stringify(luecken));
  // Ohne Ausbildungsbeginn fängt der Zeitraum beim ersten Eintrag an (hier 31.08.), sonst wären
  // die Werktage davor beim Azubi Lücken und beim Ausbilder nicht.
  pruefe('Werktag vor dem ersten Eintrag zählt nicht als Lücke', luecken.vorDemErsten === false, JSON.stringify(luecken));

  /* ---------- 4. Datumssuche ---------- */
  await page.fill('#wochensuche', '2026-09-02');
  await page.waitForTimeout(500);
  const nachSuche = await page.locator('#wochenlabel').textContent();
  pruefe('Datumssuche springt in die richtige Woche',
    nachSuche.includes('31.') || nachSuche.includes('Aug'), nachSuche);

  // Der Ring am Wochenreiter zählt den fehlenden Donnerstag (03.09.) mit: vier eingetragene
  // Tage plus die Lücke. Sonst zeigte er eine volle Woche, die zugleich nicht als fertig gilt.
  const wochenring = await page.locator('.reiter button >> nth=7 >> .ring').getAttribute('title');
  pruefe('Der Wochenring zählt den fehlenden Werktag mit',
    wochenring === '0 von 5 Tagen gegengelesen', wochenring);

  /* ---------- 5. Tagesansicht ---------- */
  await page.click('.reiter button >> nth=1');   // Dienstag, 01.09., zwei Lücken
  await page.waitForTimeout(300);
  pruefe('Keine Zeit- und Pausenfelder in der Tagesansicht',
    (await page.locator('.zeitfeld').count()) === 0);

  // 08:00–16:30 abzüglich 15 und 45 Minuten Pause = 7,50 Stunden.
  const stundenDi = await page.locator('.stdfeld').textContent();
  pruefe('Stunden aus Dauern summiert, Pausen abgezogen (7,50)', stundenDi === '7,50', stundenDi);
  pruefe('Stunden sind eine Anzeige, kein Eingabefeld',
    (await page.locator('input.stdfeld').count()) === 0);

  const zeiten = await page.locator('.postenliste .pzeit').allTextContents();
  const beginn = zeiten.map((z) => (z.match(/^(\d\d):(\d\d)/) || []).slice(1))
    .filter((t) => t.length).map((t) => +t[0] * 60 + +t[1]);
  pruefe('Buchungen stehen chronologisch, die früheste oben',
    beginn.every((m, i) => i === 0 || beginn[i - 1] <= m), JSON.stringify(zeiten));

  pruefe('Buchungen stehen offen neben dem Text',
    (await page.locator('.tagflaeche .sektion.posten .postenliste').count()) === 1);
  pruefe('Buchungen sind sichtbar',
    await page.locator('.sektion.posten .postenliste').isVisible());
  pruefe('Der Zeilenstand steht am Textfeld',
    /\d+ von rund \d+ Zeilen/.test(await page.locator('.textfuss').textContent()),
    await page.locator('.textfuss').textContent());

  /* ---------- 6. Text schreiben, Tag wechseln ---------- */
  await page.fill('.tagpanel textarea', 'Testeintrag Dienstag.');
  await page.waitForTimeout(300);
  await page.click('.reiter button >> nth=0');
  await page.waitForTimeout(250);
  await page.click('.reiter button >> nth=1');
  await page.waitForTimeout(250);
  pruefe('Text bleibt beim Tageswechsel erhalten',
    (await page.locator('.tagpanel textarea').inputValue()) === 'Testeintrag Dienstag.');

  /* ---------- 7. Art des Tages ---------- */
  await page.selectOption('.tagpanel select', 'Berufsschule');
  await page.waitForTimeout(400);
  pruefe('Berufsschule hat weiterhin ein Textfeld',
    (await page.locator('.tagpanel textarea').count()) === 1);
  pruefe('Beschriftung wechselt auf Unterrichtsthemen',
    (await page.locator('.sektion.wachsend .sektionskopf').textContent()).includes('Unterrichtsthemen'));
  pruefe('Bearbeitbare Bereiche sind abgesetzt',
    (await page.locator('.tagpanel .sektion').count()) >= 2,
    (await page.locator('.tagpanel .sektion').count()) + ' Sektionen');

  await page.selectOption('.tagpanel select', 'Urlaub');
  await page.waitForTimeout(400);
  pruefe('Urlaub blendet das Textfeld aus',
    (await page.locator('.tagpanel textarea').count()) === 0);
  await page.selectOption('.tagpanel select', 'Berufsschule');
  await page.waitForTimeout(400);

  /* ---------- 8. Layout beim Wochenwechsel ---------- */
  const vorher = await page.evaluate(() => document.querySelector('.reiter').getBoundingClientRect().top);
  await page.click('#woche-vor');
  await page.waitForTimeout(400);
  const nachher = await page.evaluate(() => document.querySelector('.reiter').getBoundingClientRect().top);
  pruefe('Reiterleiste springt beim Wochenwechsel nicht', vorher === nachher, vorher + ' / ' + nachher);

  /* ---------- 8b. Ohne Ausbildungsbeginn fragt der Export nach ---------- */
  await page.click('#btn-export');
  await page.click('#btn-wochenblatt');
  await page.waitForTimeout(300);
  const pruefliste = (await page.locator('#dlg-pruefung').isVisible())
    ? await page.locator('#pruef-liste').textContent() : '';
  pruefe('Export ohne Ausbildungsbeginn warnt vor leerem Ausbildungsjahr',
    pruefliste.includes('Ausbildungsjahr'), pruefliste.slice(0, 120));
  if (await page.locator('#dlg-pruefung').isVisible()) await page.click('#pruef-nein');
  await page.waitForTimeout(200);

  /* ---------- 9. Stammdaten ---------- */
  await h.stammdatenOeffnen(page);
  await h.stammFuellen(page, '#f-name', NAME);
  await h.stammFuellen(page, '#f-beruf', 'Fachinformatiker für Systemintegration');
  await h.stammFuellen(page, '#f-abteilung', 'Systemintegration');
  await h.stammFuellen(page, '#f-beginn', '2025-09-01');
  await h.stammFuellen(page, '#f-ende', '2028-08-31');
  await h.stammReiter(page, '#f-jahr');
  pruefe('Lehrjahr wird aus Vertragsbeginn und Berichtsdatum berechnet',
    /^2\. Ausbildungsjahr$/.test(await page.locator('#f-jahr').textContent()),
    await page.locator('#f-jahr').textContent());
  pruefe('Ausbildungs-Reiter passt ohne Scrollen in den Dialog', await page.evaluate(() => {
    const koerper = document.querySelector('#dlg-stamm .dkoerper');
    return koerper.scrollHeight <= koerper.clientHeight;
  }));
  await page.click('#dlg-fertig');
  await page.waitForTimeout(400);
  const gespeichert = await page.evaluate((schluessel) => {
    try { return JSON.parse(localStorage.getItem(schluessel)).stamm.name; } catch (e) { return null; }
  }, h.SPEICHER);
  pruefe('Stammdaten landen im Browserspeicher', gespeichert === NAME, gespeichert);

  /* ---------- 10. Wochenangaben ---------- */
  await page.click('.reiter button >> nth=7');
  await page.waitForTimeout(350);
  pruefe('Wochenreiter zeigt die Abteilung',
    (await page.locator('#feld-abteilung').inputValue()) === 'Systemintegration',
    await page.locator('#feld-abteilung').inputValue());
  await page.fill('#feld-unterweisungen', 'Unterweisung Arbeitssicherheit am Serverschrank.');
  await page.waitForTimeout(300);

  /* ---------- 11. Wochenblatt ---------- */
  await page.click('#woche-zurueck');
  await page.waitForTimeout(300);
  let ab = dateien.length;
  await page.click('#btn-export');
  await page.click('#btn-wochenblatt');
  await h.exportTrotzdem(page);
  const wochenblatt = await h.warteAufDatei(dateien, 'Wochenblatt', ab);
  pruefe('Wochenblatt wird erzeugt, Dateiname mit Nummer und Zeitraum',
    !!wochenblatt && /^Wochenblatt_Nr-\d+_\d{4}-\d{2}-\d{2}_bis_\d{4}-\d{2}-\d{2}\.docx$/.test(wochenblatt.name),
    wochenblatt ? wochenblatt.name : 'keine Datei');

  if (wochenblatt) {
    const docx = await h.docxLesen(wochenblatt.daten);
    const text = h.sichtbarerText(docx.dokument);
    const koepfe = docx.kopfzeilen.map(h.sichtbarerText);
    pruefe('Wochenblatt enthält den eingetippten Text', text.includes('Testeintrag Dienstag'));
    pruefe('Wochenblatt weist Berufsschule aus', text.includes('Berufsschule'));
    pruefe('Spaltenbreiten stehen fest im Dokument', docx.dokument.includes('<w:tblLayout w:type="fixed"/>'));
    pruefe('Wochenblatt hat kein Deckblatt', !text.includes('Ausbildungsfirma'));
    pruefe('Feld Betriebliche Tätigkeit vorhanden', text.includes('Betriebliche Tätigkeit'));
    pruefe('Feld Unterweisungen vorhanden', text.includes('Schulungsveranstaltungen'));
    pruefe('Feld Berufsschule vorhanden', text.includes('Unterrichtsthemen'));
    pruefe('Ausbildungsabteilung steht im Kopf', text.includes('Systemintegration'));
    pruefe('Zeitraum läuft Montag bis Sonntag', /\d\d\.\d\d\.\d{4} – \d\d\.\d\d\.\d{4}/.test(text));
    pruefe('Kopfleiste nennt die Ausbildungswoche', text.includes('Ausbildungswoche'));
    pruefe('Kopfleiste nennt Nummer und Ausbildungsjahr getrennt',
      /Nr\.\s*\d+/.test(text) && /Ausbildungsjahr\s*\d\./.test(text));
    pruefe('Drei Unterschriftsfelder',
      text.includes('Auszubildender / Datum') && text.includes('Ausbilder / Datum') &&
      text.includes('Gesetzlicher Vertreter / Datum'));
    // Der Nachweis fragt nach Tätigkeiten, nicht nach Zeiten.
    pruefe('Keine Uhrzeiten im Dokument', !/\d\d:\d\d/.test(text),
      (text.match(/\d\d:\d\d/g) || []).slice(0, 3).join(', '));
    pruefe('Keine Pausenangabe im Dokument', !/Pause/.test(text));
    pruefe('Keine Wochensumme im Dokument', !text.includes('Wochenstunden'));
    pruefe('Folgeseiten tragen eine Kopfzeile mit Name und Woche',
      koepfe.some((t) => t.includes('Ausbildungswoche') && t.includes('Mustermann')),
      koepfe.join(' | ').slice(0, 60));
    pruefe('Tagestext steht unter dem Wochentag', /Dienstag\s+•\s*Testeintrag Dienstag/.test(text),
      text.slice(text.indexOf('Dienstag'), text.indexOf('Dienstag') + 60));
    // Eingetippt ist "Testeintrag Dienstag." – im Nachweis steht er ohne Punkt.
    pruefe('Stichpunkte stehen ohne Punkt am Ende', !text.includes('Testeintrag Dienstag.'),
      text.slice(text.indexOf('Testeintrag'), text.indexOf('Testeintrag') + 30));
    const kopfFolge = ['Nr.', 'Ausbildungsjahr', 'Ausbildungswoche', 'Ausbildungsabteilung', 'Name']
      .map((etikett) => text.indexOf(etikett));
    pruefe('Kopfleiste von links: Nr., Jahr, Woche, Abteilung, Name',
      kopfFolge.every((stelle, i) => stelle >= 0 && (i === 0 || stelle > kopfFolge[i - 1])),
      kopfFolge.join(', '));
  }

  /* ---------- 12. Gesamtheft ---------- */
  ab = dateien.length;
  await page.click('#btn-export');
  await page.waitForTimeout(250);
  await page.click('#btn-heft');
  await h.exportTrotzdem(page);
  const heft = await h.warteAufDatei(dateien, 'Berichtsheft', ab);
  pruefe('Gesamtheft wird erzeugt, Dateiname mit Nummer und Zeitraum',
    !!heft && /^Berichtsheft_Nr-1(-\d+)?_\d{4}-\d{2}-\d{2}_bis_\d{4}-\d{2}-\d{2}\.docx$/.test(heft.name),
    heft ? heft.name : 'keine Datei');

  if (heft) {
    const text = h.sichtbarerText((await h.docxLesen(heft.daten)).dokument);
    pruefe('Gesamtheft hat ein Deckblatt', text.includes('Ausbildungsfirma'));
    pruefe('Deckblatt nennt den Vordruck', text.includes('wöchentliche Notierung'));
    pruefe('Deckblatt trägt die Stammdaten', text.includes(NAME));
    pruefe('Deckblatt hat das Feld für den gesetzlichen Vertreter', text.includes('Unterschrift der Eltern'));
    pruefe('Seite Ausbildungsgang vorhanden',
      text.includes('Ausbildungsgang') && text.includes('Arbeitsgebiet oder Sparte'));
    const wochenblaetter = text.match(/Ausbildungswoche\s+\d\d\.\d\d\.\d{4}/g) || [];
    pruefe('Gesamtheft enthält mehrere Wochen', wochenblaetter.length >= 2, wochenblaetter.length + ' Wochen');
    // In der Kopfleiste steht "53" unter "Nr.".
    const nummern = (text.match(/Nr\.\s*\d{1,3}\b/g) || []).map((n) => n.replace(/\D/g, ''));
    pruefe('Nummerierung zählt ab Ausbildungsbeginn',
      nummern.some((n) => /^(4[0-9]|5[0-9])$/.test(n)), nummern.slice(0, 3).join(', '));
  }

  /* ---------- 13. Entwurf aus einem kleinteiligen Export ---------- */
  await page.setInputFiles('#datei', h.testdatei('kimai-detailliert.csv'));
  await page.waitForTimeout(900);
  const entwurf = () => page.locator('.tagpanel textarea').inputValue();

  const voll = await entwurf();
  const positionen = voll.split('\n').filter(Boolean);
  pruefe('Der Entwurf bleibt auf Blattgröße gedeckelt (ENTWURF_MAX)',
    positionen.length > 0 && positionen.length <= 10, positionen.length + ' Zeilen');
  pruefe('Auch die kürzesten Buchungen sind drin',
    voll.includes('Mails gesichtet') && voll.includes('Wiki-Seite ergänzt'));
  pruefe('Doppelt Gebuchtes steht einmal',
    (voll.match(/Suchindex neu aufgebaut/g) || []).length === 1,
    String((voll.match(/Suchindex neu aufgebaut/g) || []).length));
  pruefe('Keine Uhrzeit im Entwurf', !/\d\d:\d\d/.test(voll), voll.slice(0, 60));

  await h.stammdatenOeffnen(page);
  const stammGeometrien = [];
  for (const ziel of ['person', 'ausbildung', 'verarbeitung', 'ki', 'gefahr']) {
    await page.click('.blattleiste button[data-ziel="' + ziel + '"]');
    await page.waitForTimeout(60);
    stammGeometrien.push(await page.evaluate(() => {
      const d = document.getElementById('dlg-stamm').getBoundingClientRect();
      const b = document.querySelector('#dlg-stamm .dkoerper').getBoundingClientRect();
      return [Math.round(d.width), Math.round(d.height), Math.round(b.height)];
    }));
  }
  pruefe('Stammdaten-Dialog bleibt bei jedem Reiter gleich groß',
    stammGeometrien.every((x) => x.join() === stammGeometrien[0].join()), JSON.stringify(stammGeometrien));
  await h.stammFuellen(page, '#f-ausblenden', 'Allgemein, Dokumentation');
  await page.locator('#f-ausblenden').dispatchEvent('change');
  await page.waitForTimeout(300);
  await page.click('#dlg-fertig');
  await page.waitForTimeout(400);
  const gefiltert = await entwurf();
  pruefe('Ausnahmeliste hält genannte Projekte heraus',
    !gefiltert.includes('Mails gesichtet') && !gefiltert.includes('Wiki-Seite'), gefiltert.slice(0, 60));
  pruefe('Ausnahmeliste lässt die übrigen Positionen stehen',
    gefiltert.split('\n').filter(Boolean).length === 5,
    gefiltert.split('\n').filter(Boolean).length + ' Zeilen');

  /* ---------- 14. Die Liste steht auch im Dokument ---------- */
  ab = dateien.length;
  await page.click('#btn-export');
  await page.click('#btn-wochenblatt');
  await h.exportTrotzdem(page);
  const listenblatt = await h.warteAufDatei(dateien, 'Wochenblatt', ab);
  pruefe('Wochenblatt mit Liste wird erzeugt', !!listenblatt);
  if (listenblatt) {
    const xml = (await h.docxLesen(listenblatt.daten)).dokument;
    const text = h.sichtbarerText(xml);
    pruefe('Jede Position steht im Dokument',
      text.includes('Suchindex neu aufgebaut') && text.includes('VLAN-Grundlagen') &&
      text.includes('Abbruch beim Import großer Dateien behoben'));
    pruefe('Positionen stehen als eigene Absätze, nicht als Fließtext',
      (xml.match(/<w:p[ >]/g) || []).length > 20, (xml.match(/<w:p[ >]/g) || []).length + ' Absätze');
    pruefe('Auch im Dokument keine Uhrzeit', !/\d\d:\d\d/.test(text));
  }

  /* ---------- 15. Eine volle Woche bleibt auf einer Seite ---------- */
  await page.setInputFiles('#datei', h.testdatei('kimai-volle-woche.csv'));
  await page.waitForTimeout(1000);

  // Der Import ergänzt das Heft: Die spätere Woche bleibt aktiv.
  pruefe('Ein zweiter Export wirft den ersten nicht weg',
    (await page.locator('#wochenlabel').textContent()).includes('Sep'),
    await page.locator('#wochenlabel').textContent());
  await page.click('#wochenlabel');
  await page.waitForTimeout(300);
  await page.fill('#wochensuche', '2026-09-01');
  await page.waitForTimeout(600);
  pruefe('Datumssuche findet die Woche aus dem älteren Export',
    (await page.locator('#wochenlabel').textContent()).includes('31.'),
    await page.locator('#wochenlabel').textContent());

  const reiterKlicken = (i) => page.evaluate((n) => {
    const r = document.querySelectorAll('#reiter button');
    r[n < 0 ? r.length + n : n].click();
  }, i);
  await reiterKlicken(-1);   // Wochenreiter
  await page.waitForTimeout(400);
  await page.fill('#feld-unterweisungen', 'Künstliche Intelligenz - Einweisung');
  await page.waitForTimeout(300);

  const druckeWoche = async () => {
    await page.evaluate(() => document.getElementById('btn-export').click());
    await page.waitForTimeout(150);
    await page.evaluate(() => document.getElementById('btn-pdf-woche').click());
    await h.exportTrotzdem(page);
    await page.waitForTimeout(700);
  };
  const pdfSeiten = async () => {
    const pdf = await page.pdf({ format: 'A4', printBackground: true,
      margin: { top: '16mm', right: '15mm', bottom: '16mm', left: '15mm' } });
    return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  };

  await druckeWoche();
  pruefe('Volle Woche wird enger gesetzt',
    (await page.locator('#druck .blatt.dicht-2').count()) === 1,
    await page.locator('#druck .blatt').getAttribute('class'));
  const seiten = await pdfSeiten();
  pruefe('Volle Woche passt auf eine Seite', seiten === 1, seiten + ' Seiten');
  // Am iPhone blieben rund 174 mm Satzbreite; der Zeitraum brach um, die Etiketten liefen
  // ineinander. Gemessen wird deshalb bei 170 mm.
  const kopfZeilen = await page.evaluate(() => {
    const m = document.getElementById('messung');
    m.style.width = '170mm';
    m.innerHTML = document.querySelector('#druck .blatt').outerHTML;
    const tds = [...m.querySelectorAll('.kopfleiste td')];
    const ergebnis = tds.map((td) => {
      const etikett = td.querySelector('span');
      const zeile = parseFloat(getComputedStyle(td).lineHeight) || parseFloat(getComputedStyle(td).fontSize) * 1.3;
      return { text: etikett.textContent, zuBreit: etikett.scrollWidth > td.clientWidth,
        zeilen: Math.round((td.getBoundingClientRect().height - etikett.getBoundingClientRect().height) / zeile) };
    });
    m.innerHTML = '';
    m.style.width = '';
    return ergebnis;
  });
  pruefe('Kopfleiste bei 170 mm: Zeitraum in einer Zeile',
    kopfZeilen[2].zeilen <= 1, JSON.stringify(kopfZeilen[2]));
  pruefe('Kopfleiste bei 170 mm: kein Etikett breiter als seine Spalte',
    kopfZeilen.every((k) => !k.zuBreit), JSON.stringify(kopfZeilen.filter((k) => k.zuBreit)));
  const druckKopf = await page.locator('#druck .blatt .kopfleiste td span').allTextContents();
  pruefe('Druck: Kopfleiste beginnt links mit Nr. und Ausbildungsjahr',
    druckKopf.join(' | ') === 'Nr. | Ausbildungsjahr | Ausbildungswoche | Ausbildungsabteilung | Name',
    druckKopf.join(' | '));

  /* ---------- 16. Überfüllte Woche wird in Blätter geteilt ---------- */
  await reiterKlicken(0);
  await page.waitForTimeout(250);
  const zuViel = Array.from({ length: 70 }, (_, i) =>
    'Systemarbeit: Ausführlicher Testeintrag Nummer ' + (i + 1) +
    ' mit zusätzlichem Kontext für den Seitenumbruch.').join('\n');
  await page.locator('.tagpanel textarea').fill(zuViel);
  await page.waitForTimeout(350);
  await druckeWoche();
  const druckseiten = await page.locator('#druck .blatt').evaluateAll((blatt) => blatt.map((x) => ({
    fortsetzung: x.classList.contains('fortsetzung'),
    taetigkeiten: x.querySelectorAll('.feld.gross').length,
    hatKopf: Boolean(x.querySelector('.kopfleiste'))
  })));
  pruefe('Überfüllte Woche wird in mehrere Druckseiten geteilt', druckseiten.length >= 2,
    druckseiten.length + ' Seiten');
  pruefe('Jede Druckseite hat genau einen Tätigkeitskasten und eine Kopfleiste',
    druckseiten.every((x) => x.taetigkeiten === 1 && x.hatKopf), JSON.stringify(druckseiten));
  pruefe('Folgeseiten sind als Fortsetzung markiert',
    druckseiten.slice(1).every((x) => x.fortsetzung), JSON.stringify(druckseiten));
  const seitenMehrseitig = await pdfSeiten();
  pruefe('Logische Druckseiten entsprechen den PDF-Seiten',
    seitenMehrseitig === druckseiten.length, seitenMehrseitig + ' PDF-Seiten');

  /* ---------- 16b. Die vollste Woche, die noch auf ein Blatt kommt ----------
     Am Grenzfall zeigt sich, ob die Messung reicht: Eine Woche, die das Werkzeug knapp als
     passend misst, darf beim Druck nicht auf eine zweite Seite ohne Kopfleiste laufen.
     Gesucht wird die größte Zeilenzahl, bei der noch ein einziges Blatt entsteht. Den engeren
     Druck am iPhone kann Chromium nicht nachstellen; dafür gilt am Handy eine eigene Satzhöhe
     (test/handy.js). */
  pruefe('Am Rechner gilt die Satzhöhe 264 mm', (await page.evaluate(() => window.__satzHoehe())) === 264);
  const blaetterBei = async (n) => {
    await page.locator('.tagpanel textarea').fill(Array.from({ length: n }, (_, i) =>
      'Systemarbeit: Testeintrag ' + (i + 1) + ' mit etwas Kontext für die Zeilenlänge im Blatt.').join('\n'));
    await page.waitForTimeout(250);
    await druckeWoche();
    return page.locator('#druck .blatt').count();
  };
  let wenig = 1, viel = 70;
  while (viel - wenig > 1) {
    const mitte = Math.floor((wenig + viel) / 2);
    if ((await blaetterBei(mitte)) === 1) wenig = mitte; else viel = mitte;
  }
  await blaetterBei(wenig);
  const grenzeRechner = await pdfSeiten();
  pruefe('Grenzfall (' + wenig + ' Zeilen, ein Blatt) passt am Rechner auf eine Seite', grenzeRechner === 1, grenzeRechner + ' Seiten');
  await blaetterBei(wenig + 1);
  const drueber = await pdfSeiten();
  pruefe('Eine Zeile mehr: zwei Blätter, jedes auf seiner eigenen Seite',
    drueber === (await page.locator('#druck .blatt').count()), drueber + ' Seiten');

  /* ---------- 17. Tastatur ---------- */
  await page.setInputFiles('#datei', CSV);   // zum Blättern braucht es zwei Wochen
  await page.waitForTimeout(900);
  await page.click('.reiter button >> nth=1');
  await page.waitForTimeout(300);

  await page.locator('.tagpanel textarea').first().click();
  await page.keyboard.press('Alt+ArrowLeft');
  await page.waitForTimeout(400);
  const nachAlt = await page.locator('#wochenlabel').textContent();
  await page.keyboard.press('Alt+ArrowRight');
  await page.waitForTimeout(400);
  pruefe('Alt und Pfeil blättern die Woche, auch aus dem Textfeld heraus',
    nachAlt !== (await page.locator('#wochenlabel').textContent()), nachAlt);

  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('3');
  await page.waitForTimeout(350);
  pruefe('Zifferntasten wählen den Tag',
    (await page.locator('.reiter button[aria-selected="true"] .rkurz').textContent()) === 'MI',
    await page.locator('.reiter button[aria-selected="true"] .rkurz').textContent());
  await page.keyboard.press('8');
  await page.waitForTimeout(350);
  pruefe('Taste 8 führt zu den Wochenangaben', (await page.locator('#feld-unterweisungen').count()) === 1);

  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  await page.locator('.tagpanel textarea').first().click();
  await page.keyboard.type('5');
  await page.waitForTimeout(300);
  pruefe('Im Textfeld bleibt die Ziffer eine Ziffer',
    (await page.locator('.tagpanel textarea').first().inputValue()).includes('5'));

  /* ---------- 18. Import: Modellausgabe ist kein eigener Text ----------
     Ein unveränderter KI-Text muss beim Import dem frischen Entwurf
     weichen, sonst gehen neu hinzugekommene Buchungen verloren. */
  {
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const seite = await kontext.newPage();
    await h.ohneRundgang(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(1000);
    await seite.setInputFiles('#datei', CSV);
    await seite.waitForTimeout(900);

    const tagKey = (await seite.locator('.tagpanel textarea').getAttribute('id')).replace('feld-', '');
    const frisch = await seite.locator('.tagpanel textarea').inputValue();

    /**
     * Einen gespeicherten Stand für diesen Tag unterschieben, neu laden und importieren.
     *
     * Gewartet wird auf bleibende Zustände im Datenmodell, nicht auf Sekunden und nicht auf
     * Meldungen in der Fußleiste: Feste Wartezeiten ließen die Seite auf langsamen Rechnern
     * einen Schritt hinterherhinken, und eine Meldung kann von der nächsten überschrieben
     * sein, bevor die Prüfung sie sieht. Beides war hier grün und auf dem Bau-Server rot.
     *
     * Der untergeschobene Tag trägt keine Buchungen; nach dem Import hat er welche. Daran
     * lässt sich beides zweifelsfrei erkennen – unabhängig davon, welcher Tag gerade offen ist.
     *
     * Vorher speichert die Seite, was noch aussteht: merken() schreibt 400 ms verzögert, und
     * fiel das zwischen Unterschieben und Neuladen, stand danach wieder der alte Text im
     * Speicher. Auf dem Bau-Server lief die Wartebedingung dann ab (zweimal in drei Läufen).
     */
    const standSetzen = async (stand) => {
      await seite.evaluate(([k, st, schluessel]) => {
        window.__merkenJetzt();
        const roh = JSON.parse(localStorage.getItem(schluessel));
        roh.tage[k] = st;
        roh.stand = { woche: null, tag: 0 };
        localStorage.setItem(schluessel, JSON.stringify(roh));
      }, [tagKey, stand, h.SPEICHER]);
      await seite.reload();
      await seite.waitForFunction(([k, erwartet]) => {
        const t = window.__tage && window.__tage()[k];
        return !!t && t.text === erwartet && !(t.posten || []).length;
      }, [tagKey, stand.text]);
      await seite.setInputFiles('#datei', CSV);
      await seite.waitForFunction(
        (k) => {
          const t = window.__tage && window.__tage()[k];
          return !!t && (t.posten || []).length > 0;
        }, tagKey);
      return seite.locator('.tagpanel textarea').inputValue();
    };

    const KI = 'Sammelbegriff: Kurzfassung des Modells.';
    const nachKi = await standSetzen({ text: KI, art: '', entwurf: frisch, vorKi: frisch, kiText: KI });
    pruefe('KI-gekürzter Tag weicht beim Import dem frischen Entwurf', nachKi === frisch, nachKi.slice(0, 60));

    const nachHand = await standSetzen({ text: 'Von Hand nachgebessert.', art: '', entwurf: frisch, vorKi: frisch, kiText: KI });
    pruefe('Von Hand überarbeiteter Text überlebt den Import',
      nachHand === 'Von Hand nachgebessert.', nachHand.slice(0, 60));

    // Ältere Stände ohne kiText: gesetztes vorKi heißt Modellausgabe.
    const nachAlt2 = await standSetzen({ text: 'Alte Ausgabe ohne kiText.', art: '', entwurf: frisch, vorKi: frisch });
    pruefe('Alter Stand mit vorKi zählt nicht als selbst geschrieben', nachAlt2 === frisch, nachAlt2.slice(0, 60));

    const nachEigen = await standSetzen({ text: 'Ganz eigener Text ohne Modell.', art: '', entwurf: frisch });
    pruefe('Wirklich eigener Text gewinnt', nachEigen === 'Ganz eigener Text ohne Modell.', nachEigen.slice(0, 60));
    await kontext.close();
  }

  /* ---------- 19. Einrichtung beim ersten Start ---------- */
  {
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const seite = await kontext.newPage();
    // Als Datei: Nur dort lädt die Seite bei ganz leerem Speicher einmal neu.
    await seite.goto(h.DATEI_SEITE);
    await seite.waitForTimeout(1100);
    const gemerkt = () => seite.evaluate((s) => localStorage.getItem(s), h.RUNDGANG);
    const ladeart = () => seite.evaluate(() => performance.getEntriesByType('navigation')[0].type);
    const schritt = () => seite.evaluate(() => [...document.querySelectorAll('.er-schritt')].find((x) => !x.hidden).dataset.schritt);

    // Ein ganz leerer Speicher bei file:// kann ein abgekoppelter sein (speicherNeuLaden() in
    // grundlagen.js): Dann lädt die Seite genau einmal neu, und erst danach kommt die Einrichtung.
    pruefe('Erster Start mit leerem Speicher: die Seite lädt einmal neu', (await ladeart()) === 'reload', await ladeart());
    pruefe('Beim ersten Start kommt die Einrichtung, kein Rundgang',
      await seite.locator('#dlg-einrichtung').isVisible() && !(await seite.locator('#onboarding').isVisible()));
    pruefe('Sechs Schritte als Punkte, am Anfang ohne Zurück',
      (await seite.locator('#er-punkte li').count()) === 6 &&
      (await seite.evaluate(() => getComputedStyle(document.getElementById('er-zurueck')).visibility)) === 'hidden');

    await seite.click('#er-weiter');
    await seite.click('#er-weiter');
    pruefe('Ohne Pflichtangaben geht es nicht weiter, das Fehlende steht da',
      (await schritt()) === 'du' && (await seite.textContent('#er-fehlt')).includes('deinen Namen, den Ausbildungsberuf und den Betrieb'),
      await seite.textContent('#er-fehlt'));
    await seite.fill('#w-name', 'Muster, Max');
    await seite.fill('#w-beruf', 'Fachinformatiker/in – Systemintegration');
    await seite.fill('#w-betrieb', 'Beispiel IT GmbH');
    await seite.click('#er-weiter');
    await seite.fill('#w-beginn', '2025-09-01');
    await seite.fill('#w-ende', '2025-08-01');
    await seite.click('#er-weiter');
    pruefe('Ein Ende vor dem Beginn wird bemerkt', (await seite.textContent('#er-fehlt')).includes('vor dem Beginn'));
    await seite.fill('#w-ende', '2028-08-31');
    await seite.selectOption('#w-land', 'NW');
    pruefe('Aus dem Beginn steht das Ausbildungsjahr gleich da', /\d\. Ausbildungsjahr/.test(await seite.textContent('#er-jahr')),
      await seite.textContent('#er-jahr'));
    await seite.click('#er-weiter');
    await seite.fill('#w-schule', 'Berufskolleg Musterstadt');
    await seite.click('#w-schultage input[value="Do"] + span');
    await seite.click('#er-weiter');
    await seite.click('.er-karte[data-vordruck="taeglich"]');
    await seite.click('#er-weiter');
    pruefe('Letzter Schritt: Zeiterfassung laden oder selbst schreiben',
      (await schritt()) === 'los' && await seite.locator('#er-laden').isVisible() && await seite.locator('#er-schreiben').isVisible());
    pruefe('Während der Einrichtung steht noch keine 1 im Speicher', (await gemerkt()) !== '1');
    await seite.click('#er-schreiben');
    await seite.waitForTimeout(600);
    const stamm = await seite.evaluate((s) => JSON.parse(localStorage.getItem(s)).stamm, h.SPEICHER);
    pruefe('Die Angaben stehen in „Deine Daten“ und im Speicher',
      stamm.name === 'Muster, Max' && stamm.beruf.startsWith('Fachinformatiker') && stamm.betrieb === 'Beispiel IT GmbH' &&
      stamm.beginn === '2025-09-01' && stamm.ende === '2028-08-31' && stamm.land === 'NW' &&
      stamm.schule === 'Berufskolleg Musterstadt' && stamm.schultage === 'Do' && stamm.vordruck === 'taeglich',
      JSON.stringify(stamm));
    pruefe('„Selbst schreiben“ öffnet die aktuelle Woche',
      !(await seite.locator('#dlg-einrichtung').isVisible()) && (await seite.locator('.reiter button').count()) === 8);
    pruefe('Gesehene Einrichtung steht als 1 im Speicher', (await gemerkt()) === '1');

    await seite.reload();
    await seite.waitForTimeout(900);
    pruefe('Beim zweiten Start bleibt die Einrichtung weg', !(await seite.locator('#dlg-einrichtung').isVisible()));
    pruefe('Mit allen Angaben bietet die Startkarte keine Einrichtung an', (await seite.locator('#btn-leer-einrichtung').count()) === 0);
    pruefe('Den Rundgang gibt es im Menü', (await seite.locator('#btn-hilfe').count()) === 1);

    // Mit Einträgen im Speicher gibt es nichts zu prüfen: Die Seite öffnet ohne Neuladen. Im selben
    // Tab, denn das zweite Dokument eines Tabs ist nie abgekoppelt; ein neuer Tab wäre es selten
    // doch und lüde dann zu Recht neu.
    await seite.goto(h.DATEI_SEITE);
    await seite.waitForTimeout(600);
    pruefe('Mit vorhandenem Speicher öffnet die Seite ohne Neuladen', (await ladeart()) === 'navigate', await ladeart());
    await kontext.close();
  }

  /* ---------- 20. Projektnamen, die nichts beitragen ---------- */
  {
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const seite = await kontext.newPage();
    await h.ohneRundgang(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(900);

    await seite.setInputFiles('#datei', {
      name: 'projekte.csv', mimeType: 'text/csv',
      buffer: Buffer.from(
        'Datum;Von;Bis;Dauer;Benutzer;Kunde;Projekt;Tätigkeit;Beschreibung\n' +
        '2026-09-07;08:00;09:00;01:00;azubi;Muster GmbH;Ausbildung;Task;Checkliste bei Exchange-Ausfall erweitert\n' +
        '2026-09-07;09:00;10:00;01:00;azubi;Muster GmbH;intern;Meeting;Wochenabstimmung im Team\n' +
        '2026-09-07;10:00;11:00;01:00;azubi;Muster GmbH;LS KW37 32600222;Task;Serverschrank aufgeräumt\n' +
        '2026-09-07;11:00;12:00;01:00;azubi;Muster GmbH;LS 09/2026 32600211;Task;Kabelwege dokumentiert\n' +
        '2026-09-07;13:00;14:00;01:00;azubi;Meyer;Support Meyer;Kontrolle;Festplattenkapazität geprüft\n' +
        '2026-09-07;14:00;15:00;01:00;azubi;Muster GmbH;Warenwirtschaft;Task;CSV-Import erweitert\n', 'utf8')
    });
    await seite.waitForTimeout(1100);

    const entwurfZeilen = (await seite.locator('.tagpanel textarea').inputValue()).split('\n').filter(Boolean);
    pruefe('Jede Buchung ergibt eine Zeile', entwurfZeilen.length === 6, entwurfZeilen.length + ' Zeilen');
    pruefe('Die Buchungskategorie steht nicht vor jeder Tätigkeit',
      !entwurfZeilen.some((z) => /^Ausbildung:/.test(z) || /^intern:/.test(z)),
      JSON.stringify(entwurfZeilen.slice(0, 2)));
    pruefe('Leistungsscheinnummern verschwinden aus dem Text',
      !entwurfZeilen.some((z) => /32600222|32600211|LS KW37/.test(z)),
      JSON.stringify(entwurfZeilen.filter((z) => /LS |3260/.test(z))));
    pruefe('Die Tätigkeit selbst bleibt vollständig erhalten',
      entwurfZeilen.some((z) => z.includes('Checkliste bei Exchange-Ausfall erweitert')) &&
      entwurfZeilen.some((z) => z.includes('Serverschrank aufgeräumt')) &&
      entwurfZeilen.some((z) => z.includes('Kabelwege dokumentiert')),
      JSON.stringify(entwurfZeilen));
    pruefe('Ein sprechender Projektname bleibt stehen',
      entwurfZeilen.some((z) => /^Warenwirtschaft:/.test(z)), JSON.stringify(entwurfZeilen));
    pruefe('Auch ein Kundenbezug bleibt stehen',
      entwurfZeilen.some((z) => /Support/.test(z)), JSON.stringify(entwurfZeilen));

    await h.stammdatenOeffnen(seite);
    await h.stammReiter(seite, '#f-projektraus');
    const projektListe = await seite.locator('#f-projektraus').inputValue();
    pruefe('Die Liste steht im Dialog und ist vorbelegt', projektListe.includes('Ausbildung'), projektListe);
    await seite.fill('#f-projektraus', '');
    await seite.locator('#f-projektraus').dispatchEvent('change');
    await seite.waitForTimeout(400);
    await seite.click('#dlg-fertig');
    await seite.waitForTimeout(500);
    pruefe('Geleerte Liste stellt die Projektnamen wieder voran',
      (await seite.locator('.tagpanel textarea').inputValue()).includes('Ausbildung:'),
      (await seite.locator('.tagpanel textarea').inputValue()).split('\n')[0]);
    await kontext.close();
  }

  /* ---------- 21. Der Sonntag gehört ans Ende seiner Woche ---------- */
  {
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const seite = await kontext.newPage();
    await h.ohneRundgang(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(900);

    // 13.09.2026 ist ein Sonntag, 12.09. ein Samstag.
    const wochenAnfang = await seite.evaluate(() => ({
      sonntag: window.__montagVon('2026-09-13'),
      samstag: window.__montagVon('2026-09-12'),
      montag: window.__montagVon('2026-09-07')
    }));
    pruefe('Sonntag gehört zur Woche, die am Montag davor beginnt',
      wochenAnfang.sonntag === '2026-09-07', wochenAnfang.sonntag);
    pruefe('Samstag und Montag liegen in derselben Woche',
      wochenAnfang.samstag === '2026-09-07' && wochenAnfang.montag === '2026-09-07',
      JSON.stringify(wochenAnfang));

    await seite.setInputFiles('#datei', {
      name: 'sonntag.csv', mimeType: 'text/csv',
      buffer: Buffer.from(
        'Datum;Von;Bis;Dauer;Benutzer;Kunde;Projekt;Tätigkeit;Beschreibung\n' +
        '2026-09-13;09:00;12:00;03:00;azubi;Muster GmbH;Bereitschaft;Wartung;Sonntagsdienst am Server\n' +
        '2026-09-09;08:00;16:00;08:00;azubi;Muster GmbH;Netzwerk;Aufbau;Switch getauscht\n', 'utf8')
    });
    await seite.waitForTimeout(1000);

    const reiterTexte = await seite.locator('#reiter button').allTextContents();
    pruefe('Die Sonntagsbuchung liegt in der Woche vom 07.09.',
      (await seite.locator('#wochenlabel').textContent()).includes('7.'),
      await seite.locator('#wochenlabel').textContent());
    pruefe('Der Sonntag ist der siebte Reiter und trägt seine Stunden',
      /SO/.test(reiterTexte[6]) && /3,00/.test(reiterTexte[6]), reiterTexte[6]);

    await seite.locator('#reiter button').nth(6).click();
    await seite.waitForTimeout(400);
    pruefe('Der Sonntagstext ist erreichbar',
      (await seite.locator('.tagpanel textarea').inputValue()).includes('Sonntagsdienst'),
      await seite.locator('.tagpanel textarea').inputValue());

    await seite.click('#wochenlabel');
    await seite.waitForTimeout(300);
    await seite.fill('#wochensuche', '2026-09-13');
    await seite.waitForTimeout(600);
    const gewaehlterTag = await seite.locator('.reiter button[aria-selected="true"] .rkurz').textContent();
    pruefe('Die Datumssuche landet auf dem gesuchten Tag, nicht auf Montag', gewaehlterTag === 'SO', gewaehlterTag);
    await kontext.close();
  }

  /* ---------- 22. Gefahrenbereich ---------- */
  {
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const seite = await kontext.newPage();
    await h.ohneRundgang(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(900);
    await seite.setInputFiles('#datei', CSV);
    await seite.waitForTimeout(1000);
    const gespeicherteTage = () => seite.evaluate((s) => (JSON.parse(localStorage.getItem(s) || '{}').tage || {}), h.SPEICHER);

    await seite.fill('.tagpanel textarea', 'Von Hand geschrieben, bleibt.');
    await seite.waitForTimeout(600);
    const eigenerTag = (await seite.locator('.tagpanel textarea').getAttribute('id')).replace('feld-', '');

    await h.stammdatenOeffnen(seite);
    await h.stammReiter(seite, '#btn-alles-weg');

    pruefe('Der Gefahrenbereich steht im Dialog',
      (await seite.locator('#btn-import-weg').count()) === 1 && (await seite.locator('#btn-alles-weg').count()) === 1);
    pruefe('Ohne Anlass keine Rückfrage', await seite.locator('#gefahrfrage').isHidden());

    await seite.click('#btn-alles-weg');
    await seite.waitForTimeout(300);
    pruefe('Löschen fragt zuerst nach', await seite.locator('#gefahrfrage').isVisible());
    pruefe('Die Rückfrage benennt, was verloren geht',
      /\d+ Tage/.test(await seite.locator('#gefahrtext').textContent()),
      await seite.locator('#gefahrtext').textContent());
    pruefe('Der Löschknopf ist gesperrt, solange nichts getippt ist', await seite.locator('#gefahr-ja').isDisabled());

    await seite.fill('#gefahrwort', 'loschen');
    await seite.waitForTimeout(200);
    pruefe('Ein falsches Wort gibt den Knopf nicht frei', await seite.locator('#gefahr-ja').isDisabled());
    await seite.fill('#gefahrwort', 'LÖSCHEN');
    await seite.waitForTimeout(200);
    pruefe('Das richtige Wort gibt den Knopf frei', await seite.locator('#gefahr-ja').isEnabled());

    await seite.click('#gefahr-nein');
    await seite.waitForTimeout(300);
    pruefe('Abbrechen schließt die Rückfrage, ohne zu löschen', await seite.locator('#gefahrfrage').isHidden());
    pruefe('Nach dem Abbrechen sind die Daten noch da', Object.keys(await gespeicherteTage()).length > 0);

    // Importierte Daten verwerfen: alles Importierte geht, ganz eigener Text bleibt.
    await seite.click('#btn-import-weg');
    await seite.waitForTimeout(300);
    await seite.fill('#gefahrwort', 'LÖSCHEN');
    await seite.waitForTimeout(150);
    await seite.click('#gefahr-ja');
    await seite.waitForTimeout(600);

    const tage = await gespeicherteTage();
    const schluessel = Object.keys(tage);
    pruefe('Verwerfen behält die Tage', schluessel.length > 0, String(schluessel.length));
    pruefe('Verwerfen entfernt die Buchungen',
      schluessel.every((x) => !(tage[x].posten || []).length));
    pruefe('Verwerfen lässt selbst Geschriebenes stehen',
      (tage[eigenerTag] || {}).text === 'Von Hand geschrieben, bleibt.', (tage[eigenerTag] || {}).text);
    const mitText = schluessel.filter((x) => (tage[x].text || '').trim()).length;
    pruefe('Verwerfen räumt die Entwürfe ab', mitText === 1, mitText + ' Tage mit Text');
    pruefe('Verwerfen entfernt die Stunden', schluessel.every((x) => tage[x].stunden == null));

    pruefe('Nach dem Verwerfen ist der Dialog zu', await seite.locator('#dlg-stamm').isHidden());
    pruefe('Die Rückfrage ist danach wieder zu', await seite.locator('#gefahrfrage').isHidden());
    await h.stammdatenOeffnen(seite);
    await seite.click('.blattleiste button[data-ziel="gefahr"]');
    await seite.waitForTimeout(150);

    // Alles löschen
    await seite.click('#btn-alles-weg');
    await seite.waitForTimeout(300);
    await seite.fill('#gefahrwort', 'LÖSCHEN');
    await seite.waitForTimeout(150);
    await seite.click('#gefahr-ja');
    await seite.waitForTimeout(700);

    pruefe('Alles löschen leert den Speicher',
      (await seite.evaluate((s) => localStorage.getItem(s), h.SPEICHER)) === null);
    pruefe('Danach steht das Werkzeug wieder am Anfang',
      (await seite.locator('.leerbild h2').count()) === 1 && (await seite.locator('.reiter button').count()) === 0);
    await seite.reload();
    await seite.waitForTimeout(900);
    pruefe('Und bleibt es auch nach dem Neuladen', (await seite.locator('.leerbild h2').count()) === 1);
    await kontext.close();
  }

  /* ---------- 21. Feiertage je Bundesland ---------- */
  {
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const seite = await kontext.newPage();
    await h.ohneRundgang(seite);
    const fehler = h.fehlerSammeln(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(800);

    // Ostern 2026 ist am 5. April: Fronleichnam am 4. Juni. Buß- und Bettag ist der 18. November.
    const faelle = [
      ['2026-10-03', '', true, 'Tag der Deutschen Einheit, bundesweit'],
      ['2026-01-06', 'BY', true, 'Heilige Drei Könige in Bayern'],
      ['2026-01-06', 'NW', false, 'Heilige Drei Könige nicht in NRW'],
      ['2026-01-06', '', false, 'Heilige Drei Könige nicht ohne Land'],
      ['2026-06-04', 'NW', true, 'Fronleichnam in NRW'],
      ['2026-06-04', 'BE', false, 'Fronleichnam nicht in Berlin'],
      ['2026-03-08', 'BE', true, 'Frauentag in Berlin'],
      ['2026-09-20', 'TH', true, 'Weltkindertag in Thüringen'],
      ['2026-10-31', 'NI', true, 'Reformationstag in Niedersachsen'],
      ['2026-10-31', 'BY', false, 'Reformationstag nicht in Bayern'],
      ['2026-11-01', 'BW', true, 'Allerheiligen in Baden-Württemberg'],
      ['2026-11-18', 'SN', true, 'Buß- und Bettag in Sachsen'],
      ['2027-11-17', 'SN', true, 'Buß- und Bettag 2027'],
      ['2026-08-15', 'SL', true, 'Mariä Himmelfahrt im Saarland'],
      ['2026-08-15', 'BY', false, 'Mariä Himmelfahrt nicht landesweit in Bayern'],
    ];
    const falsch = await seite.evaluate((liste) => liste
      .filter(([tag, land, soll]) => (window.__feiertagAn(tag, land) === 'Feiertag') !== soll)
      .map(([, , , name]) => name), faelle);
    pruefe('Feiertage je Land: ' + faelle.length + ' Fälle', falsch.length === 0, falsch.join(' | '));

    await h.stammdatenOeffnen(seite);
    await h.stammReiter(seite, '#f-land');
    await seite.selectOption('#f-land', 'NW');
    await seite.click('#dlg-fertig');
    // Sofort neu laden, ohne auf das verzögerte Speichern zu warten: Beim Verlassen der Seite
    // speichert das Werkzeug, was aussteht. Früher stand hier eine Wartezeit von 400 ms, genau
    // so lang wie die Verzögerung, und auf dem Bau-Server ging das Bundesland manchmal verloren.
    await seite.reload();
    await seite.waitForTimeout(800);
    await h.stammdatenOeffnen(seite);
    await h.stammReiter(seite, '#f-land');
    pruefe('Das Bundesland bleibt nach dem Neuladen', (await seite.inputValue('#f-land')) === 'NW', await seite.inputValue('#f-land'));
    await seite.click('#dlg-fertig');
    await seite.waitForTimeout(300);

    // Allerheiligen 2027 ist ein Montag. Fronleichnam 2026 (4. Juni) hat keine Buchung.
    const csv = path.join(os.tmpdir(), 'berichtsheft-feiertage.csv');
    fs.writeFileSync(csv, 'Datum;Von;Bis;Dauer;Benutzer;Kunde;Projekt;Tätigkeit;Beschreibung\n' +
      '2026-06-03;08:00;16:00;08:00;azubi;Meyer AG;Kundenportal;Entwicklung;Suchindex neu aufgebaut\n' +
      '2026-06-05;08:00;16:00;08:00;azubi;Meyer AG;Kundenportal;Entwicklung;Laufzeiten gemessen\n' +
      '2027-11-01;09:00;10:00;01:00;azubi;Meyer AG;Kundenportal;Entwicklung;Bereitschaft geprüft\n');
    await seite.setInputFiles('#datei', csv);
    await seite.waitForTimeout(900);
    const arten = await seite.evaluate(() => {
      const t = window.__tage();
      return { werktag: t['2026-06-03'] && t['2026-06-03'].art, allerheiligen: t['2027-11-01'] && t['2027-11-01'].art };
    });
    pruefe('Import mit NRW: ein gebuchter Feiertag wird Feiertag, ein Werktag nicht',
      arten.allerheiligen === 'Feiertag' && !arten.werktag, JSON.stringify(arten));
    const luecke = await seite.evaluate(() => {
      const mitLand = window.__fehlenderWerktag('2026-06-04');
      document.getElementById('f-land').value = '';
      const ohneLand = window.__fehlenderWerktag('2026-06-04');
      document.getElementById('f-land').value = 'NW';
      return { mitLand, ohneLand };
    });
    pruefe('Feiertag ohne Buchung ist keine Lücke, ohne Bundesland schon',
      luecke.mitLand === false && luecke.ohneLand === true, JSON.stringify(luecke));
    fs.rmSync(csv, { force: true });

    // Browser und Server müssen jeden Tag gleich sehen, sonst meldet der Ausbilder eine Lücke,
    // die der Azubi nicht sieht.
    const { istFeiertag } = require('../server/feiertage');
    const tage = [];
    for (let d = new Date(Date.UTC(2026, 0, 1)); d < new Date(Date.UTC(2028, 0, 1)); d.setUTCDate(d.getUTCDate() + 1)) {
      tage.push(d.toISOString().slice(0, 10));
    }
    const laender = ['', 'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'];
    const imBrowser = await seite.evaluate(([liste, alle]) => {
      const treffer = [];
      alle.forEach((land) => liste.forEach((tag) => { if (window.__feiertagAn(tag, land)) treffer.push(land + ' ' + tag); }));
      return treffer;
    }, [tage, laender]);
    const aufDemServer = [];
    laender.forEach((land) => tage.forEach((tag) => { if (istFeiertag(tag, land)) aufDemServer.push(land + ' ' + tag); }));
    const nurBrowser = imBrowser.filter((x) => !aufDemServer.includes(x));
    const nurServer = aufDemServer.filter((x) => !imBrowser.includes(x));
    pruefe('Browser und Server kennen dieselben Feiertage (2026–2027, alle Länder)',
      nurBrowser.length === 0 && nurServer.length === 0 && imBrowser.length > 100,
      imBrowser.length + ' Tage; nur Browser: ' + nurBrowser.join(', ') + '; nur Server: ' + nurServer.join(', '));
    // Meldung bei offenem Dialog: Die Fußleiste liegt dahinter, also erscheint sie im Dialog.
    const fremd = path.join(os.tmpdir(), 'berichtsheft-keine-sicherung.json');
    fs.writeFileSync(fremd, '{"hallo":"welt"}');
    await h.stammdatenOeffnen(seite);
    await seite.setInputFiles('#sicherungsdatei', fremd);
    await seite.waitForTimeout(400);
    const notiz = seite.locator('#dlg-stamm .dlgnotiz');
    pruefe('Bei offenem Dialog steht die Meldung im Dialog',
      (await notiz.isVisible()) && (await notiz.textContent()).includes('keine Sicherung'),
      (await notiz.count()) ? await notiz.textContent() : 'keine Meldung im Dialog');
    await seite.click('#dlg-fertig');
    fs.rmSync(fremd, { force: true });

    pruefe('Feiertage: keine JavaScript-Fehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  /* ---------- 22. Wochenstand: Heft und Ausbilder rechnen gleich ---------- */
  // Der Azubi sieht wochenStand() im Heft, der Ausbilder wochenUebersicht() vom Server. Zwei
  // Fälle liefen auseinander: Berufsschule ohne Text war beim Ausbilder „fertig“, ein geleerter
  // Werktag im Heft. Woche vom 1. bis 5. Juni 2026, Donnerstag ist Fronleichnam (in NRW frei).
  {
    const { wochenUebersicht } = require('../server/stand');
    const kontext = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const seite = await kontext.newPage();
    await h.ohneRundgang(seite);
    const fehler = h.fehlerSammeln(seite);
    await h.oeffnen(seite);
    await seite.waitForTimeout(800);

    const WOCHE = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'];
    const FERTIG = { text: 'Suchindex neu aufgebaut', art: '', stunden: 8, geprueft: true };
    const LEER = { text: '', art: '', stunden: null, geprueft: false };
    // [Name, Bundesland, Mittwoch, Donnerstag]; null heißt: kein Eintrag.
    const faelle = [
      ['alles übernommen', '', FERTIG, FERTIG],
      ['Berufsschule ohne Text', '', { ...LEER, art: 'Berufsschule' }, FERTIG],
      ['Berufsschule, nicht übernommen', '', { text: 'Netzwerktechnik', art: 'Berufsschule', stunden: null, geprueft: false }, FERTIG],
      ['Berufsschule, übernommen', '', { text: 'Netzwerktechnik', art: 'Berufsschule', stunden: null, geprueft: true }, FERTIG],
      ['Betriebsversammlung ohne Text', '', { ...LEER, art: 'Betriebsversammlung' }, FERTIG],
      ['Urlaub', '', { ...LEER, art: 'Urlaub' }, FERTIG],
      ['geleerter Werktag', '', LEER, FERTIG],
      ['Stunden ohne Text', '', { ...LEER, stunden: 8 }, FERTIG],
      ['Werktag ohne Eintrag', '', null, FERTIG],
      ['Feiertag ohne Eintrag (NRW)', 'NW', FERTIG, null],
      ['Feiertag geleert (NRW)', 'NW', FERTIG, LEER],
      ['Fronleichnam ohne Eintrag in Berlin', 'BE', FERTIG, null],
      // Blockwoche: Die Themen der Woche decken jeden Werktag ohne eigenen Text, der nicht frei ist.
      ['Blockwoche übernommen, Tag ohne Eintrag', 'NW', null, null, { schule: 'LF5: Subnetting', schuleGeprueft: true }],
      ['Blockwoche nicht übernommen', '', null, { ...LEER, art: 'Berufsschule' }, { schule: 'LF5: Subnetting', schuleGeprueft: false }],
      ['Blockwoche mit krankem Tag', '', { ...LEER, art: 'Krank' }, null, { schule: 'LF5: Subnetting', schuleGeprueft: true }],
      ['Blockwoche, geleerter Werktag', '', LEER, FERTIG, { schule: 'LF5: Subnetting', schuleGeprueft: true }],
      ['Themen nur aus Leerzeichen', '', null, FERTIG, { schule: '  ', schuleGeprueft: true }],
    ];
    const IM_HEFT = { fertig: 'fertig', pruefen: 'offen', '': 'fehlt' };
    const abweichend = [];
    for (const [name, land, mittwoch, donnerstag, themen] of faelle) {
      const eintraege = { [WOCHE[0]]: FERTIG, [WOCHE[1]]: FERTIG, [WOCHE[4]]: FERTIG };
      if (mittwoch) eintraege[WOCHE[2]] = mittwoch;
      if (donnerstag) eintraege[WOCHE[3]] = donnerstag;
      const heft = await seite.evaluate(([liste, bundesland, montag, woche]) => {
        document.getElementById('f-land').value = bundesland;
        const tage = window.__tage();
        Object.keys(tage).forEach((k) => { delete tage[k]; });
        Object.entries(liste).forEach(([datum, t]) => { tage[datum] = { ...t, pausen: [], posten: [] }; });
        const wochendaten = window.__wochendaten();
        if (woche) wochendaten[montag] = { abteilung: '', unterweisungen: '', ...woche };
        else delete wochendaten[montag];
        return window.__wochenStand(montag);
      }, [eintraege, land, WOCHE[0], themen || null]);
      const server = wochenUebersicht(WOCHE[0], WOCHE[4],
        Object.entries(eintraege).map(([datum, t]) => ({ datum, ...t })), land,
        themen ? [{ montag: WOCHE[0], ...themen }] : [])[0].stand;
      if (IM_HEFT[heft] !== server) abweichend.push(`${name}: Heft ${heft || '(leer)'}, Ausbilder ${server}`);
    }
    pruefe('Heft und Ausbilder sehen jede Woche gleich (' + faelle.length + ' Fälle)',
      abweichend.length === 0, abweichend.join(' | '));
    pruefe('Wochenstand: keine JavaScript-Fehler', fehler.length === 0, fehler.join(' | '));
    await kontext.close();
  }

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));

  await browser.close();
  abschluss();
})();
