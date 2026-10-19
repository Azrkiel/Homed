// Explains an empty result: which single filter removes the most listings.
import { passesFilters, type Listing, type ListingFilters } from '@homed/core';
import { FILTER_KEYS } from './params';

export const FILTER_LABELS: Record<keyof ListingFilters, string> = {
  maxCostPerPerson: 'Max cost per person',
  groupSize: 'Group size',
  privateBathroom: 'Private bathroom',
  leaseType: 'Lease type',
  termKind: 'Lease term',
  moveInBy: 'Move-in by',
  studyAbroadFriendly: 'Study-abroad friendly',
  furnished: 'Furnished',
  utilitiesIncluded: 'Utilities included',
  onBusRoute: 'On a bus route',
  parkingAvailable: 'Parking available',
  inUnitLaundry: 'In-unit laundry',
  dishwasher: 'Dishwasher',
  ac: 'Air conditioning',
  noise: 'Noise level',
  litRoute: 'Lit route to Grounds',
  petsAllowed: 'Pets allowed',
  accommodationFriendly: 'Accommodation-friendly',
  accessibilityFeatures: 'Accessibility features',
  noGuarantorNeeded: 'No guarantor needed',
  amenityBuilding: 'Gym, study rooms or rooftop',
  onGrounds: 'Location (On or off Grounds)',
  studioOr1Br: 'Studio or 1 bedroom',
  gradHeavy: 'Grad-heavy building',
};

export interface EmptyExplanation {
  key: keyof ListingFilters;
  /** Listings this filter alone removes. */
  removed: number;
  /** One reason string from passesFilters for a listing it removes. */
  example: string;
}

function isActive(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/**
 * For each active filter alone, count the listings it fails. Returns the filter that removes the most,
 * with one example reason. Null when no filters are active, or when no single filter removes anything
 * (e.g. the catalog is empty). Ties go to the earlier field in FILTER_KEYS.
 */
export function explainEmpty(listings: Listing[], filters: ListingFilters): EmptyExplanation | null {
  let best: EmptyExplanation | null = null;
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (!isActive(value)) continue;
    const alone = { [key]: value } as ListingFilters;
    let removed = 0;
    let example = '';
    for (const listing of listings) {
      const result = passesFilters(listing, alone);
      if (result.pass) continue;
      removed++;
      example ||= result.reasons[0] ?? '';
    }
    if (removed > 0 && (best === null || removed > best.removed)) {
      best = { key, removed, example };
    }
  }
  return best;
}
