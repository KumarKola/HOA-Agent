import { NextResponse } from 'next/server';
import { addTreatHouse, deleteOwnTreatHouse, signupOpen, treatSignupsFromDevice, validPct } from '@/lib/treats';
import { clean, reporterHash } from '@/lib/util';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!signupOpen()) return NextResponse.json({ error: 'Sign-ups are closed.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const house_number = clean(body.house_number, 10);
  const street = clean(body.street, 40);
  if (!validPct(body.x) || !validPct(body.y)) {
    return NextResponse.json({ error: 'Place your candy on the map first.' }, { status: 400 });
  }
  if (street.length < 3) return NextResponse.json({ error: 'Enter your street.' }, { status: 400 });
  if (house_number && !/^\d{1,6}[A-Za-z]?$/.test(house_number)) {
    return NextResponse.json({ error: 'House number should be digits only, or leave it blank.' }, { status: 400 });
  }
  const ipHash = await reporterHash();
  if ((await treatSignupsFromDevice(ipHash)) >= 5) {
    return NextResponse.json({ error: 'Too many sign-ups from this device. Try again later.' }, { status: 429 });
  }
  const { house, token } = await addTreatHouse({
    x: Math.round(body.x * 100) / 100,
    y: Math.round(body.y * 100) / 100,
    house_number,
    street,
    note: clean(body.note, 120),
    contact_name: clean(body.name, 60),
    ipHash,
  });
  return NextResponse.json({ house, token });
}

// A volunteer removes their own house using the key their device saved at sign-up.
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const token = clean(body.token, 64);
  if (!Number.isInteger(id) || !token) return NextResponse.json({ error: 'Missing details.' }, { status: 400 });
  const ok = await deleteOwnTreatHouse(id, token);
  if (!ok) return NextResponse.json({ error: 'This house was added from another device. Ask the organizer to remove it.' }, { status: 403 });
  return NextResponse.json({ deleted: id });
}
