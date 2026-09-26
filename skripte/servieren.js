#!/usr/bin/env node
/**
 * Liefert dist/ unter http://localhost:8080 aus – ohne Abhängigkeiten, nur für den eigenen Rechner.
 *
 *   npm start            # nach npm run build
 *   npm start -- 8081    # anderer Port
 *
 * Warum das hilft: Eine Datei per Doppelklick hat im Browser keine Herkunft ("null"). Ollama lehnt
 * solche Anfragen ab, und nur `OLLAMA_ORIGINS="*"` öffnet sie – das erlaubt dann aber jeder Webseite
 * den Zugriff auf das lokale Ollama. Über localhost braucht es diese Einstellung nicht: Adressen mit
 * localhost lässt Ollama von Haus aus zu.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('dist/index.html fehlt. Erst bauen: npm run build');
  process.exit(1);
}

const server = http.createServer((anfrage, antwort) => {
  let weg;
  try {
    weg = decodeURIComponent((anfrage.url || '/').split('?')[0]);
  } catch {
    weg = ''; // Einzelnes % in der Adresse: als "nicht gefunden" behandeln, nicht abstürzen.
  }
  // Nie aus dist/ heraus: Pfade wie ../../ werden aufgelöst und dann geprüft.
  // Der Trenner dahinter gehört dazu, sonst zählte auch ein Nachbarordner "dist-alt" als innerhalb.
  const datei = path.normalize(path.join(DIST, weg === '/' ? 'index.html' : weg));
  if (!datei.startsWith(DIST + path.sep) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
    antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return antwort.end('Nicht gefunden');
  }
  antwort.writeHead(200, {
    'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(datei).pipe(antwort);
});

// Nur für diesen Rechner. Im Netz teilen: docker-compose.lokal.yml (docs/KI.md, Teil B).
server.listen(PORT, '127.0.0.1', () => {
  console.log('Berichtsheft läuft auf http://localhost:' + PORT + '  (beenden mit Strg + C)');
});
