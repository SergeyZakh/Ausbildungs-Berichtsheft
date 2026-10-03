/**
 * Anmeldung über einen OIDC-Anbieter (Keycloak, Authentik, Entra …).
 *
 *   /anmeldung           schickt zum Anbieter
 *   /anmeldung/rueckkehr holt die Token ab, prüft sie und setzt die Sitzung
 *   /abmeldung           beendet Sitzung und, wenn möglich, die Sitzung beim Anbieter
 *
 * Ohne Bibliothek: Authorization Code mit PKCE, Prüfung des ID-Tokens gegen den JWKS des Anbieters
 * (Signatur, iss, aud, exp, nonce). Die Sitzung steckt in einem signierten Cookie, es gibt keine
 * Sitzungstabelle: Der Server hält nichts, was er nicht braucht.
 *
 * Rollen kommen aus den Gruppen im Token: „berichtsheft-ausbilder“ oder „berichtsheft-azubi“.
 * Wer keine der beiden Gruppen hat, kommt nicht hinein.
 */
'use strict';

const crypto = require('crypto');

const SITZUNG_COOKIE = 'berichtsheft_sitzung';
const FLUG_COOKIE = 'berichtsheft_anmeldung';

function konfig() {
  const k = {
    issuer: (process.env.OIDC_ISSUER || '').replace(/\/+$/, ''),
    clientId: process.env.OIDC_CLIENT_ID || '',
    clientSecret: process.env.OIDC_CLIENT_SECRET || '',
    adresse: (process.env.APP_URL || '').replace(/\/+$/, ''),
    gruppenClaim: process.env.OIDC_GRUPPEN_CLAIM || 'groups',
    praefix: process.env.OIDC_GRUPPEN_PRAEFIX || 'berichtsheft-',
    nameClaim: process.env.OIDC_NAME_CLAIM || 'name',
    geheimnis: process.env.SITZUNG_GEHEIMNIS || '',
    stunden: Number(process.env.SITZUNG_STUNDEN || 10),
  };
  k.rueckkehr = k.adresse + '/anmeldung/rueckkehr';
  return k;
}

function aktiv() {
  const k = konfig();
  return Boolean(k.issuer && k.clientId && k.adresse && k.geheimnis);
}

/* ---------- Kleinkram ---------- */

const base64url = (puffer) => Buffer.from(puffer).toString('base64url');

function signieren(text) {
  return crypto.createHmac('sha256', konfig().geheimnis).update(text).digest('base64url');
}

/** Wert als Cookie verpacken: Nutzlast und Signatur, damit niemand sich selbst zum Ausbilder macht. */
function packen(daten) {
  const nutzlast = base64url(JSON.stringify(daten));
  return nutzlast + '.' + signieren(nutzlast);
}

function auspacken(wert) {
  const [nutzlast, signatur] = String(wert || '').split('.');
  if (!nutzlast || !signatur) return null;
  const erwartet = Buffer.from(signieren(nutzlast));
  const bekommen = Buffer.from(signatur);
  if (erwartet.length !== bekommen.length || !crypto.timingSafeEqual(erwartet, bekommen)) return null;
  try {
    const daten = JSON.parse(Buffer.from(nutzlast, 'base64url').toString('utf8'));
    return daten.bis && daten.bis < Date.now() ? null : daten;
  } catch (e) {
    return null;
  }
}

function cookiesLesen(anfrage) {
  const kopf = anfrage.headers.cookie || '';
  const cookies = {};
  for (const teil of kopf.split(';')) {
    const stelle = teil.indexOf('=');
    if (stelle <= 0) continue;
    // Auch Cookies anderer Werkzeuge derselben Domain kommen hier an. Trägt eines ein loses „%“,
    // warf decodeURIComponent, und jede Anfrage dieses Browsers endete mit Fehler 500.
    let wert = teil.slice(stelle + 1).trim();
    try { wert = decodeURIComponent(wert); } catch (e) { /* bleibt, wie es kam */ }
    cookies[teil.slice(0, stelle).trim()] = wert;
  }
  return cookies;
}

