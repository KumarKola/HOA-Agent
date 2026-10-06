// Gate locations come from the recorded plats for Liberty 1A, 1B and 2.
// Every entrance has three gates side by side: entrance, exit and pedestrian.

export type EntranceId = 'G1' | 'G2' | 'G3' | 'G4';
export type GateType = 'entrance' | 'exit' | 'pedestrian';
export type IssueId =
  | 'stuck_open'
  | 'stuck_closed'
  | 'slow_close'
  | 'fob'
  | 'wont_open_leaving'
  | 'tailgating'
  | 'wont_latch'
  | 'propped_open'
  | 'lock_broken'
  | 'intruder';

export const ENTRANCES: { id: EntranceId; name: string; short: string; x: number; y: number }[] = [
  { id: 'G1', name: 'G1 · 25th Ave & Roeser Rd', short: '25th Ave & Roeser', x: 497, y: 100 },
  { id: 'G2', name: 'G2 · La Salle St & 27th Ave', short: 'La Salle & 27th Ave', x: 100, y: 326 },
  { id: 'G3', name: 'G3 · Sunland Ave & 23rd Ave', short: 'Sunland & 23rd Ave', x: 900, y: 518 },
  { id: 'G4', name: 'G4 · 25th Ave & Southern Ave', short: '25th Ave & Southern', x: 497, y: 900 },
];

export const GATE_TYPES: { id: GateType; label: string }[] = [
  { id: 'entrance', label: 'Entrance gate' },
  { id: 'exit', label: 'Exit gate' },
  { id: 'pedestrian', label: 'Pedestrian gate' },
];

export const ISSUES: Record<IssueId, { label: string; security?: boolean }> = {
  stuck_open: { label: 'Stuck open' },
  stuck_closed: { label: 'Stuck closed' },
  slow_close: { label: 'Slow to close' },
  fob: { label: 'Fob not working' },
  wont_open_leaving: { label: "Won't open when leaving" },
  tailgating: { label: 'Cars tailgating in' },
  wont_latch: { label: "Won't latch" },
  propped_open: { label: 'Propped open' },
  lock_broken: { label: 'Lock or keypad broken' },
  intruder: { label: 'Intruder or suspicious activity', security: true },
};

export const ISSUES_BY_GATE: Record<GateType, IssueId[]> = {
  entrance: ['stuck_open', 'stuck_closed', 'slow_close', 'fob', 'tailgating', 'intruder'],
  exit: ['stuck_open', 'stuck_closed', 'slow_close', 'wont_open_leaving', 'intruder'],
  pedestrian: ['wont_latch', 'propped_open', 'lock_broken', 'intruder'],
};

export const isEntrance = (v: unknown): v is EntranceId => ENTRANCES.some((e) => e.id === v);
export const isGateType = (v: unknown): v is GateType => GATE_TYPES.some((g) => g.id === v);
export const isIssue = (v: unknown): v is IssueId => typeof v === 'string' && v in ISSUES;

export const entranceName = (id: string) => ENTRANCES.find((e) => e.id === id)?.name ?? id;
export const gateLabel = (id: string) => GATE_TYPES.find((g) => g.id === id)?.label ?? id;
export const issueLabel = (id: string) => (ISSUES as Record<string, { label: string }>)[id]?.label ?? id;

/** "G1 · 25th Ave & Roeser Rd, Exit gate, Stuck open" */
export const incidentTitle = (i: { entrance: string; gate: string; issue: string }) =>
  `${entranceName(i.entrance)}, ${gateLabel(i.gate)}, ${issueLabel(i.issue)}`;
