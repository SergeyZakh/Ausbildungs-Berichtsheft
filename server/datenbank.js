/**
 * Postgres: Verbindung und Schema.
 *
 * Auf dem Server liegt nur, was im Ausbildungsnachweis steht: Tagestexte, Art des Tages, Stunden,
 * Status und Stammdaten. Die importierten Buchungen aus der Zeiterfassung (Kunden, Tickets,
 * Kollegennamen) bleiben im Browser, siehe docs/SERVER.md.
 */
'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATENBANK_URL,
  max: Number(process.env.DATENBANK_VERBINDUNGEN || 10),
});

/** Schema anlegen. Wird beim Start ausgeführt und ist wiederholbar. */
async function schemaAnlegen() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS personen (
      id          text PRIMARY KEY,           -- "sub" aus dem Anmeldedienst
      name        text NOT NULL,
      rolle       text NOT NULL CHECK (rolle IN ('azubi', 'ausbilder')),
      angelegt    timestamptz NOT NULL DEFAULT now(),
      gesehen     timestamptz NOT NULL DEFAULT now()
    );

    -- Wer betreut wen. Ein Azubi kann mehrere Ausbilder haben (Vertretung).
    CREATE TABLE IF NOT EXISTS betreuung (
      ausbilder_id text NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
      azubi_id     text NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
      PRIMARY KEY (ausbilder_id, azubi_id)
    );

    -- Stammdaten des Vordrucks (Name, Beruf, Betrieb, Vertragszeitraum …) als JSON,
    -- weil die Felder aus dem Browser kommen und sich mit dem Vordruck ändern können.
    CREATE TABLE IF NOT EXISTS stammdaten (
      person_id text PRIMARY KEY REFERENCES personen(id) ON DELETE CASCADE,
      daten     jsonb NOT NULL DEFAULT '{}'::jsonb,
      geaendert timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS tage (
      person_id text NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
      datum     date NOT NULL,
      text      text NOT NULL DEFAULT '',
      art       text NOT NULL DEFAULT '',     -- "", Berufsschule, Urlaub, Krank, Feiertag, Betriebsversammlung
      stunden   numeric(5,2),
      geprueft  boolean NOT NULL DEFAULT false,
      geaendert timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (person_id, datum)
    );

    CREATE TABLE IF NOT EXISTS wochen (
      person_id      text NOT NULL REFERENCES personen(id) ON DELETE CASCADE,
      montag         date NOT NULL,
      abteilung      text NOT NULL DEFAULT '',
      unterweisungen text NOT NULL DEFAULT '',
      geaendert      timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (person_id, montag)
    );

    -- Wann eine Zeile beim Server ankam. „geaendert“ ist die Uhr des Geräts und entscheidet, welcher
    -- Stand gewinnt; heruntergeladen wird aber nach Eingang. Sonst bekäme ein Gerät, das mittags
    -- abgeglichen hat, nie, was ein anderes morgens offline geschrieben und abends hochgeladen hat.
    ALTER TABLE tage       ADD COLUMN IF NOT EXISTS eingegangen timestamptz NOT NULL DEFAULT now();
    ALTER TABLE wochen     ADD COLUMN IF NOT EXISTS eingegangen timestamptz NOT NULL DEFAULT now();
    ALTER TABLE stammdaten ADD COLUMN IF NOT EXISTS eingegangen timestamptz NOT NULL DEFAULT now();
    CREATE INDEX IF NOT EXISTS tage_eingang ON tage (person_id, eingegangen);

    -- Themen der Berufsschule für eine ganze Blockwoche statt je Tag, mit eigenem „übernommen“.
    ALTER TABLE wochen ADD COLUMN IF NOT EXISTS schule text NOT NULL DEFAULT '';
    ALTER TABLE wochen ADD COLUMN IF NOT EXISTS schule_geprueft boolean NOT NULL DEFAULT false;
  `);

  // Vor 0.1.0 schickte der Browser auch Einstellungen mit, die bei ihm bleiben sollen. Die API
  // verwirft sie seitdem beim Schreiben und Lesen; hier verschwinden sie auch aus Konten, deren
  // Stammdaten seitdem niemand gespeichert hat. „eingegangen“ bleibt, sonst lüden alle Geräte neu.
  await pool.query('UPDATE stammdaten SET daten = daten - $1::text[] WHERE daten ?| $1::text[]', [NUR_IM_BROWSER]);
}

/**
 * Einstellungen, die im Browser des Azubis bleiben (docs/SERVER.md, „Was wo liegt“): die Namensliste
 * für die Bereinigung, die Ausblendlisten und alles zum Sprachmodell. Dieselbe Liste steht im
 * Browser (src/js/konto/konto.js).
 */
const NUR_IM_BROWSER = ['namen', 'ausblenden', 'projektraus', 'kiAdresse', 'kiModell', 'kiAnweisungen', 'kiStichpunkte'];

module.exports = { pool, schemaAnlegen, NUR_IM_BROWSER };
