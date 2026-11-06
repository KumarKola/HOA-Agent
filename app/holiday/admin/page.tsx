import SetupNotice from '../../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { contest, listEntriesAdmin, listVotesAdmin, phase, scheduleLabels } from '@/lib/holiday';
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
  const c = await contest();
  const [entries, votes] = await Promise.all([listEntriesAdmin(c.season), listVotesAdmin(c.season)]);
  return (
    <HolidayAdmin
      key={`${c.season}-${c.test}`}
      entries={entries}
      votes={votes}
      phase={c.phase}
      realPhase={phase()}
      test={c.test}
      labels={scheduleLabels()}
      season={c.year}
    />
  );
}
