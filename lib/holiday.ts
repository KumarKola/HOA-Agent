import { createHash, randomBytes } from 'crypto';
import { q } from './db';
import { communityOrDefault } from './communities';

// Holiday decor contest. Uses the same community map, lots and GPS alignment as the trick-or-treat page.
// Homes enter themselves until the entry deadline, residents vote (one vote per address), winners show on the results day.
// Everything is kept per community and season (the year), so several HOAs can run it and it can run again next December.

export type Marker = 'tree' | 'lights';
export const MARKERS: Marker[] = ['tree', 'lights'];

export type HolidayEntry = {
  id: number;
  x: number;
  y: number;
  house_number: string;
  street: string;
  marker: Marker;
  note: string | null;
  award: string | null;
};

export type HolidayEntryAdmin = HolidayEntry & {
  contact_name: string | null;
  hidden: boolean;
  created_at: string;
  votes: number;
};

export type Phase = 'entry' | 'between' | 'voting' | 'counting' | 'results';

const TZ = '-07:00'; // Arizona, no daylight saving
const day = (v: string | undefined, fallback: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback);

/** Now, or a fixed time for trying out each phase locally (HOLIDAY_FAKE_NOW, ignored on the live site). */
export function now(): Date {
  const fake = process.env.HOLIDAY_FAKE_NOW;
  if (fake && !process.env.VERCEL) {
    const d = new Date(fake);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Contest year. January still shows the past December's winners. HOLIDAY_SEASON overrides. */
export function season(): number {
  const s = Number(process.env.HOLIDAY_SEASON);
  if (Number.isInteger(s) && s > 2000) return s;
  const d = now();
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix', year: 'numeric', month: 'numeric' })
    .formatToParts(d)
    .filter((p) => p.type !== 'literal')
    .map((p) => Number(p.value));
  return m === 1 ? y - 1 : y;
}

/** Contest dates (Arizona time). Defaults: enter until Dec 10, vote Dec 11–22, winners Dec 23. */
export function schedule() {
  const y = season();
  const entryCloses = day(process.env.HOLIDAY_ENTRY_CLOSES, `${y}-12-10`);
  const voteOpens = day(process.env.HOLIDAY_VOTE_OPENS, `${y}-12-11`);
  const voteCloses = day(process.env.HOLIDAY_VOTE_CLOSES, `${y}-12-22`);
  const results = day(process.env.HOLIDAY_RESULTS, `${y}-12-23`);
  return {
    entryClosesAt: new Date(`${entryCloses}T23:59:59${TZ}`),
    voteOpensAt: new Date(`${voteOpens}T00:00:00${TZ}`),
    voteClosesAt: new Date(`${voteCloses}T23:59:59${TZ}`),
    resultsAt: new Date(`${results}T00:00:00${TZ}`),
  };
}

// ---------- Test mode ----------
// The organizer can switch the whole contest to a practice round (Entry, Voting or Winners) from /holiday/admin.
// A practice round uses its own season number (the year, negative), so practice homes and votes never mix with
// the real contest. Turning test mode off returns everyone to the real dates and data.
export type TestPhase = 'entry' | 'voting' | 'results';
export const TEST_PHASES: TestPhase[] = ['entry', 'voting', 'results'];

// Liberty keeps the original setting name; other communities get their own.
const testKey = (community: string) => (community === 'liberty' ? 'test_phase' : `test_phase:${community}`);

export async function testPhase(community: string): Promise<TestPhase | null> {
  const [r] = await q<{ value: string }>(`SELECT value FROM holiday_settings WHERE key = $1`, [testKey(community)]);
  return r && (TEST_PHASES as string[]).includes(r.value) ? (r.value as TestPhase) : null;
}

export async function setTestPhase(community: string, v: TestPhase | null) {
  if (!v) await q(`DELETE FROM holiday_settings WHERE key = $1`, [testKey(community)]);
  else
    await q(
      `INSERT INTO holiday_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [testKey(community), v],
    );
}

/** What the site shows right now: the real contest by date, or the practice round. */
export async function contest(community: string): Promise<{ season: number; phase: Phase; test: TestPhase | null; year: number }> {
  const year = season();
  const t = await testPhase(community);
  return t ? { season: -year, phase: t, test: t, year } : { season: year, phase: phase(), test: null, year };
}

/** Practice homes and votes go away; the real contest is untouched. */
export async function clearTestData(community: string) {
  await q(`DELETE FROM holiday_entries WHERE community = $1 AND season < 0`, [community]);
}

export function phase(at: Date = now()): Phase {
  const s = schedule();
  const t = at.getTime();
  if (t <= s.entryClosesAt.getTime()) return 'entry';
  if (t < s.voteOpensAt.getTime()) return 'between';
  if (t <= s.voteClosesAt.getTime()) return 'voting';
  if (t < s.resultsAt.getTime()) return 'counting';
  return 'results';
}

const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric' });
export function scheduleLabels() {
  const s = schedule();
  return {
    entryCloses: dayFmt.format(s.entryClosesAt),
    voteOpens: dayFmt.format(s.voteOpensAt),
    voteCloses: dayFmt.format(s.voteClosesAt),
    results: dayFmt.format(s.resultsAt),
  };
}

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

/** "2615|w chanute pass": how an address is compared. Street must be one of the community streets. */
export function addressKey(community: string, num: string, street: string): string | null {
  const n = num.trim();
  const st = knownStreet(community, street);
  if (!/^\d{3,6}$/.test(n) || !st) return null;
  return `${n}|${st.toLowerCase()}`;
}
export const knownStreet = (community: string, street: string) =>
  communityOrDefault(community).map.streets.find((s) => s.toLowerCase() === street.trim().toLowerCase()) || null;

// ---------- Entries ----------

const PUBLIC_COLS = 'id, x, y, house_number, street, marker, note, award';

export async function listEntries(community: string, yr: number): Promise<HolidayEntry[]> {
  return q<HolidayEntry>(
    `SELECT ${PUBLIC_COLS} FROM holiday_entries WHERE community = $1 AND season = $2 AND hidden = false ORDER BY street, house_number`,
    [community, yr],
  );
}

export async function listEntriesAdmin(community: string, yr: number): Promise<HolidayEntryAdmin[]> {
  return q<HolidayEntryAdmin>(
    `SELECT e.id, e.x, e.y, e.house_number, e.street, e.marker, e.note, e.award, e.contact_name, e.hidden, e.created_at,
            (SELECT count(*)::int FROM holiday_votes v WHERE v.entry_id = e.id) AS votes
       FROM holiday_entries e WHERE e.community = $1 AND e.season = $2 ORDER BY e.created_at DESC`,
    [community, yr],
  );
}

export async function entriesFromDevice(ipHash: string): Promise<number> {
  const [r] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM holiday_entries WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`,
    [ipHash],
  );
  return r?.n ?? 0;
}

export async function addEntry(h: {
  community: string;
  season: number;
  x: number;
  y: number;
  house_number: string;
  street: string;
  marker: Marker;
  note: string;
  contact_name: string;
  ipHash: string;
}): Promise<{ entry: HolidayEntry; token: string }> {
  // Private key for the device that entered; lets it remove its own entry.
  const token = randomBytes(18).toString('base64url');
  const tokenHash = hash(token);
  const yr = h.season;
  // The same address entering again updates its entry instead of adding a second marker.
  const [existing] = await q<{ id: number }>(
    `SELECT id FROM holiday_entries
      WHERE community = $6 AND season = $1 AND hidden = false
        AND ((lower(house_number) = lower($2) AND lower(street) = lower($3)) OR (abs(x - $4) < 0.05 AND abs(y - $5) < 0.05))
      ORDER BY id LIMIT 1`,
    [yr, h.house_number, h.street, h.x, h.y, h.community],
  );
  if (existing) {
    const [row] = await q<HolidayEntry>(
      `UPDATE holiday_entries SET x = $2, y = $3, house_number = $4, street = $5, marker = $6, note = $7,
              contact_name = COALESCE($8, contact_name), edit_token_hash = $9
        WHERE id = $1 RETURNING ${PUBLIC_COLS}`,
      [existing.id, h.x, h.y, h.house_number, h.street, h.marker, h.note || null, h.contact_name || null, tokenHash],
    );
    return { entry: row, token };
  }
  const [row] = await q<HolidayEntry>(
    `INSERT INTO holiday_entries (community, season, x, y, house_number, street, marker, note, contact_name, ip_hash, edit_token_hash)
     VALUES ($11, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${PUBLIC_COLS}`,
    [yr, h.x, h.y, h.house_number, h.street, h.marker, h.note || null, h.contact_name || null, h.ipHash, tokenHash, h.community],
  );
  return { entry: row, token };
}

/** An entrant removing their own home, proven by the key their device got when entering. */
export async function deleteOwnEntry(id: number, token: string): Promise<boolean> {
  const rows = await q(`DELETE FROM holiday_entries WHERE id = $1 AND edit_token_hash = $2 RETURNING id`, [id, hash(token)]);
  return rows.length > 0;
}

export async function deleteEntry(id: number) {
  await q(`DELETE FROM holiday_entries WHERE id = $1`, [id]);
}
export async function moveEntry(id: number, x: number, y: number) {
  await q(`UPDATE holiday_entries SET x = $2, y = $3 WHERE id = $1`, [id, x, y]);
}
export async function setEntryHidden(id: number, hidden: boolean) {
  await q(`UPDATE holiday_entries SET hidden = $2 WHERE id = $1`, [id, hidden]);
}
/** Board's Choice and other committee awards, shown on the map from the results day. */
export async function setEntryAward(id: number, award: string | null) {
  await q(`UPDATE holiday_entries SET award = $2 WHERE id = $1`, [id, award || null]);
}

// ---------- Votes ----------

export type VoteResult =
  | { ok: true; changed: boolean; entryId: number; address: string }
  | { ok: false; status: number; error: string };

/**
 * One vote per address per season. The phone that cast it can change it while voting is open.
 * A phone votes for one address only, so one person can't vote for every house on their street.
 */
export async function castVote(v: { community: string; season: number; entryId: number; num: string; street: string; device: string; ipHash: string }): Promise<VoteResult> {
  const yr = v.season, c = v.community;
  const key = addressKey(c, v.num, v.street);
  const st = knownStreet(c, v.street);
  if (!key || !st) return { ok: false, status: 400, error: 'Enter your house number and pick your street from the list.' };
  const address = `${v.num.trim()} ${st}`;
  const [entry] = await q<{ id: number; house_number: string; street: string }>(
    `SELECT id, house_number, street FROM holiday_entries WHERE id = $1 AND season = $2 AND community = $3 AND hidden = false`,
    [v.entryId, yr, c],
  );
  if (!entry) return { ok: false, status: 404, error: 'That home is no longer in the contest.' };
  if (addressKey(c, entry.house_number, entry.street) === key) {
    return { ok: false, status: 400, error: 'You can’t vote for your own home. Pick another favorite!' };
  }
  const deviceHash = hash(`device:${v.device}`);

  const [mine] = await q<{ id: number; device_hash: string; entry_id: number }>(
    `SELECT id, device_hash, entry_id FROM holiday_votes WHERE community = $3 AND season = $1 AND voter_key = $2`,
    [yr, key, c],
  );
  if (mine) {
    if (mine.device_hash !== deviceHash) {
      return { ok: false, status: 409, error: `${address} has already voted. If that wasn’t you, let the social committee know.` };
    }
    await q(`UPDATE holiday_votes SET entry_id = $2, updated_at = now() WHERE id = $1`, [mine.id, entry.id]);
    return { ok: true, changed: mine.entry_id !== entry.id, entryId: entry.id, address };
  }

  const [other] = await q<{ voter_address: string }>(
    `SELECT voter_address FROM holiday_votes WHERE community = $3 AND season = $1 AND device_hash = $2 LIMIT 1`,
    [yr, deviceHash, c],
  );
  if (other) {
    return { ok: false, status: 409, error: `This phone already voted for ${other.voter_address}. Each household votes from its own phone.` };
  }
  const [recent] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM holiday_votes WHERE community = $3 AND season = $1 AND ip_hash = $2 AND created_at > now() - interval '1 day'`,
    [yr, v.ipHash, c],
  );
  if ((recent?.n ?? 0) >= 15) return { ok: false, status: 429, error: 'Too many votes from this network today. Try again tomorrow.' };

  try {
    await q(
      `INSERT INTO holiday_votes (community, season, entry_id, voter_key, voter_address, device_hash, ip_hash) VALUES ($7, $1, $2, $3, $4, $5, $6)`,
      [yr, entry.id, key, address, deviceHash, v.ipHash, c],
    );
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return { ok: false, status: 409, error: `${address} has already voted. If that wasn’t you, let the social committee know.` };
    }
    throw e;
  }
  return { ok: true, changed: false, entryId: entry.id, address };
}

export type VoteRow = {
  id: number;
  voter_address: string;
  entry_id: number;
  entry_address: string;
  created_at: string;
  updated_at: string;
  same_network: number;
};

export async function listVotesAdmin(community: string, yr: number): Promise<VoteRow[]> {
  return q<VoteRow>(
    `SELECT v.id, v.voter_address, v.entry_id, e.house_number || ' ' || e.street AS entry_address, v.created_at, v.updated_at,
            (SELECT count(*)::int FROM holiday_votes w WHERE w.community = v.community AND w.season = v.season AND w.ip_hash = v.ip_hash AND w.id <> v.id) AS same_network
       FROM holiday_votes v JOIN holiday_entries e ON e.id = v.entry_id
      WHERE v.community = $1 AND v.season = $2 ORDER BY v.created_at DESC`,
    [community, yr],
  );
}

export async function deleteVote(id: number) {
  await q(`DELETE FROM holiday_votes WHERE id = $1`, [id]);
}

export type Winner = HolidayEntry & { votes: number; rank: number };

/** Residents' Choice: top three places by votes (ties share a place). Visible only from the results day. */
export async function residentsChoice(community: string, yr: number): Promise<Winner[]> {
  const rows = await q<HolidayEntry & { votes: number }>(
    `SELECT e.id, e.x, e.y, e.house_number, e.street, e.marker, e.note, e.award, count(v.id)::int AS votes
       FROM holiday_entries e JOIN holiday_votes v ON v.entry_id = e.id
      WHERE e.community = $1 AND e.season = $2 AND e.hidden = false
      GROUP BY e.id ORDER BY votes DESC, e.street, e.house_number`,
    [community, yr],
  );
  const out: Winner[] = [];
  let rank = 0, last = -1;
  for (const r of rows) {
    if (r.votes !== last) {
      rank++;
      last = r.votes;
    }
    if (rank > 3) break;
    out.push({ ...r, rank });
  }
  return out;
}
