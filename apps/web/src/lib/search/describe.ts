// Human labels for active filters (chips above the list). Pure.
import { ACCESSIBILITY_FEATURE_LABELS, type ListingFilters } from '@homed/core';
import { money, shortDate } from '../format';
import { FILTER_LABELS } from './empty';
import { FILTER_KEYS } from './params';

const TERMS: Record<string, string> = {
  '12_month': '12-month lease',
  academic_year: 'Academic-year lease',
  semester: 'Semester lease',
  other: 'Other lease term',
};

/** Short chip text for one filter value, e.g. "Up to $1,200 per person". */
export function describeFilter(key: keyof ListingFilters, filters: ListingFilters): string {
  switch (key) {
    case 'maxCostPerPerson':
      return `Up to ${money(filters.maxCostPerPerson ?? 0)} per person`;
    case 'groupSize': {
      const n = filters.groupSize ?? 1;
      return n === 1 ? 'Studio or 1 bedroom' : `${n} bedrooms`;
    }
    case 'leaseType':
      return filters.leaseType === 'joint' ? 'Joint lease' : 'Individual lease';
    case 'termKind':
      return TERMS[filters.termKind ?? ''] ?? FILTER_LABELS.termKind;
    case 'moveInBy':
      return `Move in by ${shortDate(filters.moveInBy ?? '')}`;
    case 'noise':
      return filters.noise === 'quiet' ? 'Quiet building' : 'Social building';
    case 'onGrounds':
      return filters.onGrounds === 'only' ? 'On Grounds only' : 'Off Grounds only';
    case 'accessibilityFeatures':
      return (filters.accessibilityFeatures ?? []).map((f) => ACCESSIBILITY_FEATURE_LABELS[f]).join(', ');
    default:
      return FILTER_LABELS[key];
  }
}

/** Active filters in URL order, with chip text. */
export function activeFilterEntries(filters: ListingFilters): { key: keyof ListingFilters; label: string }[] {
  const out: { key: keyof ListingFilters; label: string }[] = [];
  for (const key of FILTER_KEYS) {
    const v = filters[key];
    if (v === undefined || v === null || v === false) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out.push({ key, label: describeFilter(key, filters) });
  }
  return out;
}
