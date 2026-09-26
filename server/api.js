/**
 * Die Schnittstelle des Servers.
 *
 *   GET    /api/ich                      wer bin ich (Name, Rolle, bei Azubis: wer mich betreut)
 *   POST   /api/abgleich                 eigener Stand rauf und runter (Azubi)
 *   GET    /api/azubis?von=&bis=         Übersicht der betreuten Azubis (Ausbilder)
 *   GET    /api/azubis/<id>?von=&bis=    Einträge eines Azubis, nur lesen (Ausbilder)
 *   GET    /api/gruppe                   eigene Gruppe und die noch freien Azubis (Ausbilder)
 *   POST   /api/gruppe                   Azubi in die eigene Gruppe nehmen (Ausbilder)
 *   DELETE /api/gruppe/<id>              Azubi aus der eigenen Gruppe nehmen (Ausbilder)
 *
 * Die Gruppe pflegt der Ausbilder selbst: Wer sich einmal angemeldet hat, steht in „personen“ und
 * lässt sich hinzunehmen. Der Azubi sieht unter /api/ich, wer ihn betreut – niemand schaut
 * unbemerkt mit.
 *
 * Abgleich: Jede Zeile trägt einen Zeitstempel „geaendert“ vom Gerät. Beim Hochladen gewinnt der
 * neuere Stand; heruntergeladen wird, was seit „seit“ beim Server eingegangen ist. Kein Sperren,
 * kein Zusammenführen innerhalb eines Tages: Ein Tag gehört einer Person, die ihn an einem
 * Gerät nach dem anderen bearbeitet.
 */
'use strict';

const { pool, NUR_IM_BROWSER } = require('./datenbank');
const { wochenUebersicht, montag } = require('./stand');

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Stammdaten ohne die Einstellungen, die im Browser bleiben (NUR_IM_BROWSER in datenbank.js). Der
 * Browser schickt sie nicht (src/js/konto/konto.js); der Server wirft sie trotzdem weg, beim
 * Schreiben und beim Lesen, damit auch Stände aus der Zeit davor weder im Konto noch beim
 * Ausbilder ankommen.
 */
function nachweisStamm(daten) {
  const stamm = { ...daten };
  for (const schluessel of NUR_IM_BROWSER) delete stamm[schluessel];
  return stamm;
}

class Fehler extends Error {
  constructor(status, text) {
    super(text);
    this.status = status;
  }
}

function pruefeDatum(wert, name) {
  if (!ISO_DATUM.test(String(wert || ''))) throw new Fehler(400, `${name} fehlt oder ist kein Datum (JJJJ-MM-TT)`);
  return wert;
}

