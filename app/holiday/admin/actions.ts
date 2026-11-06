'use server';

import { revalidatePath } from 'next/cache';
import { isAuthed } from '@/lib/auth';
import { clearTestData, deleteEntry, deleteVote, moveEntry, setEntryAward, setEntryHidden, setTestPhase, TEST_PHASES, type TestPhase } from '@/lib/holiday';
import { validPct } from '@/lib/treatsGeo';

const SIGNED_OUT = 'Signed out. Sign in on the liaison page again.';
const refresh = () => {
  revalidatePath('/holiday');
  revalidatePath('/holiday/admin');
};

export async function moveHolidayEntry(id: number, x: number, y: number): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  if (!Number.isInteger(id) || !validPct(x) || !validPct(y)) return 'That spot is off the map.';
  await moveEntry(id, x, y);
  refresh();
  return null;
}

export async function hideHolidayEntry(id: number, hidden: boolean): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  await setEntryHidden(id, hidden);
  refresh();
  return null;
}

export async function deleteHolidayEntry(id: number): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  await deleteEntry(id);
  refresh();
  return null;
}

export async function awardHolidayEntry(id: number, award: string): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  const a = award.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40);
  await setEntryAward(id, a || null);
  refresh();
  return null;
}

/** Test mode: '' turns it off (real dates), or 'entry' | 'voting' | 'results' for a practice round. */
export async function setHolidayTestMode(v: string): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  if (v && !(TEST_PHASES as string[]).includes(v)) return 'Unknown setting.';
  await setTestPhase((v || null) as TestPhase | null);
  refresh();
  return null;
}

export async function clearHolidayTestData(): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  await clearTestData();
  refresh();
  return null;
}

export async function removeHolidayVote(id: number): Promise<string | null> {
  if (!(await isAuthed())) return SIGNED_OUT;
  await deleteVote(id);
  refresh();
  return null;
}
