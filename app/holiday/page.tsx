import SetupNotice from '../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { contest, listEntries, residentsChoice, scheduleLabels } from '@/lib/holiday';
import { addressLookupEnabled } from '@/lib/google';
import HolidayApp from './HolidayApp';

export const dynamic = 'force-dynamic';

export default async function HolidayPage() {
  if (!dbConfigured()) return <SetupNotice />;
  const c = await contest();
  const p = c.phase;
  const [entries, winners] = await Promise.all([listEntries(c.season), p === 'results' ? residentsChoice(c.season) : Promise.resolve([])]);
  return (
    <HolidayApp
      initial={entries}
      phase={p}
      labels={scheduleLabels()}
      season={c.season}
      test={!!c.test}
      winners={winners}
      addressLookup={addressLookupEnabled()}
    />
  );
}
