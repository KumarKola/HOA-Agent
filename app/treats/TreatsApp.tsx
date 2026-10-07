'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import TreatMap, { type MapHouse } from './TreatMap';
import { geoToMap, STREETS } from '@/lib/treatsGeo';
import { lotAt, lotBoxes, type Box } from '@/lib/treatsLots';
import { streetAt } from '@/lib/treatsStreets';

const snap = (x: number, y: number) => {
  const l = lotAt(x, y);
  return { x: Math.round(l.x * 100) / 100, y: Math.round(l.y * 100) / 100 };
};

export type PublicHouse = { id: number; x: number; y: number; house_number: string; street: string; note: string | null };

// Phones with Precise Location off report a circle a mile or more wide; that's useless for picking a house.
const APPROX_M = 150;

/** How to turn on precise location on this device. */
function preciseHelp(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  if (iOS && /CriOS/.test(ua)) return 'On iPhone: Settings → Privacy & Security → Location Services → Chrome → turn on Precise Location.';
  if (iOS) return 'On iPhone: Settings → Privacy & Security → Location Services → Safari Websites → turn on Precise Location.';
  if (/Macintosh/.test(ua)) return 'On a Mac: System Settings → Privacy & Security → Location Services → turn it on for your browser. Macs find location by Wi-Fi, so it can still be a few houses off.';
  if (/Android/.test(ua)) return 'On Android: Settings → Apps → your browser → Permissions → Location → turn on Use precise location.';
  return 'Turn on precise location for this browser in your device settings.';
}

// Delete keys for houses added from this device. Kept in the browser only; best effort.
const MINE_KEY = 'tt-mine';
function loadMine(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MINE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveMine(m: Record<string, string>) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(m));
  } catch {
    /* private mode: delete from this device won't be remembered after reload */
  }
}

const knownStreet = (v: string) => STREETS.find((st) => st.toLowerCase() === v.trim().toLowerCase()) || null;

const addr = (h: PublicHouse) => (h.house_number ? `${h.house_number} ${h.street}` : h.street);

