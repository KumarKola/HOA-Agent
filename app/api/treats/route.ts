import { NextResponse } from 'next/server';
import { addTreatHouse, signupOpen, treatSignupsFromDevice, validPct } from '@/lib/treats';
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
  if (!/^\d{3,6}[A-Za-z]?$/.test(house_number) || street.length < 3) {
    return NextResponse.json({ error: 'Enter your house number and street.' }, { status: 400 });
  }
  const ipHash = await reporterHash();
  if ((await treatSignupsFromDevice(ipHash)) >= 5) {
    return NextResponse.json({ error: 'Too many sign-ups from this device. Try again later.' }, { status: 429 });
  }
  const house = await addTreatHouse({
    x: Math.round(body.x * 100) / 100,
    y: Math.round(body.y * 100) / 100,
    house_number,
    street,
    note: clean(body.note, 120),
    contact_name: clean(body.name, 60),
    ipHash,
  });
  return NextResponse.json({ house });
}
