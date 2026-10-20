// Builds /search URLs. Pure.
import type { ListingFilters, WeightPreset } from '@homed/core';
import { filtersToParams, type SortKey } from './params';

export interface SearchHrefOptions {
  sort?: SortKey;
  /** Signed-out weight preset (`preset=<key>`). */
  preset?: WeightPreset | null;
}

/** "/search?max=1200&sort=price". The default sort (match) is omitted. */
export function searchHref(filters: ListingFilters, opts: SearchHrefOptions = {}): string {
  const params = filtersToParams(filters);
  if (opts.sort && opts.sort !== 'match') params.set('sort', opts.sort);
  if (opts.preset) params.set('preset', opts.preset);
  const qs = params.toString();
  return qs ? `/search?${qs}` : '/search';
}

/** Copy of `filters` without one field. */
export function withoutFilter(filters: ListingFilters, key: keyof ListingFilters): ListingFilters {
  const copy = { ...filters };
  delete copy[key];
  return copy;
}
