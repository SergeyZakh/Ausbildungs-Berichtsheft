/**
 * Gemeinsame Helfer für die Browsertests.
 */
const { chromium } = require('playwright');
const JSZip = require('jszip');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

const DIST = path.join(__dirname, '..', 'dist');
/* Die Seite als Datei. Nur für Tests, die genau das prüfen: die Einzeldatei (lokal.js), das
   Neuladen bei leerem Speicher (lauf.js) und die Suche nach dem Sprachmodell (ki.js). */
const DATEI_SEITE = pathToFileURL(path.join(DIST, 'index.html')).href;
/* Alle anderen öffnen die Seite über http (dienerStarten()). Über file:// verlor Chromium in CI
   gelegentlich, was eine Seite direkt vor dem Neuladen gespeichert hatte: Bundesland, geladene
   Sicherung, untergeschobener Tag. Lokal trat das nie auf, auf dem Bau-Server in drei von elf
   Läufen, zuletzt zweimal hintereinander. Über http kennt die Doku das Problem nicht. */
let SEITE = null;
const EINZELDATEI = path.join(DIST, 'Berichtsheft.html');
const SPEICHER = 'berichtsheft-v1';
const RUNDGANG = 'berichtsheft-onboarding';

/** Eine Datei aus test/daten/ (Beispielexporte und Formate). */
const testdatei = (name) => path.join(__dirname, 'daten', name);

/* Farbe nur, wenn jemand zusieht. In eine Datei oder Pipe umgeleitet stünden sonst
   Steuerzeichen im Protokoll; NO_COLOR ist die übliche Notbremse. */
const FARBIG = !!process.stdout.isTTY && !process.env.NO_COLOR;
const farbe = (nummer) => (text) => (FARBIG ? '\u001b[' + nummer + 'm' + text + '\u001b[0m' : text);
const gruen = farbe(32), rot = farbe(31), grau = farbe(90), fett = farbe(1);

/**
 * Zählt Prüfungen und gibt am Ende das Protokoll aus.
 *
 * `titel` steht über dem Block; ohne Angabe der Name der laufenden Datei. `npm test` ruft
 * fünf Testdateien nacheinander auf – ohne Überschrift ist hinterher nicht zu sehen,
 * welcher Block zu welcher gehört.
 */
function protokoll(titel) {
  const ueberschrift = titel || path.basename(process.argv[1] || 'Test', '.js');
  let bestanden = 0, gescheitert = 0;
  const zeilen = [];
  return {
    pruefe(name, ok, hinweis) {
      zeilen.push({ ok: !!ok, name: name, hinweis: hinweis });
      if (ok) bestanden++; else gescheitert++;
    },
    /** Ausgabe und Exit-Code; `nurFehler` blendet die bestandenen Zeilen aus. */
    abschluss(nurFehler) {
      const zeig = nurFehler ? zeilen.filter((z) => !z.ok) : zeilen;
      console.log('\n' + fett(ueberschrift) + grau('   ' + zeilen.length + ' Prüfungen'));
      zeig.forEach((z) => console.log(z.ok
        ? '  ' + gruen('OK') + '    ' + z.name
        : '  ' + rot('FEHLT') + ' ' + z.name + (z.hinweis ? grau('  →  ' + z.hinweis) : '')));
      // Sonst stünde bei ausgeblendeten Einzelfällen (korpus.js) nur eine Zahl im Leeren.
      if (nurFehler && !gescheitert) console.log(grau('  jeder Fall geprüft, Einzelzeilen ausgeblendet'));
      console.log('\n  ' + (gescheitert
        ? rot('✗ ' + gescheitert + ' gescheitert') + grau(', ' + bestanden + ' bestanden')
        : gruen('✓ ' + bestanden + ' bestanden')) + '\n');
      process.exit(gescheitert ? 1 : 0);
    },
  };
}

function pruefeBuild() {
  if (!fs.existsSync(path.join(DIST, 'index.html')) || !fs.existsSync(EINZELDATEI)) {
    console.error('dist/ fehlt. Erst "npm run build" ausführen.');
    process.exit(1);
  }
}

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml',
};

/**
 * dist/ über http auf einem freien Port dieses Rechners, solange der Testprozess läuft. Wie ein
 * Webserver ohne Berichtsheft-Server: /api/ich beantwortet er mit 404, das Werkzeug arbeitet
 * dann ohne Konto (kontoStarten() in konto.js).
 */
