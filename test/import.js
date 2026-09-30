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
  const karte = page.locator('#hinweise .hinweis');
  pruefe('Das Ergebnis steht als Karte oben, mit „Spalten prüfen“',
    (await karte.isVisible()) && (await karte.textContent()).includes('2 Tage aus „unbekannt.csv“') &&
    (await karte.locator('button', { hasText: 'Spalten prüfen' }).count()) === 1 &&
    (await page.locator('#notiz .notizknopf').count()) === 0, await karte.textContent().catch(() => ''));

  await page.setInputFiles('#datei', format('unbekannt.csv'));
  await page.waitForTimeout(600);
  pruefe('Dieselben Spalten ein zweites Mal: keine Rückfrage mehr',
    !(await page.locator('#dlg-zuordnung').isVisible()) && (await page.locator('#notiz').textContent()).includes('geladen'));

  // Korrektur: Die Dauer gar nicht übernehmen, der Tag wird neu aufgebaut statt doppelt.
  await page.waitForTimeout(8500);
  pruefe('Die Karte bleibt stehen, auch wenn die Meldung längst leise ist', await karte.isVisible());
  await karte.locator('button', { hasText: 'Spalten prüfen' }).click();
  await page.waitForSelector('#dlg-zuordnung[open]', { timeout: 3000 }).catch(() => {});
  await page.selectOption('#zu-dauer', '-1');
  await page.click('#zu-ja');
  await page.waitForTimeout(500);
  const korrigiert = await page.evaluate((s) => JSON.parse(localStorage.getItem(s)).tage['2026-09-14'], h.SPEICHER);
  pruefe('„Spalten prüfen“ wiederholt den Import mit neuer Zuordnung', !!korrigiert && korrigiert.stunden === null, JSON.stringify(korrigiert));
  await karte.locator('button', { hasText: 'Passt' }).click();
  pruefe('„Passt“ schließt die Karte', !(await page.locator('#hinweise').isVisible()));

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

  /* ---------- Berufsschule in der Zeiterfassung ---------- */
  const faecher = await page.evaluate(() => ({
    komma: window.__faecherListe('AEUP: Datenbanken, Normalisierung, FUIT: IPv4'),
    zeilen: window.__faecherListe('LF4: Subnetting\nWiSo: Tarifvertrag\nDeutsch: Erörterung'),
    betrieb: window.__faecherListe('Support: Drucker, Netzwerk: Switch'),
    satz: window.__faecherListe('Drucker im Empfang neu eingebunden'),
    zwei: window.__schultagAusBuchungen('2026-10-01', [{ projekt: 'Intern', beschreibung: 'AD: Benutzer angelegt, PC: aufgesetzt' }]),
    stichwort: window.__schultagAusBuchungen('2026-10-01', [{ projekt: 'Berufsschule', beschreibung: 'Subnetting' }]),
    kunde: window.__schultagAusBuchungen('2026-10-01', [{ projekt: 'Schule Musterstadt', beschreibung: 'WLAN ausgeleuchtet' }]),
  }));
  pruefe('Fächer: Komma trennt nur vor einem neuen Fach, Zeilen, Kürzel und ausgeschriebene Fächer',
    JSON.stringify(faecher.komma) === '["AEUP: Datenbanken, Normalisierung","FUIT: IPv4"]' &&
    JSON.stringify(faecher.zeilen) === '["LF4: Subnetting","WiSo: Tarifvertrag","Deutsch: Erörterung"]', JSON.stringify(faecher));
  pruefe('Keine Fächer: „Support: …, Netzwerk: …“ und ein ganzer Satz', faecher.betrieb === null && faecher.satz === null);
  pruefe('Schultag nur mit zweitem Zeichen: zwei Kürzel allein nicht, Projekt „Berufsschule“ ja, Kunde „Schule …“ nicht',
    !faecher.zwei && faecher.stichwort && !faecher.kunde, JSON.stringify(faecher));

  const gespeichert = (seite) => seite.evaluate((sp) => JSON.parse(localStorage.getItem(sp)), h.SPEICHER);
  const schulSeite = async (vorher) => {
    const s = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await h.ohneRundgang(s);
    await h.oeffnen(s);
    if (vorher) await s.evaluate(vorher);
    return s;
  };

  // Schultage schlägt der Import nur vor; erst „Als Berufsschule übernehmen“ in der Karte setzt sie.
  const uebernehmen = async (s) => {
    await s.locator('#hinweise button', { hasText: 'Als Berufsschule übernehmen' }).click();
    await s.waitForTimeout(300);
  };
  const vorgeschlagen = (s) => s.$$eval('#hinweise .schulwahl-liste input', (e) => e.map((x) => x.getAttribute('data-datum')));
  const schule = await schulSeite();
  const schulFehler = h.fehlerSammeln(schule);
  await schule.setInputFiles('#datei', format('kimai-schule.csv'));
  await schule.waitForTimeout(600);
  let st = await gespeichert(schule);
  const art = (k) => st.tage[k] && st.tage[k].art;
  pruefe('Kimai mit Fächern: noch keine Berufsschule, die drei Schultage stehen zum Bestätigen oben',
    !Object.values(st.tage).some((t) => t.art === 'Berufsschule') &&
    (await vorgeschlagen(schule)).join() === '2026-09-29,2026-09-30,2026-10-06', (await vorgeschlagen(schule)).join());
  pruefe('Meldung nennt die Vorschläge', (await schule.locator('#notiz').textContent()).includes('3 sehen nach Berufsschule aus'),
    await schule.locator('#notiz').textContent());
  await uebernehmen(schule);
  st = await gespeichert(schule);
  pruefe('Übernommen: Dienstag (Zeilen) und Mittwoch (Komma) sind Berufsschule',
    art('2026-09-29') === 'Berufsschule' && art('2026-09-30') === 'Berufsschule', JSON.stringify(st.tage['2026-09-29']));
  const themen = 'AEUP: Datenbanken, Normalisierung\nFUIT: IPv4, Subnetting\nITT: ESP32\nE: Compiler and Interpreter\nDeutsch: Bewerbungsschreiben';
  pruefe('Wöchentlicher Vordruck: die Fächer beider Tage in den Themen der Woche, gleiche Fächer in einer Zeile',
    st.wochen['2026-09-28'] && st.wochen['2026-09-28'].schule === themen &&
    st.tage['2026-09-29'].text === '' && st.tage['2026-09-30'].text === '', JSON.stringify(st.wochen['2026-09-28']));
  pruefe('Die Tage zählen unter den Themen, die Stunden bleiben',
    (await schule.evaluate(() => window.__tagLage('2026-09-29'))) === 'voll' && st.tage['2026-09-29'].stunden === 7.85);
  pruefe('Nicht zu gierig: zwei Kürzel, ein gemischter Tag und ein Fach ohne Schulplan bleiben Arbeitstage',
    art('2026-09-28') === '' && art('2026-10-01') === '' && art('2026-10-02') === '' && art('2026-10-07') === '' &&
    st.tage['2026-10-01'].text.includes('AD: Benutzer'), [art('2026-10-01'), art('2026-10-02'), art('2026-10-07')].join('|'));
  pruefe('Ein einzelner Schultag in der Woche behält seinen Text, je Fach eine Zeile, ohne Projekt davor',
    art('2026-10-06') === 'Berufsschule' && st.tage['2026-10-06'].text === 'WiSo: Tarifvertrag\nLF5: Schleifen und Arrays\nITT: Sensoren',
    JSON.stringify(st.tage['2026-10-06'].text));
  pruefe('Danach nennt die Karte die Schultage, ohne Liste', !(await vorgeschlagen(schule)).length &&
    (await schule.locator('#hinweise').textContent()).includes('davon 3 Berufsschule'), await schule.locator('#hinweise').textContent());
  const kiTage = await schule.evaluate(() => window.__kiTageDerWoche('2026-10-05'));
  pruefe('Die KI lässt eine Fächerliste aus, kürzt aber den Arbeitstag daneben',
    !kiTage.includes('2026-10-06') && kiTage.includes('2026-10-07'), kiTage.join(' '));

  // Erneut einlesen: Übernommene Themen bleiben übernommen, eigene Themen bleiben stehen.
  await schule.evaluate(() => window.__wocheSetzen('2026-09-28', { schuleGeprueft: true }));
  await schule.setInputFiles('#datei', format('kimai-schule.csv'));
  await schule.waitForTimeout(600);
  st = await gespeichert(schule);
  pruefe('Derselbe Export noch einmal: keine neue Frage, die Schultage bleiben',
    !(await vorgeschlagen(schule)).length && art('2026-09-29') === 'Berufsschule' && art('2026-10-06') === 'Berufsschule');
  pruefe('Derselbe Export noch einmal: Themen unverändert und weiter übernommen',
    st.wochen['2026-09-28'].schule === themen && st.wochen['2026-09-28'].schuleGeprueft === true, JSON.stringify(st.wochen['2026-09-28']));
  await schule.evaluate(() => window.__wocheSetzen('2026-09-28', { schule: 'Eigene Themen', schuleGeprueft: false }));
  await schule.setInputFiles('#datei', format('kimai-schule.csv'));
  await schule.waitForTimeout(600);
  st = await gespeichert(schule);
  pruefe('Selbst geschriebene Themen der Woche überschreibt der Import nicht', st.wochen['2026-09-28'].schule === 'Eigene Themen');
  await schule.evaluate(() => window.__tagSetzen('2026-10-06', { art: '', artVonHand: true }));
  await schule.setInputFiles('#datei', format('kimai-schule.csv'));
  await schule.waitForTimeout(600);
  st = await gespeichert(schule);
  pruefe('Von Hand zum Arbeitstag gemacht: bleibt einer, mit den Buchungen als Entwurf',
    art('2026-10-06') === '' && st.tage['2026-10-06'].text.includes('WiSo: Tarifvertrag'), JSON.stringify(st.tage['2026-10-06']));
  pruefe('Schultage ohne JavaScript-Fehler', schulFehler.length === 0, schulFehler.join(' | '));
  await schule.close();

  // Abgewählt oder „Alles Betrieb“: bleibt Arbeitstag, und derselbe Export fragt nicht noch einmal.
  const auswahl = await schulSeite();
  await auswahl.setInputFiles('#datei', format('kimai-schule.csv'));
  await auswahl.waitForTimeout(600);
  await auswahl.uncheck('#hinweise input[data-datum="2026-10-06"]');
  await uebernehmen(auswahl);
  st = await gespeichert(auswahl);
  pruefe('Ein Haken weg: dieser Tag bleibt Arbeitstag mit seinen Buchungen, die anderen werden Schule',
    art('2026-09-29') === 'Berufsschule' && art('2026-09-30') === 'Berufsschule' && art('2026-10-06') === '' &&
    st.tage['2026-10-06'].text.includes('WiSo: Tarifvertrag'), JSON.stringify(st.tage['2026-10-06']));
  await auswahl.close();
  const betrieb = await schulSeite();
  await betrieb.setInputFiles('#datei', format('kimai-schule.csv'));
  await betrieb.waitForTimeout(600);
  await betrieb.locator('#hinweise button', { hasText: 'Alles Betrieb' }).click();
  await betrieb.waitForTimeout(300);
  st = await gespeichert(betrieb);
  pruefe('„Alles Betrieb“: kein Tag wird Schule, keine Themen der Woche',
    !Object.values(st.tage).some((t) => t.art === 'Berufsschule') && !(st.wochen['2026-09-28'] && st.wochen['2026-09-28'].schule));
  await betrieb.setInputFiles('#datei', format('kimai-schule.csv'));
  await betrieb.waitForTimeout(600);
  pruefe('… und derselbe Export fragt nicht noch einmal', !(await vorgeschlagen(betrieb)).length);
  await betrieb.close();

  // Aus 0.3/0.4: Berufsschule, die der Import selbst gesetzt hat, wird beim nächsten Import wieder ein Vorschlag.
  const alt = await schulSeite(() => {
    window.__tagSetzen('2026-10-01', { art: 'Berufsschule', text: '', entwurf: '', posten: [] });
  });
  await alt.setInputFiles('#datei', format('kimai-schule.csv'));
  await alt.waitForTimeout(600);
  st = await gespeichert(alt);
  pruefe('Früher selbst gesetzte Berufsschule an einem Arbeitstag ist nach dem Import wieder Arbeitstag',
    art('2026-10-01') === '' && st.tage['2026-10-01'].text.includes('AD: Benutzer'), JSON.stringify(st.tage['2026-10-01']));
  await alt.close();

  const taeglich = await schulSeite(() => { document.getElementById('f-vordruck').value = 'taeglich'; });
  await taeglich.setInputFiles('#datei', format('kimai-schule.csv'));
  await taeglich.waitForTimeout(600);
  await uebernehmen(taeglich);
  st = await gespeichert(taeglich);
  pruefe('Tägliche Notierung: jeder Schultag behält seine Fächer, nichts in den Themen der Woche',
    st.tage['2026-09-29'].text === 'AEUP: Datenbanken\nFUIT: IPv4\nITT: ESP32\nE: Compiler and Interpreter' &&
    st.tage['2026-09-30'].text === 'AEUP: Normalisierung\nFUIT: Subnetting\nDeutsch: Bewerbungsschreiben\nE: Compiler and Interpreter' &&
    !(st.wochen['2026-09-28'] && st.wochen['2026-09-28'].schule), JSON.stringify(st.tage['2026-09-30'].text));
  await taeglich.close();

  const plan = await schulSeite(() => { document.getElementById('f-schultage').value = 'Mi'; });
  await plan.setInputFiles('#datei', format('kimai-schule.csv'));
  await plan.waitForTimeout(600);
  pruefe('Mit Schulplan steht auch der Mittwoch mit einem Fach unter den Vorschlägen',
    (await vorgeschlagen(plan)).includes('2026-10-07'), (await vorgeschlagen(plan)).join());
  await uebernehmen(plan);
  st = await gespeichert(plan);
  pruefe('Mit Schulplan reicht ein Fach: Mittwoch 7.10. ist Berufsschule, mit Dienstag zusammengeführt',
    art('2026-10-07') === 'Berufsschule' && st.wochen['2026-10-05'] &&
    st.wochen['2026-10-05'].schule === 'WiSo: Tarifvertrag\nLF5: Schleifen und Arrays\nITT: Sensoren\nLF4: VLANs',
    JSON.stringify(st.wochen['2026-10-05']));
  await plan.close();

  /* ---------- Ohne Kopfzeile ---------- */
  const ohne = await analyse(lies('kimai-ohne-kopf.csv'));
  pruefe('Ohne Kopfzeile: beide Zeilen sind Buchungen, Spalten nach Inhalt, trotzdem eine Rückfrage',
    !ohne.sicher && ohne.buchungen.length === 2 && ohne.gruende[0].includes('keine Kopfzeile') &&
    ohne.felder.datum === 0 && ohne.felder.von === 1 && ohne.felder.bis === 2 && ohne.felder.dauer === 3 && ohne.felder.beschreibung === 11,
    JSON.stringify(ohne.felder) + ' ' + JSON.stringify(ohne.gruende));
  const kopflos = await schulSeite();
  await kopflos.setInputFiles('#datei', format('kimai-ohne-kopf.csv'));
  await kopflos.waitForSelector('#dlg-zuordnung[open]', { timeout: 3000 }).catch(() => {});
  pruefe('Ohne Kopfzeile: Dialog mit Hinweis und vorgeschlagenen Spalten',
    (await kopflos.locator('#zu-gruende').textContent()).includes('keine Kopfzeile') &&
    (await kopflos.locator('#zu-beschreibung').inputValue()) === '11' && !(await kopflos.locator('#zu-ja').isDisabled()));
  await kopflos.click('#zu-ja');
  await kopflos.waitForTimeout(500);
  pruefe('Ohne Kopfzeile: beide Tage eingelesen und als Berufsschule vorgeschlagen',
    (await vorgeschlagen(kopflos)).join() === '2026-09-29,2026-09-30', (await vorgeschlagen(kopflos)).join());
  await uebernehmen(kopflos);
  st = await gespeichert(kopflos);
  pruefe('Ohne Kopfzeile: nach dem Übernehmen Berufsschule', art('2026-09-29') === 'Berufsschule' && art('2026-09-30') === 'Berufsschule',
    Object.keys((st && st.tage) || {}).join(' '));
  await kopflos.setInputFiles('#datei', format('kimai-ohne-kopf.csv'));
  await kopflos.waitForTimeout(600);
  pruefe('Ohne Kopfzeile, zweites Mal: keine Rückfrage mehr',
    !(await kopflos.locator('#dlg-zuordnung').isVisible()) && (await kopflos.locator('#notiz').textContent()).includes('geladen'));
  await kopflos.close();

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
  pruefe('Beispiel: keine Karte „Import fertig“', !((await beispiel.locator('#hinweise').textContent()) || '').includes('Import fertig'));
  pruefe('Beispiel ohne JavaScript-Fehler', beispielFehler.length === 0, beispielFehler.join(' | '));
  await beispiel.close();

  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));
  await browser.close();
  abschluss();
})();
