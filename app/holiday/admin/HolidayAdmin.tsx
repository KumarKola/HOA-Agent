'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import TreatMap from '../../treats/TreatMap';
import { holidayMarker } from '../HolidayMarkers';
import { awardHolidayEntry, clearHolidayTestData, deleteHolidayEntry, hideHolidayEntry, moveHolidayEntry, removeHolidayVote, setHolidayTestMode } from './actions';
import { lotAt } from '@/lib/treatsLots';

type Row = {
  id: number;
  x: number;
  y: number;
  house_number: string;
  street: string;
  marker: 'tree' | 'lights';
  note: string | null;
  award: string | null;
  contact_name: string | null;
  hidden: boolean;
  created_at: string;
  votes: number;
};
type Vote = { id: number; voter_address: string; entry_id: number; entry_address: string; created_at: string; updated_at: string; same_network: number };

const when = (d: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d));
const addr = (r: { house_number: string; street: string }) => `${r.house_number} ${r.street}`;
const TEST_NAME = { entry: 'Enter your home', voting: 'Voting', results: 'Winners' } as const;
const PHASE: Record<string, string> = {
  entry: 'Entries open',
  between: 'Entries closed, voting not open yet',
  voting: 'Voting open',
  counting: 'Voting closed, winners not shown yet',
  results: 'Winners showing on the public page',
};

