#!/usr/bin/env node
/**
 * Betriebstest: der ganze Stapel aus docker-compose.server.yml (nginx, Server, Postgres, Sicherung)
 * mit echtem Keycloak. Anmeldung über die Keycloak-Seite wie ein Mensch, keine nachgestellten Kopfzeilen.
 *
 * Nicht direkt starten, sondern über
 *
 *   bash server/test/betrieb.sh
 *
 * Das Skript baut die Images, startet den Stapel, legt die Konten an und setzt BETRIEB_STAPEL
 * (den docker-compose-Aufruf) und SITZUNG_GEHEIMNIS.
 *
 * Konten (Kennwort überall Test-Passwort-1):
 *   joerg  Jörg Übermüller   berichtsheft-azubi      Abgleich, Import, Umlaute
 *   bea    Bea Neuling       berichtsheft-azubi      neu, ohne Einträge
 *   lena   Lena Langzeit     berichtsheft-azubi      drei Ausbildungsjahre, Vertrag vorbei
 *   carla  Carla Ausbilderin berichtsheft-ausbilder  betreut joerg, bea, lena
 *   dirk   Dirk Fremd        berichtsheft-ausbilder  betreut niemanden
 *   gast   Gustav Gast       keine Gruppe            darf nicht hinein
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll("Betrieb: ganzer Stapel mit echtem Keycloak");
const ADRESSE = 'http://localhost:8090';
const KENNWORT = 'Test-Passwort-1';
const STAPEL = (process.env.BETRIEB_STAPEL || '').split(' ').filter(Boolean);
const TEST_CSV = h.testdatei('kimai-test.csv');
// Mit --bilder legt betrieb.sh die Bildschirmfotos für docs/SERVER.md hier ab.
const BILDER = process.env.BILDER ? path.resolve(process.env.BILDER) : null;

if (!STAPEL.length || !process.env.SITZUNG_GEHEIMNIS) {
  console.error('Bitte über bash server/test/betrieb.sh starten.');
  process.exit(2);
}

/* ---------- Werkzeuge ---------- */

function abschnitt(titel) {
  console.log('\n' + titel);
}

/** docker compose … <argumente>; gibt stdout zurück und bricht bei Fehlern ab, außer `darfScheitern`. */
function stapel(argumente, { darfScheitern = false } = {}) {
  const lauf = spawnSync(STAPEL[0], [...STAPEL.slice(1), ...argumente], { encoding: 'utf8' });
  if (lauf.status !== 0 && !darfScheitern) {
    throw new Error('docker ' + argumente.join(' ') + ' scheiterte:\n' + lauf.stdout + lauf.stderr);
  }
  return { ok: lauf.status === 0, text: (lauf.stdout || '') + (lauf.stderr || '') };
}

/** Eine SQL-Abfrage direkt in der Datenbank; Ergebnis als Text (eine Zeile je Zeile, | getrennt). */
function sql(abfrage) {
  return stapel(['exec', '-T', 'datenbank', 'psql', '-U', 'berichtsheft', '-d', 'berichtsheft', '-tAc', abfrage]).text.trim();
}

async function warteAuf(pruefung, was, maxMs = 15000) {
  const bis = Date.now() + maxMs;
  while (Date.now() < bis) {
    if (await pruefung().catch(() => false)) return true;
    await new Promise((f) => setTimeout(f, 250));
  }
  throw new Error('Wartezeit abgelaufen: ' + was);
}

/** Sitzungs-Cookie so bauen, wie der Server es tut, um Fälschung und Ablauf zu prüfen. */
function cookieBauen(daten, geheimnis = process.env.SITZUNG_GEHEIMNIS) {
  const nutzlast = Buffer.from(JSON.stringify(daten)).toString('base64url');
  return nutzlast + '.' + crypto.createHmac('sha256', geheimnis).update(nutzlast).digest('base64url');
}

function werktage(von, bis) {
  const tage = [];
  for (const d = new Date(von + 'T00:00:00Z'); d <= new Date(bis + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) tage.push(d.toISOString().slice(0, 10));
  }
  return tage;
}

/**
 * Bildschirmfoto für die Doku, nur mit BILDER. `marken` legt die nummerierten Kreise
 * an, zu denen in docs/SERVER.md die Liste mit denselben Nummern steht.
 */
async function bild(seite, name, marken) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await seite.waitForTimeout(400);
  if (marken) await h.markieren(seite, marken);
  await seite.screenshot({ path: path.join(BILDER, name + '.png') });
  if (marken) await h.markieren(seite, []);
}

function dauer(start) {
  return ((Date.now() - start) / 1000).toFixed(1) + ' s';
}

