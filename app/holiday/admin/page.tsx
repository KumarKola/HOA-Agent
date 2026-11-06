import SetupNotice from '../../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { listEntriesAdmin, listVotesAdmin, phase, scheduleLabels, season } from '@/lib/holiday';
import HolidayAdmin from './HolidayAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Holiday contest organizer · Liberty', robots: { index: false } };

export default async function Page() {
  if (!dbConfigured()) return <SetupNotice />;
  if (!(await isAuthed())) {
    return (
      <div className="ttWrap">
        <h1>
          <small>Holiday contest · Organizer</small>
          Sign in first
        </h1>
        <p>
          Sign in on the <a href="/admin">liaison page</a> with the HOA passcode, then come back to this page.
        </p>
      </div>
    );
  }
  const [entries, votes] = await Promise.all([listEntriesAdmin(), listVotesAdmin()]);
  return <HolidayAdmin entries={entries} votes={votes} phase={phase()} labels={scheduleLabels()} season={season()} />;
}
