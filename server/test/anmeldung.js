#!/usr/bin/env node
/**
 * Tests der Anmeldung gegen einen nachgebauten OIDC-Anbieter (echte RSA-Schlüssel und Signaturen).
 * Keine Datenbank nötig: Hier geht es nur um Token, Sitzung und Rollen.
 *
 *   node server/test/anmeldung.js
 */
'use strict';

const crypto = require('crypto');
const http = require('http');

let bestanden = 0;
const gescheitert = [];

/* Farbe nur, wenn jemand zusieht – sonst stünden Steuerzeichen im Protokoll. */
const FARBIG = !!process.stdout.isTTY && !process.env.NO_COLOR;
const farbe = (nummer) => (text) => (FARBIG ? '\u001b[' + nummer + 'm' + text + '\u001b[0m' : text);
const gruen = farbe(32), rot = farbe(31), grau = farbe(90), fett = farbe(1);

function pruefe(name, ok, hinweis) {
  if (ok === true) {
    bestanden++;
    console.log('  ' + gruen('OK') + '    ' + name);
  } else {
    gescheitert.push(name);
    console.log('  ' + rot('FEHLT') + ' ' + name +
      (hinweis === undefined ? '' : grau('  →  ' + JSON.stringify(hinweis))));
  }
}

function abschnitt(titel) {
  console.log('\n' + fett(titel));
}

/* ---------- Nachgebauter Anmeldedienst ---------- */

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'test-schluessel';
const base64url = (x) => Buffer.from(x).toString('base64url');

/** Baut ein signiertes JWT; `kaputt` verfälscht die Signatur. */
function jwt(inhalt, { kid = KID, kaputt = false } = {}) {
  const kopf = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const koerper = base64url(JSON.stringify(inhalt));
  const signatur = crypto.sign('RSA-SHA256', Buffer.from(kopf + '.' + koerper), privateKey);
  if (kaputt) signatur[0] ^= 0xff;
  return kopf + '.' + koerper + '.' + signatur.toString('base64url');
}

// Was der nächste Token-Tausch zurückgibt; die Tests drehen daran.
let naechsterToken = null;
let letzteAnfrage = null;

const anbieter = http.createServer((anfrage, antwort) => {
  const adresse = new URL(anfrage.url, 'http://anbieter');
  const senden = (daten, status = 200) => {
    antwort.writeHead(status, { 'Content-Type': 'application/json' });
    antwort.end(JSON.stringify(daten));
  };
  if (adresse.pathname === '/.well-known/openid-configuration') {
    return senden({
      issuer: ANBIETER_ADRESSE,
      authorization_endpoint: ANBIETER_ADRESSE + '/auth',
      token_endpoint: ANBIETER_ADRESSE + '/token',
      jwks_uri: ANBIETER_ADRESSE + '/jwks',
      end_session_endpoint: ANBIETER_ADRESSE + '/abmelden',
    });
  }
  if (adresse.pathname === '/jwks') {
    const jwk = publicKey.export({ format: 'jwk' });
    return senden({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] });
  }
  if (adresse.pathname === '/token') {
    let koerper = '';
    anfrage.on('data', (t) => { koerper += t; });
    return anfrage.on('end', () => {
      letzteAnfrage = new URLSearchParams(koerper);
      senden({ id_token: naechsterToken, token_type: 'Bearer' });
    });
  }
  senden({ fehler: 'unbekannt' }, 404);
});

/* ---------- Werkzeug ---------- */

let ANBIETER_ADRESSE = '';
let SERVER_ADRESSE = '';

const cookies = new Map();

function cookiesMerken(antwort) {
  for (const zeile of antwort.headers.getSetCookie()) {
    const [paar] = zeile.split(';');
    const stelle = paar.indexOf('=');
    const name = paar.slice(0, stelle).trim();
    const wert = paar.slice(stelle + 1).trim();
    if (!wert || /Max-Age=0/.test(zeile)) cookies.delete(name);
    else cookies.set(name, wert);
  }
}

function cookieKopf() {
  return [...cookies].map(([n, w]) => `${n}=${w}`).join('; ');
}

async function ruf(weg, einstellungen = {}) {
  const antwort = await fetch(SERVER_ADRESSE + weg, {
    redirect: 'manual',
    headers: { Cookie: cookieKopf(), ...(einstellungen.headers || {}) },
  });
  cookiesMerken(antwort);
  return antwort;
}

