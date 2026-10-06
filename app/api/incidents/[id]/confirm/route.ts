import { NextResponse } from 'next/server';
import { confirmIncident, isRateLimited } from '@/lib/incidents';
import { reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Unknown incident.' }, { status: 400 });
  const ipHash = await reporterHash();
  if (await isRateLimited(ipHash)) {
    return NextResponse.json({ error: 'Too many reports from this device in the last hour. Try again later.' }, { status: 429 });
  }
  const r = await confirmIncident(id, ipHash);
  if (!r.ok) return NextResponse.json({ error: 'This incident is already closed.' }, { status: 404 });
  return NextResponse.json({ id, already: !!r.already, confirmations: r.incident?.confirmations });
}
