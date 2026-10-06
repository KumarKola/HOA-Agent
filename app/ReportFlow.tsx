'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import GateMap from './GateMap';
import {
  ENTRANCES,
  GATE_TYPES,
  ISSUES,
  ISSUES_BY_GATE,
  type EntranceId,
  type GateType,
  type IssueId,
} from '@/lib/gates';

export type OpenItem = { id: number; entrance: string; gate: string; issue: string; confirmations: number; age: string };

const PORTAL = 'https://homeowners.cityproperty.com/';

export default function ReportFlow({ open }: { open: OpenItem[] }) {
  const [entrance, setEntrance] = useState<EntranceId | null>(null);
  const [gate, setGate] = useState<GateType | null>(null);
  const [issue, setIssue] = useState<IssueId | null>(null);
  const [othersFobsWork, setOthersFobsWork] = useState<'yes' | 'no' | null>(null);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [lot, setLot] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ id: number; confirmations: number; merged: boolean } | null>(null);

  const gateRef = useRef<HTMLDivElement>(null);
  const issueRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<HTMLDivElement>(null);

  const openCounts = useMemo(() => {
    const c: Record<string, number> = {};
    open.forEach((o) => (c[o.entrance] = (c[o.entrance] || 0) + 1));
    return c;
  }, [open]);

  const atEntrance = open.filter((o) => o.entrance === entrance);
  const atGate = atEntrance.filter((o) => o.gate === gate);
  const sameIssue = atGate.find((o) => o.issue === issue);

  const scrollTo = (r: React.RefObject<HTMLDivElement | null>) =>
    setTimeout(() => r.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);

  useEffect(() => setError(''), [entrance, gate, issue]);

  function pickEntrance(id: EntranceId) {
    setEntrance(id);
    setGate(null);
    setIssue(null);
    setOthersFobsWork(null);
    scrollTo(gateRef);
  }
  function pickGate(g: GateType) {
    setGate(g);
    setIssue(null);
    setOthersFobsWork(null);
    scrollTo(issueRef);
  }
  function pickIssue(i: IssueId) {
    setIssue(i);
    setOthersFobsWork(null);
    scrollTo(sendRef);
  }

  async function post(url: string, body?: object) {
    setSending(true);
    setError('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No connection. Try again.');
      return null;
    } finally {
      setSending(false);
    }
  }

  async function submit() {
    if (!entrance || !gate || !issue) return;
    const data = await post('/api/reports', { entrance, gate, issue, note, name, lot });
    if (data) {
      setDone({ id: data.id, confirmations: data.confirmations, merged: !data.created });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function meToo(id: number) {
    const data = await post(`/api/incidents/${id}/confirm`);
    if (data) {
      setDone({ id, confirmations: data.confirmations, merged: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function reset() {
    setEntrance(null);
    setGate(null);
    setIssue(null);
    setOthersFobsWork(null);
    setNote('');
    setDone(null);
  }

  if (done) {
    return (
      <section className="card done" aria-live="polite">
        <div className="check" aria-hidden="true">✓</div>
        <h2>Thanks, it&rsquo;s reported</h2>
        <p className="muted" style={{ margin: 0 }}>
          Incident #{done.id} ·{' '}
          {done.confirmations === 1 ? 'you are the first to report it' : `${done.confirmations} neighbors have reported it`}.
        </p>
        <p className="small muted" style={{ margin: 0, maxWidth: '42ch' }}>
          {done.merged
            ? 'Your report was added to the existing incident, which is already with City Property.'
            : 'City Property has been emailed. You can follow it on the status page.'}
        </p>
        <div style={{ display: 'grid', gap: 8, width: '100%', maxWidth: 320 }}>
          <a className="btn" href="/dashboard" style={{ textAlign: 'center', textDecoration: 'none', lineHeight: '24px' }}>
            See gate status
          </a>
          <button className="btn ghost" onClick={reset}>
            Report something else
          </button>
        </div>
      </section>
    );
  }

  const showSend = issue && (issue !== 'fob' || othersFobsWork === 'no');

  return (
    <>
      <section className="card step map">
        <div className="stepHead">
          <h2>Which entrance?</h2>
          <span className="stepNum">Tap 1 of 3</span>
        </div>
        <GateMap selected={entrance} openCounts={openCounts} onPick={pickEntrance} />
        <div className="choices">
          {ENTRANCES.map((e) => (
            <button key={e.id} className="choice" aria-pressed={entrance === e.id} onClick={() => pickEntrance(e.id)}>
              <span>{e.name}</span>
              {openCounts[e.id] ? <span className="tag">{openCounts[e.id]} open</span> : null}
            </button>
          ))}
        </div>
      </section>

      {entrance && (
        <section className="card step" ref={gateRef} style={{ scrollMarginTop: 12 }}>
          <div className="stepHead">
            <h2>Which gate?</h2>
            <span className="stepNum">Tap 2 of 3</span>
          </div>
          <div className="choices">
            {GATE_TYPES.map((g) => {
              const n = atEntrance.filter((o) => o.gate === g.id).length;
              return (
                <button key={g.id} className="choice" aria-pressed={gate === g.id} onClick={() => pickGate(g.id)}>
                  <span>{g.label}</span>
                  {n ? <span className="tag">{n} open</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {entrance && gate && (
        <section className="card step" ref={issueRef} style={{ scrollMarginTop: 12 }}>
          <div className="stepHead">
            <h2>What&rsquo;s wrong?</h2>
            <span className="stepNum">Tap 3 of 3</span>
          </div>
          {atGate.length > 0 && (
            <div className="existing">
              <span className="small">
                <b>Already reported at this gate.</b> If it&rsquo;s the same problem, tap Me too.
              </span>
              {atGate.map((o) => (
                <div className="existingRow" key={o.id}>
                  <span>
                    <b>{ISSUES[o.issue as IssueId]?.label}</b>
                    <br />
                    <span className="small muted">
                      {o.confirmations} {o.confirmations === 1 ? 'report' : 'reports'} · open {o.age}
                    </span>
                  </span>
                  <button className="btn" disabled={sending} onClick={() => meToo(o.id)}>
                    Me too
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="choices">
            {ISSUES_BY_GATE[gate].map((i) => {
              const already = atGate.find((o) => o.issue === i);
              return (
                <button key={i} className="choice" aria-pressed={issue === i} onClick={() => pickIssue(i)}>
                  <span>{ISSUES[i].label}</span>
                  {already ? <span className="tag">already open</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {entrance && gate && issue && (
        <section className="card step" ref={sendRef} style={{ scrollMarginTop: 12 }}>
          {issue === 'intruder' && (
            <div className="alert" role="alert">
              <b>Happening right now? Call 911.</b> For anything else, Phoenix Police non-emergency: 602-262-6151. This report
              records the pattern for the HOA; it does not alert police.
            </div>
          )}

          {issue === 'fob' && (
            <div className="step">
              <h3>Do other residents&rsquo; fobs open this gate?</h3>
              <div className="choices">
                <button className="choice" aria-pressed={othersFobsWork === 'yes'} onClick={() => setOthersFobsWork('yes')}>
                  Yes, theirs work
                </button>
                <button
                  className="choice"
                  aria-pressed={othersFobsWork === 'no'}
                  onClick={() => {
                    setOthersFobsWork('no');
                    scrollTo(sendRef);
                  }}
                >
                  No, or not sure
                </button>
              </div>
              {othersFobsWork === 'yes' && (
                <p className="small" style={{ margin: 0 }}>
                  Then your fob is the likely problem, not the gate. Request a replacement through City Property&rsquo;s{' '}
                  <a href={PORTAL} target="_blank" rel="noreferrer">
                    homeowner portal
                  </a>
                  . No gate report is needed.
                </p>
              )}
            </div>
          )}

          {showSend && sameIssue && (
            <div className="existing">
              <span>
                <b>This exact problem is already open</b> with {sameIssue.confirmations}{' '}
                {sameIssue.confirmations === 1 ? 'report' : 'reports'}. Add yours so City Property sees how many neighbors are
                affected.
              </span>
              <button className="btn" disabled={sending} onClick={() => meToo(sameIssue.id)}>
                {sending ? 'Sending…' : 'Me too'}
              </button>
            </div>
          )}

          {showSend && !sameIssue && (
            <>
              <details>
                <summary>Add a note or your name (optional)</summary>
                <div className="step" style={{ marginTop: 12 }}>
                  <label className="field" htmlFor="note">
                    Note
                    <textarea
                      id="note"
                      rows={3}
                      maxLength={500}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What did you see, and when?"
                    />
                  </label>
                  <div className="row2">
                    <label className="field" htmlFor="name">
                      Name
                      <input id="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                    </label>
                    <label className="field" htmlFor="lot">
                      Lot or house no.
                      <input id="lot" maxLength={20} value={lot} onChange={(e) => setLot(e.target.value)} inputMode="numeric" />
                    </label>
                  </div>
                  <span className="small muted">Your name and lot go only to City Property and the HOA liaison, never the public page.</span>
                </div>
              </details>
              <button className="btn" disabled={sending} onClick={submit}>
                {sending ? 'Sending…' : 'Send report'}
              </button>
            </>
          )}

          {error && (
            <p className="small" role="alert" style={{ margin: 0, color: 'var(--bad)' }}>
              {error}
            </p>
          )}
        </section>
      )}
    </>
  );
}
