import type { CostBreakdown, FloorPlan, Property } from './types';

export interface CostOptions {
  /** Count one parking space per person. Default false. */
  includeParking?: boolean;
}

/** Bedrooms used to split per_unit rent; a studio (0 beds) is 1 person. */
export function peopleInUnit(fp: FloorPlan): number {
  return Math.max(fp.beds, 1);
}

/** Months between leaseStart and leaseEnd, rounded to the nearest whole month (min 1). */
export function leaseMonths(fp: FloorPlan): number {
  const days = (Date.parse(fp.leaseEnd) - Date.parse(fp.leaseStart)) / 86_400_000;
  return Math.max(1, Math.round(days / 30.44));
}

/**
 * All-in monthly cost per person: rent (split by bedroom when per_unit) + utilities (0 if included,
 * else utilitiesEstimate ?? 0) + internet (same rule) + parking (when includeParking and
 * parkingAvailable: parkingMonthly ?? 0) + furniture (0 if furnished, else furnitureMonthly ?? 0).
 * Rounded to whole dollars. Academic-year / semester leases get a `note`.
 */
export function computeCost(fp: FloorPlan, property: Property, opts?: CostOptions): CostBreakdown {
  const people = peopleInUnit(fp);
  const rent = Math.round(fp.rentBasis === 'per_bed' ? fp.rentAmount : fp.rentAmount / people);
  const utilities = fp.utilitiesIncluded ? 0 : Math.round(fp.utilitiesEstimate ?? 0);
  const internet = fp.internetIncluded ? 0 : Math.round(fp.internetEstimate ?? 0);
  const parking =
    opts?.includeParking && property.amenities.parkingAvailable
      ? Math.round(property.amenities.parkingMonthly ?? 0)
      : 0;
  const furniture = fp.furnished ? 0 : Math.round(fp.furnitureMonthly ?? 0);
  const totalMonthly = rent + utilities + internet + parking + furniture;
  const months = leaseMonths(fp);
  const result: CostBreakdown = {
    rent, utilities, internet, parking, furniture, totalMonthly,
    leaseMonths: months,
    totalLease: totalMonthly * months,
  };
  if (fp.termKind === 'academic_year' || fp.termKind === 'semester') {
    result.note = `${months}-month lease: plan summer housing separately`;
  }
  return result;
}
