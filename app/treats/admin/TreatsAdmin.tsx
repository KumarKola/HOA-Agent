'use client';

import { useState, useTransition } from 'react';
import TreatMap from '../TreatMap';
import { hideHouse, moveHouse } from './actions';

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
  const visible = rows.filter((r) => !r.hidden);

  function place(x: number, y: number) {
    if (moving === null) return;
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
          Tap the right house on the map for <b>{movingRow.house_number} {movingRow.street}</b>.{' '}
          <button className="ttBtn small ghost" onClick={() => setMoving(null)}>
            Cancel
          </button>
        </p>
      ) : (
        <p className="ttSmall ttMuted">Check each candy sits on the address typed. Use Move to fix one, or Remove for spam.</p>
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
        houses={visible.map((r) => ({ id: r.id, x: r.x, y: r.y, label: `${r.house_number} ${r.street}`, dim: moving !== null && r.id !== moving }))}
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
                {r.house_number} {r.street}
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
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
