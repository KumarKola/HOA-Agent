// Map geometry for the trick-or-treat page. No database code: safe to use in the browser.

export const MAP_IMAGE = { src: '/treats-map.jpg', width: 1206, height: 1010 };

// Streets inside the community, from the recorded plats for Liberty 1A, 1B and 2.
export const STREETS = [
  'W Grenadine Rd',
  'W Chanute Pass',
  'W La Salle St',
  'W Bowker St',
  'W Sunland Ave',
  'W Pecan Rd',
  'W Hidalgo Ave',
  'W Huntington Dr',
  'W Jessica Ln',
  'W Kowalsky Ln',
  'S 26th Ave',
  'S 26th Dr',
  'S 26th Ln',
  'S 25th Ave',
  'S 25th Dr',
  'S 25th Ln',
  'S 24th Ln',
  'S 23rd Dr',
  'S 23rd Ln',
];

// GPS alignment: the four perimeter intersections (Google Maps intersection coordinates)
// matched to the centre of the perimeter roads on the drawing, in image pixels.
const CONTROL: { lat: number; lng: number; x: number; y: number }[] = [
  { lat: 33.3995231, lng: -112.1163582, x: 124, y: 40 }, // 27th Ave & Roeser Rd
  { lat: 33.3995175, lng: -112.1079525, x: 1082, y: 40 }, // 23rd Ave & Roeser Rd
  { lat: 33.3921972, lng: -112.1163692, x: 124, y: 1001 }, // 27th Ave & Southern Ave
  { lat: 33.3922355, lng: -112.1077535, x: 1082, y: 1001 }, // 23rd Ave & Southern Ave
];

// Coordinates are recentred and scaled before fitting; raw lat/lng differ only in the 4th decimal
// and the normal equations lose precision otherwise.
const LAT0 = 33.3958, LNG0 = -112.1121, K = 1e4;
const u = (lng: number) => (lng - LNG0) * K;
const w = (lat: number) => (lat - LAT0) * K;

/** Least-squares affine fit: x = a*u(lng) + b*w(lat) + c (same for y). Solved once from the control points. */
function fit(key: 'x' | 'y'): [number, number, number] {
  // Normal equations for [lng, lat, 1] -> value
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const v = [0, 0, 0];
  for (const p of CONTROL) {
    const r = [u(p.lng), w(p.lat), 1];
    for (let i = 0; i < 3; i++) {
      v[i] += r[i] * p[key];
      for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j];
    }
  }
  // Solve 3x3 by Cramer's rule
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(A);
  const col = (k: number) => A.map((row, i) => row.map((val, j) => (j === k ? v[i] : val)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}

export const GEO_TRANSFORM = { x: fit('x'), y: fit('y'), width: MAP_IMAGE.width, height: MAP_IMAGE.height };

/** Phone location -> position on the map as percentages. Returns null if well outside the community. */
export function geoToMap(lat: number, lng: number, t = GEO_TRANSFORM): { x: number; y: number } | null {
  const px = t.x[0] * u(lng) + t.x[1] * w(lat) + t.x[2];
  const py = t.y[0] * u(lng) + t.y[1] * w(lat) + t.y[2];
  const x = (px / t.width) * 100;
  const y = (py / t.height) * 100;
  if (x < -5 || x > 105 || y < -5 || y > 105) return null;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
}

export const validPct = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
