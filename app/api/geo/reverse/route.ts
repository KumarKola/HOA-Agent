import { NextResponse } from 'next/server';
import { addressLookupEnabled, overGeoLimit, reverseGeocode } from '@/lib/google';
import { reporterHash } from '@/lib/util';
import { communityOrDefault } from '@/lib/communities';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!addressLookupEnabled()) return NextResponse.json({ address: null });
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
  // Only answer for points in or near the community (Liberty unless ?c= names another).
  const b = communityOrDefault(u.searchParams.get('c')).bounds, m = 0.002;
  if (!(lat > b.low.latitude - m && lat < b.high.latitude + m && lng > b.low.longitude - m && lng < b.high.longitude + m)) return NextResponse.json({ address: null });
  if (overGeoLimit(await reporterHash())) return NextResponse.json({ address: null }, { status: 429 });
  try {
    return NextResponse.json({ address: await reverseGeocode(lat, lng) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ address: null }, { status: 502 });
  }
}
