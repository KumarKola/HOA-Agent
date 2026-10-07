'use client';

import { useEffect, useRef } from 'react';
import { MAP_IMAGE } from '@/lib/treatsGeo';

export type MapHouse = { id: number; x: number; y: number; label: string; dim?: boolean };

export function Candy({ color = '#b77ad6' }: { color?: string }) {
  // A wrapped candy, like the flyer's markers.
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 20 L1 12 L3 20 L1 28 Z M32 20 L39 12 L37 20 L39 28 Z" fill={color} stroke="#2a1d33" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="20" cy="20" rx="13" ry="10" fill={color} stroke="#2a1d33" strokeWidth="1.5" />
      <path d="M12 14 L18 27 M18 12 L25 28 M24 12 L29 22" stroke="#fff" strokeOpacity=".6" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function TreatMap({
  houses,
  zoom,
  placing,
  pending,
  you,
  selectedId,
  onTap,
  onCandy,
  focus,
}: {
  houses: MapHouse[];
  zoom: number;
  placing: boolean;
  pending: { x: number; y: number } | null;
  you: { x: number; y: number } | null;
  selectedId: number | null;
  onTap?: (x: number, y: number) => void;
  onCandy?: (id: number) => void;
  /** A point (in %) to scroll into the middle of the view, e.g. a new candy or a picked house. */
  focus?: { x: number; y: number; key: string | number } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !focus) return;
    // wait a frame so a zoom change has laid out
    const id = requestAnimationFrame(() => {
      const w = el.scrollWidth, h = el.scrollHeight;
      el.scrollTo({ left: (focus.x / 100) * w - el.clientWidth / 2, top: (focus.y / 100) * h - el.clientHeight / 2, behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [focus?.key, focus?.x, focus?.y, zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  function handle(e: React.MouseEvent<HTMLDivElement>) {
    if (!placing || !onTap) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100) onTap(Math.round(x * 100) / 100, Math.round(y * 100) / 100);
  }
  return (
    <div className="ttMapScroll" ref={scrollRef}>
      <div className={`ttMapInner${placing ? ' placing' : ''}`} style={{ width: `${zoom * 100}%` }} onClick={handle}>
        <img
          src={MAP_IMAGE.src}
          width={MAP_IMAGE.width}
          height={MAP_IMAGE.height}
          alt="Liberty community map with streets and lots"
          draggable={false}
        />
        {houses.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`ttMarker${selectedId === h.id ? ' sel' : ''}${h.dim ? ' dim' : ''}`}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            aria-label={h.label}
            onClick={(e) => {
              if (placing) return; // let the tap fall through to placement
              e.stopPropagation();
              onCandy?.(h.id);
            }}
          >
            <Candy />
          </button>
        ))}
        {pending && (
          <div className="ttPending" style={{ left: `${pending.x}%`, top: `${pending.y}%` }}>
            <Candy color="#f2923a" />
          </div>
        )}
        {you && <div className="ttYou" style={{ left: `${you.x}%`, top: `${you.y}%` }} aria-label="You are here" />}
      </div>
    </div>
  );
}
