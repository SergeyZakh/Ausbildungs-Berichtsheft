#!/usr/bin/env node
/**
 * Tests des Servers gegen eine echte Postgres-Datenbank.
 *
 *   docker run --rm -d --name berichtsheft-testdb -e POSTGRES_PASSWORD=test -p 55432:5432 postgres:17-alpine
 *   DATENBANK_URL=postgres://postgres:test@localhost:55432/postgres node server/test/server.js
 *
 * Oder in einem Rutsch: bash server/test/testen.sh
 *
 * Die Anmeldung ist hier nachgestellt (TESTANMELDUNG=1, Person aus den Kopfzeilen). Die echte
 * Anmeldung prüfen server/test/anmeldung.js (nachgebauter Anbieter) und test/betrieb.js (Keycloak).
 */
'use strict';

process.env.TESTANMELDUNG = '1';

const { pool, schemaAnlegen } = require('../datenbank');
const { server } = require('../server');
const { wochenUebersicht, tagStand, montag, werktage } = require('../stand');

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

let adresse;

/** Anfrage als angemeldete Person. */
async function ruf(person, weg, einstellungen = {}) {
  const antwort = await fetch(adresse + weg, {
    method: einstellungen.methode || (einstellungen.koerper ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(person ? { 'X-Person': person.id, 'X-Name': person.name || person.id, 'X-Rolle': person.rolle } : {}),
    },
    body: einstellungen.koerper ? JSON.stringify(einstellungen.koerper) : undefined,
  });
  return { status: antwort.status, daten: await antwort.json() };
}

const AZUBI = { id: 'azubi-1', name: 'Alex Azubi', rolle: 'azubi' };
const AZUBI2 = { id: 'azubi-2', name: 'Bea Azubi', rolle: 'azubi' };
const AUSBILDER = { id: 'ausbilder-1', name: 'Carla Ausbilderin', rolle: 'ausbilder' };
const JETZT = new Date().toISOString();
// Eine volle Woche: Montag 2026-09-07 bis Freitag 2026-09-11.
const WOCHE = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];

