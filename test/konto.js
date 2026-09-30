#!/usr/bin/env node
/**
 * Browsertest für Konto und Abgleich: das gebaute Werkzeug auf einem laufenden
 * Berichtsheft-Server, einmal als Azubi und einmal als Ausbilder.
 *
 * Braucht eine Datenbank und wird deshalb nicht von `npm test` mitgenommen:
 *
 *   bash server/test/testen.sh        (startet Postgres, API-Tests, dann diesen Test)
 *   DATENBANK_URL=... node test/konto.js
 *
 * Die Anmeldung ist nachgestellt (TESTANMELDUNG=1, Person aus Kopfzeilen); der echte
 * Ablauf über den Anmeldedienst hat eigene Tests in server/test/anmeldung.js.
 */
const { spawn } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll("Konto: Anmeldung, Abgleich und Wechsel");
const PORT = 8123;
const ADRESSE = 'http://localhost:' + PORT;
const AZUBI = { 'X-Person': 'azubi-t1', 'X-Name': 'Alex Azubi', 'X-Rolle': 'azubi' };
const AZUBI2 = { 'X-Person': 'azubi-t2', 'X-Name': 'Bea Azubi', 'X-Rolle': 'azubi' };
const AUSBILDER = { 'X-Person': 'ausbilder-t1', 'X-Name': 'Carla Ausbilderin', 'X-Rolle': 'ausbilder' };
const WOCHE = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];

function api(person, weg, koerper, methode) {
  return fetch(ADRESSE + '/api/' + weg, {
    method: methode || (koerper ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...person },
    body: koerper ? JSON.stringify(koerper) : undefined,
  }).then(async (a) => ({ status: a.status, daten: await a.json() }));
}

async function warteAuf(pruefung, was, versuche = 50) {
  for (let i = 0; i < versuche; i++) {
    if (await pruefung()) return true;
    await new Promise((f) => setTimeout(f, 200));
  }
  throw new Error('Wartezeit abgelaufen: ' + was);
}

