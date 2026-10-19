import type { RankedListing } from './types';
import { notImplemented } from './not-implemented';

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

/**
 * Build the side-by-side table for 2-4 listings (throws RangeError outside 2..4), rows in CompareRowKey order.
 * Each comparable row marks the best cell(s): lower is better for cost and walk rows, higher for
 * score, sqft and looks, and for bedBath a higher bath:bed ratio. Non-comparable rows (leaseTerm,
 * leaseType) mark nothing. Yes/no rows (furnished, utilities, laundry, parking) mark the "yes" cells.
 * Ties all get best = true; a row where every cell ties, or with null values only, marks nothing.
 */
export function buildCompareTable(items: RankedListing[]): CompareRow[] {
  return notImplemented('buildCompareTable');
}
