import { describe, expect, it } from 'vitest';
import type { ListingFilters, MatchScore, RankedListing } from '@homed/core';
import {
  FILTER_KEYS,
  filtersFromParams,
  filtersToParams,
  sortFromParams,
  sortRanked,
} from '../../src/lib/search/params';

const FULL: ListingFilters = {
  maxCostPerPerson: 1400,
  groupSize: 3,
  privateBathroom: true,
  leaseType: 'individual',
  termKind: '12_month',
  moveInBy: '2027-08-15',
  studyAbroadFriendly: true,
  furnished: true,
  utilitiesIncluded: true,
  onBusRoute: true,
  parkingAvailable: true,
  inUnitLaundry: true,
  dishwasher: true,
  ac: true,
  noise: 'quiet',
  litRoute: true,
  petsAllowed: true,
  accommodationFriendly: true,
  accessibilityFeatures: ['step_free_entrance', 'elevator'],
  noGuarantorNeeded: true,
  amenityBuilding: true,
  onGrounds: 'exclude',
  studioOr1Br: true,
  gradHeavy: true,
};

function fake(total: number, avg: number | undefined, extras: number[] = []): RankedListing {
  const commute = {
    weeklyMinutes: 0,
    averageMinutes: avg ?? 0,
    earliestClassMinutes: avg ?? null,
    usesBus: false,
    extras: extras.map((minutes, i) => ({ landmarkId: `l${i}`, minutes })),
  };
  const score = { total: 0, cost: { totalMonthly: total }, commute } as unknown as MatchScore;
  return { listing: {} as RankedListing['listing'], score };
}

describe('FILTER_KEYS', () => {
  it('lists every ListingFilters field', () => {
    expect([...FILTER_KEYS].sort()).toEqual(Object.keys(FULL).sort());
  });
});

describe('filters round trip', () => {
  it('every field set survives filtersFromParams(filtersToParams(f))', () => {
    expect(filtersFromParams(filtersToParams(FULL))).toEqual(FULL);
  });
  it('empty filters round trip to empty', () => {
    expect(filtersFromParams(filtersToParams({}))).toEqual({});
    expect(filtersToParams({}).toString()).toBe('');
  });
  it('undefined and false fields are omitted', () => {
    const params = filtersToParams({ furnished: false, ac: undefined, maxCostPerPerson: 900 });
    expect(params.toString()).toBe('max=900');
  });
  it('booleans encode as 1', () => {
    expect(filtersToParams({ petsAllowed: true }).get('pets')).toBe('1');
  });
  it('uses short readable param names', () => {
    const params = filtersToParams(FULL);
    expect(params.get('max')).toBe('1400');
    expect(params.get('movein')).toBe('2027-08-15');
    expect(params.get('a11y')).toBe('step_free_entrance,elevator');
  });
});

describe('filtersFromParams', () => {
  it('reads URLSearchParams', () => {
    expect(filtersFromParams(new URLSearchParams('max=1200&noise=social&ac=1'))).toEqual({
      maxCostPerPerson: 1200,
      noise: 'social',
      ac: true,
    });
  });
  it('reads a Next.js searchParams record, taking the first of repeated values', () => {
    expect(filtersFromParams({ max: ['900', '1000'], bath: '1', size: undefined })).toEqual({
      maxCostPerPerson: 900,
      privateBathroom: true,
    });
  });
  it('drops invalid and unknown values without throwing', () => {
    const f = filtersFromParams(
      new URLSearchParams(
        'max=abc&size=-1&lease=weird&term=forever&movein=2027-02-30&noise=loud&grounds=both&a11y=elevator,bogus&ac=0&nope=1',
      ),
    );
    expect(f).toEqual({ accessibilityFeatures: ['elevator'] });
  });
  it('rejects non-ISO dates', () => {
    expect(filtersFromParams(new URLSearchParams('movein=08/15/2027'))).toEqual({});
  });
  it('drops an accessibility list with no valid features', () => {
    expect(filtersFromParams(new URLSearchParams('a11y=bogus'))).toEqual({});
  });
  it('accepts group size as a positive integer only', () => {
    expect(filtersFromParams(new URLSearchParams('size=4'))).toEqual({ groupSize: 4 });
    expect(filtersFromParams(new URLSearchParams('size=2.5'))).toEqual({});
  });
});

describe('sortFromParams', () => {
  it('defaults to match', () => {
    expect(sortFromParams(new URLSearchParams(''))).toBe('match');
  });
  it('reads price and walk, ignores anything else', () => {
    expect(sortFromParams(new URLSearchParams('sort=price'))).toBe('price');
    expect(sortFromParams(new URLSearchParams('sort=walk'))).toBe('walk');
    expect(sortFromParams({ sort: 'random' })).toBe('match');
  });
});

describe('sortRanked', () => {
  const a = fake(1000, 12);
  const b = fake(800, 20);
  const c = fake(900, undefined);
  const d = fake(700, 5);

  it('match keeps input order', () => {
    expect(sortRanked([a, b, c, d], 'match')).toEqual([a, b, c, d]);
  });
  it('price is ascending monthly total', () => {
    expect(sortRanked([a, b, c, d], 'price')).toEqual([d, b, c, a]);
  });
  it('walk is ascending average minutes, no walk data last', () => {
    expect(sortRanked([a, b, c, d], 'walk')).toEqual([d, a, b, c]);
  });
  it('walk falls back to extras when there are no class trips', () => {
    const near = fake(900, undefined, [4]);
    const far = fake(900, undefined, [25]);
    expect(sortRanked([far, a, near], 'walk')).toEqual([near, a, far]);
  });
  it('does not mutate the input', () => {
    const input = [a, b];
    sortRanked(input, 'price');
    expect(input).toEqual([a, b]);
  });
});
