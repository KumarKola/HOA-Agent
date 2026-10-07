import { cookies } from 'next/headers';
import { adminToken, safeEqual } from './util';

export const COOKIE = 'lg_liaison';

export async function isAuthed() {
  if (!process.env.ADMIN_PASSCODE) return false;
  const c = (await cookies()).get(COOKIE)?.value || '';
  return safeEqual(c, adminToken());
}