(async () => {
  await schemaAnlegen();
  await pool.query('TRUNCATE personen CASCADE');
  await new Promise((fertig) => server.listen(0, fertig));
  adresse = 'http://localhost:' + server.address().port;

  abschnitt('Stand ohne Datenbank (reine Rechnung)');

  pruefe('Freie Tage, leere Tage, offene und fertige Tage', (() => {
    const faelle = [
      [undefined, 'fehlt'],
      [{ art: 'Urlaub', text: '' }, 'frei'],
      [{ art: '', text: '   ' }, 'fehlt'],
      [{ art: '', text: 'Server eingerichtet', geprueft: false }, 'offen'],
      [{ art: '', text: 'Server eingerichtet', geprueft: true }, 'fertig'],
      // Berufsschule und Betriebsversammlung haben ein Feld im Vordruck und brauchen Text.
      [{ art: 'Berufsschule', text: '' }, 'fehlt'],
      [{ art: 'Berufsschule', text: 'Netzwerktechnik', geprueft: false }, 'offen'],
      [{ art: 'Betriebsversammlung', text: 'Jahresplanung', geprueft: true }, 'fertig'],
    ];
    const falsch = faelle.filter(([tag, erwartet]) => tagStand(tag) !== erwartet);
    return falsch.length ? falsch.map(([t]) => JSON.stringify(t)).join(', ') : true;
  })());

  pruefe('Montag einer Woche und Werktage', montag('2026-09-11') === '2026-09-07'
    && montag('2026-09-07') === '2026-09-07' && werktage('2026-09-05', '2026-09-13').length === 5);

  pruefe('Wochenübersicht: offen schlägt fehlt', (() => {
    const tage = [
      { datum: '2026-09-07', text: 'a', geprueft: true, art: '' },
      { datum: '2026-09-08', text: 'b', geprueft: false, art: '' },
      { datum: '2026-09-09', text: '', geprueft: false, art: 'Urlaub' },
    ];
    const [woche] = wochenUebersicht('2026-09-07', '2026-09-11', tage);
    return woche.fertig === 1 && woche.offen === 1 && woche.frei === 1 && woche.fehlt === 2 && woche.stand === 'offen'
      ? true : woche;
  })());

  // Fronleichnam 2026 ist Donnerstag, der 4. Juni: in NRW frei, in Berlin ein Werktag.
  pruefe('Wochenübersicht: Feiertag ohne Eintrag fehlt nicht, je nach Bundesland', (() => {
    const tage = ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-05']
      .map((datum) => ({ datum, text: 'x', geprueft: true, art: '' }));
    const [nrw] = wochenUebersicht('2026-06-01', '2026-06-05', tage, 'NW');
    const [berlin] = wochenUebersicht('2026-06-01', '2026-06-05', tage, 'BE');
    return nrw.frei === 1 && nrw.stand === 'fertig' && berlin.fehlt === 1 && berlin.stand === 'fehlt'
      ? true : { nrw, berlin };
  })());

  // Ein geleerter Tag (etwa nach „Importierte Daten entfernen“) zählt wie keiner: an einem
  // Werktag als Lücke, an einem Feiertag als frei. So rechnet auch das Heft (test/lauf.js).
  pruefe('Wochenübersicht: geleerter Eintrag zählt wie keiner', (() => {
    const tage = ['2026-06-01', '2026-06-02', '2026-06-05']
      .map((datum) => ({ datum, text: 'x', geprueft: true, art: '' }))
      .concat([{ datum: '2026-06-03', text: '', art: '', stunden: null }, { datum: '2026-06-04', text: ' ', art: '', stunden: null }]);
    const [nrw] = wochenUebersicht('2026-06-01', '2026-06-05', tage, 'NW');
    return nrw.fehlt === 1 && nrw.frei === 1 && nrw.stand === 'fehlt' ? true : nrw;
  })());

  abschnitt('Anmeldung und Rechte');

  const ohne = await ruf(null, '/api/ich');
  pruefe('Ohne Anmeldung: 401', ohne.status === 401);
  pruefe('Ohne Angabe ist die Anmeldung Pflicht, und die Seite erfährt es', ohne.daten.anmeldungPflicht === true, ohne.daten);
  pruefe('Gesundheitsweg braucht keine Anmeldung', (await (await fetch(adresse + '/gesund')).json()).ok === true);

  const ich = await ruf(AZUBI, '/api/ich');
  pruefe('Azubi bekommt Name und Rolle', ich.daten.rolle === 'azubi' && ich.daten.name === 'Alex Azubi', ich.daten);

  pruefe('Azubi darf die Ausbilder-Übersicht nicht sehen (403)',
    (await ruf(AZUBI, '/api/azubis')).status === 403);
  pruefe('Ausbilder führt kein eigenes Berichtsheft (403)',
    (await ruf(AUSBILDER, '/api/abgleich', { koerper: { von: WOCHE[0], bis: WOCHE[4] } })).status === 403);
  pruefe('Unbekannter Weg: 404', (await ruf(AZUBI, '/api/gibtsnicht')).status === 404);

  abschnitt('Abgleich des eigenen Stands');

  const hoch = await ruf(AZUBI, '/api/abgleich', {
    koerper: {
      von: WOCHE[0], bis: WOCHE[4],
      // namen und kiAnweisungen schickt ein alter Browser noch mit; sie bleiben trotzdem draußen.
      stamm: { daten: { name: 'Alex Azubi', beruf: 'Fachinformatiker Systemintegration', beginn: '2026-09-01', ende: '2029-08-31',
        namen: 'Kollegin Wunderlich', kiAnweisungen: 'Geheimtipp' }, geaendert: JETZT },
      tage: [
        { datum: WOCHE[0], text: 'Arbeitsplatz eingerichtet', art: '', stunden: 8, geprueft: true, geaendert: JETZT },
        { datum: WOCHE[1], text: 'Erste Tickets bearbeitet', art: '', stunden: 8, geprueft: false, geaendert: JETZT },
        { datum: WOCHE[2], text: '', art: 'Berufsschule', stunden: null, geprueft: false, geaendert: JETZT },
      ],
      wochen: [{ montag: WOCHE[0], abteilung: 'IT-Betrieb', unterweisungen: 'Arbeitssicherheit', geaendert: JETZT }],
    },
  });
  pruefe('Hochladen und zurückbekommen', hoch.status === 200 && hoch.daten.tage.length === 3
    && hoch.daten.wochen.length === 1 && hoch.daten.stamm.daten.beruf.startsWith('Fachinformatiker'), hoch.daten);

  const gespeichert = (await pool.query('SELECT daten FROM stammdaten')).rows[0].daten;
  pruefe('Namensliste und KI-Anweisungen werden nicht gespeichert und nicht zurückgegeben',
    !('namen' in gespeichert) && !('kiAnweisungen' in gespeichert) && !('namen' in hoch.daten.stamm.daten)
    && gespeichert.name === 'Alex Azubi', gespeichert);

  // Ein Konto aus der Zeit, als der Browser sie noch mitschickte: Beim Start räumt der Server auf,
  // ohne den Eingang zu verschieben (sonst lüden alle Geräte die Stammdaten neu).
  await pool.query(`UPDATE stammdaten SET daten = daten || '{"namen": "Kollegin Wunderlich", "kiModell": "qwen"}'::jsonb`);
  const eingangVorher = (await pool.query('SELECT eingegangen FROM stammdaten')).rows[0].eingegangen.toISOString();
  await schemaAnlegen();
  const aufgeraeumt = (await pool.query('SELECT daten, eingegangen FROM stammdaten')).rows[0];
  pruefe('Beim Start verschwinden alte Browser-Einstellungen auch aus bestehenden Konten',
    !('namen' in aufgeraeumt.daten) && !('kiModell' in aufgeraeumt.daten) && aufgeraeumt.daten.name === 'Alex Azubi'
    && aufgeraeumt.eingegangen.toISOString() === eingangVorher, aufgeraeumt);

  // Was vor mehr als der Überlappung einging, kommt mit „seit“ nicht noch einmal.
  await pool.query("UPDATE tage SET eingegangen = now() - interval '1 hour'");
  await pool.query("UPDATE wochen SET eingegangen = now() - interval '1 hour'");
  await pool.query("UPDATE stammdaten SET eingegangen = now() - interval '1 hour'");
  const zurueck = await ruf(AZUBI, '/api/abgleich', { koerper: { von: WOCHE[0], bis: WOCHE[4], seit: hoch.daten.stand_vom } });
  pruefe('Mit „seit“ kommt nur Neueres zurück', zurueck.daten.tage.length === 0 && zurueck.daten.stamm === null, zurueck.daten);

  // Ein anderes Gerät war offline: morgens geschrieben, erst jetzt hochgeladen.
  await ruf(AZUBI, '/api/abgleich', {
    koerper: { tage: [{ datum: WOCHE[3], text: 'Morgens offline geschrieben', art: '', stunden: 8, geprueft: true, geaendert: '2026-01-01T07:00:00.000Z' }] },
  });
  const spaet = await ruf(AZUBI, '/api/abgleich', { koerper: { von: WOCHE[0], bis: WOCHE[4], seit: zurueck.daten.stand_vom } });
  pruefe('Spät hochgeladen, früh geschrieben: kommt trotzdem bei den anderen Geräten an',
    spaet.daten.tage.some((t) => t.datum === WOCHE[3]), spaet.daten.tage);
  pruefe('„stand_vom“ kommt von der Uhr der Datenbank', !Number.isNaN(Date.parse(spaet.daten.stand_vom)));
  // Die weiteren Prüfungen rechnen mit den drei Tagen von oben.
  await pool.query('DELETE FROM tage WHERE datum = $1', [WOCHE[3]]);

  const alt = await ruf(AZUBI, '/api/abgleich', {
    koerper: {
      von: WOCHE[0], bis: WOCHE[4],
      tage: [{ datum: WOCHE[0], text: 'Alter Stand von gestern', art: '', stunden: 8, geprueft: false, geaendert: '2020-01-01T00:00:00.000Z' }],
    },
  });
  pruefe('Älterer Stand überschreibt den neueren nicht',
    alt.daten.tage.find((t) => t.datum === WOCHE[0]).text === 'Arbeitsplatz eingerichtet',
    alt.daten.tage);

  const neuer = await ruf(AZUBI, '/api/abgleich', {
    koerper: {
      von: WOCHE[0], bis: WOCHE[4],
      tage: [{ datum: WOCHE[1], text: 'Tickets bearbeitet und übernommen', art: '', stunden: 8, geprueft: true, geaendert: new Date(Date.now() + 1000).toISOString() }],
    },
  });
  pruefe('Neuerer Stand gewinnt', neuer.daten.tage.find((t) => t.datum === WOCHE[1]).geprueft === true);

  // Vorab eingetragener Urlaub in der Zukunft gehört genauso dazu.
  await ruf(AZUBI, '/api/abgleich', { koerper: { tage: [{ datum: '2099-07-01', text: '', art: 'Urlaub', geaendert: JETZT }] } });
  const zukunft = await ruf(AZUBI, '/api/abgleich', { koerper: {} });
  pruefe('Ohne Zeitraum kommen auch Tage nach heute mit', zukunft.daten.tage.some((t) => t.datum === '2099-07-01'), zukunft.daten.tage.map((t) => t.datum));
  await pool.query("DELETE FROM tage WHERE datum = '2099-07-01'");

  const ohneZeitraum = await ruf(AZUBI, '/api/abgleich', { koerper: {} });
  pruefe('Ohne Zeitraum kommt alles zurück, was im Konto liegt',
    ohneZeitraum.status === 200 && ohneZeitraum.daten.tage.length === 3, ohneZeitraum.daten.tage);

  pruefe('Kaputtes Datum wird abgewiesen (400)',
    (await ruf(AZUBI, '/api/abgleich', { koerper: { von: WOCHE[0], bis: WOCHE[4], tage: [{ datum: '07.09.2026', text: 'x' }] } })).status === 400);

  abschnitt('Ausbilder sieht seine Azubis');

  await ruf(AZUBI2, '/api/ich');
  await ruf(AUSBILDER, '/api/ich');
  await pool.query('INSERT INTO betreuung (ausbilder_id, azubi_id) VALUES ($1, $2)', [AUSBILDER.id, AZUBI.id]);

  const uebersicht = await ruf(AUSBILDER, `/api/azubis?von=${WOCHE[0]}&bis=${WOCHE[4]}`);
  const alex = uebersicht.daten.azubis[0];
  pruefe('Nur betreute Azubis erscheinen', uebersicht.daten.azubis.length === 1 && alex.id === AZUBI.id,
    uebersicht.daten.azubis.map((a) => a.id));
  // Der Berufsschultag am Mittwoch hat keinen Text: Er fehlt wie die beiden leeren Werktage.
  pruefe('Wochenampel: drei Werktage ohne Text, also „fehlt“',
    alex.wochen.length === 1 && alex.wochen[0].fertig === 2 && alex.wochen[0].frei === 0
    && alex.wochen[0].fehlt === 3 && alex.wochen[0].stand === 'fehlt', alex.wochen);

  const einzeln = await ruf(AUSBILDER, `/api/azubis/${AZUBI.id}?von=${WOCHE[0]}&bis=${WOCHE[4]}`);
  pruefe('Ausbilder liest die Einträge seines Azubis',
    einzeln.status === 200 && einzeln.daten.tage.length === 3
    && einzeln.daten.tage[0].text === 'Arbeitsplatz eingerichtet', einzeln.daten.tage);

  pruefe('Fremder Azubi bleibt unsichtbar (404)',
    (await ruf(AUSBILDER, `/api/azubis/${AZUBI2.id}`)).status === 404);
  pruefe('Azubi kommt nicht an fremde Einträge (403)',
    (await ruf(AZUBI2, `/api/azubis/${AZUBI.id}`)).status === 403);

  pruefe('Zeitraum ohne Angabe kommt aus den Stammdaten',
    (await ruf(AUSBILDER, `/api/azubis/${AZUBI.id}`)).daten.von === '2026-09-01');

  abschnitt('Der Ausbilder pflegt seine Gruppe selbst');

  const vorher = await ruf(AUSBILDER, '/api/gruppe');
  pruefe('Gruppe und freie Azubis werden getrennt gezeigt',
    vorher.daten.gruppe.map((a) => a.id).join() === AZUBI.id
    && vorher.daten.frei.map((a) => a.id).join() === AZUBI2.id, vorher.daten);

  const dazu = await ruf(AUSBILDER, '/api/gruppe', { koerper: { azubi_id: AZUBI2.id } });
  const mitBea = await ruf(AUSBILDER, '/api/azubis');
  pruefe('Azubi aufnehmen', dazu.status === 200 && dazu.daten.aufgenommen.name === 'Bea Azubi'
    && mitBea.daten.azubis?.length === 2, { dazu: dazu.daten, liste: mitBea.daten });
  pruefe('Wer noch nichts geschrieben hat, steht trotzdem in der Liste', (() => {
    const bea = mitBea.daten.azubis?.find((a) => a.id === AZUBI2.id);
    return bea && bea.von === null && bea.wochen.length === 0 ? true : bea;
  })());

  pruefe('Zweimal aufnehmen ändert nichts',
    (await ruf(AUSBILDER, '/api/gruppe', { koerper: { azubi_id: AZUBI2.id } })).status === 200
    && (await ruf(AUSBILDER, '/api/gruppe')).daten.gruppe.length === 2);

  pruefe('Unbekanntes Konto lässt sich nicht aufnehmen (404)',
    (await ruf(AUSBILDER, '/api/gruppe', { koerper: { azubi_id: 'gibtsnicht' } })).status === 404);
  pruefe('Ein Ausbilder lässt sich nicht als Azubi aufnehmen (404)',
    (await ruf(AUSBILDER, '/api/gruppe', { koerper: { azubi_id: AUSBILDER.id } })).status === 404);
  pruefe('Azubis pflegen keine Gruppen (403)',
    (await ruf(AZUBI, '/api/gruppe', { koerper: { azubi_id: AZUBI2.id } })).status === 403);

  const sieht = await ruf(AZUBI2, '/api/ich');
  pruefe('Der Azubi sieht, wer ihn betreut',
    sieht.daten.ausbilder.map((a) => a.name).join() === 'Carla Ausbilderin', sieht.daten);

  pruefe('Azubi wieder aus der Gruppe nehmen',
    (await ruf(AUSBILDER, `/api/gruppe/${AZUBI2.id}`, { methode: 'DELETE' })).status === 200
    && (await ruf(AUSBILDER, '/api/azubis')).daten.azubis.length === 1);
  pruefe('Wer nicht in der Gruppe ist, lässt sich nicht entfernen (404)',
    (await ruf(AUSBILDER, `/api/gruppe/${AZUBI2.id}`, { methode: 'DELETE' })).status === 404);
  pruefe('Nach dem Entfernen sind die Einträge wieder unsichtbar',
    (await ruf(AUSBILDER, `/api/azubis/${AZUBI2.id}`)).status === 404);

  // Authentik kann die E-Mail als sub schicken. Der Browser kodiert die ID im Pfad
  // (encodeURIComponent, aus @ wird %40); früher suchte der Server nach dem kodierten Text.
  const DANA = { id: 'dana+test@firma.example', name: 'Dana Azubi', rolle: 'azubi' };
  await ruf(DANA, '/api/abgleich', { koerper: { tage: [
    { datum: WOCHE[0], text: 'Router getauscht', art: '', stunden: 8, geprueft: true, geaendert: JETZT },
  ] } });
  await ruf(AUSBILDER, '/api/gruppe', { koerper: { azubi_id: DANA.id } });
  const wegDana = '/api/azubis/' + encodeURIComponent(DANA.id);
  const dana = await ruf(AUSBILDER, wegDana);
  pruefe('ID mit @ und +: Der Ausbilder öffnet das Heft',
    dana.status === 200 && dana.daten.tage[0]?.text === 'Router getauscht', dana);
  pruefe('… und nimmt den Azubi wieder aus der Gruppe',
    (await ruf(AUSBILDER, '/api/gruppe/' + encodeURIComponent(DANA.id), { methode: 'DELETE' })).status === 200
    && (await ruf(AUSBILDER, wegDana)).status === 404);
  pruefe('Kaputt kodierte ID: 404 statt Serverfehler',
    (await ruf(AUSBILDER, '/api/azubis/%E0%A4%A')).status === 404);

  abschnitt('Nur Nachweisdaten');

  const spalten = await pool.query(
    `SELECT table_name || '.' || column_name AS spalte FROM information_schema.columns
      WHERE table_schema = 'public' ORDER BY 1`
  );
  const verdaechtig = spalten.rows.map((z) => z.spalte)
    .filter((s) => /posten|buchung|kunde|ticket|csv|roh/i.test(s));
  pruefe('Keine Spalte für rohe Buchungen aus der Zeiterfassung', verdaechtig.length === 0, verdaechtig);

  await new Promise((fertig) => server.close(fertig));
  await pool.end();

  console.log('\n  ' + (gescheitert.length
    ? rot('✗ ' + gescheitert.length + ' gescheitert') + grau(', ' + bestanden + ' bestanden')
    : gruen('✓ ' + bestanden + ' bestanden')) + '\n');
  process.exit(gescheitert.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
