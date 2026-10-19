import { accommodationBadge } from './accessibility';
import { computeCost, peopleInUnit } from './cost';
import type { ListingFilters, Listing } from './types';

export interface FilterResult {
  pass: boolean;
  /** Human-readable reasons a listing failed, e.g. "Over budget by $120". */
  reasons: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const month = MONTHS[Number(m) - 1];
  if (!month) return iso;
  return `${month} ${Number(d)}`;
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US')}`;
}

function hardReasons(listing: Listing, f: ListingFilters): string[] {
  const { floorPlan: fp, property } = listing;
  const reasons: string[] = [];
  if (f.maxCostPerPerson !== undefined) {
    const total = computeCost(fp, property).totalMonthly;
    if (total > f.maxCostPerPerson) reasons.push(`Over budget by ${money(total - f.maxCostPerPerson)}`);
  }
  if (f.groupSize !== undefined) {
    const people = peopleInUnit(fp);
    if (people !== f.groupSize) {
      reasons.push(`Has ${people} bedroom${people === 1 ? '' : 's'}, group needs ${f.groupSize}`);
    }
  }
  if (f.moveInBy !== undefined && fp.leaseStart > f.moveInBy) {
    reasons.push(`Lease starts ${shortDate(fp.leaseStart)}, after ${shortDate(f.moveInBy)}`);
  }
  return reasons;
}

/** Hard filters from the Best Match spec: budget (all-in cost), bedroom count = group size, move-in date. */
export function passesHardFilters(listing: Listing, filters: ListingFilters): FilterResult {
  const reasons = hardReasons(listing, filters);
  return { pass: reasons.length === 0, reasons };
}

/** Every filter in ListingFilters (hard + soft). An undefined filter field is ignored. */
export function passesFilters(listing: Listing, filters: ListingFilters): FilterResult {
  const { floorPlan: fp, property } = listing;
  const f = filters;
  const reasons = hardReasons(listing, f);
  const people = peopleInUnit(fp);

  if (f.privateBathroom && !(fp.baths >= people)) reasons.push('No private bathroom');
  if (f.leaseType !== undefined && fp.leaseType !== f.leaseType) {
    reasons.push(fp.leaseType === 'joint' ? 'Joint lease, not individual' : 'Individual lease, not joint');
  }
  if (f.termKind !== undefined && fp.termKind !== f.termKind) {
    reasons.push(`Lease term is ${fp.termKind.replace('_', ' ')}, not ${f.termKind.replace('_', ' ')}`);
  }
  if (f.studyAbroadFriendly && !property.studyAbroadFriendly) reasons.push('Not study-abroad friendly');
  if (f.furnished && !fp.furnished) reasons.push('Not furnished');
  if (f.utilitiesIncluded && !fp.utilitiesIncluded) reasons.push('Utilities not included');
  if (f.onBusRoute && !property.onBusRoute) reasons.push('Not on a bus route');
  if (f.parkingAvailable && !property.amenities.parkingAvailable) reasons.push('No parking available');
  if (f.inUnitLaundry && !fp.inUnitLaundry) reasons.push('No in-unit laundry');
  if (f.dishwasher && !fp.dishwasher) reasons.push('No dishwasher');
  if (f.ac && !fp.ac) reasons.push('No air conditioning');
  if (f.noise !== undefined && property.noiseLevel !== f.noise) {
    reasons.push(f.noise === 'quiet' ? 'Not a quiet building' : 'Not a social building');
  }
  if (f.litRoute && !property.litRouteToGrounds) reasons.push('No lit walking route to Grounds');
  if (f.petsAllowed && !property.amenities.petsAllowed) reasons.push('Pets not allowed');
  if (f.accommodationFriendly && !accommodationBadge(listing.accessibility).friendly) {
    reasons.push('Not accommodation-friendly');
  }
  if (f.accessibilityFeatures && f.accessibilityFeatures.length > 0) {
    const have = listing.accessibility?.features ?? [];
    const missing = f.accessibilityFeatures.filter((x) => !have.includes(x));
    if (missing.length > 0) {
      reasons.push(`Missing accessibility features: ${missing.map((x) => x.replace(/_/g, ' ')).join(', ')}`);
    }
  }
  if (f.noGuarantorNeeded && !property.noGuarantorOption) reasons.push('Requires a guarantor');
  if (f.amenityBuilding) {
    const a = property.amenities;
    if (!(a.gym || a.studyRooms || a.rooftop)) reasons.push('No gym, study rooms or rooftop');
  }
  if (f.onGrounds === 'only' && !property.onGrounds) reasons.push('Not on Grounds');
  if (f.onGrounds === 'exclude' && property.onGrounds) reasons.push('On Grounds');
  if (f.studioOr1Br && fp.beds > 1) reasons.push(`Has ${fp.beds} bedrooms, not a studio or 1BR`);
  if (f.gradHeavy && !property.gradHeavy) reasons.push('Not grad-heavy');

  return { pass: reasons.length === 0, reasons };
}

export function applyFilters(listings: Listing[], filters: ListingFilters): Listing[] {
  return listings.filter((l) => passesFilters(l, filters).pass);
}

/** Number of active (defined, non-false, non-empty) filters, for the "Filters (3)" button. */
export function countActiveFilters(filters: ListingFilters): number {
  let n = 0;
  for (const value of Object.values(filters)) {
    if (value === undefined || value === null || value === false) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    n++;
  }
  return n;
}