function cookieSetzen(name, wert, sekunden) {
  const sicher = konfig().adresse.startsWith('https://') ? '; Secure' : '';
  return `${name}=${encodeURIComponent(wert)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sekunden}${sicher}`;
}

/* ---------- Anbieter ---------- */

let entdeckt = null;
let schluessel = null;

async function anbieter() {
  if (entdeckt) return entdeckt;
  const antwort = await fetch(konfig().issuer + '/.well-known/openid-configuration');
  if (!antwort.ok) throw new Error('Anmeldedienst antwortet nicht (' + antwort.status + ')');
  entdeckt = await antwort.json();
  return entdeckt;
}

async function schluesselHolen(kid) {
  if (!schluessel || !schluessel.keys.some((k) => k.kid === kid)) {
    const antwort = await fetch((await anbieter()).jwks_uri);
    if (!antwort.ok) throw new Error('Schlüssel des Anmeldedienstes nicht erreichbar');
    schluessel = await antwort.json();
  }
  const jwk = schluessel.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error('Unbekannter Schlüssel im Token');
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

const ALGORITHMEN = { RS256: 'RSA-SHA256', RS384: 'RSA-SHA384', RS512: 'RSA-SHA512' };

/** ID-Token prüfen: Signatur, Herausgeber, Empfänger, Ablauf, nonce. */
async function tokenPruefen(token, nonce) {
  const teile = String(token || '').split('.');
  if (teile.length !== 3) throw new Error('Token hat nicht die erwartete Form');
  const kopf = JSON.parse(Buffer.from(teile[0], 'base64url').toString('utf8'));
  const inhalt = JSON.parse(Buffer.from(teile[1], 'base64url').toString('utf8'));
  const algorithmus = ALGORITHMEN[kopf.alg];
  if (!algorithmus) throw new Error('Nicht unterstütztes Signaturverfahren: ' + kopf.alg);

  const echt = crypto.verify(algorithmus, Buffer.from(teile[0] + '.' + teile[1]),
    await schluesselHolen(kopf.kid), Buffer.from(teile[2], 'base64url'));
  if (!echt) throw new Error('Signatur des Tokens stimmt nicht');

  const k = konfig();
  const empfaenger = Array.isArray(inhalt.aud) ? inhalt.aud : [inhalt.aud];
  if (inhalt.iss !== (await anbieter()).issuer) throw new Error('Token kommt von woanders');
  if (!empfaenger.includes(k.clientId)) throw new Error('Token ist nicht für dieses Werkzeug');
  if (!inhalt.exp || inhalt.exp * 1000 < Date.now()) throw new Error('Token ist abgelaufen');
  if (nonce && inhalt.nonce !== nonce) throw new Error('Token gehört nicht zu dieser Anmeldung');
  return inhalt;
}

/** Rolle aus den Gruppen; null heißt: darf nicht hinein. */
function rolleAusClaims(claims) {
  const k = konfig();
  const gruppen = []
    .concat(claims[k.gruppenClaim] || [])
    .map((g) => String(g).replace(/^\//, '').toLowerCase());
  if (gruppen.includes(k.praefix + 'ausbilder')) return 'ausbilder';
  if (gruppen.includes(k.praefix + 'azubi')) return 'azubi';
  return null;
}

/* ---------- Wege ---------- */

/** Schritt 1: zum Anbieter schicken. */
async function starten(anfrage, antwort) {
  const k = konfig();
  const flug = {
    state: base64url(crypto.randomBytes(16)),
    nonce: base64url(crypto.randomBytes(16)),
    pruefer: base64url(crypto.randomBytes(32)),
    bis: Date.now() + 10 * 60 * 1000,
  };
  const ziel = new URL((await anbieter()).authorization_endpoint);
  ziel.searchParams.set('response_type', 'code');
  ziel.searchParams.set('client_id', k.clientId);
  ziel.searchParams.set('redirect_uri', k.rueckkehr);
  ziel.searchParams.set('scope', process.env.OIDC_SCOPES || 'openid profile email');
  ziel.searchParams.set('state', flug.state);
  ziel.searchParams.set('nonce', flug.nonce);
  ziel.searchParams.set('code_challenge', base64url(crypto.createHash('sha256').update(flug.pruefer).digest()));
  ziel.searchParams.set('code_challenge_method', 'S256');

  antwort.writeHead(302, {
    'Set-Cookie': cookieSetzen(FLUG_COOKIE, packen(flug), 600),
    Location: ziel.toString(),
  });
  antwort.end();
}

/** Schritt 2: Code eintauschen, Token prüfen, Sitzung setzen. */
async function rueckkehr(anfrage, antwort, suche) {
  const k = konfig();
  const flug = auspacken(cookiesLesen(anfrage)[FLUG_COOKIE]);
  if (!flug) throw new Error('Die Anmeldung ist abgelaufen. Bitte noch einmal versuchen.');
  if (suche.get('error')) throw new Error('Der Anmeldedienst meldet: ' + suche.get('error'));
  if (!suche.get('code') || suche.get('state') !== flug.state) throw new Error('Antwort passt nicht zur Anmeldung');

  const felder = new URLSearchParams({
    grant_type: 'authorization_code',
    code: suche.get('code'),
    redirect_uri: k.rueckkehr,
    client_id: k.clientId,
    code_verifier: flug.pruefer,
  });
  if (k.clientSecret) felder.set('client_secret', k.clientSecret);

  const tausch = await fetch((await anbieter()).token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: felder,
  });
  if (!tausch.ok) throw new Error('Token-Tausch gescheitert (' + tausch.status + ')');
  const token = await tausch.json();
  const claims = await tokenPruefen(token.id_token, flug.nonce);

  const rolle = rolleAusClaims(claims);
  if (!rolle) {
    const k2 = konfig();
    throw new Error(`Kein Zugang: Dein Konto ist in keiner der Gruppen „${k2.praefix}azubi“ oder „${k2.praefix}ausbilder“.`);
  }

  const sitzung = {
    id: String(claims.sub),
    name: String(claims[k.nameClaim] || claims.preferred_username || claims.email || claims.sub),
    rolle,
    abmeldeZeiger: token.id_token,
    bis: Date.now() + k.stunden * 3600 * 1000,
  };
  antwort.writeHead(302, {
    'Set-Cookie': [
      cookieSetzen(SITZUNG_COOKIE, packen(sitzung), k.stunden * 3600),
      cookieSetzen(FLUG_COOKIE, '', 0),
    ],
    Location: '/',
  });
  antwort.end();
}

/** Angemeldete Person aus dem Cookie; null, wenn niemand angemeldet ist. */
function person(anfrage) {
  const sitzung = auspacken(cookiesLesen(anfrage)[SITZUNG_COOKIE]);
  return sitzung && sitzung.id && sitzung.rolle ? { id: sitzung.id, name: sitzung.name, rolle: sitzung.rolle } : null;
}

async function abmelden(anfrage, antwort) {
  const sitzung = auspacken(cookiesLesen(anfrage)[SITZUNG_COOKIE]);
  const k = konfig();
  let ziel = '/';
  const ende = (await anbieter().catch(() => ({}))).end_session_endpoint;
  if (ende) {
    const adresse = new URL(ende);
    // Ohne Sitzung (etwa nach „Kein Zugang“) kennt nur der Anbieter das Konto; dann per client_id.
    // Keycloak fragt in dem Fall einmal nach, ob wirklich abgemeldet werden soll.
    if (sitzung?.abmeldeZeiger) adresse.searchParams.set('id_token_hint', sitzung.abmeldeZeiger);
    else adresse.searchParams.set('client_id', k.clientId);
    adresse.searchParams.set('post_logout_redirect_uri', k.adresse + '/');
    ziel = adresse.toString();
  }
  antwort.writeHead(302, { 'Set-Cookie': cookieSetzen(SITZUNG_COOKIE, '', 0), Location: ziel });
  antwort.end();
}

module.exports = { aktiv, starten, rueckkehr, person, abmelden, rolleAusClaims, tokenPruefen, SITZUNG_COOKIE };
