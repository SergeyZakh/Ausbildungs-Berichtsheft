#!/usr/bin/env node
/**
 * Prüft die Anbindung an das Sprachmodell gegen einen nachgebauten
 * Ollama, der sich auf Kommando auch schlecht benimmt. Im Mittelpunkt
 * steht: Die Tätigkeiten eines Tages gehen als Liste hin, zurück kommt
 * eine Zusammenfassung, und der alte Text ist jederzeit zurückzuholen.
 *
 *   node test/ki.js
 */
const http = require('http');
const h = require('./hilfen');

const { pruefe, abschluss } = h.protokoll("Sprachmodell: Prompt, Lauf und Abbruch");

/* ---------- Nachgebauter Ollama ----------
   `verhalten` steuert die Antwort, `verzoegerung` die Wartezeit, `ohneModelle` die Modell-Liste. */
let verhalten = 'brav';
let verzoegerung = 0;
let ohneModelle = false;
let letzteTaetigkeiten = [];
let letzteAnfrage = null;
let letzterPfad = null;

/** Die Tätigkeiten aus dem Auftrag lesen – eine Liste mit Strichen. */
function taetigkeitenLesen(anfrage) {
  return (anfrage.messages || []).filter((m) => m.role === 'user')
    .map((m) => m.content).join('\n').split('\n')
    .map((z) => z.trim())
    .filter((z) => z.startsWith('- '))
    .map((z) => z.slice(2));
}

const AUFFAELLIG = (kern) => /[0-9]/.test(kern) || /[a-zäöü][A-ZÄÖÜ]/.test(kern) ||
  /^[A-ZÄÖÜ]{2,}$/.test(kern) || /[A-ZÄÖÜ].*[.\-]/.test(kern);

