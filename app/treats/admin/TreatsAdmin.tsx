'use client';

import { useState, useTransition } from 'react';
import TreatMap from '../TreatMap';
import { deleteHouse, hideHouse, moveHouse } from './actions';
import { lotAt } from '@/lib/treatsLots';

type Row = {
  id: number;
  x: number;
  y: number;
  house_number: string;
  street: string;
  note: string | null;
  contact_name: string | null;
  hidden: boolean;
  created_at: string;
};

const when = (d: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(d));

export default function TreatsAdmin({ houses }: { houses: Row[] }) {
  const [rows, setRows] = useState(houses);
  const [moving, setMoving] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Row | null>(null);
  const visible = rows.filter((r) => !r.hidden);

  function place(tx: number, ty: number) {
    if (moving === null) return;
    const l = lotAt(tx, ty);
    const x = Math.round(l.x * 100) / 100, y = Math.round(l.y * 100) / 100;
    const id = moving;
    start(async () => {
      const e = await moveHouse(id, x, y);
      if (e) return setMsg(e);
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, x, y } : r)));
      setMoving(null);
      setMsg('Moved.');
    });
  }

  function toggle(r: Row) {
    start(async () => {
      const e = await hideHouse(r.id, !r.hidden);
      if (e) return setMsg(e);
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, hidden: !r.hidden } : x)));
      setMsg(r.hidden ? 'Restored.' : 'Removed from the map.');
    });
  }

  function remove(r: Row) {
    start(async () => {
      const e = await deleteHouse(r.id);
      if (e) return setMsg(e);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      if (moving === r.id) setMoving(null);
      setConfirm(null);
      setMsg('Deleted for good.');
    });
  }

  const movingRow = rows.find((r) => r.id === moving);

  return (
    <div className="ttWrap">
      <header className="ttSpread">
        <h1>
          <small>Trick-or-treat · Organizer</small>
          {visible.length} houses on the map
        </h1>
        <a href="/treats">Open the public map</a>
      </header>
      {movingRow ? (
        <p className="ttHint">
          Tap the right house on the map for <b>{[movingRow.house_number, movingRow.street].filter(Boolean).join(' ')}</b>.{' '}
          <button className="ttBtn small ghost" onClick={() => setMoving(null)}>
            Cancel
          </button>
        </p>
      ) : (
        <p className="ttSmall ttMuted">Check each candy sits on the address typed. Use Move to fix one, Remove to hide it, or Delete to erase it.</p>
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
        houses={visible.map((r) => ({ id: r.id, x: r.x, y: r.y, label: [r.house_number, r.street].filter(Boolean).join(' '), dim: moving !== null && r.id !== moving }))}
        zoom={zoom}
        placing={moving !== null}
        pending={null}
        you={null}
        selectedId={moving}
        onTap={place}
        onCandy={(id) => setMoving(id)}
      />
      <section className="ttCard">
        <h2>Sign-ups ({rows.length})</h2>
        {rows.length === 0 && <p className="ttMuted">No sign-ups yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className={`ttAdminRow${r.hidden ? ' hidden' : ''}${moving === r.id ? ' sel' : ''}`}>
            <div className="ttSpread">
              <b>
                {[r.house_number, r.street].filter(Boolean).join(' ')}
              </b>
              <span className="ttSmall ttMuted">{when(r.created_at)}</span>
            </div>
            <span className="ttSmall ttMuted">
              {r.contact_name || 'No name given'}
              {r.note ? ` · ${r.note}` : ''}
              {r.hidden ? ' · removed' : ''}
            </span>
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
      {confirm && (
        <div className="ttModalBack" onClick={() => !pending && setConfirm(null)}>
          <div className="ttModal" role="alertdialog" aria-modal="true" aria-labelledby="tt-adel" onClick={(e) => e.stopPropagation()}>
            <h2 id="tt-adel">Delete this sign-up for good?</h2>
            <p>
              <b>{[confirm.house_number, confirm.street].filter(Boolean).join(' ')}</b> will be erased and can&rsquo;t be restored. To just take it off the
              map, use Remove instead.
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
    </div>
  );
}
