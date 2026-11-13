// One tiny query helper. Production uses Postgres through DATABASE_URL (or POSTGRES_URL, which
// Vercel's Supabase integration sets). Local development with neither uses an embedded Postgres (PGlite) stored in ./.data.

type Row = Record<string, any>;
type Db = { query: <T extends Row = Row>(text: string, params?: unknown[]) => Promise<{ rows: T[] }> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS incidents (
     id SERIAL PRIMARY KEY,
     entrance TEXT NOT NULL,
     gate TEXT NOT NULL,
     issue TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'open',
     source TEXT NOT NULL DEFAULT 'resident',
     confirmations INTEGER NOT NULL DEFAULT 1,
     citycync_ticket TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_report_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     escalated_at TIMESTAMPTZ,
     resolved_at TIMESTAMPTZ,
     resolution TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS incidents_open_idx ON incidents (status, entrance, gate, issue)`,
  `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS public_update TEXT`,
  `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS update_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS reports (
     id SERIAL PRIMARY KEY,
     incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
     kind TEXT NOT NULL DEFAULT 'report',
     note TEXT,
     reporter_name TEXT,
     reporter_lot TEXT,
     ip_hash TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS reports_ip_idx ON reports (ip_hash, created_at)`,
  `CREATE TABLE IF NOT EXISTS treat_houses (
     id SERIAL PRIMARY KEY,
     x REAL NOT NULL,
     y REAL NOT NULL,
     house_number TEXT NOT NULL,
     street TEXT NOT NULL,
     note TEXT,
     contact_name TEXT,
     ip_hash TEXT,
     hidden BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `ALTER TABLE treat_houses ADD COLUMN IF NOT EXISTS edit_token_hash TEXT`,
  // Map image v2 (Oct 15): same drawing, larger. Houses saved on the first image are moved to the same lot.
  // Existing rows get map_v 1, new rows default to 2; the update only touches rows not yet moved.
  `ALTER TABLE treat_houses ADD COLUMN IF NOT EXISTS map_v SMALLINT NOT NULL DEFAULT 1`,
  `ALTER TABLE treat_houses ALTER COLUMN map_v SET DEFAULT 2`,
  `UPDATE treat_houses SET
     x = LEAST(100, GREATEST(0, (1.2973009889008413 * x * 12.06 + 6.540169378283998e-05 * y * 10.10 + 78.76273452760262) / 16.00)),
     y = LEAST(100, GREATEST(0, (0.0003728297209468522 * x * 12.06 + 1.2960694958169223 * y * 10.10 + 24.823144044712084) / 14.24)),
     map_v = 2
   WHERE map_v = 1`,
  // Holiday decor contest: homes enter themselves, residents vote (one vote per address per season).
  `CREATE TABLE IF NOT EXISTS holiday_entries (
     id SERIAL PRIMARY KEY,
     season INTEGER NOT NULL,
     x REAL NOT NULL,
     y REAL NOT NULL,
     house_number TEXT NOT NULL,
     street TEXT NOT NULL,
     marker TEXT NOT NULL DEFAULT 'tree',
     note TEXT,
     contact_name TEXT,
     ip_hash TEXT,
     edit_token_hash TEXT,
     hidden BOOLEAN NOT NULL DEFAULT false,
     award TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS holiday_votes (
     id SERIAL PRIMARY KEY,
     season INTEGER NOT NULL,
     entry_id INTEGER NOT NULL REFERENCES holiday_entries(id) ON DELETE CASCADE,
     voter_key TEXT NOT NULL,
     voter_address TEXT NOT NULL,
     device_hash TEXT NOT NULL,
     ip_hash TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (season, voter_key)
   )`,
  `CREATE INDEX IF NOT EXISTS holiday_votes_device_idx ON holiday_votes (season, device_hash)`,
  // Organizer switches, e.g. the contest's test mode.
  `CREATE TABLE IF NOT EXISTS holiday_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  // Several communities (HOAs) can run the contest; rows from before this are Liberty's.
  `ALTER TABLE holiday_entries ADD COLUMN IF NOT EXISTS community TEXT NOT NULL DEFAULT 'liberty'`,
  `ALTER TABLE holiday_votes ADD COLUMN IF NOT EXISTS community TEXT NOT NULL DEFAULT 'liberty'`,
  `ALTER TABLE holiday_votes DROP CONSTRAINT IF EXISTS holiday_votes_season_voter_key_key`,
  `CREATE UNIQUE INDEX IF NOT EXISTS holiday_votes_one_per_address ON holiday_votes (community, season, voter_key)`,
];

const g = globalThis as unknown as { __libertyDb?: Promise<Db> };

/** False on a hosted deploy (Vercel) with no database connected yet. */
export const dbConfigured = () => !!(process.env.DATABASE_URL || process.env.POSTGRES_URL) || !process.env.VERCEL;

async function connect(): Promise<Db> {
  let db: Db;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url && process.env.VERCEL) {
    throw new Error('No database connected. Add a Postgres database under Storage in the Vercel project.');
  }
  if (url) {
    const { Pool } = await import('pg');
    // Hosted Postgres links carry ?sslmode=require, which newer pg treats as full certificate
    // verification and which overrides the ssl option below. Supabase's pooler presents a
    // certificate chain that fails that check, so drop the URL's SSL params and use ours:
    // the connection stays encrypted.
    const clean = new URL(url);
    ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'].forEach((k) => clean.searchParams.delete(k));
    const pool = new Pool({
      connectionString: clean.toString(),
      ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
      max: 3,
    });
    db = { query: (text, params) => pool.query(text, params as any[]) as any };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const { mkdirSync } = await import('fs');
    const dir = process.env.PGLITE_DIR || './.data/pglite';
    mkdirSync(dir, { recursive: true });
    const lite = new PGlite(dir);
    db = { query: (text, params) => lite.query(text, params as any[]) as any };
  }
  for (const stmt of SCHEMA) await db.query(stmt);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__libertyDb) {
    g.__libertyDb = connect().catch((e) => {
      g.__libertyDb = undefined; // retry on the next request instead of caching the failure
      throw e;
    });
  }
  return g.__libertyDb;
}

export async function q<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await getDb();
  return (await db.query<T>(text, params)).rows;
}