export default function TreatsApp({
  initial,
  signupOpen,
  closesLabel,
  addressLookup = false,
}: {
  initial: PublicHouse[];
  signupOpen: boolean;
  closesLabel: string | null;
  addressLookup?: boolean;
}) {
  const [houses, setHouses] = useState(initial);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [you, setYou] = useState<{ x: number; y: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const watchId = useRef<number | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; acc: number } | null>(null);
  const approxOnly = useRef(false); // last fix from "Show where I am" was approximate

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
  const [mine, setMine] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<PublicHouse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');
  useEffect(() => setMine(loadMine()), []);
  // Google address search (only when the site has a Google Maps key)
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; main: string; secondary: string }[]>([]);
  const [lookupMsg, setLookupMsg] = useState('');
  const session = useRef('');
  const picked = useRef('');
  const newSession = () => (session.current = Math.random().toString(36).slice(2) + Date.now().toString(36));

  useEffect(() => {
    if (!addressLookup || query.trim().length < 2 || query === picked.current) {
      setSuggestions([]);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        if (!session.current) newSession();
        const r = await fetch(`/api/geo/suggest?q=${encodeURIComponent(query)}&s=${session.current}`, { signal: ctl.signal });
        const d = await r.json();
        setSuggestions(d.suggestions || []);
      } catch {
        /* typing again or offline: keep the previous list */
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [query, addressLookup]);

  /** Fill the address fields from Google's street number + street name. */
  function fillAddress(a: { number?: string; street?: string } | null) {
    if (!a) return false;
    if (a.number) setNum(a.number);
    if (a.street) setStreet(a.street);
    return !!(a.number || a.street);
  }

  // Street the page filled in itself; replaced on the next placement unless the volunteer typed their own.
  const autoStreet = useRef('');

  /** Puts the candy on the lot at a point, suggests the street from the map, and (with Google) the full address. */
  function placeAt(xPct: number, yPct: number, fix?: { lat: number; lng: number } | null) {
    const pt = snap(xPct, yPct);
    setPending(pt);
    setZoom((z) => Math.max(z, 2));
    setErr('');
    setStreet((cur) => {
      if (cur && cur !== autoStreet.current) return cur; // keep what they typed
      const st = streetAt(pt.x, pt.y);
      autoStreet.current = st;
      setLookupMsg('Street filled from the map. Change it if it is wrong.');
      return st;
    });
    if (fix && addressLookup) {
      fetch(`/api/geo/reverse?lat=${fix.lat}&lng=${fix.lng}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.address?.street) autoStreet.current = d.address.street;
          if (fillAddress(d.address)) setLookupMsg('Address filled from your location. Fix it if it shows a neighbor’s number.');
        })
        .catch(() => {});
    }
  }

  async function pickSuggestion(sug: { id: string; main: string }) {
    setSuggestions([]);
    picked.current = sug.main;
    setQuery(sug.main);
    setLookupMsg('');
    try {
      const r = await fetch(`/api/geo/place?id=${encodeURIComponent(sug.id)}&s=${session.current}`);
      const d = await r.json();
      session.current = ''; // a pick ends the billing session
      fillAddress(d);
      if (typeof d.lat === 'number' && typeof d.lng === 'number') {
        const m = geoToMap(d.lat, d.lng);
        if (m) {
          if (d.street) autoStreet.current = d.street;
          setPending(snap(m.x, m.y));
          setZoom((z) => Math.max(z, 2));
          setLookupMsg('Candy placed at that address. Check it is on your house, or tap the right lot.');
        }
      }
    } catch {
      setLookupMsg('Could not look up that address. Type it below and tap your house on the map.');
    }
  }
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
      .sort((a, b) => a.street.localeCompare(b.street) || (Number.parseInt(a.house_number) || 0) - (Number.parseInt(b.house_number) || 0))
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
        } else if (p.coords.accuracy > APPROX_M) {
          lastFix.current = null;
          approxOnly.current = true;
          setYou(null);
          setGpsMsg(`This device is only sharing an approximate location. ${preciseHelp()}`);
        } else {
          lastFix.current = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
          approxOnly.current = false;
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
    // Location already showing from "Show where I am": put the candy there right away.
    if (you && lastFix.current) placeAt(you.x, you.y, lastFix.current);
    setTimeout(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setErr('This browser cannot share location. Tap your house on the map instead.');
    // "Show where I am" is already tracking: use that instead of asking the device again.
    if (tracking && you && lastFix.current) return placeAt(you.x, you.y, lastFix.current);
    if (tracking && approxOnly.current) return setErr(`This device is only sharing an approximate location. ${preciseHelp()} Or tap your house on the map.`);
    setErr('Finding your house…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const m = geoToMap(p.coords.latitude, p.coords.longitude);
        if (!m) return setErr('Your location is outside the community. Tap your house on the map instead.');
        if (p.coords.accuracy > APPROX_M) return setErr(`This device is only sharing an approximate location. ${preciseHelp()} Or tap your house on the map.`);
        placeAt(m.x, m.y, { lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => setErr(e.code === e.PERMISSION_DENIED ? 'Location is blocked. Tap your house on the map instead.' : 'Could not get your location. Tap your house on the map instead.'),
      // precise, and a fresh fix rather than a cached coarse one
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
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
      if (data.token) {
        const m = { ...loadMine(), [String(h.id)]: data.token };
        saveMine(m);
        setMine(m);
      }
      setHouses((list) => [...list.filter((x) => x.id !== h.id), h]);
      setDone(h);
      setSelected(h.id);
      setAdding(false);
      setPending(null);
      setNote('');
      setNum('');
      setStreet('');
      setQuery('');
      setLookupMsg('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No connection. Try again.');
    } finally {
      setSending(false);
    }
  }

  async function deleteMine(h: PublicHouse) {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch('/api/treats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, token: mine[String(h.id)] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove it. Try again.');
      const m = { ...mine };
      delete m[String(h.id)];
      saveMine(m);
      setMine(m);
      setHouses((list) => list.filter((x) => x.id !== h.id));
      setSelected(null);
      if (done?.id === h.id) setDone(null);
      setConfirmDelete(null);
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'No connection. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  // Typing a known street (no candy yet): highlight that street's lots so the house is easy to find.
  const typedStreet = adding && !pending ? knownStreet(street) : null;
  const highlight: Box[] = useMemo(
    () => (typedStreet ? lotBoxes().filter((b) => streetAt(b.x, b.y) === typedStreet) : []),
    [typedStreet],
  );
  const hlCenter = useMemo(() => {
    if (!highlight.length) return null;
    const xs = highlight.map((b) => b.x), ys = highlight.map((b) => b.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }, [highlight]);
  useEffect(() => {
    if (highlight.length) setZoom((z) => Math.max(z, 2));
  }, [highlight.length]);

  // With Google: a typed number + street is looked up and the candy placed, no need to pick from the list.
  const lastLookup = useRef('');
  useEffect(() => {
    if (!addressLookup || !adding || pending) return;
    const n = num.trim(), st = street.trim();
    if (!/^\d{3,6}$/.test(n) || st.length < 4) return;
    const key = `${n} ${st}`.toLowerCase();
    if (key === lastLookup.current) return;
    const t = setTimeout(async () => {
      lastLookup.current = key;
      try {
        const r = await fetch(`/api/geo/suggest?q=${encodeURIComponent(`${n} ${st}`)}`);
        const d = await r.json();
        const hit = (d.suggestions || []).find((x: { main: string }) => x.main.startsWith(`${n} `));
        if (!hit) return setLookupMsg('Could not find that address on the map. Tap your house instead.');
        const pr = await fetch(`/api/geo/place?id=${encodeURIComponent(hit.id)}`);
        const pd = await pr.json();
        const m = typeof pd.lat === 'number' ? geoToMap(pd.lat, pd.lng) : null;
        if (!m) return setLookupMsg('Could not find that address on the map. Tap your house instead.');
        setPending(snap(m.x, m.y));
        setZoom((z) => Math.max(z, 2));
        setLookupMsg(`Found ${hit.main} on the map. Check the candy is on your house, or tap the right lot.`);
      } catch {
        /* offline: they can still tap */
      }
    }, 900);
    return () => clearTimeout(t);
  }, [num, street, adding, pending, addressLookup]);

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
              : typedStreet
                ? `The lots on ${typedStreet} are outlined. Tap your house.`
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
          highlight={highlight}
          onTap={(x, y) => {
            placeAt(x, y);
            setErr('');
            if (zoom === 1) setZoom(2);
          }}
          onCandy={(id) => setSelected(id === selected ? null : id)}
          focus={
            pending
              ? { ...pending, key: `p${pending.x},${pending.y}` }
              : hlCenter
                ? { ...hlCenter, key: `st${typedStreet}` }
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
          {mine[String(sel.id)] && (
            <button
              className="ttBtn small ghost danger"
              onClick={() => {
                setDeleteErr('');
                setConfirmDelete(sel);
              }}
            >
              Remove my house from the map
            </button>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="ttModalBack" onClick={() => !deleting && setConfirmDelete(null)}>
          <div
            className="ttModal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tt-del-title"
            aria-describedby="tt-del-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="tt-del-title">Remove your house?</h2>
            <p id="tt-del-desc">
              <b>{addr(confirmDelete)}</b> will disappear from the trick-or-treat map. Families won&rsquo;t see it anymore. You can add it
              again later.
            </p>
            {deleteErr && <p className="ttErr">{deleteErr}</p>}
            <div className="ttRow">
              <button className="ttBtn danger" autoFocus disabled={deleting} onClick={() => deleteMine(confirmDelete)}>
                {deleting ? 'Removing…' : 'Yes, remove it'}
              </button>
              <button className="ttBtn ghost" disabled={deleting} onClick={() => setConfirmDelete(null)}>
                Keep it
              </button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="ttCard" ref={formRef}>
          <h2>Your house</h2>
          {addressLookup && (
            <div className="ttSearch">
              <label className="ttField" htmlFor="tt-find">
                Find your address
                <input
                  id="tt-find"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start typing, e.g. 5838 S 23rd"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-controls="tt-sugs"
                />
              </label>
              {suggestions.length > 0 && (
                <ul id="tt-sugs" className="ttSugs" role="listbox">
                  {suggestions.map((sg) => (
                    <li key={sg.id}>
                      <button type="button" role="option" aria-selected="false" onClick={() => pickSuggestion(sg)}>
                        <b>{sg.main}</b>
                        <span className="ttMuted"> {sg.secondary}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="ttGrid2">
            <label className="ttField" htmlFor="tt-num">
              House no. (optional)
              <input id="tt-num" inputMode="numeric" maxLength={10} value={num} onChange={(e) => setNum(e.target.value)} placeholder="5838" />
            </label>
            <label className="ttField" htmlFor="tt-street">
              Street
              <input id="tt-street" list="tt-streets" maxLength={40} value={street} onChange={(e) => { autoStreet.current = ''; setStreet(e.target.value); }} placeholder="S 23rd Dr" />
              <datalist id="tt-streets">
                {STREETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </div>
          {lookupMsg && <p className="ttSmall ttMuted">{lookupMsg}</p>}
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
                        <b>{h.house_number || 'House'}</b>
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
        Your location is used only to show where you are, place your candy and look up your address. It is never saved; only
        the candy spot you confirm is. Map is a drawing, not to scale.
      </p>
    </div>
  );
}