(async () => {
  if (!process.env.DATENBANK_URL) {
    console.error('DATENBANK_URL fehlt. Einfacher: bash server/test/testen.sh');
    process.exit(2);
  }

  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      TESTANMELDUNG: '1',
      STATISCH: path.join(__dirname, '..', 'dist'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write('[server] ' + d));
  await warteAuf(() => fetch(ADRESSE + '/gesund').then((a) => a.ok).catch(() => false), 'Server startet');

  const browser = await h.starteBrowser();

  /** Seite mit nachgestellter Anmeldung, jedes Mal mit leerem Browserspeicher. */
  async function seite(person) {
    const kontext = await browser.newContext({ extraHTTPHeaders: person });
    const p = await kontext.newPage();
    await h.ohneRundgang(p);
    const fehler = h.fehlerSammeln(p);
    await p.goto(ADRESSE + '/');
    return { kontext, p, fehler };
  }

  try {
    // Ausgangslage: ein Tag liegt schon im Konto, geschrieben auf einem anderen Gerät.
    await api(AZUBI, 'abgleich', {
      von: WOCHE[0], bis: WOCHE[4],
      stamm: { daten: { name: 'Alex Azubi', beruf: 'Fachinformatiker', abteilung: 'IT-Betrieb', beginn: '2026-09-01', ende: '2029-08-31' }, geaendert: new Date().toISOString() },
      tage: [{ datum: WOCHE[0], text: 'Arbeitsplatz eingerichtet', art: '', stunden: 8, geprueft: true, geaendert: new Date().toISOString() }],
    });

    console.log('\nAzubi im Browser');

    const azubi = await seite(AZUBI);
    await warteAuf(() => azubi.p.locator('#kontoname').textContent().then((t) => t === 'Alex Azubi').catch(() => false), 'Name in der Kopfleiste');
    pruefe('Angemeldet, Name steht in der Kopfleiste', true);

    await warteAuf(() => azubi.p.evaluate(() => Object.values(window.__tage()).some((t) => (t.text || '').includes('Arbeitsplatz eingerichtet'))), 'Stand vom Server');
    pruefe('Der Stand aus dem Konto ist da, obwohl der Browser leer war', true);

    pruefe('Die Stammdaten kamen mit',
      (await azubi.p.inputValue('#f-beruf')) === 'Fachinformatiker',
      await azubi.p.inputValue('#f-beruf'));

    await azubi.p.evaluate((datum) => window.__tagSetzen(datum, {
      text: 'Fehlerspeicher der Anlage ausgelesen', art: '', stunden: 8, geprueft: true,
    }), WOCHE[1]);

    await warteAuf(async () => {
      const { daten } = await api(AZUBI, `azubis`, null).catch(() => ({ daten: null }));
      const stand = await api(AZUBI, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
      return stand.daten.tage.some((t) => t.datum === WOCHE[1] && t.text.startsWith('Fehlerspeicher'));
    }, 'Neuer Tag liegt auf dem Server');
    pruefe('Was im Browser geschrieben wird, liegt gleich darauf im Konto', true);

    const zweitesGeraet = await seite(AZUBI);
    await warteAuf(() => zweitesGeraet.p.evaluate(() => Object.values(window.__tage()).some((t) => (t.text || '').includes('Fehlerspeicher der Anlage'))), 'Stand am zweiten Gerät');
    pruefe('Zweites Gerät, gleicher Stand', true);

    // Wochenfelder auf zwei Geräten. Früher teilten sich alle Wochen einen Stempel: Trug das
    // eine Gerät in einer Woche etwas ein, ging der Stand aller seiner Wochen hinaus und
    // überschrieb, was das andere inzwischen in eine andere Woche geschrieben hatte.
    const ruhig = (g) => warteAuf(() => g.p.evaluate(() => !window.__konto().laeuft), 'Abgleich fertig');
    const wocheImKonto = async (montag) => {
      const stand = await api(AZUBI, 'abgleich', {});
      return stand.daten.wochen.find((w) => w.montag === montag) || {};
    };
    await ruhig(azubi);
    await azubi.p.evaluate(() => window.__wocheSetzen('2026-08-31', { abteilung: 'Werkstatt' }));
    await warteAuf(async () => (await wocheImKonto('2026-08-31')).abteilung === 'Werkstatt', 'Woche im Konto');
    await ruhig(zweitesGeraet);
    await zweitesGeraet.p.evaluate(() => window.__kontoAbgleichen());
    await warteAuf(() => zweitesGeraet.p.evaluate(() => (window.__wochendaten()['2026-08-31'] || {}).abteilung === 'Werkstatt'), 'Woche am zweiten Gerät');
    // Gerät 1 ergänzt die Woche, Gerät 2 erfährt davon nichts und schreibt in eine andere.
    await ruhig(azubi);
    await azubi.p.evaluate(() => window.__wocheSetzen('2026-08-31', { unterweisungen: 'Brandschutzunterweisung' }));
    await warteAuf(async () => (await wocheImKonto('2026-08-31')).unterweisungen === 'Brandschutzunterweisung', 'Unterweisung im Konto');
    await ruhig(zweitesGeraet);
    await zweitesGeraet.p.evaluate(() => window.__wocheSetzen('2026-08-24', { abteilung: 'Netzwerk' }));
    await warteAuf(async () => (await wocheImKonto('2026-08-24')).abteilung === 'Netzwerk', 'Andere Woche im Konto');
    pruefe('Eine Woche am zweiten Gerät überschreibt nicht die Unterweisung einer anderen',
      (await wocheImKonto('2026-08-31')).unterweisungen === 'Brandschutzunterweisung', JSON.stringify(await wocheImKonto('2026-08-31')));
    pruefe('… und das zweite Gerät bekommt sie dabei mit',
      await zweitesGeraet.p.evaluate(() => (window.__wochendaten()['2026-08-31'] || {}).unterweisungen === 'Brandschutzunterweisung'));

    // Nach dem Neuladen galten Stammdaten und alle Wochen früher als eben geändert: Die erste
    // Eingabe schickte sie mit frischem Stempel und überschrieb Neueres aus dem Konto.
    // Die Einträge altern erst: Was in der letzten Minute einging, liefert der Server beim
    // nächsten Abgleich noch einmal (UEBERLAPPUNG_MS), und das verdeckte den Fehler.
    const { pool } = require('../server/datenbank');
    for (const tabelle of ['tage', 'wochen', 'stammdaten']) {
      await pool.query(`UPDATE ${tabelle} SET eingegangen = eingegangen - interval '1 hour'`);
    }
    await pool.end();
    await zweitesGeraet.p.reload();
    await warteAuf(() => zweitesGeraet.p.locator('#kontoname').isVisible(), 'Zweites Gerät nach dem Neuladen');
    await ruhig(zweitesGeraet);
    await ruhig(azubi);
    await azubi.p.evaluate(() => window.__wocheSetzen('2026-08-31', { unterweisungen: 'Erste Hilfe' }));
    await warteAuf(async () => (await wocheImKonto('2026-08-31')).unterweisungen === 'Erste Hilfe', 'Neue Unterweisung im Konto');
    const stammVorher = (await api(AZUBI, 'abgleich', {})).daten.stamm.geaendert;
    await warteAuf(async () => {
      await zweitesGeraet.p.evaluate((datum) => window.__tagSetzen(datum, {
        text: 'Patchfeld beschriftet', art: '', stunden: 8, geprueft: true,
      }), '2026-09-01');
      const stand = await api(AZUBI, 'abgleich', {});
      return stand.daten.tage.some((t) => t.datum === '2026-09-01' && t.text === 'Patchfeld beschriftet');
    }, 'Tag vom zweiten Gerät im Konto');
    pruefe('Nach dem Neuladen schickt eine Eingabe keine alten Wochen mit',
      (await wocheImKonto('2026-08-31')).unterweisungen === 'Erste Hilfe', JSON.stringify(await wocheImKonto('2026-08-31')));
    pruefe('… und keine unveränderten Stammdaten',
      (await api(AZUBI, 'abgleich', {})).daten.stamm.geaendert === stammVorher);
    // Blockwoche: Die Themen der Woche gehen ins Konto wie Abteilung und Unterweisungen.
    await ruhig(azubi);
    await azubi.p.evaluate(() => window.__wocheSetzen('2026-09-14', { schule: 'LF5: Subnetting und VLANs', schuleGeprueft: true }));
    await warteAuf(async () => (await wocheImKonto('2026-09-14')).schule === 'LF5: Subnetting und VLANs', 'Themen der Blockwoche im Konto');
    pruefe('Themen einer Blockwoche liegen samt „übernommen“ im Konto',
      (await wocheImKonto('2026-09-14')).schuleGeprueft === true, JSON.stringify(await wocheImKonto('2026-09-14')));
    pruefe('Keine JavaScript-Fehler auf beiden Geräten',
      azubi.fehler.length === 0 && zweitesGeraet.fehler.length === 0, azubi.fehler.concat(zweitesGeraet.fehler).join(' | '));

    // „Alles löschen“ mit Konto leert nur diesen Browser. Früher blieb die Marke des letzten
    // Abgleichs stehen: Der Browser blieb leer, das Konto voll, und die nächste Eingabe schrieb
    // leere Stammdaten ins Konto.
    await h.stammdatenOeffnen(zweitesGeraet.p);
    await h.stammReiter(zweitesGeraet.p, '#btn-import-weg');
    pruefe('Mit Konto gibt es „Alles löschen“ nicht, nur einen Hinweis',
      await zweitesGeraet.p.locator('#btn-alles-weg').isHidden() &&
      await zweitesGeraet.p.locator('#zeile-konto-loeschen').isVisible());
    // Alles kam aus dem Konto, nichts aus einem Import hier. Der Hinweis muss im Dialog stehen:
    // Die Fußleiste liegt hinter dem Dialog, dort sah ihn niemand.
    await zweitesGeraet.p.click('#btn-import-weg');
    pruefe('Nichts zu verwerfen: Der Hinweis steht sichtbar im Dialog',
      await zweitesGeraet.p.locator('#gefahrhinweis').isVisible() &&
      /nichts zu verwerfen/.test(await zweitesGeraet.p.locator('#gefahrhinweis').textContent()));
    // Die Absicherung dahinter trotzdem prüfen, etwa für eine Seite, die noch vor der
    // Anmeldung geöffnet war.
    await zweitesGeraet.p.evaluate(() => { document.getElementById('zeile-alles-weg').hidden = false; });
    await zweitesGeraet.p.click('#btn-alles-weg');
    pruefe('Mit Konto sagt die Rückfrage, dass das Konto bleibt',
      /Konto bleibt unberührt/.test(await zweitesGeraet.p.locator('#gefahrtext').textContent()));
    await zweitesGeraet.p.fill('#gefahrwort', 'LÖSCHEN');
    await zweitesGeraet.p.click('#gefahr-ja');
    await warteAuf(() => zweitesGeraet.p.evaluate(() => Object.values(window.__tage()).some((t) => (t.text || '').includes('Fehlerspeicher der Anlage'))), 'Stand nach dem Löschen wieder da');
    pruefe('Nach „Alles löschen“ kommt der Stand aus dem Konto zurück', true);
    pruefe('… samt Stammdaten', (await zweitesGeraet.p.inputValue('#f-beruf')) === 'Fachinformatiker',
      await zweitesGeraet.p.inputValue('#f-beruf'));
    await zweitesGeraet.p.reload();
    await warteAuf(() => zweitesGeraet.p.evaluate(() => Object.values(window.__tage()).some((t) => (t.text || '').includes('Arbeitsplatz eingerichtet'))), 'Stand nach dem Neuladen');
    pruefe('… und bleibt nach dem Neuladen', true);
    // Nach dem Neuladen kann der erste Abgleich noch laufen; dann lässt __tagSetzen seinen aus.
    await warteAuf(async () => {
      await zweitesGeraet.p.evaluate((datum) => window.__tagSetzen(datum, {
        text: 'Netzwerkdose geprüft', art: '', stunden: 8, geprueft: true,
      }), WOCHE[2]);
      const stand = await api(AZUBI, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
      return stand.daten.tage.some((t) => t.datum === WOCHE[2] && t.text === 'Netzwerkdose geprüft');
    }, 'Eingabe nach dem Löschen liegt auf dem Server');
    const nachLoeschen = await api(AZUBI, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
    pruefe('Die Stammdaten im Konto sind unberührt',
      nachLoeschen.daten.stamm && nachLoeschen.daten.stamm.daten.beruf === 'Fachinformatiker',
      JSON.stringify(nachLoeschen.daten.stamm));

    // Importierte Daten verwerfen: Ein Tag nur mit Importtext bleibt leer stehen, damit
    // „jetzt leer“ im Konto ankommt. Entfernt käme er dort nie an, der Ausbilder sähe ihn weiter.
    await warteAuf(async () => {
      await zweitesGeraet.p.evaluate((datum) => window.__tagSetzen(datum, {
        text: 'Drucker eingerichtet', entwurf: 'Drucker eingerichtet', art: '', stunden: 8,
      }), WOCHE[3]);
      const stand = await api(AZUBI, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
      return stand.daten.tage.some((t) => t.datum === WOCHE[3] && t.text === 'Drucker eingerichtet');
    }, 'Importierter Tag liegt auf dem Server');
    await h.stammdatenOeffnen(zweitesGeraet.p);
    await h.stammReiter(zweitesGeraet.p, '#btn-import-weg');
    await zweitesGeraet.p.click('#btn-import-weg');
    await zweitesGeraet.p.fill('#gefahrwort', 'LÖSCHEN');
    await zweitesGeraet.p.click('#gefahr-ja');
    await warteAuf(async () => {
      const stand = await api(AZUBI, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
      return stand.daten.tage.some((t) => t.datum === WOCHE[3] && t.text === '');
    }, 'Verworfener Importtext ist auch im Konto leer');
    pruefe('Verworfener Importtext ist auch im Konto leer', true);
    const nachVerwerfen = await api(AZUBI, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
    pruefe('Selbst geschriebene Tage bleiben im Konto',
      nachVerwerfen.daten.tage.some((t) => t.datum === WOCHE[2] && t.text === 'Netzwerkdose geprüft'));
    pruefe('Keine JavaScript-Fehler nach dem Löschen', zweitesGeraet.fehler.length === 0, zweitesGeraet.fehler.join(' | '));

    // Kontowechsel im selben Browser: Der Stand im localStorage gehört noch der vorigen Person.
    // Früher lud ihn der erste Abgleich mit hoch – das neue Konto bekam fremde Tage, und der
    // Ausbilder sah sie dort als Arbeit dieser Person.
    await azubi.kontext.setExtraHTTPHeaders(AZUBI2);
    await azubi.p.reload();
    await warteAuf(() => azubi.p.locator('#kontoname').textContent().then((t) => t === 'Bea Azubi').catch(() => false), 'Bea in der Kopfleiste');
    const nachWechsel = await azubi.p.evaluate(() => Object.values(window.__tage()).map((t) => t.text || '').join(' | '));
    pruefe('Nach dem Kontowechsel zeigt der Browser keine Tage des vorigen Kontos',
      !nachWechsel.includes('Fehlerspeicher') && !nachWechsel.includes('Arbeitsplatz eingerichtet'), nachWechsel);
    pruefe('Auch die Stammdaten des vorigen Kontos sind weg',
      (await azubi.p.inputValue('#f-beruf')) === '', await azubi.p.inputValue('#f-beruf'));
    await azubi.p.waitForTimeout(1500);   // dem ersten Abgleich Zeit lassen, falls er doch sendet
    const beasKonto = await api(AZUBI2, 'abgleich', { von: WOCHE[0], bis: WOCHE[4] });
    pruefe('Und nichts davon ist in das neue Konto gewandert',
      beasKonto.daten.tage.length === 0 &&
      !(beasKonto.daten.stamm && beasKonto.daten.stamm.daten && beasKonto.daten.stamm.daten.beruf),
      JSON.stringify(beasKonto.daten.tage) + ' / ' + JSON.stringify(beasKonto.daten.stamm || null));

    pruefe('Keine JavaScript-Fehler beim Azubi', azubi.fehler.length === 0, azubi.fehler.join(' | '));

    console.log('\nAusbilder im Browser');

    await api(AZUBI2, 'ich');   // Bea meldet sich einmal an, damit sie aufnehmbar ist
    const ausbilder = await seite(AUSBILDER);
    await warteAuf(() => ausbilder.p.locator('#ausbilder').isVisible(), 'Ausbilder-Ansicht');
    pruefe('Ausbilder sieht seine Ansicht statt eines eigenen Hefts',
      !(await ausbilder.p.locator('#tagbereich').isVisible()) && (await ausbilder.p.locator('#ausbilder').isVisible()));

    await ausbilder.p.click('#btn-gruppe');
    await ausbilder.p.waitForSelector('#dlg-gruppe[open]');
    // Die Datenbank kann aus den API-Tests weitere Azubis enthalten; hier zählen die eigenen.
    const frei = await ausbilder.p.locator('[data-rein]').evaluateAll((k) => k.map((e) => e.getAttribute('data-rein')));
    pruefe('Beide angemeldeten Azubis stehen zur Aufnahme bereit',
      frei.includes('azubi-t1') && frei.includes('azubi-t2'), frei);

    await ausbilder.p.click('[data-rein="azubi-t1"]');
    await warteAuf(() => ausbilder.p.locator('[data-azubi="azubi-t1"]').count().then((n) => n === 1), 'Azubi in der Auswahl');
    await ausbilder.p.click('#gruppe-zu');

    const auswahl = await ausbilder.p.locator('.aauswahl').innerText();
    pruefe('Die Auswahl zeigt nur den aufgenommenen Azubi',
      auswahl.includes('Alex Azubi') && !auswahl.includes('Bea Azubi'), auswahl);

    // Ein Klick auf den Azubi öffnet dessen Heft; die Testdaten liegen in der Woche ab 07.09.2026.
    await ausbilder.p.click('[data-azubi="azubi-t1"]');
    await ausbilder.p.waitForSelector('.vorschaubuehne .bogen');
    pruefe('Nur dieser Azubi steht in der Kopfzeile',
      (await ausbilder.p.locator('.atitel').innerText()) === 'Alex Azubi');
    await warteAuf(async () => {
      const etikett = await ausbilder.p.locator('#a-wochenlabel').innerText();
      if (etikett.includes('7.–13. Sep')) return true;
      await ausbilder.p.click('#a-zurueck');
      return false;
    }, 'Woche mit den Testdaten');

    const woche = await ausbilder.p.locator('#a-inhalt').innerText();
    pruefe('Das Wochenblatt des Azubis steht als Vorschau da',
      woche.includes('AUSBILDUNGSNACHWEIS') && woche.includes('Arbeitsplatz eingerichtet')
      && woche.includes('Fehlerspeicher der Anlage'), woche.slice(0, 200));

    // Die Woche hat keine eigene Abteilung; dann gilt die aus den Stammdaten – wie im
    // Wochenblatt, im Druck und im Word-Dokument. Gezielt auf den Block, nicht auf
    // #a-inhalt: Dort steht die Abteilung ohnehin in der Vorschau.
    const abteilungBlock = await ausbilder.p.locator('.seitenblock')
      .filter({ hasText: 'Abteilung' }).first().innerText();
    pruefe('Ohne Angabe für die Woche zeigt der Ausbilder die Abteilung aus den Stammdaten',
      abteilungBlock.includes('IT-Betrieb') && !abteilungBlock.includes('nicht angegeben'), abteilungBlock);
    pruefe('Daneben der Stand je Tag: übernommen bzw. kein Eintrag',
      woche.includes('übernommen') && woche.includes('kein Eintrag'), woche.slice(0, 300));

    // Die Blockwoche danach: keine Tageseinträge, nur die Themen der Woche.
    await ausbilder.p.click('#a-vor');
    await warteAuf(async () => (await ausbilder.p.locator('#a-inhalt').innerText()).includes('Blockwoche'), 'Blockwoche beim Ausbilder');
    const blockwoche = await ausbilder.p.locator('#a-inhalt').innerText();
    pruefe('Ausbilder sieht die Blockwoche: Tage übernommen, Themen im Blatt',
      blockwoche.includes('Blockwoche, übernommen') && blockwoche.includes('LF5: Subnetting und VLANs') &&
      !blockwoche.includes('kein Eintrag'), blockwoche.slice(0, 400));
    await ausbilder.p.click('#a-zurueck');
    await warteAuf(async () => (await ausbilder.p.locator('#a-wochenlabel').innerText()).includes('7.–13. Sep'), 'Zurück zur Woche ab 7.9.');
    await ausbilder.p.waitForSelector('.vorschaubuehne .bogen');

    // Das Monatsraster am Wochenknopf: eine Zeile je Woche mit den Tagen dieses Azubis.
    await ausbilder.p.click('#a-wochenlabel');
    await ausbilder.p.waitForSelector('#a-wochen:not([hidden])');
    const raster = await ausbilder.p.locator('#a-wochenliste').innerText();
    pruefe('Monatsraster zeigt die Wochen mit Kalenderwoche', /\b37\b/.test(raster), raster.slice(0, 120));
    await ausbilder.p.click('#a-wochen-zu');

    await ausbilder.p.click('#a-zurueck-liste');
    await ausbilder.p.waitForSelector('.aauswahl');
    pruefe('Zurück führt zur Auswahl', (await ausbilder.p.locator('#a-inhalt').innerText()).includes('Alex Azubi'));
    await ausbilder.p.click('[data-azubi="azubi-t1"]');
    await ausbilder.p.waitForSelector('.vorschaubuehne .bogen');
    pruefe('Bea bleibt außen vor', !woche.includes('Bea'));

    // Export: dieselben Bausteine wie im Heft, nur mit den Daten des Azubis.
    await ausbilder.p.click('#a-export');
    const [datei] = await Promise.all([
      ausbilder.p.waitForEvent('download'),
      ausbilder.p.click('#a-wochenblatt'),
    ]);
    pruefe('Ausbilder lädt das Wochenblatt des Azubis herunter',
      /^Wochenblatt_Alex-Azubi_Nr-2_2026-09-07_bis_2026-09-13\.docx$/.test(datei.suggestedFilename()), datei.suggestedFilename());

    pruefe('Nach dem Export ist das eigene Heft unberührt',
      await ausbilder.p.evaluate(() => Object.keys(window.__tage()).length === 0));
    pruefe('Keine JavaScript-Fehler beim Ausbilder', ausbilder.fehler.length === 0, ausbilder.fehler.join(' | '));

    console.log('\nAnmeldung als Pflicht (Vorgabe)');

    // Ohne Kopfzeilen ist niemand angemeldet. /anmeldung antwortet hier mit 501, weil der
    // Testserver keinen Anmeldedienst kennt; es zählt nur, dass die Seite dorthin will.
    const fremd = await browser.newContext();
    const tor = await fremd.newPage();
    await h.ohneRundgang(tor);
    await tor.goto(ADRESSE + '/');
    await tor.waitForURL(/\/anmeldung$/, { timeout: 5000 }).catch(() => {});
    pruefe('Ohne Anmeldung geht es beim Öffnen gleich zum Anmeldedienst', tor.url().endsWith('/anmeldung'), tor.url());

    // Hält die Anmeldung nicht, käme man endlos hin und zurück: nach drei Versuchen bleibt die Seite stehen.
    for (let i = 0; i < 2; i++) {
      await tor.goto(ADRESSE + '/');
      await tor.waitForURL(/\/anmeldung$/, { timeout: 5000 }).catch(() => {});
    }
    await tor.goto(ADRESSE + '/');
    await tor.waitForTimeout(800);
    pruefe('Nach drei Versuchen in einer Minute keine weitere Weiterleitung', !tor.url().endsWith('/anmeldung'), tor.url());
    pruefe('… sondern ein Hinweis mit „Anmelden“',
      (await tor.locator('#dlg-anmelden').isVisible()) && /nicht gehalten/.test(await tor.locator('#anmelden-text').textContent()));
    await tor.keyboard.press('Escape');
    pruefe('Der Hinweis lässt sich nicht wegdrücken', await tor.locator('#dlg-anmelden').isVisible());
    await fremd.close();

    // Sitzung läuft beim Arbeiten ab: keine Weiterleitung mitten im Tippen, sondern Sperre mit Knopf.
    const spaeter = await seite(AZUBI);
    await spaeter.p.waitForSelector('#kontoname');
    await spaeter.p.route('**/api/abgleich', (r) => r.fulfill({
      status: 401, contentType: 'application/json',
      body: JSON.stringify({ fehler: 'Nicht angemeldet', anmeldungPflicht: true }),
    }));
    await spaeter.p.evaluate(() => window.__tagSetzen('2026-09-14', { text: 'Nach Ablauf geschrieben' }));
    await spaeter.p.evaluate(() => window.__kontoAbgleichen());
    // Lief beim Umleiten noch der erste Abgleich nach dem Laden, kommt das 401 erst mit dem nächsten
    // (spätestens drei Sekunden nach dem Speichern). Auf einem langsamen Runner waren 300 ms zu knapp.
    await spaeter.p.locator('#dlg-anmelden').waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
    pruefe('Abgelaufene Sitzung: Hinweis statt Weiterleitung', spaeter.p.url() === ADRESSE + '/'
      && (await spaeter.p.locator('#dlg-anmelden').isVisible())
      && /abgelaufen/.test(await spaeter.p.locator('#anmelden-text').textContent()), spaeter.p.url());
    pruefe('… und das Geschriebene bleibt im Browser',
      await spaeter.p.evaluate(() => (window.__tage()['2026-09-14'] || {}).text === 'Nach Ablauf geschrieben'));
    await spaeter.kontext.close();

    console.log('\nAnmeldung als Angebot (ANMELDUNG_PFLICHT=0)');

    const freiwillig = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
      env: { ...process.env, PORT: String(PORT + 1), TESTANMELDUNG: '1', ANMELDUNG_PFLICHT: '0',
        STATISCH: path.join(__dirname, '..', 'dist') },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
      const nebenan = 'http://localhost:' + (PORT + 1);
      await warteAuf(() => fetch(nebenan + '/gesund').then((a) => a.ok).catch(() => false), 'zweiter Server startet');
      const offen = await browser.newContext();
      const ohneKonto = await offen.newPage();
      await h.ohneRundgang(ohneKonto);
      await ohneKonto.goto(nebenan + '/');
      await ohneKonto.waitForSelector('#konto-anmelden');
      await ohneKonto.waitForTimeout(500);
      pruefe('Freiwillig: Das Werkzeug öffnet ohne Weiterleitung, oben steht „Anmelden“',
        ohneKonto.url() === nebenan + '/' && !(await ohneKonto.locator('#dlg-anmelden').isVisible()));
      await offen.close();
    } finally {
      freiwillig.kill();
    }

    console.log('\nOhne Server');

    const kontext = await browser.newContext();
    const offline = await kontext.newPage();
    const anfragen = [];
    offline.on('request', (r) => { if (!r.url().startsWith('file:')) anfragen.push(r.url()); });
    await h.ohneRundgang(offline);
    await h.oeffnen(offline, pathToFileURL(h.EINZELDATEI).href);
    await offline.waitForTimeout(600);
    pruefe('Die Einzeldatei stellt keine Anfragen', anfragen.length === 0, anfragen.join(' | '));
    pruefe('Ohne Server kein Konto in der Kopfleiste', !(await offline.locator('#konto').isVisible()));
  } finally {
    await browser.close();
    server.kill();
  }

  abschluss();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
