import { NextResponse } from 'next/server';
import { addressLookupEnabled, overGeoLimit, reverseGeocode } from '@/lib/google';
import { reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!addressLookupEnabled()) return NextResponse.json({ address: null });
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
  // Only answer for points in or near the community.
  if (!(lat > 33.39 && lat < 33.402 && lng > -112.119 && lng < -112.105)) return NextResponse.json({ address: null });
  if (overGeoLimit(await reporterHash())) return NextResponse.json({ address: null }, { status: 429 });
  try {
    return NextResponse.json({ address: await reverseGeocode(lat, lng) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ address: null }, { status: 502 });
  }
}
