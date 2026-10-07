'use client';

import { useEffect, useRef } from 'react';
import { MAP_IMAGE } from '@/lib/treatsGeo';
import { lotAt, type Box } from '@/lib/treatsLots';

export type MapHouse = { id: number; x: number; y: number; label: string; dim?: boolean };

export const CANDY_ORANGE = '#ff7518';
export function Candy({ color = CANDY_ORANGE, stripe = '#b8460b' }: { color?: string; stripe?: string }) {
  // A wrapped candy like the flyer's markers: oval body, striped, twisted wrapper at both ends. Drawn lying flat.
  return (
    <svg viewBox="0 0 56 22" aria-hidden="true">
      <defs>
        <clipPath id="ttCandyBody">
          <ellipse cx="28" cy="11" rx="16" ry="10.4" />
        </clipPath>
      </defs>
      <path d="M13 11 L1 3 L4 11 L1 19 Z M43 11 L55 3 L52 11 L55 19 Z" fill={color} stroke="#2a1608" strokeWidth="1.2" strokeLinejoin="round" />
      <ellipse cx="28" cy="11" rx="16" ry="10.4" fill={color} />
      <g clipPath="url(#ttCandyBody)" stroke={stripe} strokeWidth="3.4">
        <path d="M14 24 L24 -2 M22 24 L32 -2 M30 24 L40 -2 M38 24 L48 -2" />
      </g>
      <ellipse cx="28" cy="11" rx="16" ry="10.4" fill="none" stroke="#2a1608" strokeWidth="1.2" />
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
            <FitCandy lot={lotAt(pending.x, pending.y)} />
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

/** Same size candy on every house, as on the flyer: about one lot long, laid along the lot with a slight tilt. */
const CANDY_LEN = 48; // map image px (lots are about 16 x 43)
const CANDY_THICK = CANDY_LEN * (22 / 56);
function FitCandy({ lot, color }: { lot: Box; color?: string }) {
  const wPx = (lot.w / 100) * MAP_IMAGE.width, hPx = (lot.h / 100) * MAP_IMAGE.height;
  const tall = hPx > wPx;
  // The span is sized before it turns, as percentages of the lot box.
  const style: React.CSSProperties = {
    width: `${(CANDY_LEN / wPx) * 100}%`,
    height: `${(CANDY_THICK / hPx) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${tall ? 80 : 10}deg)`,
  };
  return (
    <span className="ttCandyFit" style={style}>
      <Candy color={color} />
    </span>
  );
}
