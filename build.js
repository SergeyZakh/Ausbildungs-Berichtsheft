#!/usr/bin/env node
/**
 * Baut das Werkzeug aus src/ in zwei Fassungen:
 *
 *   dist/index.html + dist/vendor/docx.js   für den Webserver (Docker/nginx)
 *   dist/Berichtsheft.html                  eine Datei zum Doppelklicken,
 *                                           Word-Bibliothek eingebettet
 *
 * Beide Fassungen kommen ohne Internet aus: Schrift, Stile und Skripte
 * stehen in der Seite.
 *
 *   node build.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

/* Reihenfolge ist wichtig: Die JS-Dateien teilen sich einen
   Gültigkeitsbereich, und Konstanten müssen vor ihrer ersten
   Verwendung beim Laden stehen. start.js läuft zuletzt. Die Ordner
   ordnen nur nach Aufgabe (kern, import, ki, ansicht, ausgabe, konto);
   für den Build zählt allein diese Liste. */
const CSS = ['basis.css', 'leiste.css', 'tag.css', 'dialoge.css', 'handy.css', 'ausbilder.css', 'blatt.css'];
const JS = [
  'kern/grundlagen.js',
  'import/csv.js',
  'import/bereinigung.js',
  'import/quellen.js',
  'import/entwurf.js',
  'import/schule.js',
  'ki/ki-vorlage.js',
  'ki/ki.js',
  'ki/ki-lauf.js',
  'kern/zustand.js',
  'ansicht/ansicht-woche.js',
  'ansicht/reiter.js',
  'ansicht/ansicht-tag.js',
  'ansicht/herkunft.js',
  'ansicht/wochenblatt.js',
  'ansicht/schulwoche.js',
  'ausgabe/word.js',
  'ausgabe/druck.js',
  'ausgabe/export.js',
  'import/import.js',
  'import/zuordnung.js',
  'import/beispiel.js',
  'kern/sicherung.js',
  'kern/bedienung.js',
  'ansicht/farbe.js',
  'ansicht/zen.js',
  'ansicht/stammdaten.js',
  'ansicht/berufe.js',
  'ansicht/zeitraum.js',
  'ansicht/rundgang.js',
  'ansicht/einrichtung.js',
  'ansicht/hinweise.js',
  'ansicht/uebersicht.js',
  'konto/konto.js',
  'konto/ausbilder.js',
  'kern/start.js',
];

function abbrechen(meldung) {
  console.error('Build abgebrochen: ' + meldung);
  process.exit(1);
}

function lies(...teile) {
  return fs.readFileSync(path.join(SRC, ...teile), 'utf8');
}

/**
 * Lizenzkopf der gebauten Datei. Er steht als CSS-Kommentar ganz oben, gleich über der
 * eingebetteten Schrift: Die SIL Open Font License verlangt, dass ihr Wortlaut die Schrift
 * begleitet (src/fonts/OFL.txt). Ein HTML-Kommentar ginge nicht, "<!" mit zwei Strichen ist
 * in der fertigen Datei verboten (siehe eingebetteteBibliothek).
 */
const LIZENZKOPF = `/*!
 * Berichtsheft - Ausbildungsnachweis aus deiner Zeiterfassung
 * Copyright (c) 2026 Sergey Zakharov, MIT-Lizenz
 * https://github.com/SergeyZakh/Ausbildungs-Berichtsheft
 *
 * Mit eingebettet:
 * Instrument Sans, Copyright 2022 The Instrument Sans Project Authors,
 * SIL Open Font License 1.1, https://scripts.sil.org/OFL (Wortlaut: src/fonts/OFL.txt)
 * docx, Copyright (c) Dolan Miu, MIT-Lizenz
 */
`;

/** CSS zusammensetzen, Schriften als data-URI einbetten. */
function stile() {
  return LIZENZKOPF + CSS.map((name) => lies('css', name)).join('\n')
    .replace(/url\(\.\.\/fonts\/([\w-]+\.woff2)\)/g, (_, datei) => {
      const bytes = fs.readFileSync(path.join(SRC, 'fonts', datei));
      return 'url(data:font/woff2;base64,' + bytes.toString('base64') + ')';
    });
}

