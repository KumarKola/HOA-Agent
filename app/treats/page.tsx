import SetupNotice from '../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { listTreatHouses, signupClosesAt, signupOpen } from '@/lib/treats';
import TreatsApp from './TreatsApp';

export const dynamic = 'force-dynamic';

export default async function TreatsPage() {
  if (!dbConfigured()) return <SetupNotice />;
  const houses = await listTreatHouses();
  const closes = signupClosesAt();
  const closesLabel = closes
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', weekday: 'long', month: 'long', day: 'numeric' }).format(closes)
    : null;
  return <TreatsApp initial={houses} signupOpen={signupOpen()} closesLabel={closesLabel ? `end of ${closesLabel}` : null} />;
}
