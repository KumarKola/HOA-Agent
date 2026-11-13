// Building blocks for a community map from pixel data: lot snapping, street lookup, GPS → map.
// Browser-safe (no server imports). Liberty keeps its own hand-tuned modules (treatsLots/treatsStreets/treatsGeo);
// newer communities are built from these.
import type { Box } from './treatsLots';

export type MapDef = {
  src: string;
  width: number;
  height: number;
  /** Community streets as written in addresses (e.g. "W Desert Hollow Dr"). */
  streets: string[];
  lotAt: (xPct: number, yPct: number) => Box & { snapped: boolean };
  lotBoxes: () => Box[];
  streetAt: (xPct: number, yPct: number) => string;
  geoToMap: (lat: number, lng: number) => { x: number; y: number } | null;
  /** Typical long side of a lot in map pixels; markers are sized from it. */
  lotLong: number;
  /** The address of the lot at a point, where the map knows it (fills the form when someone taps their home). */
  addressAt?: (xPct: number, yPct: number) => { number: string; street: string } | null;
};

type Px = [number, number, number, number];

export function makeLots(lots: Px[], W: number, H: number) {
  const pct = (x: number, y: number, w: number, h: number): Box => ({ x: ((x + w / 2) / W) * 100, y: ((y + h / 2) / H) * 100, w: (w / W) * 100, h: (h / H) * 100 });
  const sorted = lots.map((l) => Math.max(l[2], l[3])).sort((a, b) => a - b);
  const lotLong = sorted[Math.floor(sorted.length / 2)] || 40;
  /** Index of the smallest lot box containing the point (curved rows make neighbouring boxes overlap), or -1. */
  function lotIndexAt(xPct: number, yPct: number): number {
    const px = (xPct / 100) * W, py = (yPct / 100) * H;
    let hit = -1;
    lots.forEach((l, i) => {
      if (px >= l[0] - 1 && px <= l[0] + l[2] + 1 && py >= l[1] - 1 && py <= l[1] + l[3] + 1 && (hit < 0 || l[2] * l[3] < lots[hit][2] * lots[hit][3])) hit = i;
    });
    return hit;
  }
  function lotAt(xPct: number, yPct: number): Box & { snapped: boolean } {
    const px = (xPct / 100) * W, py = (yPct / 100) * H;
    const i = lotIndexAt(xPct, yPct);
    if (i >= 0) return { ...pct(...lots[i]), snapped: true };
    let best: Px | null = null, bd = Infinity;
    for (const l of lots) {
      const d = (l[0] + l[2] / 2 - px) ** 2 + (l[1] + l[3] / 2 - py) ** 2;
      if (d < bd) { bd = d; best = l; }
    }
    const [w, h] = best && bd < (lotLong * 1.4) ** 2 ? [best[2], best[3]] : [lotLong * 0.45, lotLong * 0.45];
    return { x: xPct, y: yPct, w: (w / W) * 100, h: (h / H) * 100, snapped: false };
  }
  return { lotAt, lotIndexAt, lotBoxes: () => lots.map((l) => pct(...l)), lotLong };
}

/** Nearest street to a point; being past the end of a street (at a corner) counts as farther, as on the Liberty map. */
export function makeStreetAt(segs: { name: string; pts: [number, number][] }[], W: number, H: number) {
  return function streetAt(xPct: number, yPct: number): string {
    const px = (xPct / 100) * W, py = (yPct / 100) * H;
    let best = segs[0]?.name ?? '', bd = Infinity;
    for (const s of segs) {
      for (let i = 1; i < s.pts.length; i++) {
        const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[i];
        const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
        const raw = ((px - x0) * dx + (py - y0) * dy) / L2, t = Math.max(0, Math.min(1, raw));
        const first = i === 1 && raw < 0, last = i === s.pts.length - 1 && raw > 1;
        let d = (px - (x0 + t * dx)) ** 2 + (py - (y0 + t * dy)) ** 2;
        if (first || last) d *= 6;
        if (d < bd) { bd = d; best = s.name; }
      }
    }
    return best;
  };
}

/** GPS → map % through an affine fitted on (lng + 111.59)·1e5, (lat − 33.17)·1e5. Null outside the picture. */
export function makeAffineGeo(A: number[][], W: number, H: number) {
  return function geoToMap(lat: number, lng: number) {
    const lo = (lng + 111.59) * 1e5, la = (lat - 33.17) * 1e5;
    const x = A[0][0] * lo + A[0][1] * la + A[0][2], y = A[1][0] * lo + A[1][1] * la + A[1][2];
    if (x < 0 || y < 0 || x > W || y > H) return null;
    return { x: (x / W) * 100, y: (y / H) * 100 };
  };
}
