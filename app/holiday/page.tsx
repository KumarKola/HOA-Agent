import SetupNotice from '../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { listEntries, phase, residentsChoice, scheduleLabels, season } from '@/lib/holiday';
import { addressLookupEnabled } from '@/lib/google';
import HolidayApp from './HolidayApp';

export const dynamic = 'force-dynamic';

export default async function HolidayPage() {
  if (!dbConfigured()) return <SetupNotice />;
  const p = phase();
  const [entries, winners] = await Promise.all([listEntries(), p === 'results' ? residentsChoice() : Promise.resolve([])]);
  return (
    <HolidayApp
      initial={entries}
      phase={p}
      labels={scheduleLabels()}
      season={season()}
      winners={winners}
      addressLookup={addressLookupEnabled()}
    />
  );
}
