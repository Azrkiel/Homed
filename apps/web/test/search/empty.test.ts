import { describe, expect, it } from 'vitest';
import type { AccessibilityInfo, FloorPlan, Listing, ListingFilters, Property } from '@homed/core';
import { FILTER_LABELS, explainEmpty } from '../../src/lib/search/empty';

function listing(f: Partial<FloorPlan> = {}, p: Partial<Property> = {}, acc?: AccessibilityInfo): Listing {
  const property = {
    id: 'p1', slug: 'p1', name: 'P', address: '1 Main', location: { lat: 38, lng: -78 },
    kind: 'apartment_complex', onGrounds: false, neighborhood: 'Corner',
    amenities: { gym: false, studyRooms: false, rooftop: false, pool: false, elevator: false, parkingAvailable: false, petsAllowed: false },
    onBusRoute: false, busRoutes: [], studyAbroadFriendly: false, noGuarantorOption: false,
    source: 'test', dataStatus: 'verified', lastVerified: '2026-10-19', ...p,
  } as Property;
  const floorPlan = {
    id: 'fp1', propertyId: 'p1', name: '4BR', beds: 4, baths: 4, rentAmount: 3200, rentBasis: 'per_unit',
    leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month', leaseType: 'individual',
    furnished: true, utilitiesIncluded: true, internetIncluded: true, inUnitLaundry: true,
    dishwasher: true, ac: true, unitsAvailable: 2, lastVerified: '2026-10-19', ...f,
  } as FloorPlan;
  const l: Listing = { property, floorPlan, photos: [] };
  if (acc) l.accessibility = acc;
  return l;
}

describe('explainEmpty', () => {
  it('null when no filters are active', () => {
    expect(explainEmpty([listing()], {})).toBeNull();
    expect(explainEmpty([listing()], { furnished: false, ac: undefined })).toBeNull();
  });

  it('null when no single filter removes anything', () => {
    expect(explainEmpty([listing()], { ac: true })).toBeNull();
  });

  it('names the filter that removes the most listings', () => {
    const listings = [
      listing({ rentAmount: 6000 }), // $1500/person, over budget
      listing({ rentAmount: 6400 }), // $1600/person, over budget
      listing({ ac: false }), // no AC
    ];
    const filters: ListingFilters = { maxCostPerPerson: 1000, ac: true };
    const result = explainEmpty(listings, filters);
    expect(result).not.toBeNull();
    expect(result?.key).toBe('maxCostPerPerson');
    expect(result?.removed).toBe(2);
    expect(result?.example).toBe('Over budget by $500');
  });

  it('counts a filter alone, ignoring the others', () => {
    const listings = [listing({ ac: false }), listing({ ac: false, furnished: false })];
    const result = explainEmpty(listings, { ac: true, furnished: true });
    expect(result?.key).toBe('ac');
    expect(result?.removed).toBe(2);
  });

  it('example comes from passesFilters for a failing listing', () => {
    const result = explainEmpty([listing({ furnished: false })], { furnished: true });
    expect(result).toEqual({ key: 'furnished', removed: 1, example: 'Not furnished' });
  });

  it('null for an empty catalog', () => {
    expect(explainEmpty([], { ac: true })).toBeNull();
  });
});

describe('FILTER_LABELS', () => {
  it('has a human label for the cost filter', () => {
    expect(FILTER_LABELS.maxCostPerPerson).toBe('Max cost per person');
  });
  it('has a non-empty label for every filter key', () => {
    for (const label of Object.values(FILTER_LABELS)) expect(label.trim().length).toBeGreaterThan(0);
    expect(Object.keys(FILTER_LABELS)).toHaveLength(24);
  });
});
