'use client';

import { useEffect, useRef } from 'react';
import { MAP_IMAGE } from '@/lib/treatsGeo';
import { lotAt, type Box } from '@/lib/treatsLots';

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
  highlight,
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
  /** Lots to outline, e.g. every lot on the street being typed. */
  highlight?: Box[];
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
        {highlight?.map((b, i) => <div key={`hl${i}`} className="ttHl" style={boxStyle(b)} />)}
        {houses.map((h) => {
          const lot = lotAt(h.x, h.y);
          return (
            <div key={h.id} className={`ttLot${selectedId === h.id ? ' sel' : ''}${h.dim ? ' dim' : ''}`} style={boxStyle(lot)}>
              <FitCandy lot={lot} />
              <button
                type="button"
                className="ttHit"
                aria-label={h.label}
                onClick={(e) => {
                  if (placing) return; // let the tap fall through to placement
                  e.stopPropagation();
                  onCandy?.(h.id);
                }}
              />
            </div>
          );
        })}
        {pending && (
          <div className="ttLot pending" style={boxStyle(lotAt(pending.x, pending.y))}>
            <FitCandy lot={lotAt(pending.x, pending.y)} color="#f2923a" />
          </div>
        )}
        {you && <div className="ttYou" style={{ left: `${you.x}%`, top: `${you.y}%` }} aria-label="You are here" />}
      </div>
    </div>
  );
}

/** Positions a box that matches the lot on the map. */
function boxStyle(b: Box): React.CSSProperties {
  return { left: `${b.x - b.w / 2}%`, top: `${b.y - b.h / 2}%`, width: `${b.w}%`, height: `${b.h}%` };
}

/** A candy that fills its lot: laid along the lot's long side, rotated for tall lots like the flyer. */
function FitCandy({ lot, color }: { lot: Box; color?: string }) {
  // Lot sides in image pixels decide orientation; the candy art is wider than tall.
  const wPx = (lot.w / 100) * MAP_IMAGE.width, hPx = (lot.h / 100) * MAP_IMAGE.height;
  const tall = hPx > wPx * 1.2;
  const style: React.CSSProperties = tall
    ? { width: `${(hPx / wPx) * 100}%`, height: `${(wPx / hPx) * 100}%`, transform: 'translate(-50%, -50%) rotate(-70deg)' }
    : { width: '100%', height: '100%', transform: 'translate(-50%, -50%)' };
  return (
    <span className="ttCandyFit" style={style}>
      <Candy color={color} />
    </span>
  );
}
