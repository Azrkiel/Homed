import { describe, expect, it } from 'vitest';
import type { AlertEvent, Listing } from '@homed/core';
import { computeCatalogStats, median, waitingSignal } from '../../src/lib/search/stats';
import { eventListingHref, sortEventsNewestFirst, triggerLabel } from '../../src/lib/search/alerts';

function listing(pid: string, fid: string, rent: number, units: number | null, verified = '2026-10-01'): Listing {
  return {
    property: { id: pid, name: pid, lastVerified: verified, amenities: {} },
    floorPlan: {
      id: fid,
      propertyId: pid,
      name: fid,
      bedrooms: 1,
      bathrooms: 1,
      rentAmount: rent,
      rentBasis: 'per_bed',
      utilitiesIncluded: true,
      internetIncluded: true,
      furnished: true,
      unitsAvailable: units,
      lastVerified: verified,
    },
    photos: [],
  } as unknown as Listing;
}

describe('median', () => {
  it('handles empty, odd and even', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });
});

describe('computeCatalogStats', () => {
  it('handles zero listings', () => {
    const s = computeCatalogStats([]);
    expect(s).toMatchObject({ places: 0, floorPlans: 0, medianMonthly: null, lastVerified: null });
    expect(waitingSignal(s).tone).toBe('neutral');
  });
  it('counts open, full and unknown places', () => {
    const s = computeCatalogStats([
      listing('a', 'a1', 1000, 2),
      listing('a', 'a2', 1200, 0, '2026-10-10'),
      listing('b', 'b1', 900, 0),
      listing('c', 'c1', 1100, null),
    ]);
    expect(s).toMatchObject({ places: 3, floorPlans: 4, placesOpen: 1, placesFull: 1, placesUnknown: 1 });
    expect(s.floorPlansOpen).toBe(1);
    expect(s.floorPlansUnknown).toBe(1);
    expect(s.medianMonthly).toBe(1050);
    expect(s.lastVerified).toBe('2026-10-10');
  });
  it('signals', () => {
    const many = computeCatalogStats([listing('a', 'a1', 1000, 2), listing('b', 'b1', 900, 1)]);
    expect(waitingSignal(many).tone).toBe('good');
    expect(waitingSignal(many).text).toContain('2 of 2');
    const few = computeCatalogStats([listing('a', 'a1', 1000, 2), listing('b', 'b1', 900, 0), listing('c', 'c1', 900, 0)]);
    expect(waitingSignal(few).tone).toBe('warn');
    const none = computeCatalogStats([listing('b', 'b1', 900, 0)]);
    expect(waitingSignal(none).text).toContain('None of 1');
  });
});

describe('alert helpers', () => {
  const ev = (id: string, createdAt: string, extra: Partial<AlertEvent> = {}): AlertEvent => ({
    id,
    alertId: 'x',
    userId: 'u',
    trigger: 'price_drop',
    propertyId: 'a',
    message: 'm',
    createdAt,
    ...extra,
  });
  it('sorts newest first', () => {
    const sorted = sortEventsNewestFirst([ev('1', '2026-10-01T00:00:00Z'), ev('2', '2026-10-02T00:00:00Z')]);
    expect(sorted.map((e) => e.id)).toEqual(['2', '1']);
  });
  it('resolves listing href', () => {
    const ls = [listing('a', 'a1', 1000, 1)];
    expect(eventListingHref(ev('1', 'z', { floorPlanId: 'q' }), ls)).toBe('/listings/q');
    expect(eventListingHref(ev('1', 'z'), ls)).toBe('/listings/a1');
    expect(eventListingHref(ev('1', 'z', { propertyId: 'nope' }), ls)).toBeNull();
  });
  it('labels', () => {
    expect(triggerLabel('few_left')).toBe('Few left');
  });
});
