import { NextResponse } from 'next/server';
import { addressLookupEnabled, overGeoLimit, placeDetails } from '@/lib/google';
import { clean, reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!addressLookupEnabled()) return NextResponse.json({ error: 'off' }, { status: 404 });
  const u = new URL(req.url);
  const id = clean(u.searchParams.get('id'), 300);
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });
  if (overGeoLimit(await reporterHash())) return NextResponse.json({ error: 'Too many lookups' }, { status: 429 });
  try {
    return NextResponse.json(await placeDetails(id, clean(u.searchParams.get('s'), 64) || undefined));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'lookup failed' }, { status: 502 });
  }
}
