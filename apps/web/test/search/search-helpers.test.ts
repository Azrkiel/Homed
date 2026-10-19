import { describe, expect, it } from 'vitest';
import { WEIGHT_PRESETS, type MatchScore, type RankedListing } from '@homed/core';
import { searchHref, withoutFilter } from '../../src/lib/search/href';
import { filtersFromParams } from '../../src/lib/search/params';
import { matchPreset, presetFromParam } from '../../src/lib/search/presets';
import { activeFilterEntries, describeFilter } from '../../src/lib/search/describe';
import { hasWalkData, propertyMarkers } from '../../src/lib/search/results';

function ranked(propertyId: string, fpId: string, total: number, price: number, extra: { onGrounds?: boolean; lat?: number } = {}): RankedListing {
  return {
    listing: {
      property: {
        id: propertyId, name: `Prop ${propertyId}`, location: { lat: extra.lat ?? 38.03, lng: -78.5 },
        onGrounds: extra.onGrounds ?? false, kind: extra.onGrounds ? 'on_grounds' : 'apartment_complex',
      },
      floorPlan: { id: fpId, name: `Plan ${fpId}` },
      photos: [],
    } as unknown as RankedListing['listing'],
    score: { total, cost: { totalMonthly: price }, commute: { earliestClassMinutes: null, extras: [] } } as unknown as MatchScore,
  };
}

describe('searchHref', () => {
  it('returns /search with no params', () => expect(searchHref({})).toBe('/search'));
  it('omits default sort, keeps others and preset', () => {
    expect(searchHref({ maxCostPerPerson: 900 }, { sort: 'match' })).toBe('/search?max=900');
    expect(searchHref({ maxCostPerPerson: 900 }, { sort: 'price', preset: 'budget_first' })).toBe(
      '/search?max=900&sort=price&preset=budget_first',
    );
  });
  it('withoutFilter removes one field only', () => {
    expect(withoutFilter({ maxCostPerPerson: 900, ac: true }, 'ac')).toEqual({ maxCostPerPerson: 900 });
  });
  it('round-trips through filtersFromParams', () => {
    const f = { maxCostPerPerson: 900, onGrounds: 'only' as const, accessibilityFeatures: ['elevator' as const] };
    const url = new URL(searchHref(f), 'http://x');
    expect(filtersFromParams(url.searchParams)).toEqual(f);
  });
});

describe('presets', () => {
  it('validates preset params', () => {
    expect(presetFromParam('budget_first')).toBe('budget_first');
    expect(presetFromParam(['nicest_place', 'x'])).toBe('nicest_place');
    expect(presetFromParam('toString')).toBeUndefined();
    expect(presetFromParam(undefined)).toBeUndefined();
  });
  it('matches weights to a preset or custom', () => {
    expect(matchPreset(WEIGHT_PRESETS.close_to_class.weights)).toBe('close_to_class');
    expect(matchPreset({ price: 4, location: 4, looks: 2 })).toBe('balanced');
    expect(matchPreset({ price: 0.7, location: 0.2, looks: 0.1 })).toBe('custom');
  });
});

describe('describe', () => {
  it('describes values', () => {
    expect(describeFilter('maxCostPerPerson', { maxCostPerPerson: 1250 })).toBe('Up to $1,250 per person');
    expect(describeFilter('onGrounds', { onGrounds: 'exclude' })).toBe('Off Grounds only');
    expect(describeFilter('ac', { ac: true })).toBe('Air conditioning');
    expect(describeFilter('moveInBy', { moveInBy: '2027-08-15' })).toBe('Move in by Aug 15, 2027');
    expect(describeFilter('accessibilityFeatures', { accessibilityFeatures: ['elevator'] })).toMatch(/lift|elevator/i);
  });
  it('lists active entries and skips false and empty', () => {
    const entries = activeFilterEntries({ ac: true, dishwasher: false, accessibilityFeatures: [] });
    expect(entries.map((e) => e.key)).toEqual(['ac']);
  });
});

describe('results', () => {
  it('picks the best score per property and the lowest price', () => {
    const markers = propertyMarkers([
      ranked('p1', 'a', 70, 900),
      ranked('p1', 'b', 85, 1100),
      ranked('p2', 'c', 60, 700, { onGrounds: true }),
    ]);
    expect(markers).toHaveLength(2);
    const p1 = markers.find((m) => m.propertyId === 'p1');
    expect(p1).toMatchObject({ score: 85, fromPrice: 900, href: '/listings/b' });
    expect(markers.find((m) => m.propertyId === 'p2')?.onGrounds).toBe(true);
  });
  it('breaks score ties toward the cheaper plan and skips bad coordinates', () => {
    const markers = propertyMarkers([ranked('p1', 'a', 80, 1000), ranked('p1', 'b', 80, 900), ranked('p3', 'z', 50, 500, { lat: NaN })]);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.href).toBe('/listings/b');
  });
  it('detects walk data', () => {
    const base = { commute: { earliestClassMinutes: null, extras: [] } } as unknown as MatchScore;
    expect(hasWalkData(base)).toBe(false);
    expect(hasWalkData({ commute: { earliestClassMinutes: 9, extras: [] } } as unknown as MatchScore)).toBe(true);
    expect(hasWalkData({ commute: { earliestClassMinutes: null, extras: [{ landmarkId: 'x', minutes: 5 }] } } as unknown as MatchScore)).toBe(true);
  });
});
