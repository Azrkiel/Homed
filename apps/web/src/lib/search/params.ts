// ListingFilters <-> URL query codec, plus the sort option. Invalid or unknown params are dropped, never thrown.
import type { AccessibilityFeature, ListingFilters, MatchScore, RankedListing } from '@homed/core';

export type ParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;
export type SortKey = 'match' | 'price' | 'walk';

const ACCESSIBILITY_FEATURES = [
  'step_free_entrance', 'elevator', 'ground_floor_units', 'wide_doorways', 'roll_in_shower', 'grab_bars',
  'flashing_alarms', 'quiet_units', 'private_bathroom', 'kitchen_access', 'gender_inclusive_units',
  'kosher_halal_kitchen',
] as const satisfies readonly AccessibilityFeature[];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Codec<T> {
  param: string;
  encode(value: T): string | undefined;
  decode(raw: string): T | undefined;
}

function boolCodec(param: string): Codec<boolean> {
  return {
    param,
    encode: (v) => (v ? '1' : undefined),
    decode: (raw) => (raw === '1' || raw === 'true' ? true : undefined),
  };
}

function numberCodec(param: string, valid: (n: number) => boolean): Codec<number> {
  return {
    param,
    encode: (v) => String(v),
    decode: (raw) => {
      if (raw.trim() === '') return undefined;
      const n = Number(raw);
      return Number.isFinite(n) && valid(n) ? n : undefined;
    },
  };
}

function enumCodec<T extends string>(param: string, allowed: readonly T[]): Codec<T> {
  return {
    param,
    encode: (v) => v,
    decode: (raw) => (allowed.includes(raw as T) ? (raw as T) : undefined),
  };
}

function dateCodec(param: string): Codec<string> {
  return {
    param,
    encode: (v) => v,
    decode: (raw) => {
      if (!ISO_DATE.test(raw)) return undefined;
      const [y, m, d] = raw.split('-').map(Number) as [number, number, number];
      const check = new Date(Date.UTC(y, m - 1, d));
      const valid = check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
      return valid ? raw : undefined;
    },
  };
}

const featureList: Codec<AccessibilityFeature[]> = {
  param: 'a11y',
  encode: (v) => (v.length > 0 ? v.join(',') : undefined),
  decode: (raw) => {
    const known = new Set<string>(ACCESSIBILITY_FEATURES);
    const picked = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is AccessibilityFeature => known.has(s));
    const unique = [...new Set(picked)];
    return unique.length > 0 ? unique : undefined;
  },
};

/** One codec per ListingFilters field. The mapped type makes a missing field a compile error. */
const CODECS: { [K in keyof ListingFilters]-?: Codec<NonNullable<ListingFilters[K]>> } = {
  maxCostPerPerson: numberCodec('max', (n) => n >= 0),
  groupSize: numberCodec('size', (n) => Number.isInteger(n) && n >= 1),
  privateBathroom: boolCodec('bath'),
  leaseType: enumCodec('lease', ['individual', 'joint'] as const),
  termKind: enumCodec('term', ['12_month', 'academic_year', 'semester', 'other'] as const),
  moveInBy: dateCodec('movein'),
  studyAbroadFriendly: boolCodec('abroad'),
  furnished: boolCodec('furnished'),
  utilitiesIncluded: boolCodec('utils'),
  onBusRoute: boolCodec('bus'),
  parkingAvailable: boolCodec('parking'),
  inUnitLaundry: boolCodec('laundry'),
  dishwasher: boolCodec('dishwasher'),
  ac: boolCodec('ac'),
  noise: enumCodec('noise', ['quiet', 'social'] as const),
  litRoute: boolCodec('lit'),
  petsAllowed: boolCodec('pets'),
  accommodationFriendly: boolCodec('accom'),
  accessibilityFeatures: featureList,
  noGuarantorNeeded: boolCodec('noguar'),
  amenityBuilding: boolCodec('amenity'),
  onGrounds: enumCodec('grounds', ['only', 'exclude'] as const),
  studioOr1Br: boolCodec('studio'),
  gradHeavy: boolCodec('grad'),
};

/** Every ListingFilters field, in URL order. */
export const FILTER_KEYS = Object.keys(CODECS) as (keyof ListingFilters)[];

/** URL param name for each filter field. */
export const FILTER_PARAMS = Object.fromEntries(
  FILTER_KEYS.map((k) => [k, CODECS[k].param]),
) as Record<keyof ListingFilters, string>;

export const SORT_KEYS = ['match', 'price', 'walk'] as const satisfies readonly SortKey[];

function getParam(p: ParamsInput, name: string): string | undefined {
  if (p instanceof URLSearchParams) return p.get(name) ?? undefined;
  const v = p[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Reads filters from a query. Undefined fields are omitted. Never throws. */
export function filtersFromParams(p: ParamsInput): ListingFilters {
  const out: Record<string, unknown> = {};
  for (const key of FILTER_KEYS) {
    const raw = getParam(p, CODECS[key].param);
    if (raw === undefined) continue;
    const value = (CODECS[key] as Codec<unknown>).decode(raw);
    if (value !== undefined) out[key] = value;
  }
  return out as ListingFilters;
}

/** Writes filters to a query. Undefined and false fields are omitted. */
export function filtersToParams(f: ListingFilters): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = f[key];
    if (value === undefined) continue;
    const encoded = (CODECS[key] as Codec<unknown>).encode(value);
    if (encoded !== undefined) out.set(CODECS[key].param, encoded);
  }
  return out;
}

/** Reads the `sort` param. Default 'match'. */
export function sortFromParams(p: ParamsInput): SortKey {
  const raw = getParam(p, 'sort');
  return (SORT_KEYS as readonly string[]).includes(raw ?? '') ? (raw as SortKey) : 'match';
}

/** Average one-way minutes for the walk sort. Class trips first, then extras. Infinity = no walk data. */
function walkMinutes(score: MatchScore): number {
  const c = score.commute;
  if (c.earliestClassMinutes !== null) return c.averageMinutes;
  if (c.extras.length > 0) return c.extras.reduce((s, e) => s + e.minutes, 0) / c.extras.length;
  return Number.POSITIVE_INFINITY;
}

/** Returns a sorted copy. match keeps input order; price ascending monthly total; walk ascending commute. Stable. */
export function sortRanked(ranked: RankedListing[], sort: SortKey): RankedListing[] {
  const copy = [...ranked];
  if (sort === 'price') return copy.sort((a, b) => a.score.cost.totalMonthly - b.score.cost.totalMonthly);
  if (sort === 'walk') {
    const key = (r: RankedListing) => walkMinutes(r.score);
    return copy.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka === kb) return 0;
      return ka < kb ? -1 : 1;
    });
  }
  return copy;
}
