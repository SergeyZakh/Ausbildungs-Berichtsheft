#!/usr/bin/env node
/**
 * Berichtsheft-Server: Konten, Datenbank und die Ansicht für Ausbilder.
 *
 * Der Server ist freiwillig. Ohne ihn bleibt das Berichtsheft, was es ist: eine Datei, die im
 * Browser läuft und nichts hochlädt. Mit ihm melden sich Azubis an, ihre Einträge liegen in der
 * Datenbank, und Ausbilder sehen, welche Wochen fertig sind und welche fehlen.
 *
 *   PORT              Standard 8080
 *   DATENBANK_URL     postgres://benutzer:kennwort@host:5432/berichtsheft
 *   STATISCH          Ordner mit dem gebauten Werkzeug (dist/); ohne Angabe liefert der Server nur Daten
 *   APP_URL, SITZUNG_GEHEIMNIS, OIDC_*   Anmeldung (siehe .env.example und docs/SERVER.md)
 *   ANMELDUNG_PFLICHT Vorgabe an; „0“: das Werkzeug geht auch ohne Konto (nur im Browser)
 *   TESTANMELDUNG=1   Nur für Tests: Person kommt aus den Kopfzeilen X-Person, X-Name, X-Rolle.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { schemaAnlegen } = require('./datenbank');
const { Fehler, beantworten, personMerken } = require('./api');
const anmeldung = require('./anmeldung');

const PORT = Number(process.env.PORT || 8080);
const MAX_KOERPER = 2 * 1024 * 1024;

/**
 * Muss man sich anmelden, um das Werkzeug zu benutzen? Im Betrieb meist ja: Einträge, die nur im
 * Browser liegen, sieht kein Ausbilder. Der Server erzwingt nichts, er sagt es der Seite mit der
 * 401-Antwort; ohne Konto gibt es ohnehin keine Daten vom Server.
 */
function anmeldungPflicht() {
  return !/^(0|false|nein|aus)$/i.test(String(process.env.ANMELDUNG_PFLICHT || '1').trim());
}

/**
 * Wer stellt die Anfrage? Normalerweise aus dem Sitzungs-Cookie nach der Anmeldung beim
 * OIDC-Anbieter. Die Testanmeldung über Kopfzeilen gibt es nur mit TESTANMELDUNG=1.
 */
function person(anfrage) {
  if (process.env.TESTANMELDUNG === '1') {
    const id = anfrage.headers['x-person'];
    if (id) {
      const rolle = anfrage.headers['x-rolle'] === 'ausbilder' ? 'ausbilder' : 'azubi';
      return { id: String(id), name: String(anfrage.headers['x-name'] || id), rolle };
    }
  }
  return anmeldung.aktiv() ? anmeldung.person(anfrage) : null;
}

/** Fehler bei der Anmeldung als lesbare Seite, nicht als JSON: Hier steht ein Mensch im Browser. */
function anmeldungGescheitert(antwort, text) {
  // Gleiche Farben wie das Werkzeug (src/css/basis.css). Die Schrift fehlt hier bewusst: Die Seite
  // kommt vom Server, nicht aus dem Build, und soll nichts nachladen.
  // „Anderes Konto“ geht über /abmeldung, sonst meldet der Anbieter sofort wieder dasselbe Konto an.
  const seite = `<!doctype html><html lang="de"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Anmeldung nicht möglich · Berichtsheft</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F2EE;color:#16161A;
  font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
main{background:#fff;border:1px solid #DEDCD6;border-radius:14px;padding:28px 32px;max-width:30rem;
  box-shadow:0 1px 2px rgba(22,22,26,.04),0 6px 20px rgba(22,22,26,.05)}
h1{font-size:17px;margin:0 0 8px}p{margin:0 0 18px;color:#62615C}
.knoepfe{display:flex;flex-wrap:wrap;gap:8px}
a{display:inline-block;padding:7px 14px;border-radius:9px;border:1px solid #DEDCD6;color:#16161A;text-decoration:none}
a.voll{background:#16161A;border-color:#16161A;color:#fff}a:hover{border-color:#BDBAB2}
</style>
<main><h1>Anmeldung nicht möglich</h1><p>${text.replace(/[<>&]/g, '')}</p>
<div class="knoepfe"><a class="voll" href="/abmeldung">Mit einem anderen Konto anmelden</a>
<a href="/anmeldung">Noch einmal versuchen</a><a href="/">Ohne Konto weiter</a></div></main></html>`;
  antwort.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
  antwort.end(seite);
}

function antworten(antwort, status, daten) {
  const inhalt = Buffer.from(JSON.stringify(daten), 'utf8');
  antwort.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': inhalt.length,
    // Der Server liefert nur Daten, nie Seiten.
    'X-Content-Type-Options': 'nosniff',
  });
  antwort.end(inhalt);
}

