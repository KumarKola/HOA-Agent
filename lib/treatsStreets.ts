// Which street a lot faces, worked out from the map drawing (no Google needed).
// Road centrelines measured on public/treats-map-v2.jpg (1600x1424 px); names from the recorded plats.
// Perimeter roads (Roeser, Southern, 27th Ave, 23rd Ave) are left out: no lot inside faces them.
import { MAP_IMAGE } from './treatsGeo';

type Seg = { name: string; x0: number; y0: number; x1: number; y1: number };
const H = (name: string, y: number, x0: number, x1: number): Seg => ({ name, x0, y0: y, x1, y1: y });
const V = (name: string, x: number, y0: number, y1: number): Seg => ({ name, x0: x, y0, x1: x, y1 });

const SEGMENTS: Seg[] = [
  H('W Grenadine Rd', 171, 345, 1396),
  H('W Chanute Pass', 305, 345, 790), // stops at the middle block
  H('W Chanute Pass', 305, 1023, 1389),
  H('W La Salle St', 441, 416, 1376),
  H('W La Salle St', 520, 260, 416),
  H('W Bowker St', 598, 345, 870),
  H('W Bowker St', 574, 935, 1376),
  H('W Sunland Ave', 735, 345, 870),
  H('W Sunland Ave', 709, 961, 1460),
  H('W Pecan Rd', 869, 345, 870),
  H('W Pecan Rd', 869, 961, 1376),
  H('W Hidalgo Ave', 1003, 260, 1376),
  H('W Huntington Dr', 1136, 345, 980),
  H('W Jessica Ln', 1097, 987, 1253),
  H('W Kowalsky Ln', 1269, 520, 812),
  H('W Kowalsky Ln', 1224, 980, 1376),
  V('S 26th Ln', 354, 167, 1139),
  V('S 26th Dr', 408, 440, 602),
  V('S 25th Dr', 800, 167, 440),
  V('S 25th Dr', 879, 440, 602),
  V('S 25th Dr', 797, 1139, 1308),
  V('S 25th Ave', 855, 735, 874),
  V('S 25th Ave', 891, 1139, 1321),
  V('S 24th Ln', 1017, 167, 440),
  V('S 24th Ln', 947, 440, 595),
  V('S 24th Ln', 969, 709, 874),
  V('S 24th Ln', 983, 1010, 1139),
  V('S 23rd Dr', 1385, 161, 1321),
  V('S 23rd Ln', 1255, 1010, 1230),
  V('S 26th Ave', 528, 1139, 1276),
  V('S 25th Ln', 663, 1139, 1276),
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
