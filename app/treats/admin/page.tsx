import SetupNotice from '../../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { listTreatHousesAdmin } from '@/lib/treats';
import TreatsAdmin from './TreatsAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Trick-or-treat organizer · Liberty', robots: { index: false } };

export default async function Page() {
  if (!dbConfigured()) return <SetupNotice />;
  if (!(await isAuthed())) {
    return (
      <div className="ttWrap">
        <h1>
          <small>Trick-or-treat · Organizer</small>
          Sign in first
        </h1>
        <p>
          Sign in on the <a href="/admin">liaison page</a> with the HOA passcode, then come back to this page.
        </p>
      </div>
    );
  }
  const houses = await listTreatHousesAdmin();
  return <TreatsAdmin houses={houses} />;
}
