import type { CostBreakdown, FloorPlan, Property } from './types';
import { notImplemented } from './not-implemented';

export interface CostOptions {
  /** Count one parking space per person. Default false. */
  includeParking?: boolean;
}

/** Bedrooms used to split per_unit rent; a studio (0 beds) is 1 person. */
export function peopleInUnit(fp: FloorPlan): number {
  return notImplemented('peopleInUnit');
}

/** Months between leaseStart and leaseEnd, rounded to the nearest whole month (min 1). */
export function leaseMonths(fp: FloorPlan): number {
  return notImplemented('leaseMonths');
}

/**
 * All-in monthly cost per person: rent (split by bedroom when per_unit) + utilities (0 if included,
 * else utilitiesEstimate ?? 0) + internet (same rule) + parking (when includeParking and
 * parkingAvailable: parkingMonthly ?? 0) + furniture (0 if furnished, else furnitureMonthly ?? 0).
 * Rounded to whole dollars. Academic-year / semester leases get a `note`.
 */
export function computeCost(fp: FloorPlan, property: Property, opts?: CostOptions): CostBreakdown {
  return notImplemented('computeCost');
}
