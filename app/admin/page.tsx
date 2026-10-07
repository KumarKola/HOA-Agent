import { cookies } from 'next/headers';
import SetupNotice from '../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { incidentTitle } from '@/lib/gates';
import { closeIncident, getOpenIncidents, getReports } from '@/lib/incidents';
import { COOKIE, isAuthed } from '@/lib/auth';
import TrackingForm from './TrackingForm';
import { adminToken, age, phx, safeEqual } from '@/lib/util';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Liaison · Liberty Gates', robots: { index: false } };

async function login(form: FormData) {
  'use server';
  const pass = String(form.get('passcode') || '');
  const expected = process.env.ADMIN_PASSCODE || '';
  if (expected && safeEqual(pass, expected)) {
    (await cookies()).set(COOKIE, adminToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    redirect('/admin');
  }
  redirect('/admin?wrong=1');
}

async function close(form: FormData) {
  'use server';
  if (!(await isAuthed())) return;
  const how = form.get('how') === 'dismissed' ? 'dismissed' : 'fixed';
  await closeIncident(Number(form.get('id')), how);
  revalidatePath('/admin');
  revalidatePath('/dashboard');
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  if (!dbConfigured()) return <SetupNotice />;
  const sp = await searchParams;
  if (!(await isAuthed())) {
    return (
      <main className="wrap" style={{ maxWidth: 420 }}>
        <h1 className="brand">
          <small>Liberty Gates</small>
          Liaison sign-in
        </h1>
        {!process.env.ADMIN_PASSCODE ? (
          <p className="alert">Set ADMIN_PASSCODE in the site settings to turn on this page.</p>
        ) : (
          <form action={login} className="card step">
            <label className="field" htmlFor="passcode">
              Passcode
              <input id="passcode" name="passcode" type="password" autoComplete="current-password" required />
            </label>
            {sp.wrong && (
              <span className="small" style={{ color: 'var(--bad)' }}>
                That passcode didn&rsquo;t match. Try again.
              </span>
            )}
            <button className="btn">Sign in</button>
          </form>
        )}
      </main>
    );
  }

  const open = await getOpenIncidents();
  const withReports = await Promise.all(open.map(async (i) => ({ i, reports: await getReports(i.id) })));

  return (
    <main className="wrap">
      <header className="topbar">
        <h1 className="brand">
          <small>Liberty Gates · Liaison</small>
          Open incidents
        </h1>
        <nav className="nav">
          <a href="/dashboard">Gate status</a>
          <a href="/">Report</a>
          <a href="/treats/admin">Trick-or-treat</a>
        </nav>
      </header>
      <p className="small muted" style={{ margin: 0 }}>
        Add the CityCync ticket number once City Property opens a work order, and a short update residents will see on the status page. Mark an incident fixed once the gate works again; that
        sets its time to fix on the dashboard.
      </p>
      {withReports.length === 0 && <p className="card empty">No open incidents.</p>}
      {withReports.map(({ i, reports }) => {
        const notes = reports.filter((r) => r.kind === 'report' && (r.note || r.reporter_name || r.reporter_lot));
        return (
          <section className="card adminInc" key={i.id}>
            <div className="incTop">
              <h3>
                #{i.id} {incidentTitle(i)}
              </h3>
              <span className="pill warn">open {age(i.created_at)}</span>
            </div>
            <div className="meta">
              <span>since {phx(i.created_at)}</span>
              <span>
                {i.confirmations} {i.confirmations === 1 ? 'report' : 'reports'}
              </span>
              {i.escalated_at && <span>escalated {phx(i.escalated_at)}</span>}
            </div>
            {notes.length > 0 && (
              <ul className="notes">
                {notes.map((r) => (
                  <li key={r.id}>
                    {phx(r.created_at)}
                    {(r.reporter_name || r.reporter_lot) &&
                      ` · ${[r.reporter_name, r.reporter_lot && `Lot ${r.reporter_lot}`].filter(Boolean).join(', ')}`}
                    {r.note && <>: {r.note}</>}
                  </li>
                ))}
              </ul>
            )}
            <TrackingForm
              key={i.id}
              id={i.id}
              ticket={i.citycync_ticket || ''}
              update={i.public_update || ''}
            />
            <div className="inline">
              <form action={close}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="how" value="fixed" />
                <button className="btn">Mark fixed</button>
              </form>
              <form action={close}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="how" value="dismissed" />
                <button className="btn ghost">Not a gate problem</button>
              </form>
            </div>
          </section>
        );
      })}
    </main>
  );
}
