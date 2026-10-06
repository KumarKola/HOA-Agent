import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { headers } from 'next/headers';

/** Hash of the reporter's IP, used only for spam limits and one "Me too" per device. */
export async function reporterHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
  return createHash('sha256')
    .update(ip + (process.env.HASH_SALT || 'liberty-dev-salt'))
    .digest('hex')
    .slice(0, 32);
}

export function adminToken(): string {
  const pass = process.env.ADMIN_PASSCODE || '';
  return createHmac('sha256', pass + (process.env.HASH_SALT || 'liberty-dev-salt')).update('liaison').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Phoenix',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
export const phx = (d: string | Date) => fmt.format(new Date(d));

/** "3 h", "2 d 4 h" */
export function age(from: string | Date, to: Date = new Date()): string {
  const hrs = Math.max(0, (to.getTime() - new Date(from).getTime()) / 3600000);
  if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))} min`;
  if (hrs < 24) return `${Math.round(hrs)} h`;
  const d = Math.floor(hrs / 24);
  const h = Math.round(hrs - d * 24);
  return h ? `${d} d ${h} h` : `${d} d`;
}

export const hoursSince = (d: string | Date) => (Date.now() - new Date(d).getTime()) / 3600000;

export function clean(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}