export default function HolidayAdmin({
  entries,
  votes,
  phase,
  realPhase,
  test,
  labels,
  season,
}: {
  entries: Row[];
  votes: Vote[];
  phase: string;
  realPhase: string;
  test: 'entry' | 'voting' | 'results' | null;
  labels: { entryCloses: string; voteOpens: string; voteCloses: string; results: string };
  season: number;
}) {
  const [rows, setRows] = useState(entries);
  const [voteRows, setVoteRows] = useState(votes);
  const [moving, setMoving] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [confirmVote, setConfirmVote] = useState<Vote | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const router = useRouter();
  const [awardDraft, setAwardDraft] = useState<Record<number, string>>(() => Object.fromEntries(entries.map((e) => [e.id, e.award || ''])));
  const visible = rows.filter((r) => !r.hidden);
  const ranked = useMemo(() => [...visible].sort((a, b) => b.votes - a.votes || a.street.localeCompare(b.street)), [visible]);

  function place(tx: number, ty: number) {
    if (moving === null) return;
    const l = lotAt(tx, ty);
    const x = Math.round(l.x * 100) / 100, y = Math.round(l.y * 100) / 100;
    const id = moving;
    start(async () => {
      const e = await moveHolidayEntry(id, x, y);
      if (e) return setMsg(e);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, x, y } : r)));
      setMoving(null);
      setMsg('Moved.');
    });
  }
  function toggle(r: Row) {
    start(async () => {
      const e = await hideHolidayEntry(r.id, !r.hidden);
      if (e) return setMsg(e);
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)));
      setMsg(r.hidden ? 'Restored.' : 'Removed from the map. Its votes no longer count.');
    });
  }
  function remove(r: Row) {
    start(async () => {
      const e = await deleteHolidayEntry(r.id);
      if (e) return setMsg(e);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      setVoteRows((vs) => vs.filter((v) => v.entry_id !== r.id));
      if (moving === r.id) setMoving(null);
      setConfirm(null);
      setMsg('Deleted for good, with its votes.');
    });
  }
  function saveAward(r: Row) {
    const a = (awardDraft[r.id] || '').trim();
    start(async () => {
      const e = await awardHolidayEntry(r.id, a);
      if (e) return setMsg(e);
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, award: a || null } : x)));
      setMsg(a ? `Award saved: ${a}. It shows on the public page from ${labels.results}.` : 'Award cleared.');
    });
  }
  function dropVote(v: Vote) {
    start(async () => {
      const e = await removeHolidayVote(v.id);
      if (e) return setMsg(e);
      setVoteRows((vs) => vs.filter((x) => x.id !== v.id));
      setRows((rs) => rs.map((x) => (x.id === v.entry_id ? { ...x, votes: Math.max(0, x.votes - 1) } : x)));
      setConfirmVote(null);
      setMsg(`Vote from ${v.voter_address} removed. That address can vote again.`);
    });
  }

  function setTest(v: '' | 'entry' | 'voting' | 'results') {
    start(async () => {
      const e = await setHolidayTestMode(v);
      if (e) return setMsg(e);
      setMsg(v ? `Test mode: everyone now sees the ${TEST_NAME[v]} screen.` : 'Test mode off. The site follows the real contest dates again.');
      router.refresh();
    });
  }
  function clearTest() {
    start(async () => {
      const e = await clearHolidayTestData();
      if (e) return setMsg(e);
      setConfirmClear(false);
      setRows([]);
      setVoteRows([]);
      setMsg('Practice homes and votes cleared.');
      router.refresh();
    });
  }

  const movingRow = rows.find((r) => r.id === moving);

  return (
    <div className="ttWrap">
      <header className="ttSpread">
        <h1>
          <small>Holiday contest {season} · Organizer</small>
          {visible.length} {visible.length === 1 ? 'home' : 'homes'} · {voteRows.length} {voteRows.length === 1 ? 'vote' : 'votes'}
        </h1>
        <a href="/holiday">Open the public page</a>
      </header>
      <section className="ttCard" aria-labelledby="hd-test">
        <h2 id="hd-test">Test mode</h2>
        <p className="ttSmall ttMuted">
          Show everyone a practice round of any screen right now. Practice homes and votes are kept apart from the real contest; turn test
          mode off and the site goes back to the real dates ({PHASE[realPhase] || realPhase} today).
        </p>
        <div className="hdTestPick" role="group" aria-label="Test mode">
          {(['', 'entry', 'voting', 'results'] as const).map((v) => (
            <button
              key={v || 'off'}
              className={`ttBtn small ghost${(test || '') === v ? ' cur' : ''}`}
              aria-pressed={(test || '') === v}
              disabled={pending}
              onClick={() => setTest(v)}
            >
              {v ? TEST_NAME[v] : 'Off (real dates)'}
            </button>
          ))}
        </div>
        {test && (
          <p className="ttSmall">
            Practice round on: <b>{TEST_NAME[test]}</b>. Enter a few homes on the Enter screen, switch to Voting to vote from your phone, then
            Winners. This list and the votes below are the practice ones.{' '}
            <button className="ttBtn small ghost danger" disabled={pending} onClick={() => setConfirmClear(true)}>
              Clear practice data
            </button>
          </p>
        )}
      </section>
      <p className="ttHint">
        <b>{test ? `Practice round: ${TEST_NAME[test]}` : PHASE[phase] || phase}.</b> Enter until {labels.entryCloses}, vote {labels.voteOpens}–{labels.voteCloses}, winners {labels.results}. Vote
        counts are only visible here until then.
      </p>
      {movingRow ? (
        <p className="ttHint">
          Tap the right house on the map for <b>{addr(movingRow)}</b>.{' '}
          <button className="ttBtn small ghost" onClick={() => setMoving(null)}>
            Cancel
          </button>
        </p>
      ) : (
        <p className="ttSmall ttMuted">Check each marker sits on the address typed. Move fixes one, Remove hides it (its votes stop counting), Delete erases it.</p>
      )}
      {msg && <p className="ttOk ttSmall">{msg}</p>}
      <div className="ttRow" role="group" aria-label="Zoom">
        <button className="ttBtn small ghost" onClick={() => setZoom((z) => Math.max(1, z - 1))} disabled={zoom === 1} aria-label="Zoom out">
          −
        </button>
        <button className="ttBtn small ghost" onClick={() => setZoom((z) => Math.min(4, z + 1))} disabled={zoom === 4} aria-label="Zoom in">
          +
        </button>
      </div>
      <TreatMap
        src="/holiday-map.jpg"
        alt="Liberty community map with the homes in the holiday decor contest"
        renderMarker={holidayMarker}
        houses={visible.map((r) => ({ id: r.id, x: r.x, y: r.y, kind: r.marker, label: addr(r), dim: moving !== null && r.id !== moving }))}
        zoom={zoom}
        placing={moving !== null}
        pending={null}
        you={null}
        selectedId={moving}
        onTap={place}
        onCandy={(id) => setMoving(id)}
      />

      <section className="ttCard">
        <h2>Standings (Residents&rsquo; Choice)</h2>
        {ranked.length === 0 && <p className="ttMuted">No homes yet.</p>}
        <ol className="hdStand">
          {ranked.map((r) => (
            <li key={r.id}>
              <b>{addr(r)}</b> <span className="ttMuted">· {r.votes} {r.votes === 1 ? 'vote' : 'votes'}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="ttCard">
        <h2>Homes ({rows.length})</h2>
        <p className="ttSmall ttMuted">Award: type a committee award such as &ldquo;Board&rsquo;s Choice&rdquo; and save. It shows on the public page from {labels.results}.</p>
        {rows.length === 0 && <p className="ttMuted">No entries yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className={`ttAdminRow${r.hidden ? ' hidden' : ''}${moving === r.id ? ' sel' : ''}`}>
            <div className="ttSpread">
              <b>
                {addr(r)} · {r.marker === 'lights' ? 'lights' : 'tree'}
              </b>
              <span className="ttSmall ttMuted">{when(r.created_at)}</span>
            </div>
            <span className="ttSmall ttMuted">
              {r.contact_name || 'No name given'}
              {r.note ? ` · ${r.note}` : ''} · {r.votes} {r.votes === 1 ? 'vote' : 'votes'}
              {r.hidden ? ' · removed' : ''}
            </span>
            <div className="ttRow">
              <input
                aria-label={`Award for ${addr(r)}`}
                maxLength={40}
                placeholder="Award, e.g. Board’s Choice"
                value={awardDraft[r.id] ?? ''}
                onChange={(e) => setAwardDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                style={{ flex: '1 1 180px', width: 'auto' }}
              />
              <button className="ttBtn small ghost" disabled={pending || (awardDraft[r.id] ?? '') === (r.award || '')} onClick={() => saveAward(r)}>
                Save award
              </button>
            </div>
            <div className="ttRow">
              {!r.hidden && (
                <button className="ttBtn small ghost" disabled={pending} onClick={() => setMoving(r.id)}>
                  Move
                </button>
              )}
              <button className="ttBtn small ghost" disabled={pending} onClick={() => toggle(r)}>
                {r.hidden ? 'Restore' : 'Remove'}
              </button>
              <button className="ttBtn small ghost danger" disabled={pending} onClick={() => setConfirm(r)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="ttCard">
        <h2>Votes ({voteRows.length})</h2>
        <p className="ttSmall ttMuted">
          One vote per address; a phone can vote for one address. &ldquo;Same network&rdquo; means other votes came from the same internet
          connection, which is normal for neighbors on the same phone carrier but worth a look if one address keeps showing up with many.
        </p>
        {voteRows.length === 0 && <p className="ttMuted">No votes yet.</p>}
        {voteRows.map((v) => (
          <div key={v.id} className="ttAdminRow">
            <div className="ttSpread">
              <span>
                <b>{v.voter_address}</b> → {v.entry_address}
              </span>
              <span className="ttSmall ttMuted">{when(v.updated_at)}</span>
            </div>
            <div className="ttSpread">
              <span className="ttSmall ttMuted">{v.same_network ? `Same network as ${v.same_network} other ${v.same_network === 1 ? 'vote' : 'votes'}` : ' '}</span>
              <button className="ttBtn small ghost danger" disabled={pending} onClick={() => setConfirmVote(v)}>
                Remove vote
              </button>
            </div>
          </div>
        ))}
      </section>

      {confirm && (
        <div className="ttModalBack" onClick={() => !pending && setConfirm(null)}>
          <div className="ttModal" role="alertdialog" aria-modal="true" aria-labelledby="hd-adel" onClick={(e) => e.stopPropagation()}>
            <h2 id="hd-adel">Delete this entry for good?</h2>
            <p>
              <b>{addr(confirm)}</b> and its {confirm.votes} {confirm.votes === 1 ? 'vote' : 'votes'} will be erased and can&rsquo;t be restored. To just take it
              off the map, use Remove instead.
            </p>
            <div className="ttRow">
              <button className="ttBtn danger" autoFocus disabled={pending} onClick={() => remove(confirm)}>
                {pending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button className="ttBtn ghost" disabled={pending} onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmClear && (
        <div className="ttModalBack" onClick={() => !pending && setConfirmClear(false)}>
          <div className="ttModal" role="alertdialog" aria-modal="true" aria-labelledby="hd-tclr" onClick={(e) => e.stopPropagation()}>
            <h2 id="hd-tclr">Clear the practice round?</h2>
            <p>All practice homes and votes will be erased. The real contest isn&rsquo;t affected.</p>
            <div className="ttRow">
              <button className="ttBtn danger" autoFocus disabled={pending} onClick={clearTest}>
                {pending ? 'Clearing…' : 'Yes, clear it'}
              </button>
              <button className="ttBtn ghost" disabled={pending} onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmVote && (
        <div className="ttModalBack" onClick={() => !pending && setConfirmVote(null)}>
          <div className="ttModal" role="alertdialog" aria-modal="true" aria-labelledby="hd-vdel" onClick={(e) => e.stopPropagation()}>
            <h2 id="hd-vdel">Remove this vote?</h2>
            <p>
              The vote from <b>{confirmVote.voter_address}</b> for {confirmVote.entry_address} will be erased, and that address can vote again.
            </p>
            <div className="ttRow">
              <button className="ttBtn danger" autoFocus disabled={pending} onClick={() => dropVote(confirmVote)}>
                {pending ? 'Removing…' : 'Yes, remove it'}
              </button>
              <button className="ttBtn ghost" disabled={pending} onClick={() => setConfirmVote(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
