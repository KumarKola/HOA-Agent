// Which street a lot faces, worked out from the map drawing (no Google needed).
// Road centrelines measured on public/treats-map.jpg (1206x1010 px); names from the recorded plats.
// Perimeter roads (Roeser, Southern, 27th Ave, 23rd Ave) are left out: no lot inside faces them.
import { MAP_IMAGE } from './treatsGeo';

type Seg = { name: string; x0: number; y0: number; x1: number; y1: number };
const H = (name: string, y: number, x0: number, x1: number): Seg => ({ name, x0, y0: y, x1, y1: y });
const V = (name: string, x: number, y0: number, y1: number): Seg => ({ name, x0: x, y0, x1: x, y1 });

const SEGMENTS: Seg[] = [
  H('W Grenadine Rd', 113, 205, 1015),
  H('W Chanute Pass', 216, 205, 548), // stops at the middle park
  H('W Chanute Pass', 216, 728, 1010),
  H('W La Salle St', 321, 260, 1000),
  H('W La Salle St', 382, 140, 260),
  H('W Bowker St', 442, 205, 610),
  H('W Bowker St', 424, 660, 1000),
  H('W Sunland Ave', 548, 205, 610),
  H('W Sunland Ave', 528, 680, 1065),
  H('W Pecan Rd', 651, 205, 610),
  H('W Pecan Rd', 651, 680, 1000),
  H('W Hidalgo Ave', 755, 140, 1000),
  H('W Huntington Dr', 857, 205, 695),
  H('W Jessica Ln', 827, 700, 905),
  H('W Kowalsky Ln', 960, 340, 565),
  H('W Kowalsky Ln', 925, 695, 1000),
  V('S 26th Ln', 212, 110, 860),
  V('S 26th Dr', 254, 320, 445),
  V('S 25th Dr', 556, 110, 320),
  V('S 25th Dr', 617, 320, 445),
  V('S 25th Dr', 554, 860, 990),
  V('S 25th Ave', 598, 548, 655),
  V('S 25th Ave', 626, 860, 1000),
  V('S 24th Ln', 723, 110, 320),
  V('S 24th Ln', 669, 320, 440),
  V('S 24th Ln', 686, 528, 655),
  V('S 24th Ln', 697, 760, 860),
  V('S 23rd Dr', 1007, 105, 1000),
  V('S 23rd Ln', 907, 760, 930),
  V('S 26th Ave', 346, 860, 965),
  V('S 25th Ln', 450, 860, 965),
];

function dist2(px: number, py: number, s: Seg) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0;
  const len2 = dx * dx + dy * dy || 1;
  const raw = ((px - s.x0) * dx + (py - s.y0) * dy) / len2;
  const t = Math.max(0, Math.min(1, raw));
  const cx = s.x0 + t * dx, cy = s.y0 + t * dy;
  const d = (px - cx) ** 2 + (py - cy) ** 2;
  // A lot faces a street along its length. Being past the end of a street (at a corner) counts as much farther.
  return raw < 0 || raw > 1 ? d * 6 : d;
}

/** The nearest community street to a point on the map (in %). A suggestion: corner lots can face either street. */
export function streetAt(xPct: number, yPct: number): string {
  const px = (xPct / 100) * MAP_IMAGE.width, py = (yPct / 100) * MAP_IMAGE.height;
  let best = SEGMENTS[0], bd = Infinity;
  for (const s of SEGMENTS) {
    const d = dist2(px, py, s);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best.name;
}
