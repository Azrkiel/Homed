import type { ListingFilters, Listing } from './types';
import { notImplemented } from './not-implemented';

export interface FilterResult {
  pass: boolean;
  /** Human-readable reasons a listing failed, e.g. "Over budget by $120". */
  reasons: string[];
}

/** Hard filters from the Best Match spec: budget (all-in cost), bedroom count = group size, move-in date. */
export function passesHardFilters(listing: Listing, filters: ListingFilters): FilterResult {
  return notImplemented('passesHardFilters');
}

/** Every filter in ListingFilters (hard + soft). An undefined filter field is ignored. */
export function passesFilters(listing: Listing, filters: ListingFilters): FilterResult {
  return notImplemented('passesFilters');
}

export function applyFilters(listings: Listing[], filters: ListingFilters): Listing[] {
  return notImplemented('applyFilters');
}

/** Number of active (defined, non-false, non-empty) filters, for the "Filters (3)" button. */
export function countActiveFilters(filters: ListingFilters): number {
  return notImplemented('countActiveFilters');
}

