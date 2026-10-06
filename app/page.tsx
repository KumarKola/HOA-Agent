import ReportFlow, { type OpenItem } from './ReportFlow';
import { getOpenIncidents } from '@/lib/incidents';
import { age } from '@/lib/util';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const open: OpenItem[] = (await getOpenIncidents()).map((i) => ({
    id: i.id,
    entrance: i.entrance,
    gate: i.gate,
    issue: i.issue,
    confirmations: i.confirmations,
    age: age(i.created_at),
  }));

  return (
    <main className="wrap">
      <header className="topbar">
        <h1 className="brand">
          <small>Liberty community · Phoenix</small>
          Report a gate problem
        </h1>
        <nav className="nav">
          <a href="/dashboard">Gate status</a>
        </nav>
      </header>
      <ReportFlow open={open} />
      <p className="small muted" style={{ margin: 0 }}>
        Reports go to City Property automatically and stay open until the gate is fixed. No account needed.
      </p>
    </main>
  );
}
