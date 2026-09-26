#!/usr/bin/env node
/**
 * Import aus verschiedenen Zeiterfassungen: Spaltenerkennung, Werte,
 * Zeichensatz, Zuordnungsdialog, gemerkte Zuordnung und das Beispiel.
 *
 * Die Dateien unter test/daten/formate/ sind ausgedacht; ihre Kopfzeilen folgen
 * den Exporten, wie die Hilfeseiten der Werkzeuge sie beschreiben. Wer
 * einen echten Export mit abweichenden Spalten hat: anonymisieren, dort
 * ablegen und hier einen Fall ergänzen.
 *
 *   node test/import.js
 */
const fs = require('fs');
const path = require('path');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll("Import: Formate, Spalten und Zuordnung");
const format = (name) => path.join(__dirname, 'daten', 'formate', name);
const lies = (name) => fs.readFileSync(format(name), 'utf8');

(async () => {
  const browser = await h.starteBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await h.ohneRundgang(page);
  const jsFehler = h.fehlerSammeln(page);
  await h.oeffnen(page);
  await page.waitForTimeout(400);

  const analyse = (text) => page.evaluate((t) => window.__csvAnalysieren(t), text);
  const zeile = (b) => b && [b.tag, b.von, b.bis, b.dauer, b.projekt, b.taetigkeit, b.beschreibung].join(' | ');

  /* ---------- Werte ---------- */
  const werte = await page.evaluate(() => ({
    pm: window.__minutenAusZeit('01:15:00 PM'),
    mitternacht: window.__minutenAusZeit('12:05 AM'),
    mittag: window.__minutenAusZeit('12:30 PM'),
    datumZeit: window.__minutenAusZeit('2026-09-14 08:30'),
    hms: window.__minutenAusDauer('1:30:30'),
    komma: window.__minutenAusDauer('2,25'),
    minuten: window.__minutenAusDauer('90', 'min'),
    us: window.__datumAusText('09/14/2026', 'mt'),
    de: window.__datumAusText('14.09.26'),
    falsch: window.__datumAusText('31.02.2026'),
  }));
  pruefe('12-Stunden-Zeiten: 1:15 PM = 13:15, 12:05 AM = 0:05, 12:30 PM = 12:30',
    werte.pm === 795 && werte.mitternacht === 5 && werte.mittag === 750, JSON.stringify(werte));
  pruefe('Uhrzeit aus Datum mit Uhrzeit', werte.datumZeit === 510);
  pruefe('Dauer als H:MM:SS, Dezimal mit Komma und in Minuten',
    werte.hms === 91 && werte.komma === 135 && werte.minuten === 90, JSON.stringify(werte));
  pruefe('US-Datum, zweistelliges Jahr, ungültiger Tag', werte.us === '2026-09-14' && werte.de === '2026-09-14' && werte.falsch === null);

  /* ---------- Formate ---------- */
  const kimai = await analyse(fs.readFileSync(h.testdatei('kimai-test.csv'), 'utf8'));
  pruefe('Kimai (deutsch): ohne Rückfrage, Profil erkannt', kimai.sicher && kimai.profil === 'Kimai', JSON.stringify(kimai.gruende) + ' ' + kimai.profil);

  const clockify = await analyse(lies('clockify.csv'));
  const c0 = clockify.buchungen[0];
  pruefe('Clockify: ohne Rückfrage, Profil erkannt', clockify.sicher && clockify.profil === 'Clockify', JSON.stringify(clockify.gruende));
  pruefe('Clockify: Monat/Tag erkannt, PM-Zeit, Beschreibung, Aufgabe',
    c0.tag === '2026-09-14' && c0.von === 795 && c0.bis === 885 && c0.dauer === 90 &&
    c0.beschreibung.startsWith('Printer') && c0.taetigkeit === 'Ticket', zeile(c0));
  pruefe('Clockify: "Start Date" ist Datum, nicht Beginn; "Billable Rate" ist keine Dauer',
    clockify.kopf[clockify.felder.datum] === 'Start Date' && clockify.kopf[clockify.felder.von] === 'Start Time' &&
    /^Duration/.test(clockify.kopf[clockify.felder.dauer]), JSON.stringify(clockify.felder));

  const mehrdeutig = await analyse(lies('clockify-mehrdeutig.csv'));
  pruefe('Nur Daten bis zum 12.: Tag/Monat unklar, also Rückfrage',
    !mehrdeutig.sicher && mehrdeutig.reihenfolge === null && mehrdeutig.gruende.some((g) => g.includes('Tag/Monat')), JSON.stringify(mehrdeutig.gruende));

  const toggl = await analyse(lies('toggl.csv'));
  pruefe('Toggl Track: ohne Rückfrage, Profil, H:MM:SS-Dauer',
    toggl.sicher && toggl.profil === 'Toggl Track' && toggl.buchungen[0].dauer === 90 && toggl.buchungen[1].beschreibung === 'Outlook-Profil neu angelegt',
    toggl.profil + ' ' + zeile(toggl.buchungen[0]));

  const harvest = await analyse(lies('harvest.csv'));
  pruefe('Harvest: Notes, Hours statt "Hours Rounded", Dezimalstunden',
    harvest.sicher && harvest.profil === 'Harvest' && harvest.kopf[harvest.felder.dauer] === 'Hours' &&
    harvest.buchungen[1].dauer === 135 && harvest.buchungen[0].beschreibung.startsWith('Access Point'),
    JSON.stringify(harvest.felder) + ' ' + zeile(harvest.buchungen[1]));

  const tempo = await analyse(lies('tempo.csv'));
  const t0 = tempo.buchungen[0];
  pruefe('Jira/Tempo: Work date mit Uhrzeit, Hours, Work Description, keine "Billed Hours"',
    tempo.sicher && tempo.profil === 'Jira/Tempo' && t0.tag === '2026-09-14' && t0.von === 510 && t0.dauer === 120 &&
    t0.beschreibung.startsWith('Zwei Notebooks') && tempo.kopf[tempo.felder.dauer] === 'Hours',
    JSON.stringify(tempo.felder) + ' ' + zeile(t0));

  const excelText = await page.evaluate((b) => window.__csvDekodieren(b), [...fs.readFileSync(format('excel-windows1252.csv'))]);
  pruefe('Excel in Windows-1252: Umlaute bleiben lesbar', excelText.includes('Tätigkeitsbeschreibung') && excelText.includes('Größere'));
  const excel = await analyse(excelText);
  pruefe('Excel: Titelzeilen übersprungen, Summenzeile ignoriert, Stunden mit Komma',
    excel.sicher && excel.buchungen.length === 2 && excel.buchungen[0].dauer === 150 && excel.buchungen[0].von === 480 &&
    excel.buchungen[0].beschreibung.startsWith('Größere'), JSON.stringify(excel.gruende) + ' ' + zeile(excel.buchungen[0]));

  const unbekannt = await analyse(lies('unbekannt.csv'));
  pruefe('Unbekannte Spalten: Rückfrage statt Fehler', !unbekannt.sicher && unbekannt.gruende.length > 0);

  /* ---------- Dialog ---------- */
  await page.setInputFiles('#datei', format('unbekannt.csv'));
  await page.waitForSelector('#dlg-zuordnung[open]', { timeout: 3000 }).catch(() => {});
  pruefe('Zuordnungsdialog öffnet sich', await page.locator('#dlg-zuordnung').isVisible());
  pruefe('Importieren ist gesperrt, solange das Datum fehlt', await page.locator('#zu-ja').isDisabled());
  await page.selectOption('#zu-datum', '0');
  await page.selectOption('#zu-beschreibung', '1');
  await page.selectOption('#zu-dauer', '2');
  pruefe('Vorschau zeigt die erste Buchung',
    (await page.locator('#zu-vorschau tbody tr').count()) === 2 &&
    (await page.locator('#zu-vorschau tbody tr').first().textContent()).includes('Kabel im Büro verlegt'));
  pruefe('Stand: zwei Buchungen an zwei Tagen', (await page.locator('#zu-stand').textContent()).includes('2 Buchungen'));
  await page.click('#zu-ja');
  await page.waitForTimeout(500);
  pruefe('Nach der Zuordnung ist importiert', (await page.locator('#notiz').textContent()).includes('unbekannt.csv geladen'));
  const tag = await page.evaluate((s) => JSON.parse(localStorage.getItem(s)).tage['2026-09-14'], h.SPEICHER);
  pruefe('Tag hat Text und Stunden aus der Zuordnung', !!tag && tag.text.includes('Kabel') && tag.stunden === 2.5, JSON.stringify(tag));
  pruefe('Knopf „Spalten prüfen“ steht hinter der Meldung', (await page.locator('#notiz .notizknopf').count()) === 1);

  await page.setInputFiles('#datei', format('unbekannt.csv'));
  await page.waitForTimeout(600);
  pruefe('Dieselben Spalten ein zweites Mal: keine Rückfrage mehr',
    !(await page.locator('#dlg-zuordnung').isVisible()) && (await page.locator('#notiz').textContent()).includes('geladen'));

  // Korrektur: Die Dauer gar nicht übernehmen, der Tag wird neu aufgebaut statt doppelt.
  await page.click('#notiz .notizknopf');
  await page.waitForSelector('#dlg-zuordnung[open]', { timeout: 3000 }).catch(() => {});
  await page.selectOption('#zu-dauer', '-1');
  await page.click('#zu-ja');
  await page.waitForTimeout(500);
  const korrigiert = await page.evaluate((s) => JSON.parse(localStorage.getItem(s)).tage['2026-09-14'], h.SPEICHER);
  pruefe('„Spalten prüfen“ wiederholt den Import mit neuer Zuordnung', !!korrigiert && korrigiert.stunden === null, JSON.stringify(korrigiert));

  const abbruch = await browser.newPage();
  await h.ohneRundgang(abbruch);
  await h.oeffnen(abbruch);
  await abbruch.setInputFiles('#datei', format('clockify-mehrdeutig.csv'));
  await abbruch.waitForSelector('#dlg-zuordnung[open]', { timeout: 3000 }).catch(() => {});
  await abbruch.click('#zu-nein');
  await abbruch.waitForTimeout(300);
  pruefe('Abbrechen importiert nichts',
    (await abbruch.locator('#notiz').textContent()).includes('abgebrochen') &&
    (await abbruch.evaluate((s) => localStorage.getItem(s), h.SPEICHER)) === null);
  await abbruch.close();

  const excelSeite = await browser.newPage();
  await h.ohneRundgang(excelSeite);
  await h.oeffnen(excelSeite);
  await excelSeite.setInputFiles('#datei', { name: 'zeiten.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK') });
  await excelSeite.waitForTimeout(300);
  pruefe('Excel-Datei: Hinweis auf CSV statt Fehler', (await excelSeite.locator('#notiz').textContent()).includes('CSV UTF-8'));
  await excelSeite.close();

  /* ---------- Beispiel ---------- */
  const beispiel = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await h.ohneRundgang(beispiel);
  const beispielFehler = h.fehlerSammeln(beispiel);
  await h.oeffnen(beispiel);
  await beispiel.click('#btn-beispiel');
  await beispiel.waitForTimeout(600);
  const bsp = await beispiel.evaluate((s) => JSON.parse(localStorage.getItem(s)), h.SPEICHER);
  pruefe('Beispiel lädt zwei Wochen mit Berufsschultag und Stammdaten',
    Object.keys(bsp.tage).length === 7 && bsp.tage['2026-09-10'].art === 'Berufsschule' && bsp.stamm.betrieb === 'Beispiel IT GmbH',
    Object.keys(bsp.tage).length + ' Tage');
  pruefe('Beispiel: Kundennamen und Ticketnummern sind bereinigt',
    !/Sonnenschein|#48213|PC-LAGER02|Herr Weber/.test(JSON.stringify(Object.values(bsp.tage).map((t) => t.text))),
    bsp.tage['2026-09-07'].text);
  pruefe('Beispiel: Tagesansicht zeigt Montag, 7.9.', (await beispiel.locator('#tagbereich').textContent()).includes('07.09.2026'));
  pruefe('Beispiel ohne JavaScript-Fehler', beispielFehler.length === 0, beispielFehler.join(' | '));
  await beispiel.close();

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