/** Vollständiger Ablauf: /anmeldung, Anbieter, Rückkehr. Gibt die Antwort der Rückkehr zurück. */
async function anmelden(claims, tokenEinstellungen) {
  const start = await ruf('/anmeldung');
  const ziel = new URL(start.headers.get('location'));
  const state = ziel.searchParams.get('state');
  const nonce = ziel.searchParams.get('nonce');
  naechsterToken = jwt({
    iss: ANBIETER_ADRESSE,
    aud: 'berichtsheft',
    sub: 'konto-1',
    nonce,
    exp: Math.floor(Date.now() / 1000) + 300,
    ...claims,
  }, tokenEinstellungen);
  return { start, ziel, antwort: await ruf(`/anmeldung/rueckkehr?code=abc&state=${encodeURIComponent(state)}`) };
}

(async () => {
  await new Promise((f) => anbieter.listen(0, f));
  ANBIETER_ADRESSE = 'http://localhost:' + anbieter.address().port;

  process.env.OIDC_ISSUER = ANBIETER_ADRESSE;
  process.env.OIDC_CLIENT_ID = 'berichtsheft';
  process.env.OIDC_CLIENT_SECRET = 'geheim';
  process.env.SITZUNG_GEHEIMNIS = 'test-geheimnis-fuer-die-sitzung';
  delete process.env.TESTANMELDUNG;
  delete process.env.DATENBANK_URL;

  const anmeldung = require('../anmeldung');

  // Ein kleiner Server nur mit Anmeldung und /api/ich: Die API selbst hat eigene Tests.
  const server = http.createServer(async (anfrage, antwort) => {
    const adresse = new URL(anfrage.url, 'http://server');
    try {
      if (adresse.pathname === '/anmeldung') return await anmeldung.starten(anfrage, antwort);
      if (adresse.pathname === '/anmeldung/rueckkehr') return await anmeldung.rueckkehr(anfrage, antwort, adresse.searchParams);
      if (adresse.pathname === '/abmeldung') return await anmeldung.abmelden(anfrage, antwort);
      const wer = anmeldung.person(anfrage);
      antwort.writeHead(wer ? 200 : 401, { 'Content-Type': 'application/json' });
      antwort.end(JSON.stringify(wer || { fehler: 'Nicht angemeldet' }));
    } catch (e) {
      antwort.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      antwort.end(e.message);
    }
  });
  await new Promise((f) => server.listen(0, f));
  SERVER_ADRESSE = 'http://localhost:' + server.address().port;
  process.env.APP_URL = SERVER_ADRESSE;

  abschnitt('Rollen aus den Gruppen');

  pruefe('Gruppen mit und ohne führenden Schrägstrich, Groß- und Kleinschreibung', (() => {
    const faelle = [
      [{ groups: ['berichtsheft-azubi'] }, 'azubi'],
      [{ groups: ['/Berichtsheft-Ausbilder'] }, 'ausbilder'],
      [{ groups: ['/berichtsheft-azubi', '/berichtsheft-ausbilder'] }, 'ausbilder'],
      [{ groups: ['wiki-admin'] }, null],
      [{}, null],
    ];
    const falsch = faelle.filter(([claims, erwartet]) => anmeldung.rolleAusClaims(claims) !== erwartet);
    return falsch.length ? falsch.map(([c]) => JSON.stringify(c)).join(', ') : true;
  })());

  abschnitt('Anmeldeablauf');

  const azubi = await anmelden({ groups: ['berichtsheft-azubi'], name: 'Alex Azubi' });
  const ziel = azubi.ziel;
  pruefe('Weiterleitung zum Anbieter mit PKCE und nonce',
    ziel.searchParams.get('code_challenge_method') === 'S256'
    && ziel.searchParams.get('code_challenge')
    && ziel.searchParams.get('nonce')
    && ziel.searchParams.get('redirect_uri') === SERVER_ADRESSE + '/anmeldung/rueckkehr',
    Object.fromEntries(ziel.searchParams));

  pruefe('Rückkehr setzt die Sitzung und führt zurück ins Werkzeug',
    azubi.antwort.status === 302 && azubi.antwort.headers.get('location') === '/'
    && cookies.has(anmeldung.SITZUNG_COOKIE));

  pruefe('Der Prüfer (PKCE) geht an den Anbieter, nicht die Ableitung',
    letzteAnfrage.get('code_verifier') && letzteAnfrage.get('code_verifier').length >= 43
    && letzteAnfrage.get('client_secret') === 'geheim');

  const ich = await (await ruf('/api/ich')).json();
  pruefe('Angemeldet als Azubi mit Namen aus dem Token',
    ich.rolle === 'azubi' && ich.name === 'Alex Azubi' && ich.id === 'konto-1', ich);

  const ausbilder = await anmelden({ groups: ['/berichtsheft-ausbilder'], name: 'Carla Ausbilderin', sub: 'konto-2' });
  pruefe('Ausbilder bekommt die Rolle aus seiner Gruppe',
    ausbilder.antwort.status === 302 && (await (await ruf('/api/ich')).json()).rolle === 'ausbilder');

  abschnitt('Abmelden');

  const ab = await ruf('/abmeldung');
  pruefe('Abmelden löscht die Sitzung und meldet beim Anbieter ab',
    ab.status === 302 && ab.headers.get('location').startsWith(ANBIETER_ADRESSE + '/abmelden')
    && !cookies.has(anmeldung.SITZUNG_COOKIE));
  pruefe('Danach ist man draußen', (await ruf('/api/ich')).status === 401);

  abschnitt('Was nicht hineinkommen darf');

  const fremd = await anmelden({ groups: ['wiki-mitarbeiter'], sub: 'konto-3' });
  pruefe('Ohne passende Gruppe kein Zugang',
    fremd.antwort.status === 403 && !cookies.has(anmeldung.SITZUNG_COOKIE),
    await fremd.antwort.text());

  const faelle = [
    ['Falsche Signatur', { groups: ['berichtsheft-azubi'] }, { kaputt: true }],
    ['Unbekannter Schlüssel', { groups: ['berichtsheft-azubi'] }, { kid: 'anderer' }],
    ['Fremder Herausgeber', { groups: ['berichtsheft-azubi'], iss: 'https://boese.invalid' }, {}],
    ['Fremder Empfänger', { groups: ['berichtsheft-azubi'], aud: 'anderes-werkzeug' }, {}],
    ['Abgelaufenes Token', { groups: ['berichtsheft-azubi'], exp: Math.floor(Date.now() / 1000) - 60 }, {}],
    ['Falscher nonce', { groups: ['berichtsheft-azubi'], nonce: 'untergeschoben' }, {}],
  ];
  for (const [name, claims, einstellungen] of faelle) {
    const versuch = await anmelden(claims, einstellungen);
    pruefe(name + ' wird abgewiesen',
      versuch.antwort.status === 403 && !cookies.has(anmeldung.SITZUNG_COOKIE), await versuch.antwort.text());
  }

  await anmelden({ groups: ['berichtsheft-azubi'], name: 'Alex Azubi' });
  const echt = cookies.get(anmeldung.SITZUNG_COOKIE);
  const [nutzlast, signatur] = decodeURIComponent(echt).split('.');
  const daten = JSON.parse(Buffer.from(nutzlast, 'base64url').toString('utf8'));
  daten.rolle = 'ausbilder';
  const gefaelscht = Buffer.from(JSON.stringify(daten)).toString('base64url') + '.' + signatur;
  cookies.set(anmeldung.SITZUNG_COOKIE, encodeURIComponent(gefaelscht));
  pruefe('Selbst zum Ausbilder gemachtes Cookie fliegt raus', (await ruf('/api/ich')).status === 401);

  cookies.set(anmeldung.SITZUNG_COOKIE, encodeURIComponent(echt));
  pruefe('Das echte Cookie gilt weiter', (await (await ruf('/api/ich')).json()).rolle === 'azubi');

  // Ein anderes Werkzeug derselben Domain setzt ein Cookie mit losem „%“. Früher warf das Lesen
  // der Cookies, und jede Anfrage dieses Browsers scheiterte.
  cookies.set('rabatt', '50%');
  const mitFremdem = await ruf('/api/ich');
  pruefe('Ein fremdes Cookie mit losem % stört die Sitzung nicht',
    mitFremdem.status === 200 && (await mitFremdem.json()).rolle === 'azubi', mitFremdem.status);
  cookies.delete('rabatt');

  const abgelaufen = { ...daten, rolle: 'azubi', bis: Date.now() - 1000 };
  const alt = Buffer.from(JSON.stringify(abgelaufen)).toString('base64url');
  const hmac = crypto.createHmac('sha256', process.env.SITZUNG_GEHEIMNIS).update(alt).digest('base64url');
  cookies.set(anmeldung.SITZUNG_COOKIE, encodeURIComponent(alt + '.' + hmac));
  pruefe('Abgelaufene Sitzung gilt nicht mehr', (await ruf('/api/ich')).status === 401);

  const ohneFlug = await (async () => {
    cookies.clear();
    return ruf('/anmeldung/rueckkehr?code=abc&state=irgendwas');
  })();
  pruefe('Rückkehr ohne begonnene Anmeldung wird abgewiesen', ohneFlug.status === 403);

  await new Promise((f) => server.close(f));
  await new Promise((f) => anbieter.close(f));

  console.log('\n  ' + (gescheitert.length
    ? rot('✗ ' + gescheitert.length + ' gescheitert') + grau(', ' + bestanden + ' bestanden')
    : gruen('✓ ' + bestanden + ' bestanden')) + '\n');
  process.exit(gescheitert.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
