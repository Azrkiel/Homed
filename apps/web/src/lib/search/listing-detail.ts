// Pure helpers for the listing detail page. No I/O; relative imports only.
import type { Building, Landmark, LeaseTermKind, ScoreWeights, WalkTime, WeeklyMeeting } from '@homed/core';

/** `?parking=1` (or true/yes/on) turns the parking toggle on. Arrays use the first value. */
export function parkingFromParam(value: string | string[] | undefined): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** A rating must be an integer from 1 to 5. */
export function parseRating(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export interface WeightRow {
  key: 'price' | 'location' | 'looks';
  label: string;
  /** Whole percent. The three rows sum to 100. */
  percent: number;
}

/** Weights as whole percents that sum to exactly 100 (largest remainder). */
export function weightPercents(weights: ScoreWeights): WeightRow[] {
  const rows: WeightRow[] = [
    { key: 'price', label: 'Price', percent: 0 },
    { key: 'location', label: 'Location', percent: 0 },
    { key: 'looks', label: 'Looks', percent: 0 },
  ];
  const raw = rows.map((r) => Math.max(0, Number(weights[r.key]) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  const exact = sum > 0 ? raw.map((v) => (v / sum) * 100) : [100 / 3, 100 / 3, 100 / 3];
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left--;
  }
  return rows.map((r, i) => ({ ...r, percent: floors[i] ?? 0 }));
}

export interface TermExplanation {
  title: string;
  body: string;
}

/** Short copy comparing lease terms; chosen by the floor plan's term kind. */
export function termExplanation(kind: LeaseTermKind, months: number): TermExplanation {
  switch (kind) {
    case '12_month':
      return {
        title: '12-month lease',
        body: `You pay for all ${months} months, including summer, whether or not you are in town. Compare the total lease cost, not just the monthly price: a lower monthly rent on a 12-month lease can cost more overall than an academic-year lease.`,
      };
    case 'academic_year':
      return {
        title: 'Academic-year lease',
        body: `This lease runs about ${months} months, roughly August to May. The monthly price is often higher, but you do not pay for summer. Plan summer housing separately, and compare the total lease cost, not just the monthly price.`,
      };
    case 'semester':
      return {
        title: 'Semester lease',
        body: `This lease covers about ${months} months. Plan housing for the rest of the year separately, and compare the total lease cost, not just the monthly price.`,
      };
    default:
      return {
        title: 'Custom lease term',
        body: `This lease runs about ${months} months. Compare the total lease cost, not just the monthly price, and check the exact dates.`,
      };
  }
}

export function leaseTypeLabel(t: 'individual' | 'joint'): string {
  return t === 'individual' ? 'Individual lease' : 'Joint lease';
}

export function termKindLabel(k: LeaseTermKind): string {
  switch (k) {
    case '12_month':
      return '12-month';
    case 'academic_year':
      return 'Academic year';
    case 'semester':
      return 'Semester';
    default:
      return 'Custom term';
  }
}

export interface WalkRow {
  id: string;
  name: string;
  walkMinutes: number;
  busMinutes: number | null;
  estimated: boolean;
  /** Landmark rows only: one of the named highlights. */
  highlight?: boolean;
}

/** Unique class buildings from the user's meetings with walk data, in the order first used. */
export function classWalkRows(meetings: WeeklyMeeting[], buildings: Building[], walks: WalkTime[], propertyId: string): WalkRow[] {
  const byBuilding = new Map(buildings.map((b) => [b.id, b]));
  const walkBy = new Map(walks.filter((w) => w.propertyId === propertyId).map((w) => [w.targetId, w]));
  const seen = new Set<string>();
  const out: WalkRow[] = [];
  for (const m of meetings) {
    if (seen.has(m.buildingId)) continue;
    seen.add(m.buildingId);
    const w = walkBy.get(m.buildingId);
    const b = byBuilding.get(m.buildingId);
    if (!w || !b) continue;
    out.push({ id: b.id, name: b.name, walkMinutes: w.walkMinutes, busMinutes: w.busMinutes, estimated: w.source === 'estimate' });
  }
  return out;
}

const HIGHLIGHTS: ((l: Landmark) => boolean)[] = [
  (l) => l.kind !== 'worship' && l.kind !== 'grocery' && /\bcorner\b/i.test(l.name),
  (l) => /\blawn\b|rotunda/i.test(l.name),
  (l) => /clemons/i.test(l.name),
  (l) => /newcomb/i.test(l.name),
  (l) => /\bafc\b|aquatic|fitness/i.test(l.name),
  (l) => l.kind === 'grocery',
];

/** Landmarks with walk data for this property. The named highlights come first, then the rest by walk time. */
export function landmarkWalkRows(landmarks: Landmark[], walks: WalkTime[], propertyId: string): WalkRow[] {
  const walkBy = new Map(
    walks.filter((w) => w.propertyId === propertyId && w.targetKind === 'landmark').map((w) => [w.targetId, w]),
  );
  const rows: (WalkRow & { rank: number })[] = [];
  for (const l of landmarks) {
    const w = walkBy.get(l.id);
    if (!w) continue;
    const idx = HIGHLIGHTS.findIndex((test) => test(l));
    rows.push({
      id: l.id,
      name: l.name,
      walkMinutes: w.walkMinutes,
      busMinutes: w.busMinutes,
      estimated: w.source === 'estimate',
      highlight: idx >= 0,
      rank: idx >= 0 ? idx : HIGHLIGHTS.length,
    });
  }
  rows.sort((a, b) => a.rank - b.rank || a.walkMinutes - b.walkMinutes || a.name.localeCompare(b.name));
  // Only the nearest grocery is a highlight; the others go with the rest.
  const groceryRank = HIGHLIGHTS.length - 1;
  let groceryShown = false;
  for (const row of rows) {
    if (row.rank !== groceryRank) continue;
    if (groceryShown) row.highlight = false;
    groceryShown = true;
  }
  return rows.map(({ rank: _rank, ...row }) => row);
}

/** Bus note from the property's route fields. */
export function busNote(onBusRoute: boolean, busRoutes: string[]): string {
  if (!onBusRoute) return 'Not on a bus route.';
  return busRoutes.length > 0 ? `On a bus route: ${busRoutes.join(', ')}.` : 'On a bus route.';
}
