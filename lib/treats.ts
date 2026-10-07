import { createHash, randomBytes } from 'crypto';
import { q } from './db';
export * from './treatsGeo';

// Trick-or-treat map. Positions are stored as percentages of the map image (0-100),
// so a candy lands on the same house at any screen size.

export type TreatHouse = {
  id: number;
  x: number;
  y: number;
  house_number: string;
  street: string;
  note: string | null;
};

export type TreatHouseAdmin = TreatHouse & { contact_name: string | null; hidden: boolean; created_at: string };

export async function listTreatHouses(): Promise<TreatHouse[]> {
  return q<TreatHouse>(
    `SELECT id, x, y, house_number, street, note FROM treat_houses WHERE hidden = false ORDER BY street, house_number`,
  );
}

export async function listTreatHousesAdmin(): Promise<TreatHouseAdmin[]> {
  return q<TreatHouseAdmin>(
    `SELECT id, x, y, house_number, street, note, contact_name, hidden, created_at FROM treat_houses ORDER BY created_at DESC`,
  );
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export async function treatSignupsFromDevice(ipHash: string): Promise<number> {
  const [r] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM treat_houses WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`,
    [ipHash],
  );
  return r?.n ?? 0;
}

export async function addTreatHouse(h: {
  x: number;
  y: number;
  house_number: string;
  street: string;
  note: string;
  contact_name: string;
  ipHash: string;
}): Promise<{ house: TreatHouse; token: string }> {
  // A private key returned only to the device that signed up; lets that device delete its own entry.
  const token = randomBytes(18).toString('base64url');
  const tokenHash = hashToken(token);
  // Same address signing up again replaces the earlier entry instead of adding a second candy.
  // A house is the same house if the typed address matches, or the candy lands on the same lot.
  const [existing] = await q<{ id: number }>(
    `SELECT id FROM treat_houses
      WHERE hidden = false
        AND ((($1)::text <> '' AND lower(house_number) = lower($1) AND lower(street) = lower($2))
             OR (abs(x - $3) < 0.05 AND abs(y - $4) < 0.05))
      ORDER BY id LIMIT 1`,
    [h.house_number, h.street, h.x, h.y],
  );
  if (existing) {
    const [row] = await q<TreatHouse>(
      `UPDATE treat_houses SET x = $2, y = $3, note = $4, contact_name = COALESCE($5, contact_name),
              house_number = CASE WHEN $6 <> '' THEN $6 ELSE house_number END, street = $7, edit_token_hash = $8
        WHERE id = $1 RETURNING id, x, y, house_number, street, note`,
      [existing.id, h.x, h.y, h.note || null, h.contact_name || null, h.house_number, h.street, tokenHash],
    );
    return { house: row, token };
  }
  const [row] = await q<TreatHouse>(
    `INSERT INTO treat_houses (x, y, house_number, street, note, contact_name, ip_hash, edit_token_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, x, y, house_number, street, note`,
    [h.x, h.y, h.house_number, h.street, h.note || null, h.contact_name || null, h.ipHash, tokenHash],
  );
  return { house: row, token };
}

/** A volunteer deleting their own entry, proven by the key their device got at sign-up. */
export async function deleteOwnTreatHouse(id: number, token: string): Promise<boolean> {
  const rows = await q(`DELETE FROM treat_houses WHERE id = $1 AND edit_token_hash = $2 RETURNING id`, [id, hashToken(token)]);
  return rows.length > 0;
}

/** Organizer: permanent delete. */
export async function deleteTreatHouse(id: number) {
  await q(`DELETE FROM treat_houses WHERE id = $1`, [id]);
}

export async function moveTreatHouse(id: number, x: number, y: number) {
  await q(`UPDATE treat_houses SET x = $2, y = $3 WHERE id = $1`, [id, x, y]);
}

export async function setTreatHouseHidden(id: number, hidden: boolean) {
  await q(`UPDATE treat_houses SET hidden = $2 WHERE id = $1`, [id, hidden]);
}

/** Sign-ups close at the end of TREATS_SIGNUP_CLOSES (YYYY-MM-DD, Arizona time). Open when unset. */
export function signupClosesAt(): Date | null {
  const v = process.env.TREATS_SIGNUP_CLOSES;
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T23:59:59-07:00`);
}

export const signupOpen = () => {
  const c = signupClosesAt();
  return !c || Date.now() <= c.getTime();
};

