'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import TreatMap, { type MapHouse } from '../treats/TreatMap';
import { holidayMarkerFor, Lights, Tree } from './HolidayMarkers';
import { communityOrDefault } from '@/lib/communities';
import type { Box } from '@/lib/treatsLots';

// Same flow as the trick-or-treat page (tap your home, use your location, address lookup),
// plus a choice of decoration and resident voting.

type Marker = 'tree' | 'lights';
type Phase = 'entry' | 'between' | 'voting' | 'counting' | 'results';
export type PublicEntry = { id: number; x: number; y: number; house_number: string; street: string; marker: Marker; note: string | null; award: string | null };
export type PublicWinner = PublicEntry & { votes: number; rank: number };
type Labels = { entryCloses: string; voteOpens: string; voteCloses: string; results: string };

// Phones with Precise Location off report a circle a mile or more wide; that's useless for picking a house.
const APPROX_M = 150;

function preciseHelp(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  if (iOS && /CriOS/.test(ua)) return 'On iPhone: Settings → Privacy & Security → Location Services → Chrome → turn on Precise Location.';
  if (iOS) return 'On iPhone: Settings → Privacy & Security → Location Services → Safari Websites → turn on Precise Location.';
  if (/Macintosh/.test(ua)) return 'On a Mac: System Settings → Privacy & Security → Location Services → turn it on for your browser. Macs find location by Wi-Fi, so it can still be a few houses off.';
  if (/Android/.test(ua)) return 'On Android: Settings → Apps → your browser → Permissions → Location → turn on Use precise location.';
  return 'Turn on precise location for this browser in your device settings.';
}

// Browser-only memory (best effort; private mode may forget it).
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}
/** A random id for this phone, so a household's vote can be changed from the phone that cast it. */
function deviceId(): string {
  let d = load<string>('hd-device', '');
  if (!d) {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    d = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
    save('hd-device', d);
  }
  return d;
}

const addr = (h: { house_number: string; street: string }) => `${h.house_number} ${h.street}`;
const PLACE = ['', '1st place', '2nd place', '3rd place'];
const SHORT = ['', '1st', '2nd', '3rd'];

function MarkerIcon({ kind }: { kind: Marker }) {
  return <span className={`hdIcon ${kind}`}>{kind === 'lights' ? <Lights /> : <Tree />}</span>;
}

