import { NextResponse } from 'next/server';
import { addEntry, contest, deleteOwnEntry, entriesFromDevice, knownStreet, MARKERS, type Marker } from '@/lib/holiday';
import { validPct } from '@/lib/treatsGeo';
import { communityOrDefault } from '@/lib/communities';
import { clean, reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const community = communityOrDefault(body.community).slug;
  const c = await contest(community);
  if (c.phase !== 'entry') return NextResponse.json({ error: 'Entries are closed for this year.' }, { status: 403 });
  const house_number = clean(body.house_number, 10);
  const street = knownStreet(community, clean(body.street, 40));
  const marker: Marker = MARKERS.includes(body.marker) ? body.marker : 'tree';
  if (!validPct(body.x) || !validPct(body.y)) {
    return NextResponse.json({ error: 'Tap your home on the map first.' }, { status: 400 });
  }
  if (!/^\d{3,6}$/.test(house_number)) {
    return NextResponse.json({ error: 'Enter your house number so neighbors can find your home.' }, { status: 400 });
  }
  if (!street) return NextResponse.json({ error: 'Pick your street from the list.' }, { status: 400 });
  const ipHash = await reporterHash();
  if ((await entriesFromDevice(ipHash)) >= 5) {
    return NextResponse.json({ error: 'Too many entries from this device. Try again later.' }, { status: 429 });
  }
  const { entry, token } = await addEntry({
    community,
    season: c.season,
    x: Math.round(body.x * 100) / 100,
    y: Math.round(body.y * 100) / 100,
    house_number,
    street,
    marker,
    note: clean(body.note, 120),
    contact_name: clean(body.name, 60),
    ipHash,
  });
  return NextResponse.json({ entry, token });
}

// An entrant removes their own home using the key their device saved when entering.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const token = clean(body.token, 64);
  if (!Number.isInteger(id) || !token) return NextResponse.json({ error: 'Missing details.' }, { status: 400 });
  const ok = await deleteOwnEntry(id, token);
  if (!ok) return NextResponse.json({ error: 'This home was entered from another device. Ask the social committee to remove it.' }, { status: 403 });
  return NextResponse.json({ deleted: id });
}
