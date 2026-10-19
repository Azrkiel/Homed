import type { RankedListing } from './types';
import { formatMinutes } from './schedule';

export type CompareRowKey =
  | 'score'
  | 'costPerPerson'
  | 'totalLease'
  | 'weeklyWalk'
  | 'earliestWalk'
  | 'bedBath'
  | 'sqft'
  | 'leaseTerm'
  | 'leaseType'
  | 'furnished'
  | 'utilities'
  | 'laundry'
  | 'parking'
  | 'looks';

export interface CompareCell {
  display: string;
  /** Numeric value used for "better" when the row is comparable. */
  value: number | null;
  best: boolean;
}

export interface CompareRow {
  key: CompareRowKey;
  label: string;
  cells: CompareCell[];
}

type Mode = 'low' | 'high' | 'yes' | 'none';

const num = (n: number): string => n.toLocaleString('en-US');
const usd = (n: number): string => `$${num(n)}`;
const yesNo = (b: boolean): string => (b ? 'Yes' : 'No');

const TERM_LABELS = {
  '12_month': '12-month',
  academic_year: 'Academic year',
  semester: 'Semester',
  other: 'Other',
} as const;

function mark(cells: Omit<CompareCell, 'best'>[], mode: Mode): CompareCell[] {
  const none = cells.map((c) => ({ ...c, best: false }));
  if (mode === 'none') return none;
  const vals = cells.map((c) => c.value).filter((v): v is number => v !== null);
  if (vals.length === 0) return none;
  if (mode === 'yes') {
    if (vals.every((v) => v === vals[0])) return none;
    return cells.map((c) => ({ ...c, best: c.value === 1 }));
  }
  const target = mode === 'low' ? Math.min(...vals) : Math.max(...vals);
  // Every cell tied (no nulls, all equal): nothing is "best".
  if (vals.length === cells.length && vals.every((v) => v === target)) return none;
  return cells.map((c) => ({ ...c, best: c.value !== null && c.value === target }));
}

/**
 * Build the side-by-side table for 2-4 listings (throws RangeError outside 2..4), rows in CompareRowKey order.
 * Each comparable row marks the best cell(s): lower is better for cost and walk rows, higher for
 * score, sqft and looks, and for bedBath a higher bath:bed ratio. Non-comparable rows (leaseTerm,
 * leaseType) mark nothing. Yes/no rows (furnished, utilities, laundry, parking) mark the "yes" cells.
 * Ties all get best = true; a row where every cell ties, or with null values only, marks nothing.
 */
export function buildCompareTable(items: RankedListing[]): CompareRow[] {
  if (items.length < 2 || items.length > 4) {
    throw new RangeError(`Compare needs 2 to 4 listings, got ${items.length}`);
  }
  const row = (
    key: CompareRowKey,
    label: string,
    mode: Mode,
    f: (r: RankedListing) => { display: string; value: number | null },
  ): CompareRow => ({ key, label, cells: mark(items.map(f), mode) });

  return [
    row('score', 'Match score', 'high', (r) => ({ display: String(r.score.total), value: r.score.total })),
    row('costPerPerson', 'Cost per person', 'low', (r) => ({
      display: `${usd(r.score.cost.totalMonthly)}/mo`,
      value: r.score.cost.totalMonthly,
    })),
    row('totalLease', 'Total over lease', 'low', (r) => ({
      display: `${usd(r.score.cost.totalLease)} (${r.score.cost.leaseMonths} mo)`,
      value: r.score.cost.totalLease,
    })),
    row('weeklyWalk', 'Weekly time to class', 'low', (r) => ({
      display: formatMinutes(r.score.commute.weeklyMinutes),
      value: r.score.commute.weeklyMinutes,
    })),
    row('earliestWalk', 'Trip to earliest class', 'low', (r) => {
      const m = r.score.commute.earliestClassMinutes;
      return { display: m === null ? '—' : formatMinutes(m), value: m };
    }),
    row('bedBath', 'Beds / baths', 'high', (r) => {
      const { beds, baths } = r.listing.floorPlan;
      return { display: `${beds} bd / ${baths} ba`, value: baths / Math.max(beds, 1) };
    }),
    row('sqft', 'Size', 'high', (r) => {
      const s = r.listing.floorPlan.sqft;
      return s === undefined ? { display: '—', value: null } : { display: `${num(s)} sq ft`, value: s };
    }),
    row('leaseTerm', 'Lease term', 'none', (r) => ({
      display: TERM_LABELS[r.listing.floorPlan.termKind],
      value: null,
    })),
    row('leaseType', 'Lease type', 'none', (r) => ({
      display: r.listing.floorPlan.leaseType === 'individual' ? 'Individual' : 'Joint',
      value: null,
    })),
    row('furnished', 'Furnished', 'yes', (r) => ({
      display: yesNo(r.listing.floorPlan.furnished),
      value: r.listing.floorPlan.furnished ? 1 : 0,
    })),
    row('utilities', 'Utilities included', 'yes', (r) => ({
      display: yesNo(r.listing.floorPlan.utilitiesIncluded),
      value: r.listing.floorPlan.utilitiesIncluded ? 1 : 0,
    })),
    row('laundry', 'In-unit laundry', 'yes', (r) => ({
      display: yesNo(r.listing.floorPlan.inUnitLaundry),
      value: r.listing.floorPlan.inUnitLaundry ? 1 : 0,
    })),
    row('parking', 'Parking', 'yes', (r) => {
      const a = r.listing.property.amenities;
      if (!a.parkingAvailable) return { display: 'No', value: 0 };
      const m = a.parkingMonthly;
      const display = m === undefined ? 'Yes' : m === 0 ? 'Yes, free' : `Yes, ${usd(m)}/mo`;
      return { display, value: 1 };
    }),
    row('looks', 'Looks', 'high', (r) => ({ display: String(r.score.looks), value: r.score.looks })),
  ];
}
