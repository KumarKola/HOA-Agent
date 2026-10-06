import { q } from './db';
import type { EntranceId, GateType, IssueId } from './gates';

export type Incident = {
  id: number;
  entrance: EntranceId;
  gate: GateType;
  issue: IssueId;
  status: 'open' | 'closed';
  source: string;
  confirmations: number;
  citycync_ticket: string | null;
  created_at: string;
  last_report_at: string;
  escalated_at: string | null;
  resolved_at: string | null;
  resolution: string | null;
};

export type Report = {
  id: number;
  incident_id: number;
  kind: 'report' | 'confirm';
  note: string | null;
  reporter_name: string | null;
  reporter_lot: string | null;
  created_at: string;
};

const RATE_LIMIT_PER_HOUR = 8;
export const ESCALATE_AFTER_HOURS = 48;
export const RED_AFTER_DAYS = 7;

// Phoenix stays on UTC-7 all year (no daylight saving).
const PHX_OFFSET_MS = 7 * 3600 * 1000;
export function phoenixMonthStart(monthsAgo = 0, now = new Date()): Date {
  const local = new Date(now.getTime() - PHX_OFFSET_MS);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsAgo, 1);
  return new Date(start + PHX_OFFSET_MS);
}

export async function getOpenIncidents(): Promise<Incident[]> {
  return q<Incident>(`SELECT * FROM incidents WHERE status = 'open' ORDER BY created_at ASC`);
}

export async function isRateLimited(ipHash: string): Promise<boolean> {
  const [r] = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM reports WHERE ip_hash = $1 AND created_at > now() - interval '1 hour'`,
    [ipHash],
  );
  return (r?.n ?? 0) >= RATE_LIMIT_PER_HOUR;
}

/** Adds a report. Merges into the open incident for the same entrance, gate and issue when one exists. */
export async function submitReport(input: {
  entrance: EntranceId;
  gate: GateType;
  issue: IssueId;
  note?: string;
  name?: string;
  lot?: string;
  ipHash: string;
  source?: 'resident' | 'sensor';
}): Promise<{ incident: Incident; created: boolean }> {
  const [existing] = await q<Incident>(
    `SELECT * FROM incidents WHERE status = 'open' AND entrance = $1 AND gate = $2 AND issue = $3 ORDER BY id LIMIT 1`,
    [input.entrance, input.gate, input.issue],
  );
  let incident: Incident;
  let created = false;
  if (existing) {
    [incident] = await q<Incident>(
      `UPDATE incidents SET confirmations = confirmations + 1, last_report_at = now() WHERE id = $1 RETURNING *`,
      [existing.id],
    );
  } else {
    [incident] = await q<Incident>(
      `INSERT INTO incidents (entrance, gate, issue, source) VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.entrance, input.gate, input.issue, input.source ?? 'resident'],
    );
    created = true;
  }
  await q(
    `INSERT INTO reports (incident_id, kind, note, reporter_name, reporter_lot, ip_hash) VALUES ($1, 'report', $2, $3, $4, $5)`,
    [incident.id, input.note || null, input.name || null, input.lot || null, input.ipHash],
  );
  return { incident, created };
}

/** "Me too": one confirmation per device per incident. */
export async function confirmIncident(
  id: number,
  ipHash: string,
): Promise<{ ok: boolean; already?: boolean; incident?: Incident }> {
  const [inc] = await q<Incident>(`SELECT * FROM incidents WHERE id = $1 AND status = 'open'`, [id]);
  if (!inc) return { ok: false };
  const [dup] = await q(`SELECT 1 FROM reports WHERE incident_id = $1 AND ip_hash = $2 LIMIT 1`, [id, ipHash]);
  if (dup) return { ok: true, already: true, incident: inc };
  const [updated] = await q<Incident>(
    `UPDATE incidents SET confirmations = confirmations + 1, last_report_at = now() WHERE id = $1 RETURNING *`,
    [id],
  );
  await q(`INSERT INTO reports (incident_id, kind, ip_hash) VALUES ($1, 'confirm', $2)`, [id, ipHash]);
  return { ok: true, incident: updated };
}

export async function getReports(incidentId: number): Promise<Report[]> {
  return q<Report>(
    `SELECT id, incident_id, kind, note, reporter_name, reporter_lot, created_at FROM reports WHERE incident_id = $1 ORDER BY created_at`,
    [incidentId],
  );
}

export async function setTicket(id: number, ticket: string) {
  await q(`UPDATE incidents SET citycync_ticket = $2 WHERE id = $1`, [id, ticket.trim() || null]);
}

export async function closeIncident(id: number, resolution: 'fixed' | 'dismissed') {
  await q(`UPDATE incidents SET status = 'closed', resolution = $2, resolved_at = now() WHERE id = $1 AND status = 'open'`, [
    id,
    resolution,
  ]);
}

export async function markEscalated(id: number) {
  await q(`UPDATE incidents SET escalated_at = now() WHERE id = $1`, [id]);
}

export async function getEscalationDue(): Promise<Incident[]> {
  return q<Incident>(
    `SELECT * FROM incidents WHERE status = 'open' AND escalated_at IS NULL
       AND created_at < now() - ($1 || ' hours')::interval ORDER BY created_at`,
    [String(ESCALATE_AFTER_HOURS)],
  );
}

export async function getRecentClosed(limit = 20): Promise<Incident[]> {
  return q<Incident>(`SELECT * FROM incidents WHERE status = 'closed' ORDER BY resolved_at DESC LIMIT $1`, [limit]);
}

export type EntranceStats = { entrance: string; this_month: number; last_month: number; avg_fix_hours: number | null };

export async function getEntranceStats(now = new Date()): Promise<EntranceStats[]> {
  const thisStart = phoenixMonthStart(0, now);
  const lastStart = phoenixMonthStart(1, now);
  return q<EntranceStats>(
    `SELECT entrance,
            count(*) FILTER (WHERE created_at >= $1)::int AS this_month,
            count(*) FILTER (WHERE created_at >= $2 AND created_at < $1)::int AS last_month,
            avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
              FILTER (WHERE resolution = 'fixed' AND resolved_at > now() - interval '90 days')::float AS avg_fix_hours
       FROM incidents
      WHERE resolution IS DISTINCT FROM 'dismissed'
      GROUP BY entrance`,
    [thisStart.toISOString(), lastStart.toISOString()],
  );
}

/** Incidents opened in a Phoenix calendar month (monthsAgo = 1 for last month). */
export async function getMonthIncidents(monthsAgo = 1, now = new Date()): Promise<Incident[]> {
  const start = phoenixMonthStart(monthsAgo, now);
  const end = phoenixMonthStart(monthsAgo - 1, now);
  return q<Incident>(
    `SELECT * FROM incidents WHERE created_at >= $1 AND created_at < $2 AND resolution IS DISTINCT FROM 'dismissed' ORDER BY created_at`,
    [start.toISOString(), end.toISOString()],
  );
}

export async function getAvgFixHours(): Promise<number | null> {
  const [r] = await q<{ h: number | null }>(
    `SELECT avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::float AS h
       FROM incidents WHERE resolution = 'fixed' AND resolved_at > now() - interval '90 days'`,
  );
  return r?.h ?? null;
}