function koerperLesen(anfrage) {
  return new Promise((fertig, fehler) => {
    const teile = [];
    let laenge = 0;
    anfrage.on('data', (teil) => {
      laenge += teil.length;
      if (laenge > MAX_KOERPER) {
        fehler(new Fehler(413, 'Anfrage zu groß'));
        anfrage.destroy();
        return;
      }
      teile.push(teil);
    });
    anfrage.on('end', () => {
      if (!teile.length) return fertig({});
      try {
        fertig(JSON.parse(Buffer.concat(teile).toString('utf8')));
      } catch (e) {
        fehler(new Fehler(400, 'Kein gültiges JSON'));
      }
    });
    anfrage.on('error', fehler);
  });
}

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
};

/** Das gebaute Werkzeug ausliefern, wenn STATISCH gesetzt ist. true, wenn beantwortet. */
function statisch(anfrage, antwort, pfad) {
  const wurzel = process.env.STATISCH;
  if (!wurzel || (anfrage.method !== 'GET' && anfrage.method !== 'HEAD')) return false;
  const datei = path.join(wurzel, pfad === '/' ? 'index.html' : pfad);
  // Kein Ausbruch aus dem Ordner über „..“.
  if (!path.resolve(datei).startsWith(path.resolve(wurzel))) return false;
  if (!fs.existsSync(datei) || !fs.statSync(datei).isFile()) return false;
  const inhalt = fs.readFileSync(datei);
  antwort.writeHead(200, {
    'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream',
    'Content-Length': inhalt.length,
    'X-Content-Type-Options': 'nosniff',
  });
  antwort.end(anfrage.method === 'HEAD' ? undefined : inhalt);
  return true;
}

const server = http.createServer(async (anfrage, antwort) => {
  const adresse = new URL(anfrage.url, 'http://server');
  if (adresse.pathname === '/gesund') return antworten(antwort, 200, { ok: true });

  if (adresse.pathname.startsWith('/anmeldung') || adresse.pathname === '/abmeldung') {
    if (!anmeldung.aktiv()) return antworten(antwort, 501, { fehler: 'Keine Anmeldung eingerichtet (OIDC_*)' });
    try {
      if (adresse.pathname === '/anmeldung') return await anmeldung.starten(anfrage, antwort);
      if (adresse.pathname === '/anmeldung/rueckkehr') return await anmeldung.rueckkehr(anfrage, antwort, adresse.searchParams);
      return await anmeldung.abmelden(anfrage, antwort);
    } catch (e) {
      return anmeldungGescheitert(antwort, e.message);
    }
  }

  if (!adresse.pathname.startsWith('/api/') && statisch(anfrage, antwort, adresse.pathname)) return;

  try {
    const wer = person(anfrage);
    if (!wer) throw new Fehler(401, 'Nicht angemeldet');
    await personMerken(wer);
    const koerper = anfrage.method === 'POST' || anfrage.method === 'PUT' ? await koerperLesen(anfrage) : {};
    antworten(antwort, 200, await beantworten(wer, anfrage.method, adresse.pathname, adresse.searchParams, koerper));
  } catch (e) {
    if (e instanceof Fehler) {
      const daten = { fehler: e.message };
      if (e.status === 401) daten.anmeldungPflicht = anmeldungPflicht();
      return antworten(antwort, e.status, daten);
    }
    console.error(e);
    antworten(antwort, 500, { fehler: 'Serverfehler' });
  }
});

if (require.main === module) {
  // Die Testanmeldung lässt jeden per Kopfzeile Ausbilder werden. Im Image (NODE_ENV=production)
  // startet der Server damit gar nicht erst, statt still offen zu stehen.
  if (process.env.TESTANMELDUNG === '1' && process.env.NODE_ENV === 'production') {
    console.error('Start verweigert: TESTANMELDUNG=1 ist nur für Tests, nie im Betrieb.');
    process.exit(1);
  }
  if (anmeldung.aktiv() && process.env.SITZUNG_GEHEIMNIS.length < 32) {
    console.error('Start verweigert: SITZUNG_GEHEIMNIS braucht mindestens 32 Zeichen (openssl rand -hex 32).');
    process.exit(1);
  }
  if (!anmeldung.aktiv() && process.env.TESTANMELDUNG !== '1') {
    console.warn('Keine Anmeldung eingerichtet (OIDC_ISSUER, OIDC_CLIENT_ID, APP_URL, SITZUNG_GEHEIMNIS): Niemand kommt hinein.');
  }
  schemaAnlegen()
    .then(() => server.listen(PORT, () => console.log(`Berichtsheft-Server auf :${PORT}`)))
    .catch((e) => {
      console.error('Start gescheitert:', e.message);
      process.exit(1);
    });
}

module.exports = { server };