/** Alle Skripte in einer Funktion, damit nichts im globalen Raum landet. */
/**
 * Alle Dateien teilen einen Gültigkeitsbereich. Zwei gleich benannte Funktionen in
 * verschiedenen Dateien überschreiben sich deshalb stillschweigend – die spätere gewinnt,
 * und an ganz anderer Stelle geht etwas kaputt. Genau das ist mit `wocheWechseln`
 * passiert (Heft und Ausbilder-Ansicht), deshalb bricht der Build hier ab.
 */
function pruefeNamen(quellen) {
  const gefunden = new Map();
  const doppelt = [];
  for (const { name, text } of quellen) {
    for (const treffer of text.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*)\s*=)/gm)) {
      const bezeichner = treffer[1] || treffer[2];
      const schon = gefunden.get(bezeichner);
      if (schon && schon !== name) doppelt.push(`${bezeichner} (${schon} und ${name})`);
      else gefunden.set(bezeichner, name);
    }
  }
  if (doppelt.length) abbrechen('Name doppelt vergeben: ' + doppelt.join(', '));
}

function anwendung() {
  // Das ausgedachte Beispielheft aus src/beispiel.csv, für „Beispiel ansehen“.
  const beispiel = 'var BEISPIEL_CSV = ' + JSON.stringify(lies('beispiel.csv')) + ';\n';
  const quellen = JS.map((name) => ({ name, text: lies('js', name) }));
  pruefeNamen(quellen);
  pruefeEval(quellen);
  const rumpf = beispiel + quellen.map((q) => '/* ---- ' + q.name + ' ---- */\n' + q.text).join('\n');
  return '(function () {\n"use strict";\n\n' + rumpf + '\n})();';
}

/**
 * Die Seite verspricht, dass nichts außer zur eigenen KI das Gerät verlässt. Deshalb darf
 * keine fremde Adresse im Code stehen, auch nicht maskiert als "https:\/\/". Erlaubt sind:
 * der SVG-Namensraum, das eigene Repo (Link in der Kopfzeile, Lizenzkopf), die Schriftlizenz
 * und die Platzhalter für Ollama. Wer eine neue Adresse braucht, trägt sie hier bewusst ein.
 */
const EIGENE_HOSTS = ['www.w3.org', 'github.com', 'scripts.sil.org', 'localhost', 'host', 'rechner'];

/**
 * Die docx-Bibliothek verweist in ihren Kommentaren auf Hilfeseiten zu OOXML und nennt die
 * XML-Namensräume, die in jede Word-Datei gehören. Beides lädt nichts. Die Kommentare
 * herauszuschneiden bräuchte einen JavaScript-Parser, also bleiben sie und die Hosts stehen
 * hier fest. Bringt ein Update von docx einen neuen Host, bricht der Build ab, damit ihn
 * jemand ansieht, bevor er hier landet.
 */
const BIBLIOTHEK_HOSTS = [
  'schemas.openxmlformats.org', 'schemas.microsoft.com', 'purl.org', 'www.w3.org',
  'officeopenxml.com', 'www.datypic.com', 'c-rex.net', 'www.ecma-international.org',
  'docs.microsoft.com', 'learn.microsoft.com', 'answers.microsoft.com', 'stackoverflow.com',
  'bugzilla.mozilla.org', 'www.npmjs.com', 'github.com', 'raw.github.com', 'stuk.github.io',
  'feross.org', 'mths.be', 'stuartk.com', 'example.com',
  // Seit docx 9.8: Kommentar mit Verweis auf die ECMA-376-Referenz zu VML-Formen.
  'webapp.docx4java.org',
];

