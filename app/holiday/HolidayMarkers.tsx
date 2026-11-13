// Markers for the holiday contest map: a decorated tree or a string of lights over each entered home.
import type { Box } from '@/lib/treatsLots';

export function Tree() {
  return (
    <svg viewBox="0 0 24 44" aria-hidden="true">
      <rect x="10" y="36" width="4" height="7" fill="#6b3f1d" stroke="#2a1608" strokeWidth="0.8" />
      <path
        d="M12 5 L20 17 L16 17 L22 27 L17 27 L23 37 L1 37 L7 27 L2 27 L8 17 L4 17 Z"
        fill="#1f8a4c"
        stroke="#0b2a17"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="15" r="1.6" fill="#e5383b" />
      <circle cx="14.5" cy="22" r="1.6" fill="#f2c14e" />
      <circle cx="8.5" cy="27" r="1.6" fill="#4ea8de" />
      <circle cx="16" cy="31" r="1.6" fill="#e5383b" />
      <circle cx="11" cy="33.5" r="1.6" fill="#f2c14e" />
      <path d="M12 0.6 L13.3 3.6 L16.4 3.8 L14 5.8 L14.8 8.9 L12 7.2 L9.2 8.9 L10 5.8 L7.6 3.8 L10.7 3.6 Z" fill="#f2c14e" stroke="#7a5a0b" strokeWidth="0.6" />
    </svg>
  );
}

export function Lights() {
  const bulbs = ['#e5383b', '#f2c14e', '#2fbf71', '#4ea8de', '#e5383b', '#f2c14e'];
  return (
    <svg viewBox="0 0 60 20" aria-hidden="true">
      <path d="M1 6 Q6 12 11 6 T21 6 T31 6 T41 6 T51 6 T59 6" fill="none" stroke="#163d2a" strokeWidth="1.6" />
      {bulbs.map((c, i) => {
        const x = 6 + i * 9.6;
        return (
          <g key={i} transform={`rotate(${i % 2 ? -12 : 12} ${x} 9)`}>
            <rect x={x - 1.6} y="7.5" width="3.2" height="2.6" rx="0.6" fill="#3a3f3c" />
            <ellipse cx={x} cy="14" rx="3.3" ry="4.6" fill={c} stroke="#1d1d1d" strokeWidth="0.7" />
            <ellipse cx={x - 1} cy="12.6" rx="0.9" ry="1.5" fill="#fff" opacity="0.6" />
          </g>
        );
      })}
    </svg>
  );
}

// Sizes in map-image pixels for Liberty (lots about 20 x 55); other maps scale them by their lot size.
const TREE_TALL = 52;
const TREE_SHORT = 34; // on the wide lots along 27th Ave and 23rd Dr
const LIGHTS_LEN = 64;

type Geo = { width: number; height: number; lotLong: number };

function lotPx(lot: Box, g: Geo) {
  return { wPx: (lot.w / 100) * g.width, hPx: (lot.h / 100) * g.height };
}

/** A tree standing upright in the lot. */
function FitTree({ lot, g }: { lot: Box; g: Geo }) {
  const { wPx, hPx } = lotPx(lot, g);
  const k = g.lotLong / 55;
  const h = (hPx > wPx ? TREE_TALL : TREE_SHORT) * k;
  const w = h * (24 / 44);
  return (
    <span className="ttCandyFit hdTree" style={{ width: `${(w / wPx) * 100}%`, height: `${(h / hPx) * 100}%`, transform: 'translate(-50%, -50%)' }}>
      <Tree />
    </span>
  );
}

/** A string of lights laid along the lot with a slight tilt, like the Halloween candies. */
function FitLights({ lot, g }: { lot: Box; g: Geo }) {
  const { wPx, hPx } = lotPx(lot, g);
  const tall = hPx > wPx;
  const len = LIGHTS_LEN * (g.lotLong / 55), thick = len * (20 / 60);
  return (
    <span
      className="ttCandyFit hdLights"
      style={{
        width: `${(len / wPx) * 100}%`,
        height: `${(thick / hPx) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${tall ? 80 : 10}deg)`,
      }}
    >
      <Lights />
    </span>
  );
}

/** Marker drawer for a map: a tree or lights sized to that map's lots. */
export function holidayMarkerFor(g: Geo) {
  return function holidayMarker(lot: Box, kind?: string) {
    return kind === 'lights' ? <FitLights lot={lot} g={g} /> : <FitTree lot={lot} g={g} />;
  };
}
