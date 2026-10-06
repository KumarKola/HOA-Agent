import { NextResponse } from 'next/server';
import { getEscalationDue, markEscalated } from '@/lib/incidents';
import { emailEscalation } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Runs daily (vercel.json). Escalates open incidents older than 48 hours, once each.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const due = await getEscalationDue();
  for (const inc of due) {
    await emailEscalation(inc);
    await markEscalated(inc.id);
  }
  return NextResponse.json({ escalated: due.map((i) => i.id) });
}
