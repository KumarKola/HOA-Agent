'use server';

import { revalidatePath } from 'next/cache';
import { isAuthed } from '@/lib/auth';
import { setTracking } from '@/lib/incidents';
import { clean } from '@/lib/util';

export type SaveState = { ok: boolean; message: string; ticket: string; update: string };

export async function saveTracking(_prev: SaveState, form: FormData): Promise<SaveState> {
  const ticket = clean(form.get('ticket'), 40);
  const update = clean(form.get('update'), 200);
  if (!(await isAuthed())) return { ok: false, message: 'Signed out. Reload the page and sign in again.', ticket, update };
  const inc = await setTracking(Number(form.get('id')), ticket, update);
  if (!inc) return { ok: false, message: 'This incident no longer exists.', ticket, update };
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Saved', ticket: inc.citycync_ticket || '', update: inc.public_update || '' };
}