(async () => {
  const browser = await h.starteBrowser();
  const zeiten = [];

  /** Neuer Browser (leerer Speicher), angemeldet über die Keycloak-Seite. */
  async function anmelden(benutzer, { erwartet = 'drin', bilder = false } = {}) {
    const kontext = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    const p = await kontext.newPage();
    await h.ohneRundgang(p);
    // Drucken öffnet sonst einen Dialog, den niemand schließt; gezählt wird, wie oft es versucht wurde.
    await p.addInitScript(() => { window.print = () => { window.__gedruckt = (window.__gedruckt || 0) + 1; }; });
    const fehler = h.fehlerSammeln(p);
    // ANMELDUNG_PFLICHT ist im Betrieb an: Wer die Seite öffnet, landet gleich bei Keycloak.
    await p.goto(ADRESSE + '/');
    await p.waitForSelector('#username');
    await p.fill('#username', benutzer);
    await p.fill('#password', KENNWORT);
    if (bilder) {
      await bild(p, '2-keycloak', [
        ['#username', 1, 'davor'],     // Firmenkonto
        ['#password', 2, 'davor'],
        ['#kc-login', 3, 'danach'],
      ]);
    }
    await p.click('#kc-login');
    await p.waitForURL((u) => u.href.startsWith(ADRESSE));
    if (erwartet === 'drin') await p.waitForSelector('#kontoname');
    return { kontext, p, fehler, dateien: h.downloadsSammeln(p) };
  }

  /** Anfrage mit den Cookies des Kontexts. */
  async function api(wer, weg, { methode, koerper } = {}) {
    const antwort = await wer.kontext.request.fetch(ADRESSE + '/api/' + weg, {
      method: methode || (koerper ? 'POST' : 'GET'),
      data: koerper,
    });
    let daten = null;
    try { daten = await antwort.json(); } catch (e) { /* keine JSON-Antwort */ }
    return { status: antwort.status(), daten };
  }

  const tagText = (wer, datum) => wer.p.evaluate((d) => (window.__tage()[d] || {}).text || '', datum);
  const kontostand = (wer) => wer.p.locator('#kontostand').textContent();

  // Wiederholbar gegen einen stehenden Stapel (betrieb.sh --behalten): Konten bleiben in Keycloak,
  // die Datenbank beginnt leer.
  sql('TRUNCATE personen CASCADE');

  try {
    /* ================================================================ */
    abschnitt('Stapel');

    const kopf = await fetch(ADRESSE + '/');
    const csp = kopf.headers.get('content-security-policy') || '';
    pruefe('Die Seite kommt mit Content-Security-Policy', csp.includes("default-src 'none'"), csp || 'fehlt');
    pruefe('… und wird nicht zwischengespeichert', kopf.headers.get('cache-control') === 'no-cache', kopf.headers.get('cache-control'));
    pruefe('Der Server ist über nginx erreichbar, ohne Anmeldung aber verschlossen',
      (await fetch(ADRESSE + '/api/ich')).status === 401);
    // /ki reicht den Pfad an Ollama durch. Mit einer Variablen in proxy_pass kam früher jede Anfrage
    // als „/“ an, und Ollama antwortete mit seiner Startseite. Ohne Ollama auf dem Rechner: 502, dann
    // lässt sich das hier nicht prüfen.
    const ki = await fetch(ADRESSE + '/ki/api/version');
    if (ki.status === 502) {
      console.log('  --    /ki nicht geprüft: kein Ollama auf diesem Rechner');
    } else {
      const kiText = await ki.text();
      pruefe('/ki reicht den Pfad an Ollama durch', /"version"/.test(kiText), kiText.slice(0, 80));
    }
    const kopfzeilen = await fetch(ADRESSE + '/api/ich', { headers: { 'X-Person': 'carla', 'X-Rolle': 'ausbilder' } });
    pruefe('Die Testanmeldung per Kopfzeile ist im Betrieb aus', kopfzeilen.status === 401, kopfzeilen.status);
    const dateisystem = stapel(['exec', '-T', 'server', 'sh', '-c', 'touch /app/probe 2>&1; id -u'], { darfScheitern: true }).text;
    pruefe('Der Server läuft als Benutzer node auf schreibgeschütztem Dateisystem',
      dateisystem.includes('Read-only') && /\b1000\b/.test(dateisystem), dateisystem);
    const testanmeldungImImage = stapel(['run', '--rm', '--no-deps', '-e', 'TESTANMELDUNG=1', 'server'], { darfScheitern: true });
    pruefe('Mit TESTANMELDUNG=1 startet das Server-Image gar nicht erst',
      !testanmeldungImImage.ok && testanmeldungImImage.text.includes('Start verweigert'), testanmeldungImImage.text.slice(-200));

    /* ================================================================ */
    abschnitt('Anmeldung');

    const gast = await anmelden('gast', { erwartet: 'draussen' });
    await bild(gast.p, '3-kein-zugang');
    const gastSeite = await gast.p.content();
    pruefe('Konto ohne Gruppe wird abgewiesen, mit lesbarer Begründung',
      gastSeite.includes('Anmeldung nicht möglich') && gastSeite.includes('berichtsheft-azubi'), gastSeite.slice(0, 300));
    pruefe('… und bekommt keine Sitzung', (await api(gast, 'ich')).status === 401);
    // Ohne Kontowechsel meldete „Noch einmal versuchen“ nur wieder dasselbe Konto an.
    await gast.p.click('text=Mit einem anderen Konto anmelden');
    await gast.p.waitForSelector('#kc-logout');
    await gast.p.click('#kc-logout');
    // Zurück im Berichtsheft und, weil die Anmeldung Pflicht ist, gleich wieder bei Keycloak.
    await gast.p.waitForSelector('#username');
    await gast.p.fill('#username', 'bea');
    await gast.p.fill('#password', KENNWORT);
    await gast.p.click('#kc-login');
    await gast.p.waitForSelector('#kontoname');
    pruefe('Nach „Kein Zugang“ lässt sich mit einem anderen Konto anmelden',
      (await gast.p.locator('#kontoname').textContent()) === 'Bea Neuling');
    await gast.kontext.close();

    // Falsches Kennwort: Meldung im Design des Berichtshefts, in Du-Form.
    const falschesKennwort = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const fk = await falschesKennwort.newPage();
    await fk.goto(ADRESSE + '/anmeldung');
    await fk.waitForSelector('#username');
    pruefe('Anmeldeseite im Design des Berichtshefts (Schrift, Grund)',
      await fk.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Instrument Sans')
        && getComputedStyle(document.body).backgroundColor === 'rgb(243, 242, 238)'));
    await fk.fill('#username', 'joerg');
    await fk.fill('#password', 'falsch');
    await fk.click('#kc-login');
    await fk.waitForSelector('#input-error-username');
    pruefe('Falsches Kennwort: Meldung in Du-Form', (await fk.content()).includes('Benutzername oder Kennwort stimmen nicht'));
    await falschesKennwort.close();

    const joerg = await anmelden('joerg', { bilder: true });
    pruefe('Azubi meldet sich über Keycloak an, Name mit Umlauten in der Kopfleiste',
      (await joerg.p.locator('#kontoname').textContent()) === 'Jörg Übermüller');
    const sitzung = (await joerg.kontext.cookies()).find((c) => c.name === 'berichtsheft_sitzung');
    pruefe('Sitzungs-Cookie ist HttpOnly und SameSite=Lax', sitzung && sitzung.httpOnly && sitzung.sameSite === 'Lax', sitzung);
    const ichJoerg = (await api(joerg, 'ich')).daten;
    pruefe('Rolle kommt aus der Keycloak-Gruppe', ichJoerg.rolle === 'azubi', ichJoerg);
    pruefe('Die Konto-ID ist die unveränderliche Keycloak-ID, nicht der Benutzername',
      /^[0-9a-f-]{36}$/.test(ichJoerg.id), ichJoerg.id);

    // Gefälschte oder abgelaufene Sitzungen.
    const falsch = await browser.newContext();
    const gefaelscht = cookieBauen({ id: ichJoerg.id, name: 'x', rolle: 'ausbilder', bis: Date.now() + 3600e3 }, 'falsches-geheimnis-0123456789abcdef');
    const abgelaufen = cookieBauen({ id: ichJoerg.id, name: 'x', rolle: 'azubi', bis: Date.now() - 1000 });
    const mitCookie = async (wert) => (await falsch.request.fetch(ADRESSE + '/api/ich', {
      headers: { Cookie: 'berichtsheft_sitzung=' + encodeURIComponent(wert) },
    })).status();
    pruefe('Ein selbst gebautes Cookie mit falscher Signatur zählt nicht', (await mitCookie(gefaelscht)) === 401);
    pruefe('Eine abgelaufene Sitzung zählt nicht', (await mitCookie(abgelaufen)) === 401);
    const echtAberUmgeschrieben = sitzung.value.split('.');
    const umgeschrieben = Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(decodeURIComponent(echtAberUmgeschrieben[0]), 'base64url').toString()), rolle: 'ausbilder',
    })).toString('base64url') + '.' + echtAberUmgeschrieben[1];
    pruefe('Die Rolle im echten Cookie lässt sich nicht umschreiben', (await mitCookie(umgeschrieben)) === 401);

    const abgelaufeneSeite = await falsch.newPage();
    await h.ohneRundgang(abgelaufeneSeite);
    await falsch.addCookies([{ name: 'berichtsheft_sitzung', value: encodeURIComponent(abgelaufen), url: ADRESSE }]);
    await abgelaufeneSeite.goto(ADRESSE + '/');
    await abgelaufeneSeite.waitForSelector('#username');
    pruefe('Mit abgelaufener Sitzung geht es beim Öffnen wieder zur Anmeldung', true);
    await falsch.close();

    /* ================================================================ */
    abschnitt('Import und Abgleich');

    // Stammdaten über die Oberfläche, wie ein Azubi sie einträgt.
    await h.stammdatenOeffnen(joerg.p);
    await h.stammFuellen(joerg.p, '#f-vorname', 'Jörg');
    await h.stammFuellen(joerg.p, '#f-nachname', 'Übermüller');
    await h.stammFuellen(joerg.p, '#f-beruf', 'Fachinformatiker für Systemintegration');
    await h.stammFuellen(joerg.p, '#f-beginn', '2026-08-01');
    await h.stammFuellen(joerg.p, '#f-ende', '2029-07-31');
    // Bleibt im Browser: Namensliste und eigene KI-Anweisungen (docs/SERVER.md, „Was wo liegt“).
    await h.stammFuellen(joerg.p, '#f-namen', 'Kollegin Wunderlich');
    await h.stammFuellen(joerg.p, '#f-ki-anweisungen', 'Geheimtipp vom Ausbilder');
    await joerg.p.click('#dlg-fertig');

    await joerg.p.setInputFiles('#datei', TEST_CSV);
    await joerg.p.waitForTimeout(900);
    // Montag, 31.08.: Entwurf übernehmen („Fertig“).
    await joerg.p.click('#wochenlabel');
    await joerg.p.fill('#wochensuche', '2026-08-31');
    await joerg.p.waitForTimeout(400);
    await joerg.p.click('.reiter button >> nth=0');
    await joerg.p.waitForTimeout(300);
    await joerg.p.click('.sektionsknopf.uebernehmen');
    await warteAuf(async () => (await kontostand(joerg)) === 'im Konto gesichert'
      && sql("SELECT geprueft FROM tage WHERE datum = '2026-08-31'") === 't', 'Import liegt im Konto');
    pruefe('Nach dem Import und „Fertig“ steht der Tag übernommen im Konto', true);
    await bild(joerg.p, '4-azubi-im-konto', [
      ['.konto', 1, 'unten-links'],               // angemeldet, Stand im Konto
      ['.reiter button', 2, 'rechts'],            // Stand der Tage
      ['.sektionsknopf.bearbeiten', 3, 'davor'],  // fertig – zum Ändern wieder öffnen
    ]);
    pruefe('Die Stammdaten liegen im Konto',
      sql("SELECT daten->>'name' FROM stammdaten") === 'Übermüller, Jörg', sql('SELECT daten FROM stammdaten'));

    const dump = stapel(['exec', '-T', 'datenbank', 'pg_dump', '-U', 'berichtsheft', '-d', 'berichtsheft', '--data-only']).text;
    pruefe('Kundennamen aus dem Export liegen nirgends auf dem Server', !dump.includes('Meyer'));
    pruefe('Uhrzeiten der Buchungen liegen nirgends auf dem Server', !/\b12:45\b|\b16:20\b/.test(dump));
    pruefe('Namensliste und KI-Anweisungen bleiben im Browser',
      !dump.includes('Wunderlich') && !dump.includes('Geheimtipp'), sql('SELECT daten FROM stammdaten'));
    pruefe('Die Buchungen selbst bleiben im Browser',
      await joerg.p.evaluate(() => (window.__tage()['2026-08-31'].posten || []).length > 0));

    // Zweites Gerät desselben Azubis: leerer Browser, gleicher Stand.
    const joerg2 = await anmelden('joerg');
    await warteAuf(async () => (await tagText(joerg2, '2026-08-31')) === (await tagText(joerg, '2026-08-31')), 'Stand am zweiten Gerät');
    pruefe('Zweites Gerät bekommt Tagestexte und Stammdaten',
      (await joerg2.p.inputValue('#f-beruf')) === 'Fachinformatiker für Systemintegration');
    pruefe('… aber keine Buchungen, die gibt es nur, wo importiert wurde',
      await joerg2.p.evaluate(() => (window.__tage()['2026-08-31'].posten || []).length === 0));

    // Beide Geräte schreiben gleichzeitig verschiedene Tage.
    await Promise.all([
      joerg.p.evaluate(() => window.__tagSetzen('2026-09-14', { text: 'Gerät A: Switch konfiguriert', geprueft: true })),
      joerg2.p.evaluate(() => window.__tagSetzen('2026-09-15', { text: 'Gerät B: Drucker eingerichtet', geprueft: true })),
    ]);
    await joerg.p.evaluate(() => window.__kontoAbgleichen());
    await joerg2.p.evaluate(() => window.__kontoAbgleichen());
    pruefe('Gleichzeitig auf zwei Geräten: Beide Tage liegen im Konto',
      sql("SELECT count(*) FROM tage WHERE datum IN ('2026-09-14','2026-09-15')") === '2');
    pruefe('… und beide Geräte haben beide Tage',
      (await tagText(joerg, '2026-09-15')).startsWith('Gerät B') && (await tagText(joerg2, '2026-09-14')).startsWith('Gerät A'));

    // Gerät A ohne Netz, Gerät B schreibt denselben Tag später: Der neuere Stand gewinnt überall.
    await joerg.p.route('**/api/abgleich', (r) => r.abort('internetdisconnected'));
    await joerg.p.evaluate(() => window.__tagSetzen('2026-09-16', { text: 'Gerät A offline: Kabel verlegt', geprueft: false }));
    await joerg.p.evaluate(() => window.__tagSetzen('2026-09-17', { text: 'Gerät A offline: Backup geprüft', geprueft: true }));
    pruefe('Ohne Netz sagt das Werkzeug, dass die Einträge nur auf diesem Gerät liegen',
      (await kontostand(joerg)) === 'nur auf diesem Gerät', await kontostand(joerg));
    await bild(joerg.p, '5-azubi-ohne-netz', [
      ['.konto', 1, 'unten-links'],     // nur auf diesem Gerät
      ['#notiz', 2, 'darueber'],        // was das heißt
    ]);
    await joerg.p.waitForTimeout(50);
    await joerg2.p.evaluate(() => window.__tagSetzen('2026-09-16', { text: 'Gerät B später: Kabel verlegt und getestet', geprueft: true }));
    await joerg.p.unroute('**/api/abgleich');
    const wieder = Date.now();
    await warteAuf(async () => (await kontostand(joerg)) === 'im Konto gesichert', 'Gerät A gleicht von selbst wieder ab', 40000);
    pruefe('Wieder im Netz gleicht Gerät A von selbst ab (' + dauer(wieder) + ')', true);
    pruefe('Offline geschriebener Tag ohne Gegenstück ist danach im Konto',
      sql("SELECT text FROM tage WHERE datum = '2026-09-17'") === 'Gerät A offline: Backup geprüft');
    pruefe('Beim selben Tag gewinnt der neuere Stand auf dem Server',
      sql("SELECT text FROM tage WHERE datum = '2026-09-16'") === 'Gerät B später: Kabel verlegt und getestet');
    // Gerät B hatte seinen letzten Abgleich, bevor A den Tag nachreichte – geschrieben hat A ihn noch davor.
    const beiB = await warteAuf(async () => {
      await joerg2.p.evaluate(() => window.__kontoAbgleichen());
      return (await tagText(joerg2, '2026-09-17')) === 'Gerät A offline: Backup geprüft';
    }, 'Nachgereichter Tag bei Gerät B', 10000).catch(() => false);
    pruefe('Offline geschrieben, später hochgeladen: kommt auch beim anderen Gerät an', beiB, await tagText(joerg2, '2026-09-17'));
    pruefe('… und auch auf dem Gerät, das offline war',
      (await tagText(joerg, '2026-09-16')) === 'Gerät B später: Kabel verlegt und getestet', await tagText(joerg, '2026-09-16'));

    // Server weg (Container gestoppt), weiterschreiben, Server wieder da.
    stapel(['stop', 'server']);
    await joerg.p.evaluate(() => window.__tagSetzen('2026-09-18', { text: 'Während der Server aus war', geprueft: true }));
    pruefe('Server gestoppt: Eingaben bleiben im Browser', (await kontostand(joerg)) === 'nur auf diesem Gerät');
    pruefe('Server gestoppt: Die Seite selbst lädt weiter', (await fetch(ADRESSE + '/')).ok);
    stapel(['start', 'server']);
    const neustart = Date.now();
    await warteAuf(async () => sql("SELECT count(*) FROM tage WHERE datum = '2026-09-18'") === '1', 'Nachgereicht nach Neustart', 60000);
    pruefe('Nach dem Neustart des Servers kommt der Tag ohne Zutun an (' + dauer(neustart) + ')', true);
    pruefe('Keine JavaScript-Fehler bei den Geräten des Azubis',
      joerg.fehler.length === 0 && joerg2.fehler.length === 0, [...joerg.fehler, ...joerg2.fehler].join(' | '));
    await joerg2.kontext.close();

    /* ================================================================ */
    abschnitt('Belastung: drei Ausbildungsjahre');

    const lena = await anmelden('lena');
    const idLena = (await api(lena, 'ich')).daten.id;
    const langeZeile = 'Netzwerkdokumentation für den Standort überarbeitet und mit dem Team abgestimmt';
    const tageLena = werktage('2023-08-01', '2026-07-31').map((datum) => ({
      datum, art: '', stunden: 8, geprueft: true, geaendert: new Date().toISOString(),
      // Sechs Zeilen je Tag: so viel, wie ein Tag im Vordruck höchstens trägt.
      text: [1, 2, 3, 4, 5, 6].map((n) => n + '. ' + langeZeile).join('\n'),
    }));
    const paket = {
      tage: tageLena,
      stamm: { daten: { name: 'Lena Langzeit', beruf: 'Kauffrau für Büromanagement', beginn: '2023-08-01', ende: '2026-07-31' }, geaendert: new Date().toISOString() },
    };
    const groesse = Buffer.byteLength(JSON.stringify(paket));
    let start = Date.now();
    const hoch = await api(lena, 'abgleich', { koerper: paket });
    zeiten.push(['Hochladen ' + tageLena.length + ' Tage (' + Math.round(groesse / 1024) + ' KB)', dauer(start)]);
    pruefe('Drei Jahre (' + tageLena.length + ' Tage, ' + Math.round(groesse / 1024) + ' KB) auf einmal hochladen',
      hoch.status === 200, hoch.status + ' ' + JSON.stringify(hoch.daten).slice(0, 120));

    start = Date.now();
    const lena2 = await anmelden('lena');
    await warteAuf(async () => (await lena2.p.evaluate(() => Object.keys(window.__tage()).length)) >= tageLena.length, 'Drei Jahre im neuen Browser', 60000);
    zeiten.push(['Anmelden und alles herunterladen (neuer Browser)', dauer(start)]);
    pruefe('Neuer Browser hat nach der Anmeldung alle ' + tageLena.length + ' Tage', true);
    pruefe('Keine JavaScript-Fehler mit drei Jahren', lena2.fehler.length === 0, lena2.fehler.join(' | '));
    await lena2.kontext.close();

    /* ================================================================ */
    abschnitt('Ausbilder');

    const bea = await anmelden('bea');
    const idBea = (await api(bea, 'ich')).daten.id;
    const carla = await anmelden('carla');
    await carla.p.waitForSelector('#ausbilder');
    pruefe('Ausbilderin sieht ihre Ansicht statt eines eigenen Hefts', !(await carla.p.locator('#tagbereich').isVisible()));

    await carla.p.click('#btn-gruppe');
    await carla.p.waitForSelector('#dlg-gruppe[open]');
    for (const id of [ichJoerg.id, idBea, idLena]) {
      await carla.p.click(`[data-rein="${id}"]`);
      await carla.p.waitForSelector(`[data-raus="${id}"]`);
    }
    pruefe('Gruppe pflegen: drei Azubis aufgenommen', (await carla.p.locator('[data-raus]').count()) === 3);
    await bild(carla.p, '6-ausbilder-gruppe', [
      ['#dlg-gruppe-inhalt', 1],        // wer in der Gruppe ist
      ['[data-raus]', 2, 'danach'],     // wieder entfernen
      ['#gruppe-zu', 3, 'danach'],
    ]);
    await carla.p.click('#gruppe-zu');
    pruefe('Der Azubi sieht, wer ihn betreut',
      ((await api(joerg, 'ich')).daten.ausbilder || []).some((a) => a.name === 'Carla Ausbilderin'));

    start = Date.now();
    const uebersicht = await api(carla, 'azubis');
    zeiten.push(['Übersicht der Gruppe (3 Azubis, einer mit 3 Jahren)', dauer(start)]);
    const lenaZeile = uebersicht.daten.azubis.find((a) => a.id === idLena);
    const beaZeile = uebersicht.daten.azubis.find((a) => a.id === idBea);
    pruefe('Übersicht: Vertragsende in der Vergangenheit begrenzt den Zeitraum',
      lenaZeile && lenaZeile.bis === '2026-07-31' && lenaZeile.von === '2023-08-01', lenaZeile && [lenaZeile.von, lenaZeile.bis]);
    pruefe('Übersicht: Alle Wochen von Lena sind fertig', lenaZeile && lenaZeile.fehlt === 0 && lenaZeile.offen === 0 && lenaZeile.fertig > 150,
      lenaZeile && [lenaZeile.fertig, lenaZeile.offen, lenaZeile.fehlt]);
    pruefe('Übersicht: Neuer Azubi ohne Einträge steht trotzdem da', beaZeile && beaZeile.von === null, beaZeile);

    // Neuer Azubi ohne Einträge: Heft öffnen darf nicht scheitern.
    await carla.p.waitForSelector(`[data-azubi="${idBea}"]`);
    await bild(carla.p, '7-ausbilder-auswahl', [
      ['#btn-gruppe', 1, 'darunter'],   // Gruppe verwalten
      ['.aauswahl', 2, 'rechts'],       // die Azubis der Gruppe
      ['[data-azubi]', 3, 'davor'],     // Stand der Wochen
    ]);
    const beaKnopf = await carla.p.locator(`[data-azubi="${idBea}"]`).innerText();
    pruefe('Auswahl: Neuer Azubi steht als „noch keine Einträge“, nicht grün',
      beaKnopf.includes('noch keine Einträge') && !(await carla.p.locator(`[data-azubi="${idBea}"].fertig`).count()), beaKnopf);
    await carla.p.click(`[data-azubi="${idBea}"]`);
    await carla.p.waitForTimeout(1200);
    const beaInhalt = await carla.p.locator('#a-inhalt').innerText();
    const beaMeldung = await carla.p.locator('#notiz').innerText();
    pruefe('Neuer Azubi ohne Einträge: Heft öffnet ohne Fehler',
      carla.fehler.length === 0 && (await carla.p.locator('.vorschaubuehne').count()) === 1 && !beaMeldung.includes('nicht laden'),
      carla.fehler.join(' | ') || beaMeldung || beaInhalt.slice(0, 160));
    await carla.p.click('#a-zurueck-liste').catch(() => {});
    await carla.p.waitForSelector('.aauswahl');

    // Jörg: Umlaute, Wochenblatt, Monatsraster.
    await carla.p.click(`[data-azubi="${ichJoerg.id}"]`);
    await carla.p.waitForSelector('.vorschaubuehne .bogen');
    // Die Ansicht beginnt in der aktuellen Woche; die Testdaten liegen in der Woche ab 14.09.2026.
    await warteAuf(async () => {
      if ((await carla.p.locator('#a-wochenlabel').innerText()).includes('14.–20. Sep')) return true;
      await carla.p.click('#a-zurueck');
      await carla.p.waitForTimeout(300);
      return false;
    }, 'Woche 14.09.', 60000);
    const wocheJoerg = await carla.p.locator('#a-inhalt').innerText();
    await bild(carla.p, '8-ausbilder-heft', [
      ['#a-zurueck-liste', 1, 'darunter'],    // zurück zur Auswahl
      ['#a-wochenlabel', 2, 'unten-rechts'],  // Woche wechseln
      ['.vorschaubuehne', 3],                 // das Wochenblatt, wie der Azubi es sieht
      ['#a-export', 4, 'unten-links'],        // Word und PDF
    ]);
    pruefe('Wochenblatt von Jörg mit Einträgen beider Geräte',
      wocheJoerg.includes('Switch konfiguriert') && wocheJoerg.includes('Drucker eingerichtet'), wocheJoerg.slice(0, 300));
    pruefe('Die laufende Woche zeigt auch Tage nach heute, die schon geschrieben sind',
      wocheJoerg.includes('Während der Server aus war'), wocheJoerg.slice(0, 400));
    await carla.p.click('#a-vor');
    await carla.p.waitForTimeout(800);
    pruefe('Woche ohne Daten: keine Fehler', carla.fehler.length === 0, carla.fehler.join(' | '));
    await carla.p.click('#a-zurueck');
    await carla.p.waitForTimeout(500);

    await carla.p.click('#a-wochenlabel');
    await carla.p.waitForSelector('#a-wochen:not([hidden])');
    await bild(carla.p, '9-ausbilder-monatsraster', [
      ['#a-monatslabel', 1, 'darueber'],
      ['#a-wochenliste', 2, 'rechts'],   // eine Zeile je Woche
      ['#a-wochen-zu', 3, 'davor'],
    ]);
    pruefe('Monatsraster zeigt Kalenderwoche 38', /\b38\b/.test(await carla.p.locator('#a-wochenliste').innerText()));
    await carla.p.click('#a-wochen-zu');

    // Rundgang für Ausbilder: eigener Speicherschlüssel, eigene Schritte, jederzeit über „?“.
    // Die Anmeldung setzt beide Schlüssel auf „gesehen“; hier wird er über das Fragezeichen geholt.
    await carla.p.click('#a-hilfe');
    await carla.p.waitForSelector('#onboarding:not([hidden])');
    pruefe('Ausbilder: „?“ startet den Rundgang', /Schritt 1 von \d/.test(await carla.p.locator('#onb-zaehler').textContent()),
      await carla.p.locator('#onb-zaehler').textContent());
    pruefe('Ausbilder: der Rundgang spricht Ausbilder an',
      (await carla.p.locator('#onb-titel').textContent()).includes('deiner Azubis'), await carla.p.locator('#onb-titel').textContent());
    const schritte = Number((await carla.p.locator('#onb-zaehler').textContent()).match(/von (\d+)/)[1]);
    let leerHervorgehoben = 0;
    for (let i = 1; i < schritte; i++) {
      await carla.p.click('#onb-weiter');
      await carla.p.waitForTimeout(250);
      const loch = await carla.p.locator('#onb-loch').boundingBox();
      if (!loch || loch.width < 10) leerHervorgehoben++;
    }
    pruefe('Ausbilder: jeder Schritt ab dem zweiten hebt ein Element hervor', leerHervorgehoben === 0,
      leerHervorgehoben + ' von ' + (schritte - 1) + ' ohne Ziel');
    await carla.p.click('#onb-weiter');
    await carla.p.waitForTimeout(250);
    pruefe('Ausbilder: nach dem letzten Schritt ist der Rundgang zu', await carla.p.locator('#onboarding').isHidden());

    await carla.p.click('#a-export');
    await carla.p.click('#a-wochenblatt');
    const wochenblatt = await h.warteAufDatei(carla.dateien, 'Wochenblatt');
    pruefe('Wochenblatt als Word, Dateiname mit Umlauten',
      wochenblatt && /^Wochenblatt_Jörg-Übermüller_Nr-\d+_2026-09-14_bis_2026-09-20\.docx$/.test(wochenblatt.name),
      wochenblatt && wochenblatt.name);
    const wordText = wochenblatt ? h.sichtbarerText((await h.docxLesen(wochenblatt.daten)).dokument) : '';
    pruefe('… mit Name und Einträgen im Dokument',
      wordText.includes('Übermüller') && wordText.includes('Switch konfiguriert'), wordText.slice(0, 200));

    await carla.p.click('#a-export');
    await carla.p.click('#a-pdf-woche');
    await warteAuf(() => carla.p.evaluate(() => window.__gedruckt === 1), 'Druck Woche');
    pruefe('Wochenblatt als PDF: Druckblatt mit den Einträgen',
      (await carla.p.locator('#druck').innerText()).includes('Switch konfiguriert'));

    await carla.p.click('#a-zurueck-liste');
    await carla.p.waitForSelector('.aauswahl');

    // Lena: drei Jahre, lange Texte, Gesamtheft.
    start = Date.now();
    await carla.p.click(`[data-azubi="${idLena}"]`);
    await carla.p.waitForSelector('.vorschaubuehne .bogen', { timeout: 60000 });
    zeiten.push(['Ausbilderin öffnet das Heft mit drei Jahren', dauer(start)]);
    const lenaWoche = await carla.p.locator('#a-inhalt').innerText();
    pruefe('Heft mit sechs langen Zeilen je Tag: Vorschau steht', lenaWoche.includes('Netzwerkdokumentation'), lenaWoche.slice(0, 160));

    start = Date.now();
    await carla.p.click('#a-export');
    await carla.p.click('#a-heft');
    const heft = await h.warteAufDatei(carla.dateien, 'Berichtsheft_Lena', 0, 180000);
    zeiten.push(['Gesamtheft als Word (drei Jahre)', dauer(start)]);
    pruefe('Gesamtheft über drei Jahre als Word (' + (heft ? Math.round(heft.daten.length / 1024) + ' KB' : '–') + ')', Boolean(heft));
    if (heft) {
      // Jedes Wochenblatt ist ein eigener Abschnitt, dazu Deckblatt und Ausbildungsgang.
      const wochenImHeft = ((await h.docxLesen(heft.daten)).dokument.match(/<w:sectPr/g) || []).length - 2;
      pruefe('… mit einem Blatt je Woche (' + wochenImHeft + ')', wochenImHeft >= 155, wochenImHeft);
    }

    start = Date.now();
    await carla.p.click('#a-export');
    await carla.p.click('#a-pdf-heft');
    await warteAuf(() => carla.p.evaluate(() => window.__gedruckt === 2), 'Druck Gesamtheft', 180000);
    zeiten.push(['Gesamtheft als PDF vorbereiten (drei Jahre)', dauer(start)]);
    const druckBlaetter = await carla.p.locator('#druck .blatt').count();
    pruefe('Gesamtheft als PDF: Druckblätter für alle Wochen (' + druckBlaetter + ')', druckBlaetter >= 155, druckBlaetter);

    pruefe('Nach allen Exporten ist das eigene Heft der Ausbilderin leer',
      await carla.p.evaluate(() => Object.keys(window.__tage()).length === 0));
    pruefe('Keine JavaScript-Fehler bei der Ausbilderin', carla.fehler.length === 0, carla.fehler.join(' | '));

    /* ================================================================ */
    abschnitt('Rechte');

    const dirk = await anmelden('dirk');
    pruefe('Azubi sieht keine Übersicht', (await api(joerg, 'azubis')).status === 403);
    pruefe('Azubi sieht kein fremdes Heft', (await api(joerg, 'azubis/' + idLena)).status === 403);
    pruefe('Azubi kann keine Gruppe pflegen', (await api(joerg, 'gruppe', { koerper: { azubi_id: idLena } })).status === 403);
    pruefe('Azubi lädt nur sein eigenes Heft herunter',
      !JSON.stringify((await api(joerg, 'abgleich', { koerper: { von: '2023-01-01', bis: '2026-12-31' } })).daten).includes('Netzwerkdokumentation'));
    pruefe('Fremder Ausbilder sieht Jörgs Heft nicht', (await api(dirk, 'azubis/' + ichJoerg.id)).status === 404);
    pruefe('Fremder Ausbilder hat eine leere Übersicht', (await api(dirk, 'azubis')).daten.azubis.length === 0);
    pruefe('Ausbilder schreibt kein Heft', (await api(carla, 'abgleich', { koerper: { tage: [] } })).status === 403);
    pruefe('Ausbilder kann Einträge nicht über den Abgleich des Azubis ändern',
      sql("SELECT count(*) FROM tage WHERE text LIKE '%Carla%'") === '0');
    const entfernt = await api(dirk, 'gruppe/' + idLena, { methode: 'DELETE' });
    pruefe('Fremder Ausbilder kann niemanden aus Carlas Gruppe nehmen',
      entfernt.status === 404 && sql('SELECT count(*) FROM betreuung') === '3', entfernt.status);
    pruefe('Ungültige Daten werden abgewiesen, ohne etwas halb zu schreiben',
      (await api(bea, 'abgleich', { koerper: { tage: [{ datum: '2026-09-14', text: 'gut' }, { datum: 'kaputt', text: 'x' }] } })).status === 400
      && sql(`SELECT count(*) FROM tage WHERE person_id = '${idBea}'`) === '0');
    await dirk.kontext.close();

    /* ================================================================ */
    abschnitt('Abmelden');

    await joerg.p.click('a.kontolink');
    await joerg.p.waitForSelector('#username');
    pruefe('Abmelden führt zurück zur Anmeldeseite', true);
    pruefe('… und der Server kennt die Sitzung nicht mehr', (await api(joerg, 'ich')).status === 401);
    pruefe('Auch bei Keycloak abgemeldet: Anmelden verlangt wieder das Kennwort', true);
    pruefe('Die eigenen Einträge bleiben nach dem Abmelden im Browser (für die nächste Anmeldung)', true);

    /* ================================================================ */
    abschnitt('Sicherung und Wiederherstellung');

    const vorher = sql('SELECT count(*) FROM tage');
    const lauf = stapel(['exec', '-T', 'sicherung', 'sh', '/skripte/sicherung.sh', 'jetzt']);
    pruefe('Sicherung läuft durch', lauf.text.includes('Sicherung fertig'), lauf.text);
    const name = stapel(['exec', '-T', 'sicherung', 'sh', '-c', 'ls -1 /sicherungen | grep ^20 | tail -1']).text.trim();

    const zuFrueh = stapel(['exec', '-T', 'sicherung', 'sh', '/skripte/wiederherstellen.sh', name], { darfScheitern: true });
    pruefe('Wiederherstellen verweigert, solange der Server läuft',
      !zuFrueh.ok && zuFrueh.text.includes('läuft noch'), zuFrueh.text.slice(-200));

    // Ein Unglück: Alle Tage sind weg.
    sql('DELETE FROM tage');
    stapel(['stop', 'server']);
    const zurueck = stapel(['exec', '-T', 'sicherung', 'sh', '/skripte/wiederherstellen.sh', name], { darfScheitern: true });
    pruefe('Wiederherstellen mit gestopptem Server', zurueck.ok && zurueck.text.includes('Fertig'), zurueck.text.slice(-300));
    stapel(['up', '-d', '--wait', 'server']);
    pruefe('Nach der Wiederherstellung sind alle ' + vorher + ' Tage wieder da', sql('SELECT count(*) FROM tage') === vorher, sql('SELECT count(*) FROM tage'));
    const nachher = await api(carla, 'azubis/' + idLena);
    pruefe('… und die Ausbilderin sieht Lenas Heft wieder (Sitzung hat überlebt)',
      nachher.status === 200 && nachher.daten.tage.length === tageLena.length, nachher.status);
  } catch (e) {
    console.error(e);
    pruefe('Der Test lief bis zum Ende', false, e.message.split('\n')[0]);
  } finally {
    await browser.close();
    if (zeiten.length) {
      console.log('\nZeiten');
      for (const [was, wie] of zeiten) console.log('  ' + wie.padStart(7) + '  ' + was);
    }
  }

  abschluss();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