function plusTage(datum, tage) {
  const d = new Date(datum + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Konto-ID aus dem letzten Teil des Pfads, etwa /api/azubis/<id>. Der Browser kodiert sie mit
 * encodeURIComponent, und `sub` darf je nach Anbieter @, : oder + enthalten (Authentik mit der
 * E-Mail als sub). Ohne Dekodieren fand der Ausbilder solche Azubis nicht. Die ID geht nur als
 * Parameter in die Abfragen, deshalb genügt: nicht leer, kein weiterer Pfadteil, höchstens 255
 * Zeichen wie `sub` in OpenID Connect.
 */
function idAusPfad(pfad, anfang) {
  if (!pfad.startsWith(anfang)) return null;
  const teil = pfad.slice(anfang.length);
  if (!teil || teil.includes('/')) return null;
  let id;
  try { id = decodeURIComponent(teil); } catch (e) { return null; }
  return id && id.length <= 255 ? id : null;
}

function zeitstempel(wert) {
  const zeit = new Date(wert || 0);
  return Number.isNaN(zeit.getTime()) ? new Date(0) : zeit;
}

/** Person anlegen oder auffrischen; Name und Rolle kommen bei jeder Anmeldung aus dem Token. */
async function personMerken(person) {
  await pool.query(
    `INSERT INTO personen (id, name, rolle) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rolle = EXCLUDED.rolle, gesehen = now()`,
    [person.id, person.name, person.rolle]
  );
}

/**
 * Überlappung beim Herunterladen: Eine Schreibtransaktion, die vor „stand_vom“ begann, aber erst
 * danach fertig wurde, trägt einen früheren Eingang. Doppelt Geliefertes verwirft der Browser, weil
 * es nicht neuer ist als sein eigener Stand.
 */
const UEBERLAPPUNG_MS = 60 * 1000;

/**
 * Stand einer Person im Zeitraum. Mit `seit` (das `stand_vom` des letzten Abgleichs) nur, was
 * seitdem beim Server einging – egal, wann es auf dem Gerät geschrieben wurde.
 */
async function standLesen(personId, von, bis, seit) {
  // Die Uhr der Datenbank, vor dem Lesen: Was danach eingeht, kommt beim nächsten Mal.
  const uhr = await pool.query('SELECT clock_timestamp() AS jetzt');
  const grenze = seit ? new Date(zeitstempel(seit).getTime() - UEBERLAPPUNG_MS) : new Date(0);
  const tage = await pool.query(
    `SELECT to_char(datum, 'YYYY-MM-DD') AS datum, text, art, stunden, geprueft, geaendert
       FROM tage WHERE person_id = $1 AND datum BETWEEN $2 AND $3 AND eingegangen > $4 ORDER BY datum`,
    [personId, von, bis, grenze]
  );
  const wochen = await pool.query(
    `SELECT to_char(montag, 'YYYY-MM-DD') AS montag, abteilung, unterweisungen, geaendert
       FROM wochen WHERE person_id = $1 AND montag BETWEEN $2 AND $3 AND eingegangen > $4 ORDER BY montag`,
    [personId, von, bis, grenze]
  );
  const stamm = await pool.query(
    'SELECT daten, geaendert FROM stammdaten WHERE person_id = $1 AND eingegangen > $2',
    [personId, grenze]
  );
  return {
    tage: tage.rows.map((t) => ({ ...t, stunden: t.stunden === null ? null : Number(t.stunden) })),
    wochen: wochen.rows,
    stamm: stamm.rows[0] ? { ...stamm.rows[0], daten: nachweisStamm(stamm.rows[0].daten) } : null,
    stand_vom: uhr.rows[0].jetzt.toISOString(),
  };
}

/** Hochgeladene Zeilen übernehmen, wenn sie neuer sind als das, was liegt. */
async function standSchreiben(personId, daten) {
  const tage = Array.isArray(daten.tage) ? daten.tage : [];
  const wochen = Array.isArray(daten.wochen) ? daten.wochen : [];
  const verbindung = await pool.connect();
  try {
    await verbindung.query('BEGIN');
    for (const tag of tage) {
      pruefeDatum(tag.datum, 'datum');
      await verbindung.query(
        `INSERT INTO tage (person_id, datum, text, art, stunden, geprueft, geaendert)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (person_id, datum) DO UPDATE
           SET text = EXCLUDED.text, art = EXCLUDED.art, stunden = EXCLUDED.stunden,
               geprueft = EXCLUDED.geprueft, geaendert = EXCLUDED.geaendert, eingegangen = now()
         WHERE tage.geaendert < EXCLUDED.geaendert`,
        [personId, tag.datum, String(tag.text || ''), String(tag.art || ''),
          tag.stunden === undefined || tag.stunden === null || tag.stunden === '' ? null : Number(tag.stunden),
          Boolean(tag.geprueft), zeitstempel(tag.geaendert)]
      );
    }
    for (const woche of wochen) {
      pruefeDatum(woche.montag, 'montag');
      await verbindung.query(
        `INSERT INTO wochen (person_id, montag, abteilung, unterweisungen, geaendert)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (person_id, montag) DO UPDATE
           SET abteilung = EXCLUDED.abteilung, unterweisungen = EXCLUDED.unterweisungen,
               geaendert = EXCLUDED.geaendert, eingegangen = now()
         WHERE wochen.geaendert < EXCLUDED.geaendert`,
        [personId, woche.montag, String(woche.abteilung || ''), String(woche.unterweisungen || ''), zeitstempel(woche.geaendert)]
      );
    }
    if (daten.stamm && typeof daten.stamm.daten === 'object' && daten.stamm.daten) {
      await verbindung.query(
        `INSERT INTO stammdaten (person_id, daten, geaendert) VALUES ($1, $2, $3)
         ON CONFLICT (person_id) DO UPDATE SET daten = EXCLUDED.daten, geaendert = EXCLUDED.geaendert, eingegangen = now()
         WHERE stammdaten.geaendert < EXCLUDED.geaendert`,
        [personId, JSON.stringify(nachweisStamm(daten.stamm.daten)), zeitstempel(daten.stamm.geaendert)]
      );
    }
    await verbindung.query('COMMIT');
  } catch (e) {
    await verbindung.query('ROLLBACK');
    throw e;
  } finally {
    verbindung.release();
  }
}

/**
 * Zeitraum eines Azubis: aus den Stammdaten, sonst aus den vorhandenen Tagen.
 * `leerErlaubt` gibt null zurück, statt zu scheitern, wenn noch nichts da ist.
 */
async function zeitraum(personId, von, bis, leerErlaubt = false) {
  if (von && bis) return [pruefeDatum(von, 'von'), pruefeDatum(bis, 'bis')];
  const stamm = await pool.query('SELECT daten FROM stammdaten WHERE person_id = $1', [personId]);
  const daten = stamm.rows[0]?.daten || {};
  const grenzen = await pool.query(
    `SELECT to_char(min(datum), 'YYYY-MM-DD') AS von, to_char(max(datum), 'YYYY-MM-DD') AS bis
       FROM tage WHERE person_id = $1`, [personId]
  );
  const anfang = ISO_DATUM.test(daten.beginn || '') ? daten.beginn : grenzen.rows[0].von;
  const heute = new Date().toISOString().slice(0, 10);
  // Bis heute, aber nie über das Vertragsende hinaus.
  const ende = ISO_DATUM.test(daten.ende || '') && daten.ende < heute ? daten.ende : heute;
  if (!anfang) {
    if (leerErlaubt) return null;
    throw new Fehler(400, 'Zeitraum unbekannt: von und bis angeben');
  }
  return [anfang, ende];
}

async function betreute(ausbilderId) {
  const zeilen = await pool.query(
    `SELECT p.id, p.name FROM betreuung b JOIN personen p ON p.id = b.azubi_id
      WHERE b.ausbilder_id = $1 AND p.rolle = 'azubi' ORDER BY p.name`,
    [ausbilderId]
  );
  return zeilen.rows;
}

async function darfSehen(ausbilderId, azubiId) {
  const zeile = await pool.query(
    'SELECT 1 FROM betreuung WHERE ausbilder_id = $1 AND azubi_id = $2', [ausbilderId, azubiId]
  );
  return zeile.rowCount > 0;
}

/** Eine Anfrage beantworten. Gibt das JSON zurück, das der Server ausliefert. */
async function beantworten(person, methode, pfad, suche, koerper) {
  if (methode === 'GET' && pfad === '/api/ich') {
    const ich = { id: person.id, name: person.name, rolle: person.rolle };
    if (person.rolle === 'azubi') {
      const ausbilder = await pool.query(
        `SELECT p.id, p.name FROM betreuung b JOIN personen p ON p.id = b.ausbilder_id
          WHERE b.azubi_id = $1 ORDER BY p.name`, [person.id]
      );
      ich.ausbilder = ausbilder.rows;
    }
    return ich;
  }

  if (pfad === '/api/gruppe' || pfad.startsWith('/api/gruppe/')) {
    if (person.rolle !== 'ausbilder') throw new Fehler(403, 'Nur für Ausbilder');

    if (methode === 'GET') {
      const alle = await pool.query(
        `SELECT p.id, p.name, (b.azubi_id IS NOT NULL) AS betreut
           FROM personen p LEFT JOIN betreuung b ON b.azubi_id = p.id AND b.ausbilder_id = $1
          WHERE p.rolle = 'azubi' ORDER BY p.name`, [person.id]
      );
      return {
        gruppe: alle.rows.filter((a) => a.betreut).map(({ id, name }) => ({ id, name })),
        frei: alle.rows.filter((a) => !a.betreut).map(({ id, name }) => ({ id, name })),
      };
    }

    if (methode === 'POST') {
      const azubiId = String(koerper.azubi_id || '');
      const azubi = await pool.query("SELECT id, name FROM personen WHERE id = $1 AND rolle = 'azubi'", [azubiId]);
      if (!azubi.rowCount) throw new Fehler(404, 'Unbekannter Azubi. Er muss sich einmal angemeldet haben.');
      await pool.query(
        'INSERT INTO betreuung (ausbilder_id, azubi_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [person.id, azubiId]
      );
      return { aufgenommen: azubi.rows[0] };
    }

    const entfernen = idAusPfad(pfad, '/api/gruppe/');
    if (methode === 'DELETE' && entfernen) {
      const weg = await pool.query('DELETE FROM betreuung WHERE ausbilder_id = $1 AND azubi_id = $2',
        [person.id, entfernen]);
      if (!weg.rowCount) throw new Fehler(404, 'Dieser Azubi ist nicht in deiner Gruppe');
      return { entfernt: entfernen };
    }
  }

  if (methode === 'POST' && pfad === '/api/abgleich') {
    if (person.rolle !== 'azubi') throw new Fehler(403, 'Nur Azubis führen ein Berichtsheft');
    await standSchreiben(person.id, koerper);
    // Ohne Zeitraum alles, was im Konto liegt: Ein frisch aufgesetzter Browser weiß noch nicht,
    // welche Wochen es gibt. Auch nichts „bis heute“ abschneiden, sonst bliebe vorab
    // eingetragener Urlaub auf dem Gerät, auf dem er geschrieben wurde.
    const [von, bis] = koerper.von || koerper.bis
      ? [pruefeDatum(koerper.von, 'von'), pruefeDatum(koerper.bis, 'bis')]
      : ['0001-01-01', '9999-12-31'];
    return standLesen(person.id, von, bis, koerper.seit);
  }

  if (methode === 'GET' && pfad === '/api/azubis') {
    if (person.rolle !== 'ausbilder') throw new Fehler(403, 'Nur für Ausbilder');
    const liste = await betreute(person.id);
    const ergebnis = [];
    for (const azubi of liste) {
      const zeiten = await zeitraum(azubi.id, suche.get('von'), suche.get('bis'), true);
      if (!zeiten) {
        // Aufgenommen, aber noch nichts geschrieben: trotzdem in der Liste zeigen.
        ergebnis.push({ ...azubi, von: null, bis: null, wochen: [], offen: 0, fehlt: 0, fertig: 0 });
        continue;
      }
      const [von, bis] = zeiten;
      const { tage, stamm } = await standLesen(azubi.id, von, bis, null);
      const wochen = wochenUebersicht(von, bis, tage, stamm?.daten?.land);
      // Wann zuletzt etwas eingetragen wurde: zeigt, wer seit Wochen nichts mehr schreibt.
      const beschrieben = tage.filter((t) => String(t.text || '').trim() || t.art);
      ergebnis.push({
        ...azubi,
        von,
        bis,
        zuletzt: beschrieben.length ? beschrieben[beschrieben.length - 1].datum : null,
        wochen,
        offen: wochen.filter((w) => w.stand === 'offen').length,
        fehlt: wochen.filter((w) => w.stand === 'fehlt').length,
        fertig: wochen.filter((w) => w.stand === 'fertig').length,
      });
    }
    return { azubis: ergebnis };
  }

  const azubiId = idAusPfad(pfad, '/api/azubis/');
  if (methode === 'GET' && azubiId) {
    if (person.rolle !== 'ausbilder') throw new Fehler(403, 'Nur für Ausbilder');
    if (!(await darfSehen(person.id, azubiId))) throw new Fehler(404, 'Unbekannter Azubi');
    const zeiten = await zeitraum(azubiId, suche.get('von'), suche.get('bis'), true);
    if (!zeiten) {
      // Aufgenommen, aber noch nichts geschrieben: leeres Heft statt Fehler.
      return { tage: [], wochen: [], stamm: null, von: null, bis: null, wochenstand: [] };
    }
    const [von, bis] = zeiten;
    // Gezählt wird bis heute, gelesen bis zum Ende dieser Woche: Was der Azubi für morgen schon
    // vorgeschrieben hat, steht auch in der Vorschau des Ausbilders.
    const heute = new Date().toISOString().slice(0, 10);
    const lesenBis = !suche.get('bis') && bis === heute ? plusTage(montag(heute), 6) : bis;
    const stand = await standLesen(azubiId, von, lesenBis, null);
    return { ...stand, von, bis, wochenstand: wochenUebersicht(von, bis, stand.tage, stand.stamm?.daten?.land) };
  }

  throw new Fehler(404, 'Unbekannter Weg');
}

module.exports = { Fehler, beantworten, personMerken, standLesen, standSchreiben, betreute };
