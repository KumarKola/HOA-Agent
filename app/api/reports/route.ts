import { NextResponse } from 'next/server';
import { isEntrance, isGateType, isIssue, ISSUES_BY_GATE } from '@/lib/gates';
import { isRateLimited, submitReport } from '@/lib/incidents';
import { emailNewIncident } from '@/lib/email';
import { clean, reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { entrance, gate, issue } = body ?? {};
  if (!isEntrance(entrance) || !isGateType(gate) || !isIssue(issue) || !ISSUES_BY_GATE[gate].includes(issue)) {
    return NextResponse.json({ error: 'Pick an entrance, a gate and a problem.' }, { status: 400 });
  }
  const ipHash = await reporterHash();
  if (await isRateLimited(ipHash)) {
    return NextResponse.json({ error: 'Too many reports from this device in the last hour. Try again later.' }, { status: 429 });
  }
  const { incident, created } = await submitReport({
    entrance,
    gate,
    issue,
    note: clean(body.note, 500),
    name: clean(body.name, 80),
    lot: clean(body.lot, 20),
    ipHash,
  });
  if (created) {
    try {
      await emailNewIncident(incident);
    } catch (e) {
      console.error('New incident email failed', e);
    }
  }
  return NextResponse.json({ id: incident.id, created, confirmations: incident.confirmations });
}
