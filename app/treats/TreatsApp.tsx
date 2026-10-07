'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import TreatMap, { type MapHouse } from './TreatMap';
import { geoToMap, STREETS } from '@/lib/treatsGeo';

export type PublicHouse = { id: number; x: number; y: number; house_number: string; street: string; note: string | null };

const addr = (h: PublicHouse) => `${h.house_number} ${h.street}`;

export default function TreatsApp({
  initial,
  signupOpen,
  closesLabel,
}: {
  initial: PublicHouse[];
  signupOpen: boolean;
  closesLabel: string | null;
}) {
  const [houses, setHouses] = useState(initial);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [you, setYou] = useState<{ x: number; y: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const watchId = useRef<number | null>(null);

  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [num, setNum] = useState('');
  const [street, setStreet] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<PublicHouse | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
  }, []);

  const markers: MapHouse[] = useMemo(
    () => houses.map((h) => ({ id: h.id, x: h.x, y: h.y, label: `${addr(h)}${h.note ? `. ${h.note}` : ''}` })),
    [houses],
  );
  const byStreet = useMemo(() => {
    const m = new Map<string, PublicHouse[]>();
    [...houses]
      .sort((a, b) => a.street.localeCompare(b.street) || Number.parseInt(a.house_number) - Number.parseInt(b.house_number))
      .forEach((h) => m.set(h.street, [...(m.get(h.street) || []), h]));
    return [...m.entries()];
  }, [houses]);
  const sel = houses.find((h) => h.id === selected) || null;

  function gpsError(e: GeolocationPositionError) {
    setGpsMsg(
      e.code === e.PERMISSION_DENIED
        ? 'Location is blocked for this site. Allow it in your browser settings, or tap your house on the map.'
        : 'Could not get your location. Step outside or tap your house on the map.',
    );
  }

  function toggleYou() {
    if (tracking) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setTracking(false);
      setYou(null);
      setGpsMsg('');
      return;
    }
    if (!navigator.geolocation) return setGpsMsg('This browser cannot share location.');
    setGpsMsg('Finding you…');
    setTracking(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const m = geoToMap(p.coords.latitude, p.coords.longitude);
        if (!m) {
          setYou(null);
          setGpsMsg('You are outside the community map.');
        } else {
          setYou(m);
          setGpsMsg(p.coords.accuracy > 40 ? 'Location is rough right now; it sharpens outdoors.' : '');
        }
      },
      (e) => {
        gpsError(e);
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  function startAdding() {
    setAdding(true);
    setDone(null);
    setErr('');
    setSelected(null);
    setTimeout(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setErr('This browser cannot share location. Tap your house on the map instead.');
    setErr('Finding your house…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const m = geoToMap(p.coords.latitude, p.coords.longitude);
        if (!m) return setErr('Your location is outside the community. Tap your house on the map instead.');
        setPending(m);
        setZoom((z) => Math.max(z, 2));
        setErr('');
      },
      (e) => setErr(e.code === e.PERMISSION_DENIED ? 'Location is blocked. Tap your house on the map instead.' : 'Could not get your location. Tap your house on the map instead.'),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  }

  async function submit() {
    if (!pending) return setErr('Place your candy on the map first.');
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/treats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, house_number: num.trim(), street: street.trim(), note, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      const h: PublicHouse = data.house;
      setHouses((list) => [...list.filter((x) => x.id !== h.id), h]);
      setDone(h);
      setSelected(h.id);
      setAdding(false);
      setPending(null);
      setNote('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No connection. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ttWrap">
      <header className="ttSpread">
        <h1>
          <small>Liberty community · Halloween, Oct 31</small>
          Trick-or-Treat Map
        </h1>
        <p className="ttCount ttMuted">
          <b>{houses.length}</b> {houses.length === 1 ? 'house is' : 'houses are'} handing out candy
        </p>
      </header>

      {signupOpen && !adding && (
        <div className="ttCard">
          {done ? (
            <p className="ttOk">🎃 You&rsquo;re on the map at {addr(done)}. Thank you!</p>
          ) : (
            <p>
              <b>Handing out candy?</b> Put your house on the map so families can find you.
              {closesLabel && <span className="ttMuted"> Sign-ups close {closesLabel}.</span>}
            </p>
          )}
          <button className="ttBtn full" onClick={startAdding}>
            {done ? 'Add another house' : 'Add my house'}
          </button>
        </div>
      )}
      {!signupOpen && (
        <p className="ttHint">Sign-ups are closed. Here are all the houses handing out candy. Happy Halloween!</p>
      )}

      <div ref={mapRef} style={{ scrollMarginTop: 12, display: 'grid', gap: 10 }}>
        {adding && (
          <p className="ttHint">
            {pending
              ? 'Is the orange candy on your house? If not, tap your house again to move it.'
              : 'Tap your house on the map, or use your location if you are at home.'}
          </p>
        )}
        <div className="ttSpread">
          <div className="ttRow">
            {adding ? (
              <button className="ttBtn small ghost" onClick={useMyLocation}>
                📍 Use my location
              </button>
            ) : (
              <button className={`ttBtn small ghost${tracking ? ' on' : ''}`} onClick={toggleYou} aria-pressed={tracking}>
                {tracking ? '● Showing where I am' : '📍 Show where I am'}
              </button>
            )}
          </div>
          <div className="ttRow" role="group" aria-label="Zoom">
            <button className="ttBtn small ghost" onClick={() => setZoom((z) => Math.max(1, z - 1))} disabled={zoom === 1} aria-label="Zoom out">
              −
            </button>
            <button className="ttBtn small ghost" onClick={() => setZoom((z) => Math.min(4, z + 1))} disabled={zoom === 4} aria-label="Zoom in">
              +
            </button>
          </div>
        </div>
        {gpsMsg && !adding && <p className="ttSmall ttMuted">{gpsMsg}</p>}
        <TreatMap
          houses={markers}
          zoom={zoom}
          placing={adding}
          pending={pending}
          you={you}
          selectedId={selected}
          onTap={(x, y) => {
            setPending({ x, y });
            setErr('');
            if (zoom === 1) setZoom(2);
          }}
          onCandy={(id) => setSelected(id === selected ? null : id)}
          focus={
            pending
              ? { ...pending, key: `p${pending.x},${pending.y}` }
              : sel
                ? { x: sel.x, y: sel.y, key: `h${sel.id}` }
                : you
                  ? { ...you, key: 'you' }
                  : null
          }
        />
      </div>

      {sel && !adding && (
        <div className="ttCard" aria-live="polite">
          <div className="ttSpread">
            <h2>{addr(sel)}</h2>
            <button className="ttBtn small ghost" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {sel.note ? <p>{sel.note}</p> : <p className="ttMuted">Handing out candy.</p>}
        </div>
      )}

      {adding && (
        <div className="ttCard" ref={formRef}>
          <h2>Your house</h2>
          <div className="ttGrid2">
            <label className="ttField" htmlFor="tt-num">
              House no.
              <input id="tt-num" inputMode="numeric" maxLength={10} value={num} onChange={(e) => setNum(e.target.value)} placeholder="5838" />
            </label>
            <label className="ttField" htmlFor="tt-street">
              Street
              <input id="tt-street" list="tt-streets" maxLength={40} value={street} onChange={(e) => setStreet(e.target.value)} placeholder="S 23rd Dr" />
              <datalist id="tt-streets">
                {STREETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </div>
          <label className="ttField" htmlFor="tt-note">
            Note for families (optional)
            <input id="tt-note" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nut-free treats, 5:30–8 pm" />
          </label>
          <label className="ttField" htmlFor="tt-name">
            Your name (optional, only organizers see it)
            <input id="tt-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          {err && <p className={err.startsWith('Finding') ? 'ttSmall ttMuted' : 'ttErr'}>{err}</p>}
          <div className="ttRow">
            <button className="ttBtn" onClick={submit} disabled={sending || !pending}>
              {sending ? 'Adding…' : pending ? 'Add my house to the map' : 'Place your candy first'}
            </button>
            <button
              className="ttBtn ghost"
              onClick={() => {
                setAdding(false);
                setPending(null);
                setErr('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <section className="ttCard">
        <h2>Houses by street</h2>
        {byStreet.length === 0 && <p className="ttMuted">No houses yet. Be the first to add yours!</p>}
        <div className="ttList">
          {byStreet.map(([st, list]) => (
            <div className="ttStreet" key={st}>
              <h3>{st}</h3>
              <ul>
                {list.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => {
                        setSelected(h.id);
                        setZoom((z) => Math.max(z, 2));
                        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <span className="dot" aria-hidden="true" />
                      <span>
                        <b>{h.house_number}</b>
                        {h.note ? <span className="ttMuted"> · {h.note}</span> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <p className="ttSmall ttMuted">
        Your location stays on your phone; only the candy spot you confirm is saved. Map is a drawing, not to scale.
      </p>
    </div>
  );
}
