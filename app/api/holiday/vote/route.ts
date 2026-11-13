import { NextResponse } from 'next/server';
import { castVote, contest } from '@/lib/holiday';
import { clean, reporterHash } from '@/lib/util';
import { communityOrDefault } from '@/lib/communities';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const community = communityOrDefault(body.community).slug;
  const c = await contest(community);
  const p = c.phase;
  if (p !== 'voting') {
    const error = p === 'entry' || p === 'between' ? 'Voting hasn’t started yet.' : 'Voting is closed.';
    return NextResponse.json({ error }, { status: 403 });
  }
  const entryId = Number(body.entryId);
  const device = clean(body.device, 64);
  if (!Number.isInteger(entryId) || device.length < 16) return NextResponse.json({ error: 'Missing details. Reload the page and try again.' }, { status: 400 });
  const r = await castVote({ community, season: c.season, entryId, num: clean(body.house_number, 10), street: clean(body.street, 40), device, ipHash: await reporterHash() });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
