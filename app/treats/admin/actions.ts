'use server';

import { revalidatePath } from 'next/cache';
import { isAuthed } from '@/lib/auth';
import { deleteTreatHouse, moveTreatHouse, setTreatHouseHidden, validPct } from '@/lib/treats';

export async function moveHouse(id: number, x: number, y: number): Promise<string | null> {
  if (!(await isAuthed())) return 'Signed out. Sign in on the liaison page again.';
  if (!Number.isInteger(id) || !validPct(x) || !validPct(y)) return 'That spot is off the map.';
  await moveTreatHouse(id, x, y);
  revalidatePath('/treats');
  revalidatePath('/treats/admin');
  return null;
}

export async function hideHouse(id: number, hidden: boolean): Promise<string | null> {
  if (!(await isAuthed())) return 'Signed out. Sign in on the liaison page again.';
  await setTreatHouseHidden(id, hidden);
  revalidatePath('/treats');
  revalidatePath('/treats/admin');
  return null;
}

export async function deleteHouse(id: number): Promise<string | null> {
  if (!(await isAuthed())) return 'Signed out. Sign in on the liaison page again.';
  await deleteTreatHouse(id);
  revalidatePath('/treats');
  revalidatePath('/treats/admin');
  return null;
}
