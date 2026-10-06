'use client';

import { ENTRANCES, type EntranceId } from '@/lib/gates';

// Schematic of the community from the recorded plats. Not to scale.
// Markers are large tap targets; open-incident counts show as a badge.
export default function GateMap({
  selected,
  openCounts,
  onPick,
}: {
  selected: EntranceId | null;
  openCounts: Record<string, number>;
  onPick: (id: EntranceId) => void;
}) {
  return (
    <svg viewBox="0 0 1000 1000" role="group" aria-label="Community map. Tap an entrance.">
      <g fill="var(--road)">
        <rect x="60" y="62" width="880" height="26" />
        <rect x="60" y="912" width="880" height="26" />
        <rect x="62" y="60" width="26" height="880" />
        <rect x="912" y="60" width="26" height="880" />
      </g>
      <g fontSize="22" fontWeight="600" fill="var(--muted)" textAnchor="middle">
        <text x="250" y="50">ROESER RD</text>
        <text x="250" y="972">SOUTHERN AVE</text>
        <text x="40" y="700" transform="rotate(-90 40 700)">27TH AVE</text>
        <text x="962" y="250" transform="rotate(90 962 250)">23RD AVE</text>
      </g>
      <rect x="100" y="100" width="800" height="800" fill="var(--lot)" stroke="var(--wall)" strokeWidth="3" />
      <g stroke="var(--street)" strokeWidth="12" strokeLinecap="round" fill="none">
        <path d="M173 152H835 M173 235H835 M100 326H835 M173 429H835 M173 518H900 M173 605H835 M173 692H835 M173 779H566 M566 805H835 M173 836H835" />
        <path d="M173 152V836 M497 100V900 M566 152V836 M835 152V836" />
      </g>
      <g transform="translate(850 170)" fill="var(--muted)">
        <path d="M0 -26 L11 10 L0 3 L-11 10 Z" />
        <text x="0" y="34" fontSize="20" textAnchor="middle" fontWeight="600">N</text>
      </g>
      {ENTRANCES.map((e) => {
        const n = openCounts[e.id] || 0;
        const sel = selected === e.id;
        return (
          <g
            key={e.id}
            className={`marker${sel ? ' sel' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={sel}
            aria-label={`${e.name}${n ? `, ${n} open ${n === 1 ? 'issue' : 'issues'}` : ''}`}
            onClick={() => onPick(e.id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onPick(e.id);
              }
            }}
          >
            <circle cx={e.x} cy={e.y} r="64" fill="transparent" />
            <circle className="ring" cx={e.x} cy={e.y} r="44" />
            <text
              className="lbl"
              x={e.x}
              y={e.y + 13}
              textAnchor="middle"
              fontSize="38"
              fontWeight="700"
              fill="var(--accent-ink)"
              style={{ fontFamily: 'var(--display)' }}
            >
              {e.id}
            </text>
            {n > 0 && (
              <g>
                <circle cx={e.x + 36} cy={e.y - 36} r="20" fill="var(--bad)" stroke="var(--panel)" strokeWidth="4" />
                <text x={e.x + 36} y={e.y - 28} textAnchor="middle" fontSize="22" fontWeight="700" fill="#fff">
                  {n}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
