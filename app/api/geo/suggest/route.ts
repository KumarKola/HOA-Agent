import { NextResponse } from 'next/server';
import { addressLookupEnabled, overGeoLimit, suggestAddresses } from '@/lib/google';
import { clean, reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!addressLookupEnabled()) return NextResponse.json({ suggestions: [] });
  const u = new URL(req.url);
  const q = clean(u.searchParams.get('q'), 80);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });
  if (overGeoLimit(await reporterHash())) return NextResponse.json({ suggestions: [] }, { status: 429 });
  try {
    return NextResponse.json({ suggestions: await suggestAddresses(q, clean(u.searchParams.get('s'), 64) || undefined) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ suggestions: [] }, { status: 502 });
  }
}