function pruefeAdressen(text, erlaubt, wo) {
  const fremd = new Set();
  for (const treffer of text.matchAll(/https?:(?:\\?\/){2}([^/\s"'<>)\\`:]*)/gi)) {
    if (!erlaubt.includes(treffer[1].toLowerCase())) fremd.add(treffer[1]);
  }
  if (fremd.size) abbrechen(`Fremde Adresse in ${wo}: ${[...fremd].join(', ')}`);
}

/** Code aus Zeichenketten auszuführen ist im eigenen Code tabu. Die Bibliothek ist ausgenommen. */
function pruefeEval(quellen) {
  const treffer = quellen.filter((q) => /\beval\s*\(|\bnew\s+Function\s*\(/.test(q.text));
  if (treffer.length) abbrechen('eval oder new Function in ' + treffer.map((q) => q.name).join(', '));
}

function docxBibliothek() {
  const datei = path.join(__dirname, 'node_modules', 'docx', 'dist', 'index.iife.js');
  if (!fs.existsSync(datei)) abbrechen('docx nicht gefunden. Erst "npm install" ausführen.');
  return datei;
}

/**
 * Die Bibliothek unverändert in ein <script> legen (nicht als Zeichenkette
 * mit eval – das melden Virenscanner). Zwei Zeichenfolgen würden den
 * HTML-Parser dabei aus dem Skript werfen:
 *   "</script"  beendet das Element vorzeitig
 *   "<!--"      öffnet zusammen mit "<script" den maskierten Zustand
 * Aus "<!--" wird "<!--": In Zeichenketten liest JavaScript daraus
 * wieder "-", in Kommentaren ist es bedeutungslos.
 */
function eingebetteteBibliothek(quelle) {
  if (/<\/script/i.test(quelle)) abbrechen('Die Bibliothek enthält "</script".');
  const js = quelle.replace(/<!--/g, '<!\\u002d-');
  return '<script>\n' + js + '\n</script>';
}

function seite(docxTag) {
  const css = stile();
  const js = anwendung();
  if (/<\/style/i.test(css)) abbrechen('Das CSS enthält "</style".');
  if (/<\/script|<!--/i.test(js)) abbrechen('Das Skript enthält "</script" oder "<!--".');

  // Marken zuerst sichern, dann die übrigen HTML-Kommentare entfernen.
  // Ersetzt wird mit Funktionen, damit "$" im Inhalt nicht als Rückverweis gilt.
  let html = lies('index.html')
    .replace('<!-- build:docx -->', '@@docx@@')
    .replace('<!-- build:css -->', '@@css@@')
    .replace('<!-- build:js -->', '@@js@@')
    .replace(/<!--[\s\S]*?-->\s*/g, '');
  const marken = { docx: docxTag, css: '<style>\n' + css + '</style>', js: '<script>\n' + js + '\n</script>' };
  html = html.replace(/@@(\w+)@@/g, (_, name) => marken[name]);
  if (/@@\w+@@/.test(html)) abbrechen('Eine Marke in src/index.html fehlt.');
  return html;
}

const bibliothek = docxBibliothek();
const bibliothekText = fs.readFileSync(bibliothek, 'utf8');
const serverSeite = seite('<script src="vendor/docx.js"></script>');
pruefeAdressen(serverSeite, EIGENE_HOSTS, 'src/');
pruefeAdressen(bibliothekText, BIBLIOTHEK_HOSTS, 'der docx-Bibliothek');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'vendor'), { recursive: true });

fs.copyFileSync(bibliothek, path.join(DIST, 'vendor', 'docx.js'));
fs.writeFileSync(path.join(DIST, 'index.html'), serverSeite);
fs.writeFileSync(path.join(DIST, 'Berichtsheft.html'), seite(eingebetteteBibliothek(bibliothekText)));

for (const datei of ['index.html', 'vendor/docx.js', 'Berichtsheft.html']) {
  const kb = Math.round(fs.statSync(path.join(DIST, datei)).size / 1024);
  console.log(('dist/' + datei).padEnd(24) + kb + ' kB');
}