const server = http.createServer((req, res) => {
  const kopf = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, kopf); return res.end(); }

  // Die Modell-Liste für „Verbindung prüfen“ und die Auswahl im Feld „Modell“, auch hinter „/ki“.
  if (/^(\/ki)?\/api\/tags/.test(req.url)) {
    res.writeHead(200, kopf);
    return res.end(JSON.stringify({
      models: ohneModelle ? [] : [{ name: 'test-modell' }, { name: 'anderes:7b' }]
    }));
  }

  let roh = '';
  req.on('data', (d) => { roh += d; });
  req.on('end', () => {
    letzterPfad = req.url;
    letzteAnfrage = JSON.parse(roh || '{}');
    const eingabe = taetigkeitenLesen(letzteAnfrage);
    letzteTaetigkeiten = eingabe;

    if (verhalten === 'modell-fehlt') {
      res.writeHead(404, kopf);
      return res.end(JSON.stringify({ error: 'model not found' }));
    }

    let zeilen;
    if (verhalten === 'brav') {
      // Legt die Tätigkeiten zu höchstens vier Zeilen zusammen, wie ein
      // Modell es tun soll, und kürzt jede auf sechs Wörter. Den Punkt am
      // Ende setzt es trotzdem, wie die echten Modelle auch.
      const je = Math.ceil(eingabe.length / Math.min(4, eingabe.length || 1)) || 1;
      zeilen = [];
      for (let i = 0; i < eingabe.length; i += je) {
        zeilen.push(eingabe.slice(i, i + je).join('; ').split(/\s+/).slice(0, 6).join(' ') + '.');
      }
    } else if (verhalten === 'jede-einzeln') {
      // Wie ein echtes Modell bei langen Tagen: eine Zeile je Tätigkeit.
      zeilen = eingabe.map((z) => z.split(/\s+/).slice(0, 8).join(' ') + '.');
    } else if (verhalten === 'erfindet') {
      zeilen = eingabe.map(() => 'Allgemeine Systembetreuung im Tagesgeschäft');
    } else if (verhalten === 'ohne-schema') {
      zeilen = eingabe.slice(0, 4).map((z) => z.replace(/:/g, ' –'));
    } else if (verhalten === 'mit-aufzaehlung') {
      zeilen = eingabe.map((z) => '- ' + z.split(/\s+/).slice(0, 5).join(' '));
    }

    const antworten = () => {
      res.writeHead(200, kopf);
      res.end(JSON.stringify({ message: { role: 'assistant', content: zeilen.join('\n') } }));
    };
    if (verzoegerung) setTimeout(antworten, verzoegerung);
    else antworten();
  });
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const adresse = 'http://127.0.0.1:' + server.address().port;

  const browser = await h.starteBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await h.ohneRundgang(page);
  const jsFehler = h.fehlerSammeln(page);
  // Alles, was nicht aus der Datei selbst kommt. Erlaubt ist nur das Ollama auf diesem Rechner.
  const fremdeAnfragen = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol !== 'file:' && u.protocol !== 'data:' && u.protocol !== 'blob:' &&
        !['127.0.0.1', 'localhost'].includes(u.hostname)) fremdeAnfragen.push(r.url());
  });
  // Als Datei: Geprüft wird unten auch, welche Adressen das Werkzeug dann nach Ollama absucht.
  await h.oeffnen(page, h.DATEI_SEITE);
  await page.waitForTimeout(600);

  const text = () => page.locator('.tagpanel textarea').inputValue();
  const notiz = () => page.locator('#notiz').textContent();
  const kiKnopf = () => page.locator('.sektionsknopf', { hasText: /Mit KI kürzen|Original zurück|KI kürzt/ });
  // Zurücksetzen fragt am Knopf nach: erster Klick fragt, zweiter setzt zurück.
  const rueckgaengig = async () => {
    await page.locator('.sektionsknopf', { hasText: 'Original zurück' }).click();
    await page.locator('.sektionsknopf.sicher').click();
    await page.waitForTimeout(600);
  };
  const adresseSetzen = async (wert, modell) => {
    await h.stammdatenOeffnen(page);
    await h.stammFuellen(page, '#f-ki-adresse', wert);
    if (modell) await h.stammFuellen(page, '#f-ki-modell', modell);
    await page.click('#dlg-fertig');
    await page.waitForTimeout(500);
  };
  const kuerzen = async (wartezeit = 1200) => {
    await kiKnopf().click();
    await page.waitForTimeout(wartezeit);
  };

  /* ---------- 1. Ohne Adresse gibt es die Funktion nicht ---------- */
  await page.setInputFiles('#datei', h.testdatei('kimai-volle-woche.csv'));
  await page.waitForTimeout(900);
  await page.locator('#reiter button').nth(1).click();   // Die Testwoche beginnt am Dienstag.
  await page.waitForTimeout(400);
  pruefe('Ohne hinterlegte Adresse kein KI-Knopf', (await kiKnopf().count()) === 0);

  /* ---------- 2. Adresse eintragen ---------- */
  await adresseSetzen(adresse, 'test-modell');
  pruefe('Mit Adresse erscheint der Knopf', (await kiKnopf().count()) === 1);

  /* ---------- 2b. Modelle stehen zur Auswahl ---------- */
  await h.stammdatenOeffnen(page);
  await h.stammReiter(page, '#f-ki-modell');
  await page.waitForTimeout(400);
  // Gesucht wird nur, wenn das Feld leer ist – eine eingetragene Adresse bleibt stehen.
  pruefe('Eine eingetragene Adresse wird nicht überschrieben',
    (await page.inputValue('#f-ki-adresse')) === adresse, await page.inputValue('#f-ki-adresse'));
  // Als Einzeldatei gibt es kein „/ki“: Dort kommt nur das Ollama auf dem eigenen Rechner
  // in Frage. Auf einem Server steht „/ki“ vorn, weil die CSP nichts anderes zulässt.
  pruefe('Als Datei wird nur der eigene Rechner gesucht',
    JSON.stringify(await page.evaluate(() => window.__kiAdressen())) === '["http://localhost:11434"]',
    JSON.stringify(await page.evaluate(() => window.__kiAdressen())));
  pruefe('Ohne Klick bleibt die Modell-Liste zu', await page.locator('#ki-modelle').isHidden());
  await page.click('#btn-ki-modelle');
  await page.waitForTimeout(200);
  const auswahl = await page.locator('#ki-modelle button span').allTextContents();
  pruefe('Das Feld „Modell“ bietet die Modelle des Dienstes an',
    auswahl.join(', ') === 'test-modell, anderes:7b', auswahl.join(', '));
  await page.locator('#ki-modelle button', { hasText: 'anderes:7b' }).click();
  await page.waitForTimeout(200);
  pruefe('Ein Klick übernimmt das Modell und schließt die Liste',
    (await page.inputValue('#f-ki-modell')) === 'anderes:7b' && await page.locator('#ki-modelle').isHidden());
  await h.stammFuellen(page, '#f-ki-modell', 'test-modell');
  await page.click('#btn-ki-pruefen');
  await page.waitForTimeout(1400);
  pruefe('„Verbindung prüfen“ meldet das Modell als installiert',
    /installiert/.test(await page.locator('#ki-pruefhinweis').textContent()),
    await page.locator('#ki-pruefhinweis').textContent());
  await page.click('#dlg-fertig');
  await page.waitForTimeout(300);

  /* ---------- 3. Braves Modell ---------- */
  const vorher = await text();
  verhalten = 'brav';
  await kuerzen();
  const gekuerzt = await text();
  pruefe('Text wird gekürzt', gekuerzt.length < vorher.length && gekuerzt.length > 0,
    vorher.length + ' → ' + gekuerzt.length + ' Zeichen');
  const zeilenVorher = vorher.split('\n').filter(Boolean).length;
  const zeilenNachher = gekuerzt.split('\n').filter(Boolean).length;
  pruefe('Alle Tätigkeiten des Tages gehen ans Modell',
    letzteTaetigkeiten.length === zeilenVorher,
    letzteTaetigkeiten.length + ' / ' + zeilenVorher);
  pruefe('Aus den Buchungen werden höchstens ein paar Halbsätze',
    zeilenNachher >= 1 && zeilenNachher <= Math.min(4, zeilenVorher),
    zeilenNachher + ' Zeilen aus ' + zeilenVorher);
  pruefe('Das Modell setzt Punkte, im Tag steht keiner',
    gekuerzt.split('\n').filter(Boolean).every((z) => !/[.;,]$/.test(z)), gekuerzt);
  pruefe('Der Tag ist danach nicht mehr freigegeben',
    (await page.locator('.sektionsknopf', { hasText: 'Original zurück' }).count()) === 1);

  const prompt = letzteAnfrage.messages[0].content;
  pruefe('Der Prompt verlangt höchstens vier Zeilen', /höchstens vier Zeilen/.test(prompt));
  pruefe('Der Prompt verlangt Zeilen ohne Schlusspunkt', /ohne Punkt\s+am Ende/.test(prompt));
  pruefe('Die Zahl der Tätigkeiten spielt keine Rolle',
    /Wie viele Tätigkeiten in der Liste stehen, spielt keine Rolle/.test(prompt));
  pruefe('Zusammenfassen ist die Aufgabe',
    /Verwandtes fasst\s+du unter einem Oberbegriff zusammen/.test(prompt) && /Nebensächliches lässt du weg/.test(prompt));
  pruefe('Allgemein bleiben: Oberbegriffe statt Einzelheiten', /Oberbegriffe statt Einzelheiten/.test(prompt));
  pruefe('Systemprompt bindet das Modell an die Eingabe', /nur, was in der Liste steht/.test(prompt));
  pruefe('Erfinden bleibt verboten', /erfindest nichts dazu/.test(prompt));
  pruefe('Herstellernamen werden zur Gattung', /Gattung, nicht die/.test(prompt));
  pruefe('Der Prompt untersagt lautes Denken', /denkst nicht laut/.test(prompt));
  pruefe('Systemprompt macht das Format am Beispiel vor',
    prompt.includes('Beispiel') && prompt.includes('Eingabe:') && prompt.includes('Ausgabe:'));
  pruefe('Das Beispiel zeigt die Liste als Eingabe', /Eingabe:\n- Möbelaufbau/.test(prompt));
  const beispiel = (prompt.split('Ausgabe:')[1] || '').trim().split('\n').filter(Boolean);
  pruefe('Das Beispiel fasst zehn Tätigkeiten zu vier Zeilen zusammen',
    beispiel.length === 4, beispiel.join(' | '));
  // Die Zählzeile des Ausbilders ist länger und bleibt, wie er sie vorgegeben hat.
  pruefe('Das Beispiel bleibt allgemein: höchstens sechs Wörter je Zeile',
    beispiel.every((z) => /\dx\b/.test(z) || z.split(/\s+/).length <= 6), beispiel.join(' | '));
  pruefe('Im Beispiel endet keine Zeile mit Punkt',
    beispiel.every((z) => !/[.;]$/.test(z)), beispiel.join(' | '));
  pruefe('Das Beispiel zählt Gleiches, wie der Ausbilder es will',
    beispiel.includes('Installation Ubuntu 2x und Installation Debian 1x') && /zählst/.test(prompt),
    beispiel.join(' | '));
  // Eine beschriebene Schablone schreibt ein kleines Modell wörtlich ab.
  pruefe('Kein Platzhalter, den das Modell abschreiben kann', !/Kategorie: Beschreibung/.test(prompt));
  pruefe('Der Auftrag wiederholt die Zeilenzahl',
    /höchstens vier Zeilen/.test(letzteAnfrage.messages[1].content),
    letzteAnfrage.messages[1].content.split('\n')[0]);
  pruefe('Sampling bleibt eng, aber nicht gierig',
    letzteAnfrage.options.temperature > 0 && letzteAnfrage.options.temperature <= 0.3 &&
    letzteAnfrage.options.top_p === 0.8 && letzteAnfrage.options.top_k === 20,
    JSON.stringify(letzteAnfrage.options));
  pruefe('Fester seed macht die Antwort wiederholbar', letzteAnfrage.options.seed !== undefined);

  /* ---------- 3b. Zu viele Absätze werden auf den Platz im Blatt gebracht ----------
     Kein Modell hält sich an die verlangte Zahl: gemessen kamen bei 14 und 22
     Positionen 8 bis 19 Absätze zurück. Deshalb legt der Code zusammen. */
  await rueckgaengig();
  verhalten = 'jede-einzeln';
  await kuerzen();
  const platz = await page.evaluate(() => window.__stichpunkte());
  pruefe('Ohne Einstellung sind es vier Stichpunkte je Tag', platz === 4, platz);
  const nachDeckel = (await text()).split('\n').filter(Boolean);
  pruefe('Mehr Absätze als Platz werden zusammengelegt',
    nachDeckel.length <= platz, nachDeckel.length + ' Absätze, Platz für ' + platz);
  await rueckgaengig();

  /* ---------- 3c. Stichpunkte je Tag nach Vorgabe des Betriebs ---------- */
  await h.stammdatenOeffnen(page);
  await h.stammFuellen(page, '#f-ki-stichpunkte', '2');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(300);
  await kuerzen();
  const nachZwei = (await text()).split('\n').filter(Boolean);
  pruefe('Eingestellt 2: Der Tag hat danach höchstens zwei Zeilen', nachZwei.length <= 2, nachZwei.join(' | '));
  const promptZwei = letzteAnfrage.messages[0].content;
  pruefe('Eingestellt 2: Prompt und Auftrag verlangen zwei Zeilen',
    /höchstens zwei Zeilen/.test(promptZwei) && /höchstens zwei Zeilen/.test(letzteAnfrage.messages[1].content));
  const beispielZwei = (promptZwei.split('Ausgabe:')[1] || '').trim().split('\n').filter(Boolean);
  pruefe('Eingestellt 2: Das Beispiel hält sich selbst daran', beispielZwei.length === 2, beispielZwei.join(' | '));
  await rueckgaengig();
  const prompts = await page.evaluate(() => [1, 6].map((n) => window.__kiPrompt(n)));
  pruefe('Eine Zeile heißt „höchstens einer Zeile“', /mit höchstens einer Zeile,/.test(prompts[0]));
  pruefe('Sechs Zeilen: Das Beispiel bleibt bei seinen vier', /höchstens sechs Zeilen/.test(prompts[1])
    && (prompts[1].split('Ausgabe:')[1] || '').trim().split('\n').length === 4);
  pruefe('Der Prompt verlangt die Gattung statt des Herstellernamens',
    /Gattung, nicht die/.test(prompts[0])
    && /Betriebssysteme und verbreitete Technik behältst du/.test(prompts[0])
    && !/unverändert ab/.test(prompts[0]));
  await h.stammdatenOeffnen(page);
  await h.stammFuellen(page, '#f-ki-stichpunkte', '9');
  pruefe('Mehr als sechs fasst der Vordruck nicht', (await page.evaluate(() => window.__stichpunkte())) === 6);
  await h.stammFuellen(page, '#f-ki-stichpunkte', '');
  await page.click('#dlg-fertig');
  await page.waitForTimeout(300);

  const vieleZeilen = ['Eins a.', 'Zwei b.', 'Drei c.', 'Vier d.', 'Fünf e.',
    'Sechs f.', 'Sieben g.', 'Acht h.', 'Neun i.'];
  const aufSechs = await page.evaluate((l) => window.__zusammenlegen(l, 6), vieleZeilen);
  pruefe('Neun Absätze werden zu sechs', aufSechs.length === 6, JSON.stringify(aufSechs));
  pruefe('Dabei geht keine Tätigkeit verloren',
    vieleZeilen.every((z) => aufSechs.join(' ').includes(z.replace('.', ''))),
    JSON.stringify(aufSechs));
  pruefe('Die Reihenfolge des Tages bleibt',
    aufSechs.join(' ').indexOf('Eins') < aufSechs.join(' ').indexOf('Neun'), JSON.stringify(aufSechs));

  const gelegt = await page.evaluate(() => window.__zusammenlegen(
    ['Support: Drucker eingebunden.', 'Netzwerk: VLAN gesetzt.', 'GitLab: Notizen geschrieben.'], 2));
  pruefe('Zusammenlegen verschmilzt Nachbarn statt abzuschneiden',
    gelegt.length === 2 && gelegt.join(' ').includes('VLAN') && gelegt.join(' ').includes('Notizen'),
    JSON.stringify(gelegt));
  pruefe('Nur ein Doppelpunkt je zusammengelegter Zeile',
    gelegt.every((z) => (z.match(/:/g) || []).length <= 1), JSON.stringify(gelegt));

  verhalten = 'brav';
  await kuerzen();

  /* ---------- 4. Rückgängig ---------- */
  await rueckgaengig();
  pruefe('Rückgängig stellt den Text wieder her', (await text()) === vorher);

  /* ---------- 5. Modell formuliert um ----------
     Umformuliert wird übernommen – gerade darum bleibt das Original stehen
     und der Tag verliert seine Freigabe. Gegengelesen wird von Hand. */
  verhalten = 'erfindet';
  await kuerzen();
  pruefe('Auch eine umformulierte Antwort landet im Feld',
    (await text()) !== vorher && (await text()).includes('Systembetreuung'), (await text()).slice(0, 60));
  pruefe('Das Original ist weiter zurückzuholen',
    (await page.locator('.sektionsknopf', { hasText: 'Original zurück' }).count()) === 1);
  await rueckgaengig();
  pruefe('Und kommt unverändert zurück', (await text()) === vorher);

  /* ---------- 6. Lange Zeilen ---------- */
  verhalten = 'ohne-schema';
  await kuerzen();
  pruefe('Lange Zeilen werden übernommen, nicht nachgebessert',
    (await text()).split('\n').filter(Boolean).length === Math.min(4, letzteTaetigkeiten.length),
    (await text()).split('\n').filter(Boolean).length + ' Zeilen');
  pruefe('Das Textfeld sagt selbst, ob es aufs Blatt passt',
    /von rund \d+ Zeilen/.test(await page.locator('.tagpanel .textstand').textContent()),
    await page.locator('.tagpanel .textstand').textContent());
  await rueckgaengig();

  /* ---------- 7. Aufzählungszeichen werden entfernt ---------- */
  verhalten = 'mit-aufzaehlung';
  await kuerzen();
  pruefe('Vorangestellte Striche werden entfernt',
    !(await text()).split('\n').some((z) => /^\s*[-*•]/.test(z)), (await text()).slice(0, 40));
  await rueckgaengig();

  /* ---------- 8. Adresse mit Pfad, wie hinter nginx ----------
     "/ki" in den Stammdaten; nginx reicht /ki/api/chat als /api/chat weiter. */
  verhalten = 'brav';
  await adresseSetzen(adresse + '/ki');
  await kuerzen();
  pruefe('Adresse mit Pfad ergibt <pfad>/api/chat', letzterPfad === '/ki/api/chat', letzterPfad);
  await rueckgaengig();

  await adresseSetzen(adresse + '/ki/');
  await kuerzen();
  pruefe('Abschließender Schrägstrich ergibt keinen doppelten', letzterPfad === '/ki/api/chat', letzterPfad);
  await rueckgaengig();

  /* ---------- 8b. Leeres Modellfeld ----------
     Wie nach dem ersten Docker-Start: Das Modell kam erst, als „Deine Daten“ schon zu war.
     Dann gilt das erste installierte, und es bleibt im Feld stehen. */
  await page.evaluate(() => { document.getElementById('f-ki-modell').value = ''; });
  await kuerzen();
  pruefe('Leeres Modellfeld nimmt das installierte Modell',
    letzteAnfrage.model === 'test-modell', letzteAnfrage.model);
  pruefe('Das Modell steht danach im Feld',
    (await page.inputValue('#f-ki-modell')) === 'test-modell', await page.inputValue('#f-ki-modell'));
  await rueckgaengig();

  ohneModelle = true;
  letzteAnfrage = null;
  await page.evaluate(() => { document.getElementById('f-ki-modell').value = ''; });
  await kuerzen();
  pruefe('Ohne installiertes Modell eine klare Meldung',
    (await notiz()).includes('kein Modell installiert'), await notiz());
  pruefe('Ohne Modell geht keine Anfrage ans Modell', letzteAnfrage === null);
  pruefe('Ohne Modell bleibt der Text stehen', (await text()) === vorher);
  ohneModelle = false;
  await page.evaluate(() => { document.getElementById('f-ki-modell').value = 'test-modell'; });

  /* ---------- 9. Modell nicht installiert ---------- */
  verhalten = 'modell-fehlt';
  await kuerzen();
  pruefe('Fehlendes Modell wird verständlich gemeldet', (await notiz()).includes('nicht installiert'), await notiz());
  pruefe('Der Text bleibt dabei unangetastet', (await text()) === vorher);

  /* ---------- 10. Server nicht erreichbar ---------- */
  await new Promise((r) => server.close(r));
  await kuerzen(2000);
  pruefe('Nicht erreichbares Modell wird verständlich gemeldet', (await notiz()).includes('nicht erreichbar'), await notiz());
  pruefe('Auch dann bleibt der Text stehen', (await text()) === vorher);

  /* ---------- 11. Die ganze Woche ---------- */
  verhalten = 'brav';
  server.listen(0, '127.0.0.1');
  await new Promise((r) => setTimeout(r, 300));
  await adresseSetzen('http://127.0.0.1:' + server.address().port);

  await page.evaluate(() => {
    const r = document.querySelectorAll('#reiter button');
    r[r.length - 1].click();
  });
  await page.waitForTimeout(400);

  const wocheKnopf = page.locator('.sektionsknopf', { hasText: /Ganze Woche mit KI kürzen/ });
  pruefe('Wochenansicht bietet „Ganze Woche mit KI kürzen“', (await wocheKnopf.count()) === 1);

  const reiterTexte = () => page.evaluate(() =>
    Array.from(document.querySelectorAll('#reiter button')).map((b) => b.textContent));
  const vorWoche = await reiterTexte();

  await wocheKnopf.click();
  await page.waitForTimeout(6000);
  pruefe('Meldet, wie viele Tage gekürzt wurden', /\d+ Tage? gekürzt/.test(await notiz()), await notiz());
  pruefe('Danach gibt es „Originale zurück“',
    (await page.locator('.sektionsknopf', { hasText: 'Originale zurück' }).count()) === 1);

  const vorFrage = JSON.stringify(await reiterTexte());
  await page.locator('.sektionsknopf', { hasText: 'Originale zurück' }).click();
  await page.waitForTimeout(300);
  pruefe('„Originale zurück“ fragt erst nach und ändert noch nichts',
    (await page.locator('.sektionsknopf.sicher', { hasText: 'Sicher?' }).count()) === 1 &&
    JSON.stringify(await reiterTexte()) === vorFrage);
  await page.locator('.sektionsknopf.sicher').click();
  await page.waitForTimeout(800);
  pruefe('Rückgängig stellt die ganze Woche wieder her',
    JSON.stringify(vorWoche) === JSON.stringify(await reiterTexte()));

  /* ---------- 11b. Abbrechen in der Wochenansicht, bevor ein Tag fertig ist ---------- */
  // Der KI-Knopf muss zurückkommen, ohne dass der Tagbereich neu aufgebaut wird
  // (sonst sieht die Seite aus, als lade sie neu). Merkmal: ein Attribut am
  // vorhandenen Element überlebt nur, wenn niemand den Bereich neu zeichnet.
  verzoegerung = 1500;
  await page.evaluate(() => document.querySelector('#tagbereich > *').setAttribute('data-test-bleibt', '1'));
  await page.locator('.sektionsknopf', { hasText: /Ganze Woche mit KI kürzen/ }).click();
  await page.waitForTimeout(300);
  pruefe('Wochenansicht: Beim Start bleibt der Tagbereich stehen',
    (await page.locator('#tagbereich [data-test-bleibt]').count()) === 1);
  // Ist die Woche des Laufs offen, steht der Fortschritt samt Abbrechen im Feld, nicht oben.
  await page.click('#tagbereich .kiabbruch');
  await page.waitForTimeout(600);
  const knopfDanach = page.locator('.sektionsknopf', { hasText: /Ganze Woche mit KI kürzen/ });
  const knopfDa = (await knopfDanach.count()) === 1;
  pruefe('Wochenansicht: Nach dem Abbruch ist der KI-Knopf wieder da', knopfDa);
  pruefe('Wochenansicht: Der KI-Knopf ist wieder bedienbar', knopfDa && (await knopfDanach.isEnabled()));
  pruefe('Wochenansicht: Der Abbruch baut den Tagbereich nicht neu auf',
    (await page.locator('#tagbereich [data-test-bleibt]').count()) === 1);
  pruefe('Wochenansicht: Abbruch ohne Ergebnis ändert nichts',
    JSON.stringify(vorWoche) === JSON.stringify(await reiterTexte()));
  await page.evaluate(() => document.querySelector('#tagbereich [data-test-bleibt]')?.removeAttribute('data-test-bleibt'));

  /* ---------- 12. Navigieren und Abbrechen während des Laufs ---------- */
  const kuerzKnopf = page.locator('.sektionsknopf', { hasText: /Ganze Woche mit KI kürzen/ });
  const gesamt = parseInt((await kuerzKnopf.textContent()).match(/\((\d+)\)/)[1], 10);
  pruefe('Die Woche hat mehrere Tage zum Kürzen', gesamt >= 3, gesamt + ' Tage');

  // Der Fortschritt steht oben oder, wenn Tag oder Woche des Laufs offen
  // sind, an der Stelle des KI-Knopfs.
  const fortschrittSichtbar = async () =>
    (await page.locator("#fortschritt").isVisible()) || (await page.locator(".kistatus").isVisible());

  await kuerzKnopf.click();          // bewusst ohne auf das Ende zu warten
  await page.waitForTimeout(400);

  pruefe('Der Fortschritt steht sichtbar im Fenster', await fortschrittSichtbar());
  pruefe('Der Fortschritt nennt Tag und Stand',
    /\d+ von \d+/.test(await page.locator('#ftext').textContent()), await page.locator('#ftext').textContent());
  pruefe('Der laufende Tag ist im Reiter markiert', (await page.locator('.reiter button.laeuft').count()) === 1);

  await page.locator('#reiter button').nth(1).click();
  await page.waitForTimeout(1800);   // zwei Tage laufen durch
  const gewaehlt = await page.locator('.reiter button[aria-selected="true"] .rkurz').textContent();
  pruefe('Der Tageswechsel überlebt den weiterlaufenden Lauf',
    gewaehlt === (await page.locator('#reiter button').nth(1).locator('.rkurz').textContent()), gewaehlt);
  pruefe('Der Fortschritt läuft dabei weiter', await fortschrittSichtbar());

  const feld = page.locator('.tagpanel textarea').first();
  await feld.click();
  await feld.fill('Wird gerade getippt.');
  await page.waitForTimeout(1600);
  pruefe('Getippter Text bleibt stehen, während der Lauf arbeitet',
    (await feld.inputValue()) === 'Wird gerade getippt.', await feld.inputValue());

  await page.click('#f-abbrechen');
  await page.waitForTimeout(1800);
  pruefe('Nach dem Abbruch verschwindet die Fortschrittszeile', !(await fortschrittSichtbar()));
  pruefe('Der Abbruch wird gemeldet', /abgebrochen/.test(await notiz()), await notiz());
  const gekuerzteTage = await page.locator('.reiter .marke[title^="vom Sprachmodell"]').count();
  pruefe('Abgebrochen heißt: nicht alle Tage sind durch', gekuerzteTage < gesamt, gekuerzteTage + ' von ' + gesamt);
  pruefe('Was vor dem Abbruch fertig wurde, bleibt erhalten', gekuerzteTage >= 1, String(gekuerzteTage));
  verzoegerung = 0;

  await new Promise((r) => server.close(r));
  pruefe('Anfragen gehen nur an das eigene Ollama', fremdeAnfragen.length === 0, fremdeAnfragen.join(' | '));
  pruefe('Keine JavaScript-Fehler', jsFehler.length === 0, jsFehler.join(' | '));

  await browser.close();
  abschluss();
})();
