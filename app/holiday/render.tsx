// Shared server rendering for every community's contest page and organizer page.
import { notFound } from 'next/navigation';
import SetupNotice from '../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { getCommunity } from '@/lib/communities';
import { addressLookupEnabled } from '@/lib/google';
import { contest, listEntries, listEntriesAdmin, listVotesAdmin, phase, residentsChoice, scheduleLabels } from '@/lib/holiday';
import HolidayApp from './HolidayApp';
import HolidayAdmin from './admin/HolidayAdmin';

export function contestMetadata(slug: string) {
  const cm = getCommunity(slug);
  if (!cm) return {};
  return {
    title: `Holiday Decor Contest · ${cm.short}`,
    description: `Enter your decorated home on the ${cm.short} map, then vote for your favorite.`,
  };
}

export async function ContestPage({ slug }: { slug: string }) {
  const cm = getCommunity(slug);
  if (!cm) notFound();
  if (!dbConfigured()) return <SetupNotice />;
  const c = await contest(cm.slug);
  const p = c.phase;
  const [entries, winners] = await Promise.all([
    listEntries(cm.slug, c.season),
    p === 'results' ? residentsChoice(cm.slug, c.season) : Promise.resolve([]),
  ]);
  return (
    <HolidayApp
      community={cm.slug}
      initial={entries}
      phase={p}
      labels={scheduleLabels(cm.slug)}
      season={c.season}
      test={!!c.test}
      winners={winners}
      addressLookup={addressLookupEnabled()}
    />
  );
}

export async function OrganizerPage({ slug }: { slug: string }) {
  const cm = getCommunity(slug);
  if (!cm) notFound();
  if (!dbConfigured()) return <SetupNotice />;
  if (!(await isAuthed())) {
    return (
      <div className="ttWrap">
        <h1>
          <small>{cm.short} holiday contest · Organizer</small>
          Sign in first
        </h1>
        <p>
          Sign in on the <a href="/admin">liaison page</a> with the passcode, then come back to this page.
        </p>
      </div>
    );
  }
  const c = await contest(cm.slug);
  const [entries, votes] = await Promise.all([listEntriesAdmin(cm.slug, c.season), listVotesAdmin(cm.slug, c.season)]);
  return (
    <HolidayAdmin
      key={`${cm.slug}-${c.season}-${c.test}`}
      community={cm.slug}
      entries={entries}
      votes={votes}
      phase={c.phase}
      realPhase={phase(cm.slug)}
      test={c.test}
      labels={scheduleLabels(cm.slug)}
      season={c.year}
    />
  );
}
