import { ENTRANCES, incidentTitle, gateLabel, issueLabel } from '@/lib/gates';
import SetupNotice from '../SetupNotice';
import { dbConfigured } from '@/lib/db';
import { getAvgFixHours, getEntranceStats, getOpenIncidents, getRecentClosed, RED_AFTER_DAYS, type Incident } from '@/lib/incidents';
import { age, hoursSince, phx } from '@/lib/util';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gate status · Liberty Gates' };

const fmtHours = (h: number | null) => (h === null ? '–' : h < 48 ? `${h.toFixed(0)} h` : `${(h / 24).toFixed(1)} d`);

function OpenRow({ i }: { i: Incident }) {
  const red = hoursSince(i.created_at) > RED_AFTER_DAYS * 24;
  return (
    <div className={`inc ${red ? 'red' : 'open'}`}>
      <div className="incTop">
        <b>
          {gateLabel(i.gate)}: {issueLabel(i.issue)}
        </b>
        <span className={`pill ${red ? 'bad' : 'warn'}`}>open {age(i.created_at)}</span>
      </div>
      <div className="meta">
        <span>#{i.id}</span>
        <span>
          {i.confirmations} {i.confirmations === 1 ? 'report' : 'reports'}
        </span>
        <span>since {phx(i.created_at)}</span>
        <span>{i.citycync_ticket ? `CityCync ${i.citycync_ticket}` : 'CityCync ticket pending'}</span>
        {i.escalated_at && <span>escalated to HOA president</span>}
        {i.source === 'sensor' && <span>sensor alert</span>}
      </div>
    </div>
  );
}

export default async function Dashboard() {
  if (!dbConfigured()) return <SetupNotice />;
  const [open, stats, closed, avgFix] = await Promise.all([getOpenIncidents(), getEntranceStats(), getRecentClosed(12), getAvgFixHours()]);
  const byEnt = Object.fromEntries(stats.map((s) => [s.entrance, s]));
  const thisMonth = stats.reduce((a, s) => a + s.this_month, 0);
  const fixed = closed.filter((c) => c.resolution === 'fixed');
  const overdue = open.filter((i) => hoursSince(i.created_at) > RED_AFTER_DAYS * 24).length;

  return (
    <main className="wrap">
      <header className="topbar">
        <h1 className="brand">
          <small>Liberty community · Phoenix</small>
          Gate status
        </h1>
        <nav className="nav">
          <a href="/">Report a problem</a>
        </nav>
      </header>

      <section className="kpis" aria-label="Summary">
        <div className="kpi">
          <b>{open.length}</b>
          <span>open now</span>
        </div>
        <div className="kpi">
          <b style={{ color: overdue ? 'var(--bad)' : undefined }}>{overdue}</b>
          <span>open over {RED_AFTER_DAYS} days</span>
        </div>
        <div className="kpi">
          <b>{thisMonth}</b>
          <span>reported this month</span>
        </div>
        <div className="kpi">
          <b>{fmtHours(avgFix)}</b>
          <span>average time to fix (90 days)</span>
        </div>
      </section>

      {ENTRANCES.map((e) => {
        const s = byEnt[e.id];
        const list = open.filter((i) => i.entrance === e.id);
        return (
          <section className="card ent" key={e.id}>
            <div className="entHead">
              <h2>{e.name}</h2>
              <span className={`pill ${list.length ? 'warn' : 'good'}`}>{list.length ? `${list.length} open` : 'no open issues'}</span>
            </div>
            <div className="stats">
              <span>This month: {s?.this_month ?? 0}</span>
              <span>Last month: {s?.last_month ?? 0}</span>
              <span>Avg fix: {fmtHours(s?.avg_fix_hours ?? null)}</span>
            </div>
            {list.map((i) => (
              <OpenRow key={i.id} i={i} />
            ))}
          </section>
        );
      })}

      <section className="card ent">
        <h2>Recently fixed</h2>
        {fixed.length === 0 && <p className="empty">Nothing fixed yet. Fixed incidents appear here with their time to fix.</p>}
        {fixed.map((i) => (
          <div className="inc closed" key={i.id}>
            <div className="incTop">
              <b>{incidentTitle(i)}</b>
              <span className="pill good">fixed in {age(i.created_at, new Date(i.resolved_at!))}</span>
            </div>
            <div className="meta">
              <span>#{i.id}</span>
              <span>
                {i.confirmations} {i.confirmations === 1 ? 'report' : 'reports'}
              </span>
              <span>fixed {phx(i.resolved_at!)}</span>
              {i.citycync_ticket && <span>CityCync {i.citycync_ticket}</span>}
            </div>
          </div>
        ))}
      </section>

      <p className="small muted" style={{ margin: 0 }}>
        Times are Arizona time. Incidents open more than 48 hours are escalated to the HOA president; over {RED_AFTER_DAYS} days they
        are flagged red. Reporter names are never shown here.
      </p>
    </main>
  );
}