function dienerStarten() {
  const diener = http.createServer((anfrage, antwort) => {
    let weg = '';
    try { weg = decodeURIComponent((anfrage.url || '/').split('?')[0]); } catch (e) { /* wird 404 */ }
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
  // Hält den Testprozess nicht am Leben, wenn die Tests fertig sind.
  diener.unref();
  return new Promise((fertig) => diener.listen(0, '127.0.0.1', () => {
    fertig('http://127.0.0.1:' + diener.address().port + '/index.html');
  }));
}

async function starteBrowser() {
  pruefeBuild();
  if (!SEITE) SEITE = await dienerStarten();
  return chromium.launch();
}

/**
 * Seite öffnen, bei file:// zweimal. Chromium hängt das erste Dokument eines neuen Tabs mit
 * file:// gelegentlich an einen Speicher, der mit dem Tab verschwindet (speicherNeuLaden() in
 * src/js/kern/grundlagen.js). Das trifft Seiten, die gleich beim Laden auf den Speicher zugreifen,
 * und genau das tut ohneRundgang(). Ohne das zweite Öffnen verlor ein Test in rund 13 % der Läufe
 * nach dem nächsten Neuladen seine Daten. Ohne vorher gestarteten Browser (und damit ohne
 * Webserver) bleibt es bei der Datei.
 */
async function oeffnen(page, adresse = SEITE || DATEI_SEITE) {
  await page.goto(adresse);
  if (adresse.startsWith('file:')) await page.goto(adresse);
}

/** Einrichtung (Azubi) und Rundgang (Ausbilder) beim ersten Start würden jeden Klick abfangen. */
async function ohneRundgang(page) {
  await page.addInitScript((schluessel) => {
    try { localStorage.setItem(schluessel, '1'); localStorage.setItem(schluessel + '-ausbilder', '1'); } catch (e) {}
  }, RUNDGANG);
}

/**
 * Nummerierte Marken für die Bilder der Doku auf die Seite legen.
 *
 * Jede Marke ist ein Rahmen um das Element und eine Zahl daran: Der Rahmen zeigt, welche
 * Fläche gemeint ist, die Zahl verweist auf die Liste, die in der Doku unter dem Bild steht.
 *
 * Beides entsteht im Browser über den gefundenen Elementen, nicht nachträglich im Bild:
 * Verschiebt sich die Oberfläche, wandert die Marke mit. Fällt ein Element weg, bricht die
 * Aufnahme mit dem Namen der Stelle ab – besser, als still auf die falsche zu zeigen.
 *
 *   await markieren(page, [['#reiter', 1], ['#feld-art', 2, 'rechts']]);
 *   await markieren(page, []);            // Marken wieder entfernen
 *
 * Die Lage sagt, wohin die Marke gehört. Auf einer Ecke des Elements: "links" (Vorgabe),
 * "rechts", "unten-links", "unten-rechts" – passt für Karten und große Flächen.
 * Daneben, ohne etwas zu verdecken: "davor", "danach", "darueber", "darunter" – für Knöpfe
 * und Felder. Liegen zwei Marken zu dicht, weicht die spätere selbsttätig aus.
 */
async function markieren(page, marken) {
  const fehlend = await page.evaluate((liste) => {
    const alt = document.getElementById('__marken');
    if (alt) alt.remove();
    const schicht = document.createElement('div');
    schicht.id = '__marken';
    schicht.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    // Ein modaler <dialog> liegt im Top-Layer und deckt jedes z-index zu. Die Marken
    // müssen dann in den Dialog selbst, sonst wären sie im Bild nicht zu sehen.
    const modal = [...document.querySelectorAll('dialog[open]')].find((d) => d.matches(':modal'));
    (modal || document.body).appendChild(schicht);
    const fehlt = [];
    const gesetzt = [];
    const MASS = 26, LUFT = 10;   // Durchmesser der Marke, kleinster Abstand zwischen zweien
    const RAND = 4;               // Luft zwischen Element und Rahmen
    const klemm = (wert, grenze) => Math.max(4, Math.min(wert, grenze - MASS - 4));
    const frei = (x, y) => gesetzt.every(
      (p) => Math.abs(p.x - x) >= MASS + LUFT || Math.abs(p.y - y) >= MASS + LUFT);

    liste.forEach(([wahl, nummer, ecke]) => {
      const el = document.querySelector(wahl);
      if (!el) { fehlt.push(wahl + ' (nichts gefunden)'); return; }
      const roh = el.getBoundingClientRect();
      // Versteckt zählt wie nicht vorhanden: Zwei Knöpfe derselben Stelle liegen hier
      // gleichzeitig im Baum (Fertig und Bearbeiten), nur einer ist sichtbar. Ohne diese
      // Prüfung entstünde ein Rahmen von 0 × 0 und eine Zahl in der Bildecke.
      if (!roh.width || !roh.height) { fehlt.push(wahl + ' (unsichtbar)'); return; }
      // Der Rahmen sagt, welche Fläche gemeint ist – die Zahl allein zeigt nur eine Stelle.
      // Er liegt knapp außerhalb des Elements, damit er nichts überdeckt.
      // Auf das Bild beschnitten: Eine Fläche, die unter den Rand reicht (etwa die Vorschau
      // des Wochenblatts), zöge ihren Rahmen sonst als zwei Striche durch das ganze Bild.
      const r = {
        left: Math.max(roh.left - RAND, 2),
        top: Math.max(roh.top - RAND, 2),
        right: Math.min(roh.right + RAND, innerWidth - 2),
        bottom: Math.min(roh.bottom + RAND, innerHeight - 2),
      };
      r.width = r.right - r.left;
      r.height = r.bottom - r.top;
      const rahmen = document.createElement('span');
      rahmen.style.cssText =
        'position:absolute;box-sizing:border-box;border:2px solid #16161A;border-radius:10px;' +
        // Heller Saum nach außen, damit der Rahmen auch auf dunklem Grund zu sehen ist.
        'box-shadow:0 0 0 2px rgba(255,255,255,.75);' +
        'left:' + r.left + 'px;top:' + r.top + 'px;' +
        'width:' + r.width + 'px;height:' + r.height + 'px';
      schicht.appendChild(rahmen);

      // Auf der Ecke sitzt die Marke halb über dem Rahmen – richtig für große Flächen,
      // bei einem Knopf verdeckt sie die Aufschrift. Dafür gibt es die vier Lagen daneben.
      const halb = MASS / 2;
      const [x0, y0] = {
        davor: [r.left - MASS - LUFT, r.top],
        danach: [r.right + LUFT, r.top],
        darueber: [r.left, r.top - MASS - LUFT],
        darunter: [r.left, r.bottom + LUFT],
        rechts: [r.right - halb, r.top - halb],
        'unten-links': [r.left - halb, r.bottom - halb],
        'unten-rechts': [r.right - halb, r.bottom - halb],
      }[ecke] || [r.left - halb, r.top - halb];

      // Gewünschte Stelle zuerst, dann rundherum ausweichen. Zwei Marken übereinander
      // wären im Bild nicht mehr auseinanderzuhalten, und die Legende zeigte ins Leere.
      const schritt = MASS + LUFT;
      const wege = [[0, 0]];
      for (let ring = 1; ring <= 3; ring++) {
        [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]
          .forEach(([dx, dy]) => wege.push([dx * ring * schritt, dy * ring * schritt]));
      }
      let x = klemm(x0, innerWidth), y = klemm(y0, innerHeight);
      for (const [dx, dy] of wege) {
        const px = klemm(x0 + dx, innerWidth), py = klemm(y0 + dy, innerHeight);
        if (frei(px, py)) { x = px; y = py; break; }
      }
      gesetzt.push({ x, y });

      const punkt = document.createElement('span');
      punkt.textContent = String(nummer);
      punkt.style.cssText =
        'position:absolute;display:flex;align-items:center;justify-content:center;' +
        'width:' + MASS + 'px;height:' + MASS + 'px;border-radius:50%;' +
        'background:#16161A;color:#fff;font:600 15px/1 system-ui,sans-serif;' +
        // Weißer Ring, damit die Marke auch auf dunklem Grund stehen bleibt.
        'box-shadow:0 0 0 3px #fff,0 2px 6px rgba(22,22,26,.35);' +
        'left:' + x + 'px;top:' + y + 'px';
      schicht.appendChild(punkt);
    });
    return fehlt;
  }, marken);
  if (fehlend.length) throw new Error('Marke ohne Element: ' + fehlend.join(', '));
}

/** JavaScript-Fehler der Seite sammeln. */
function fehlerSammeln(page) {
  const fehler = [];
  page.on('pageerror', (e) => { fehler.push(e.message); if (process.env.STACKS) console.log('STACK:', String(e.stack).split('\n').slice(0, 4).join(' | ')); });
  return fehler;
}

/** Den Reiter im Stammdatendialog öffnen, in dem das Feld steckt. */
async function stammReiter(page, id) {
  const ziel = await page.evaluate((x) => {
    const el = document.getElementById(x);
    const blatt = el && el.closest('.dlg-blatt');
    return blatt ? blatt.getAttribute('data-blatt') : null;
  }, id.replace('#', ''));
  if (ziel) {
    await page.click('.blattleiste button[data-ziel="' + ziel + '"]');
    await page.waitForTimeout(120);
  }
}

async function stammFuellen(page, id, wert) {
  await stammReiter(page, id);
  await page.fill(id, wert);
}

async function stammdatenOeffnen(page) {
  await page.click('#btn-mehr');
  await page.waitForTimeout(250);
  await page.click('#btn-stamm');
  await page.waitForTimeout(300);
}

/**
 * Die Kontrolle vor dem Export mit "Trotzdem exportieren" beantworten.
 * In frisch geladenen Testdaten ist nichts übernommen, also fragt sie immer.
 */
async function exportTrotzdem(page) {
  const dlg = page.locator('#dlg-pruefung');
  for (let i = 0; i < 20; i++) {
    if (await dlg.isVisible()) { await page.click('#pruef-ja'); await page.waitForTimeout(200); return true; }
    await page.waitForTimeout(100);
  }
  return false;
}

/** Downloads der Seite mitschreiben: [{ name, daten: Buffer }]. */
function downloadsSammeln(page) {
  const dateien = [];
  page.on('download', async (download) => {
    const pfad = await download.path();
    dateien.push({ name: download.suggestedFilename(), daten: fs.readFileSync(pfad) });
  });
  return dateien;
}

/** Auf eine Datei mit diesem Namensanfang warten, die nach `ab` Dateien kommt. */
async function warteAufDatei(dateien, praefix, ab = 0, maxMs = 20000) {
  const bis = Date.now() + maxMs;
  while (Date.now() < bis) {
    const treffer = dateien.slice(ab).find((d) => d.name.startsWith(praefix));
    if (treffer) return treffer;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** Eine Word-Datei entpacken: { dokument, kopfzeilen: [xml, …] }. */
async function docxLesen(daten) {
  const zip = await JSZip.loadAsync(daten);
  const kopfzeilen = [];
  for (const name of Object.keys(zip.files)) {
    if (/^word\/header\d+\.xml$/.test(name)) kopfzeilen.push(await zip.files[name].async('string'));
  }
  return { dokument: await zip.file('word/document.xml').async('string'), kopfzeilen };
}

/** Alle <w:t>-Inhalte zu einem Fließtext zusammenziehen. */
function sichtbarerText(xml) {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ''))
    .join(' ');
}

/**
 * Warten, bis das große Schreibfeld steht: Es fährt mit einer Animation herein. Eine feste Pause
 * reichte am Rechner, auf dem langsameren CI-Rechner stand es nach 300 ms noch 2 px zu tief.
 */
async function schreibfeldSteht(page) {
  await page.waitForFunction(() => {
    const d = document.getElementById('dlg-schreiben');
    return d.open && d.classList.contains('da') && d.getAnimations({ subtree: true }).every((a) => a.playState === 'finished');
  }, null, { timeout: 3000 });
}

module.exports = {
  // Erst nach starteBrowser() gesetzt, deshalb als Getter.
  get SEITE() { return SEITE; },
  DATEI_SEITE, EINZELDATEI, SPEICHER, RUNDGANG, testdatei,
  protokoll, starteBrowser, oeffnen, ohneRundgang, fehlerSammeln, markieren,
  stammReiter, stammFuellen, stammdatenOeffnen, exportTrotzdem,
  downloadsSammeln, warteAufDatei, docxLesen, sichtbarerText, schreibfeldSteht,
};