export default function HolidayApp({
  community,
  initial,
  phase,
  labels,
  season,
  winners,
  test = false,
  addressLookup = false,
}: {
  /** Which community's contest (see lib/communities). */
  community: string;
  initial: PublicEntry[];
  phase: Phase;
  labels: Labels;
  season: number;
  winners: PublicWinner[];
  /** Practice round switched on by the organizer. */
  test?: boolean;
  addressLookup?: boolean;
}) {
  const cm = communityOrDefault(community);
  const { streets: STREETS, lotAt, lotBoxes, streetAt, geoToMap } = cm.map;
  const holidayMarker = useMemo(() => holidayMarkerFor(cm.map), [cm]);
  const knownStreet = (v: string) => STREETS.find((st) => st.toLowerCase() === v.trim().toLowerCase()) || null;
  const snap = (x: number, y: number) => {
    const l = lotAt(x, y);
    return { x: Math.round(l.x * 100) / 100, y: Math.round(l.y * 100) / 100 };
  };
  const C = `c=${cm.slug}`; // tells the address lookups which community's area to search
  const [entries, setEntries] = useState(initial);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [you, setYou] = useState<{ x: number; y: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const watchId = useRef<number | null>(null);
  const lastFix = useRef<{ lat: number; lng: number; acc: number } | null>(null);
  const approxOnly = useRef(false);

  // Entering a home
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [marker, setMarker] = useState<Marker>('tree');
  const [num, setNum] = useState('');
  const [street, setStreet] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<PublicEntry | null>(null);
  const [mine, setMine] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<PublicEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  // Voting
  const VOTE_KEY = cm.slug === 'liberty' ? `hd-vote-${season}` : `hd-vote-${cm.slug}-${season}`;
  const VOTER_KEY = cm.slug === 'liberty' ? 'hd-voter' : `hd-voter-${cm.slug}`;
  const [myVote, setMyVote] = useState<{ entryId: number; address: string } | null>(null);
  const [voteFor, setVoteFor] = useState<PublicEntry | null>(null);
  const [vNum, setVNum] = useState('');
  const [vStreet, setVStreet] = useState('');
  const [voting, setVoting] = useState(false);
  const [voteErr, setVoteErr] = useState('');
  const [voteOk, setVoteOk] = useState('');

  useEffect(() => {
    setMine(load<Record<string, string>>('hd-mine', {}));
    setMyVote(load<{ entryId: number; address: string } | null>(VOTE_KEY, null));
    const me = load<{ num: string; street: string } | null>(VOTER_KEY, null);
    if (me) {
      setVNum(me.num);
      setVStreet(me.street);
    }
  }, [VOTE_KEY, VOTER_KEY]);

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
        const r = await fetch(`/api/geo/suggest?q=${encodeURIComponent(query)}&s=${session.current}&${C}`, { signal: ctl.signal });
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

  function fillAddress(a: { number?: string; street?: string } | null) {
    if (!a) return false;
    if (a.number) setNum(a.number);
    if (a.street) setStreet(knownStreet(a.street) || a.street);
    return !!(a.number || a.street);
  }

  // Street the page filled in itself; replaced on the next placement unless the entrant typed their own.
  const autoStreet = useRef('');
  const autoNum = useRef('');

  function placeAt(xPct: number, yPct: number, fix?: { lat: number; lng: number } | null) {
    const pt = snap(xPct, yPct);
    setPending(pt);
    setZoom((z) => Math.max(z, 2));
    setErr('');
    // Maps that know each lot's address fill the house number too; otherwise only the street is suggested.
    const known = cm.map.addressAt?.(pt.x, pt.y) ?? null;
    setStreet((cur) => {
      if (cur && cur !== autoStreet.current) return cur;
      const st = known?.street ?? streetAt(pt.x, pt.y);
      autoStreet.current = st;
      setLookupMsg(known ? 'Address filled from the map. Check it is yours.' : 'Street filled from the map. Change it if it is wrong.');
      return st;
    });
    if (known) setNum((cur) => (cur && cur !== autoNum.current ? cur : (autoNum.current = known.number)));
    if (fix && addressLookup) {
      fetch(`/api/geo/reverse?lat=${fix.lat}&lng=${fix.lng}&${C}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.address?.street) autoStreet.current = knownStreet(d.address.street) || d.address.street;
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
      session.current = '';
      fillAddress(d);
      if (typeof d.lat === 'number' && typeof d.lng === 'number') {
        const m = geoToMap(d.lat, d.lng);
        if (m) {
          if (d.street) autoStreet.current = knownStreet(d.street) || d.street;
          setPending(snap(m.x, m.y));
          setZoom((z) => Math.max(z, 2));
          setLookupMsg('Placed at that address. Check it is on your home, or tap the right lot.');
        }
      }
    } catch {
      setLookupMsg('Could not look up that address. Type it below and tap your home on the map.');
    }
  }
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
  }, []);

  const rankOf = useMemo(() => new Map(winners.map((w) => [w.id, w.rank])), [winners]);
  const markers: MapHouse[] = useMemo(
    () =>
      entries.map((h) => {
        const rank = phase === 'results' ? rankOf.get(h.id) : undefined;
        const badge = rank ? SHORT[rank] : phase === 'results' && h.award ? '★' : undefined;
        return { id: h.id, x: h.x, y: h.y, kind: h.marker, badge, label: `${addr(h)}${h.note ? `. ${h.note}` : ''}` };
      }),
    [entries, phase, rankOf],
  );
  const byStreet = useMemo(() => {
    const m = new Map<string, PublicEntry[]>();
    [...entries]
      .sort((a, b) => a.street.localeCompare(b.street) || (Number.parseInt(a.house_number) || 0) - (Number.parseInt(b.house_number) || 0))
      .forEach((h) => m.set(h.street, [...(m.get(h.street) || []), h]));
    return [...m.entries()];
  }, [entries]);
  const sel = entries.find((h) => h.id === selected) || null;
  const awards = phase === 'results' ? entries.filter((e) => e.award) : [];
  const votedFor = myVote ? entries.find((e) => e.id === myVote.entryId) : null;

  function gpsError(e: GeolocationPositionError) {
    setGpsMsg(
      e.code === e.PERMISSION_DENIED
        ? 'Location is blocked for this site. Allow it in your browser settings, or find homes on the map.'
        : 'Could not get your location. Step outside or find homes on the map.',
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
    if (you && lastFix.current) placeAt(you.x, you.y, lastFix.current);
    setTimeout(() => mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setErr('This browser cannot share location. Tap your home on the map instead.');
    if (tracking && you && lastFix.current) return placeAt(you.x, you.y, lastFix.current);
    if (tracking && approxOnly.current) return setErr(`This device is only sharing an approximate location. ${preciseHelp()} Or tap your home on the map.`);
    setErr('Finding your home…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const m = geoToMap(p.coords.latitude, p.coords.longitude);
        if (!m) return setErr('Your location is outside the community. Tap your home on the map instead.');
        if (p.coords.accuracy > APPROX_M) return setErr(`This device is only sharing an approximate location. ${preciseHelp()} Or tap your home on the map.`);
        placeAt(m.x, m.y, { lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => setErr(e.code === e.PERMISSION_DENIED ? 'Location is blocked. Tap your home on the map instead.' : 'Could not get your location. Tap your home on the map instead.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  async function submit() {
    if (!pending) return setErr('Tap your home on the map first.');
    if (!/^\d{3,6}$/.test(num.trim())) return setErr('Enter your house number so neighbors can find your home.');
    if (!knownStreet(street)) return setErr('Pick your street from the list.');
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community: cm.slug, ...pending, house_number: num.trim(), street: knownStreet(street), marker, note, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      const h: PublicEntry = data.entry;
      if (data.token) {
        const m = { ...load<Record<string, string>>('hd-mine', {}), [String(h.id)]: data.token };
        save('hd-mine', m);
        setMine(m);
      }
      setEntries((list) => [...list.filter((x) => x.id !== h.id), h]);
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

  async function deleteMine(h: PublicEntry) {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch('/api/holiday', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: h.id, token: mine[String(h.id)] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove it. Try again.');
      const m = { ...mine };
      delete m[String(h.id)];
      save('hd-mine', m);
      setMine(m);
      setEntries((list) => list.filter((x) => x.id !== h.id));
      setSelected(null);
      if (done?.id === h.id) setDone(null);
      setConfirmDelete(null);
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : 'No connection. Try again.');
    } finally {
      setDeleting(false);
    }
  }

  function openVote(h: PublicEntry) {
    setVoteErr('');
    setVoteOk('');
    setVoteFor(h);
  }

  async function castVote() {
    if (!voteFor) return;
    if (!/^\d{3,6}$/.test(vNum.trim())) return setVoteErr('Enter your house number.');
    if (!knownStreet(vStreet)) return setVoteErr('Pick your street.');
    setVoting(true);
    setVoteErr('');
    try {
      const res = await fetch('/api/holiday/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ community: cm.slug, entryId: voteFor.id, house_number: vNum.trim(), street: vStreet, device: deviceId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your vote. Try again.');
      const v = { entryId: voteFor.id, address: data.address as string };
      save(VOTE_KEY, v);
      save(VOTER_KEY, { num: vNum.trim(), street: vStreet });
      setMyVote(v);
      setVoteOk(myVote && myVote.entryId !== voteFor.id ? `Vote changed to ${addr(voteFor)}.` : `Thanks! Your vote for ${addr(voteFor)} is in.`);
      setVoteFor(null);
    } catch (e) {
      setVoteErr(e instanceof Error ? e.message : 'No connection. Try again.');
    } finally {
      setVoting(false);
    }
  }

  // Typing a known street (no marker yet): highlight that street's lots so the home is easy to find.
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

  // With Google: a typed number + street is looked up and the marker placed.
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
        const r = await fetch(`/api/geo/suggest?q=${encodeURIComponent(`${n} ${st}`)}&${C}`);
        const d = await r.json();
        const hit = (d.suggestions || []).find((x: { main: string }) => x.main.startsWith(`${n} `));
        if (!hit) return setLookupMsg('Could not find that address on the map. Tap your home instead.');
        const pr = await fetch(`/api/geo/place?id=${encodeURIComponent(hit.id)}`);
        const pd = await pr.json();
        const m = typeof pd.lat === 'number' ? geoToMap(pd.lat, pd.lng) : null;
        if (!m) return setLookupMsg('Could not find that address on the map. Tap your home instead.');
        setPending(snap(m.x, m.y));
        setZoom((z) => Math.max(z, 2));
        setLookupMsg(`Found ${hit.main} on the map. Check it is on your home, or tap the right lot.`);
      } catch {
        /* offline: they can still tap */
      }
    }, 900);
    return () => clearTimeout(t);
  }, [num, street, adding, pending, addressLookup]);

  const decoName = marker === 'lights' ? 'lights' : 'tree';

  return (
    <div className="ttWrap">
      <header className="ttSpread">
        <h1>
          <small>
            {cm.name} · Holidays {Math.abs(season)}
          </small>
          Holiday Decor Contest
        </h1>
        <p className="ttCount ttMuted">
          <b>{entries.length}</b> {entries.length === 1 ? 'home' : 'homes'} in the contest
        </p>
      </header>

      {test && (
        <p className="hdTest" role="status">
          <b>Test mode.</b> This is a practice round for the social committee. Homes and votes entered now are not part of the real contest
          and will be cleared.
        </p>
      )}

      <ol className="hdSteps" aria-label="Contest dates">
        <li className={phase === 'entry' ? 'now' : ''}>
          <b>Enter</b> until {labels.entryCloses}
        </li>
        <li className={phase === 'voting' ? 'now' : ''}>
          <b>Vote</b> {labels.voteOpens}–{labels.voteCloses}
        </li>
        <li className={phase === 'results' ? 'now' : ''}>
          <b>Winners</b> {labels.results}
        </li>
      </ol>

      {phase === 'entry' && !adding && (
        <div className="ttCard">
          {done ? (
            <p className="ttOk">🎄 Your home is in the contest at {addr(done)}. Voting opens {labels.voteOpens}. Good luck!</p>
          ) : (
            <p>
              <b>Decorating this year?</b> Enter your home and a tree or lights goes over it on the map. Neighbors drive by, then vote{' '}
              {labels.voteOpens}–{labels.voteCloses}. <span className="ttMuted">Entries close at the end of {labels.entryCloses}.</span>
            </p>
          )}
          <button className="ttBtn full" onClick={startAdding}>
            {done ? 'Enter another home' : 'Enter my home'}
          </button>
        </div>
      )}
      {phase === 'between' && <p className="ttHint">Entries are closed. Voting opens {labels.voteOpens}. Take a drive and see the homes!</p>}
      {phase === 'voting' && (
        <div className="ttCard">
          <p>
            <b>Voting is open until the end of {labels.voteCloses}.</b> Go see the homes in person, then tap your favorite on the map or in
            the list below. One vote per address.
          </p>
          {myVote && (
            <p className="ttOk">
              ✓ {myVote.address} voted for {votedFor ? addr(votedFor) : 'a home'}.{' '}
              <span className="ttMuted">Changed your mind? Pick another home and vote again before {labels.voteCloses}.</span>
            </p>
          )}
          {voteOk && !myVote && <p className="ttOk">{voteOk}</p>}
        </div>
      )}
      {phase === 'counting' && <p className="ttHint">Voting is closed. Winners will be announced {labels.results}!</p>}
      {phase === 'results' && (
        <section className="ttCard hdWinners" aria-labelledby="hd-win">
          <h2 id="hd-win">🏆 Residents&rsquo; Choice</h2>
          {winners.length === 0 ? (
            <p className="ttMuted">No votes were cast this year.</p>
          ) : (
            <ol>
              {winners.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => {
                      setSelected(w.id);
                      setZoom((z) => Math.max(z, 2));
                      mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <span className={`hdPlace p${w.rank}`}>{PLACE[w.rank]}</span>
                    <MarkerIcon kind={w.marker} />
                    <span>
                      <b>{addr(w)}</b>
                      <span className="ttMuted">
                        {' '}
                        · {w.votes} {w.votes === 1 ? 'vote' : 'votes'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {awards.length > 0 && (
            <>
              <h3>Committee awards</h3>
              <ul>
                {awards.map((w) => (
                  <li key={w.id}>
                    <button
                      onClick={() => {
                        setSelected(w.id);
                        setZoom((z) => Math.max(z, 2));
                        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <span className="hdPlace award">★ {w.award}</span>
                      <MarkerIcon kind={w.marker} />
                      <b>{addr(w)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="ttSmall ttMuted">Thank you to all {entries.length} homes for lighting up {cm.short}. Happy holidays!</p>
        </section>
      )}

      <div ref={mapRef} style={{ scrollMarginTop: 12, display: 'grid', gap: 10 }}>
        {adding && (
          <p className="ttHint">
            {pending
              ? `Is the ${decoName} on your home? If not, tap your home again to move it.`
              : typedStreet
                ? `The lots on ${typedStreet} are outlined. Tap your home.`
                : 'Tap your home on the map, or use your location if you are at home.'}
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
          src={cm.map.src}
          alt={`${cm.short} community map with the homes in the holiday decor contest`}
          geometry={cm.map}
          renderMarker={holidayMarker}
          pendingKind={marker}
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
          onCandy={(id) => {
            setVoteOk('');
            setSelected(id === selected ? null : id);
          }}
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
            <h2>
              <MarkerIcon kind={sel.marker} /> {addr(sel)}
            </h2>
            <button className="ttBtn small ghost" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {phase === 'results' && (rankOf.get(sel.id) || sel.award) && (
            <p className="hdPrize">
              {rankOf.get(sel.id) ? `🏆 Residents’ Choice, ${PLACE[rankOf.get(sel.id)!]}` : ''}
              {rankOf.get(sel.id) && sel.award ? ' · ' : ''}
              {sel.award ? `★ ${sel.award}` : ''}
            </p>
          )}
          {sel.note ? <p>{sel.note}</p> : <p className="ttMuted">Decorated for the holidays.</p>}
          {phase === 'voting' &&
            (myVote?.entryId === sel.id ? (
              <p className="ttOk">✓ This is your household&rsquo;s vote.</p>
            ) : (
              <button className="ttBtn full" onClick={() => openVote(sel)}>
                {myVote ? 'Change my vote to this home' : 'Vote for this home'}
              </button>
            ))}
          {voteOk && <p className="ttOk">{voteOk}</p>}
          {phase === 'entry' && mine[String(sel.id)] && (
            <button
              className="ttBtn small ghost danger"
              onClick={() => {
                setDeleteErr('');
                setConfirmDelete(sel);
              }}
            >
              Remove my home from the contest
            </button>
          )}
        </div>
      )}

      {voteFor && (
        <div className="ttModalBack" onClick={() => !voting && setVoteFor(null)}>
          <div className="ttModal" role="dialog" aria-modal="true" aria-labelledby="hd-vote-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="hd-vote-title">Vote for {addr(voteFor)}?</h2>
            {myVote && myVote.entryId !== voteFor.id && (
              <p className="ttSmall">This changes your household&rsquo;s vote from {votedFor ? addr(votedFor) : 'your earlier pick'}.</p>
            )}
            <p className="ttSmall ttMuted">Enter your own address. Each address gets one vote, and you can&rsquo;t vote for your own home.</p>
            <div className="ttGrid2">
              <label className="ttField" htmlFor="hd-vnum">
                Your house no.
                <input id="hd-vnum" inputMode="numeric" maxLength={6} value={vNum} onChange={(e) => setVNum(e.target.value)} placeholder="5838" autoComplete="off" />
              </label>
              <label className="ttField" htmlFor="hd-vstreet">
                Your street
                <select id="hd-vstreet" value={vStreet} onChange={(e) => setVStreet(e.target.value)}>
                  <option value="">Pick your street</option>
                  {STREETS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="ttSmall ttMuted">Only the social committee sees which address voted, to keep it to one vote per home.</p>
            {voteErr && <p className="ttErr">{voteErr}</p>}
            <div className="ttRow">
              <button className="ttBtn" autoFocus disabled={voting} onClick={castVote}>
                {voting ? 'Voting…' : 'Cast my vote'}
              </button>
              <button className="ttBtn ghost" disabled={voting} onClick={() => setVoteFor(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="ttModalBack" onClick={() => !deleting && setConfirmDelete(null)}>
          <div
            className="ttModal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hd-del-title"
            aria-describedby="hd-del-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="hd-del-title">Remove your home?</h2>
            <p id="hd-del-desc">
              <b>{addr(confirmDelete)}</b> will leave the holiday contest and disappear from the map. You can enter again before{' '}
              {labels.entryCloses} ends.
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
        <div className="ttCard">
          <h2>Your home</h2>
          <fieldset className="hdPick">
            <legend>Your decoration on the map</legend>
            {(['tree', 'lights'] as Marker[]).map((k) => (
              <label key={k} className={marker === k ? 'on' : ''}>
                <input type="radio" name="hd-marker" value={k} checked={marker === k} onChange={() => setMarker(k)} />
                <MarkerIcon kind={k} />
                {k === 'tree' ? 'Christmas tree' : 'Holiday lights'}
              </label>
            ))}
          </fieldset>
          {addressLookup && (
            <div className="ttSearch">
              <label className="ttField" htmlFor="hd-find">
                Find your address
                <input
                  id="hd-find"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start typing your house number and street"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={suggestions.length > 0}
                  aria-controls="hd-sugs"
                />
              </label>
              {suggestions.length > 0 && (
                <ul id="hd-sugs" className="ttSugs" role="listbox">
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
            <label className="ttField" htmlFor="hd-num">
              House no.
              <input id="hd-num" inputMode="numeric" maxLength={6} value={num} onChange={(e) => setNum(e.target.value)} placeholder="5838" />
            </label>
            <label className="ttField" htmlFor="hd-street">
              Street
              <input
                id="hd-street"
                list="hd-streets"
                maxLength={40}
                value={street}
                onChange={(e) => {
                  autoStreet.current = '';
                  setStreet(e.target.value);
                }}
                placeholder={STREETS[0]}
              />
              <datalist id="hd-streets">
                {STREETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </div>
          {lookupMsg && <p className="ttSmall ttMuted">{lookupMsg}</p>}
          <label className="ttField" htmlFor="hd-note">
            Note for visitors (optional)
            <input id="hd-note" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lights on 5–10 pm, music on 88.1 FM" />
          </label>
          <label className="ttField" htmlFor="hd-name">
            Your name (optional, only the committee sees it)
            <input id="hd-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          {err && <p className={err.startsWith('Finding') ? 'ttSmall ttMuted' : 'ttErr'}>{err}</p>}
          <div className="ttRow">
            <button className="ttBtn" onClick={submit} disabled={sending || !pending}>
              {sending ? 'Entering…' : pending ? 'Enter my home in the contest' : 'Tap your home on the map first'}
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
        <h2>Homes by street</h2>
        {byStreet.length === 0 && (
          <p className="ttMuted">{phase === 'entry' ? 'No homes yet. Be the first to enter yours!' : 'No homes entered this year.'}</p>
        )}
        <div className="ttList">
          {byStreet.map(([st, list]) => (
            <div className="ttStreet" key={st}>
              <h3>{st}</h3>
              <ul>
                {list.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => {
                        setVoteOk('');
                        setSelected(h.id);
                        setZoom((z) => Math.max(z, 2));
                        mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                    >
                      <MarkerIcon kind={h.marker} />
                      <span>
                        <b>{h.house_number}</b>
                        {myVote?.entryId === h.id && <span className="hdMine"> ✓ your vote</span>}
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
        Your location is used only to show where you are, place your decoration and look up your address. It is never saved. Your
        address is saved with your vote so each home votes once; only the social committee sees it. Map is a drawing, not to scale.
      </p>
    </div>
  );
}
