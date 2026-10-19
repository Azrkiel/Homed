import { describe, expect, it } from 'vitest';
import { applyFilters, countActiveFilters, passesFilters, passesHardFilters } from '../src/filters';
import type { AccessibilityInfo, FloorPlan, Listing, ListingFilters, Property } from '../src/types';

function fp(over: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'fp1', propertyId: 'p1', name: '4BR', beds: 4, baths: 4, rentAmount: 3200, rentBasis: 'per_unit',
    leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month', leaseType: 'individual',
    furnished: true, utilitiesIncluded: true, internetIncluded: true, inUnitLaundry: true,
    dishwasher: true, ac: true, unitsAvailable: 2, lastVerified: '2026-10-19', ...over,
  };
}
function prop(over: Partial<Property> = {}, amenities: Partial<Property['amenities']> = {}): Property {
  return {
    id: 'p1', slug: 'p1', name: 'P', address: '1 Main', location: { lat: 38, lng: -78 },
    kind: 'apartment_complex', onGrounds: false, neighborhood: 'Corner',
    amenities: {
      gym: false, studyRooms: false, rooftop: false, pool: false, elevator: false,
      parkingAvailable: false, petsAllowed: false, ...amenities,
    },
    onBusRoute: false, busRoutes: [], studyAbroadFriendly: false, noGuarantorOption: false,
    source: 'test', dataStatus: 'verified', lastVerified: '2026-10-19', ...over,
  } as Property;
}
function listing(
  f: Partial<FloorPlan> = {},
  p: Partial<Property> = {},
  a: Partial<Property['amenities']> = {},
  accessibility?: AccessibilityInfo,
): Listing {
  const l: Listing = { property: prop(p, a), floorPlan: fp(f), photos: [] };
  if (accessibility) l.accessibility = accessibility;
  return l;
}
function acc(over: Partial<AccessibilityInfo> = {}): AccessibilityInfo {
  return {
    propertyId: 'p1', features: ['step_free_entrance', 'elevator'], photoConfirmed: [],
    accommodationContact: 'Dana', accommodationProcess: 'Email us.',
    assistanceAnimals: { serviceAnimalsAllowed: true, esaAllowed: true, noFees: true },
    updatedAt: '2026-10-01', ...over,
  };
}

/** Default listing costs $800 all-in per person (3200 / 4). */
function check(l: Listing, filters: ListingFilters, reason?: string) {
  const r = passesFilters(l, filters);
  if (reason === undefined) {
    expect(r).toEqual({ pass: true, reasons: [] });
  } else {
    expect(r.pass).toBe(false);
    expect(r.reasons).toEqual([reason]);
  }
}

describe('passesHardFilters', () => {
  it('empty filters pass', () => expect(passesHardFilters(listing(), {})).toEqual({ pass: true, reasons: [] }));
  it('budget pass (equal)', () => expect(passesHardFilters(listing(), { maxCostPerPerson: 800 }).pass).toBe(true));
  it('budget fail', () =>
    expect(passesHardFilters(listing({ rentAmount: 3680 }), { maxCostPerPerson: 800 })).toEqual({
      pass: false, reasons: ['Over budget by $120'],
    }));
  it('budget counts utilities and furniture, not parking', () => {
    const l = listing(
      { utilitiesIncluded: false, utilitiesEstimate: 60, furnished: false, furnitureMonthly: 40 },
      {}, { parkingAvailable: true, parkingMonthly: 100 },
    );
    expect(passesHardFilters(l, { maxCostPerPerson: 900 }).pass).toBe(true);
    expect(passesHardFilters(l, { maxCostPerPerson: 850 }).reasons).toEqual(['Over budget by $50']);
  });
  it('group size pass', () => expect(passesHardFilters(listing(), { groupSize: 4 }).pass).toBe(true));
  it('group size fail', () =>
    expect(passesHardFilters(listing({ beds: 3, baths: 3 }), { groupSize: 4 })).toEqual({
      pass: false, reasons: ['Has 3 bedrooms, group needs 4'],
    }));
  it('studio counts as 1 person', () =>
    expect(passesHardFilters(listing({ beds: 0, baths: 1 }), { groupSize: 1 }).pass).toBe(true));
  it('singular bedroom wording', () =>
    expect(passesHardFilters(listing({ beds: 1, baths: 1 }), { groupSize: 2 }).reasons).toEqual([
      'Has 1 bedroom, group needs 2',
    ]));
  it('move-in pass (same day)', () =>
    expect(passesHardFilters(listing(), { moveInBy: '2027-08-15' }).pass).toBe(true));
  it('move-in fail', () =>
    expect(passesHardFilters(listing({ leaseStart: '2027-08-25' }), { moveInBy: '2027-08-15' })).toEqual({
      pass: false, reasons: ['Lease starts Aug 25, after Aug 15'],
    }));
  it('collects multiple reasons', () => {
    const r = passesHardFilters(
      listing({ rentAmount: 3680, beds: 3, leaseStart: '2027-09-01' }),
      { maxCostPerPerson: 800, groupSize: 4, moveInBy: '2027-08-15' },
    );
    expect(r.pass).toBe(false);
    expect(r.reasons).toHaveLength(3);
  });
  it('ignores soft filters', () =>
    expect(passesHardFilters(listing({ furnished: false }), { furnished: true }).pass).toBe(true));
});

describe('passesFilters: hard filters included', () => {
  it('budget fail', () => check(listing({ rentAmount: 3680 }), { maxCostPerPerson: 800 }, 'Over budget by $120'));
  it('group size fail', () => check(listing({ beds: 3 }), { groupSize: 4 }, 'Has 3 bedrooms, group needs 4'));
  it('move-in fail', () =>
    check(listing({ leaseStart: '2027-08-25' }), { moveInBy: '2027-08-15' }, 'Lease starts Aug 25, after Aug 15'));
});

describe('passesFilters: soft filters (pass and fail)', () => {
  it('privateBathroom pass', () => check(listing(), { privateBathroom: true }));
  it('privateBathroom fail', () => check(listing({ baths: 2 }), { privateBathroom: true }, 'No private bathroom'));
  it('leaseType pass', () => check(listing(), { leaseType: 'individual' }));
  it('leaseType fail', () => check(listing(), { leaseType: 'joint' }, 'Individual lease, not joint'));
  it('termKind pass', () => check(listing(), { termKind: '12_month' }));
  it('termKind fail', () =>
    check(listing(), { termKind: 'academic_year' }, 'Lease term is 12 month, not academic year'));
  it('studyAbroadFriendly pass', () =>
    check(listing({}, { studyAbroadFriendly: true }), { studyAbroadFriendly: true }));
  it('studyAbroadFriendly fail', () =>
    check(listing(), { studyAbroadFriendly: true }, 'Not study-abroad friendly'));
  it('furnished pass', () => check(listing(), { furnished: true }));
  it('furnished fail', () => check(listing({ furnished: false }), { furnished: true }, 'Not furnished'));
  it('utilitiesIncluded pass', () => check(listing(), { utilitiesIncluded: true }));
  it('utilitiesIncluded fail', () =>
    check(listing({ utilitiesIncluded: false }), { utilitiesIncluded: true }, 'Utilities not included'));
  it('onBusRoute pass', () => check(listing({}, { onBusRoute: true }), { onBusRoute: true }));
  it('onBusRoute fail', () => check(listing(), { onBusRoute: true }, 'Not on a bus route'));
  it('parkingAvailable pass', () =>
    check(listing({}, {}, { parkingAvailable: true }), { parkingAvailable: true }));
  it('parkingAvailable fail', () => check(listing(), { parkingAvailable: true }, 'No parking available'));
  it('inUnitLaundry pass', () => check(listing(), { inUnitLaundry: true }));
  it('inUnitLaundry fail', () =>
    check(listing({ inUnitLaundry: false }), { inUnitLaundry: true }, 'No in-unit laundry'));
  it('dishwasher pass', () => check(listing(), { dishwasher: true }));
  it('dishwasher fail', () => check(listing({ dishwasher: false }), { dishwasher: true }, 'No dishwasher'));
  it('ac pass', () => check(listing(), { ac: true }));
  it('ac fail', () => check(listing({ ac: false }), { ac: true }, 'No air conditioning'));
  it('noise quiet pass', () => check(listing({}, { noiseLevel: 'quiet' }), { noise: 'quiet' }));
  it('noise quiet fail', () =>
    check(listing({}, { noiseLevel: 'social' }), { noise: 'quiet' }, 'Not a quiet building'));
  it('noise quiet fails when moderate', () =>
    check(listing({}, { noiseLevel: 'moderate' }), { noise: 'quiet' }, 'Not a quiet building'));
  it('noise social pass', () => check(listing({}, { noiseLevel: 'social' }), { noise: 'social' }));
  it('noise social fail (unknown level)', () => check(listing(), { noise: 'social' }, 'Not a social building'));
  it('litRoute pass', () => check(listing({}, { litRouteToGrounds: true }), { litRoute: true }));
  it('litRoute fail', () => check(listing(), { litRoute: true }, 'No lit walking route to Grounds'));
  it('petsAllowed pass', () => check(listing({}, {}, { petsAllowed: true }), { petsAllowed: true }));
  it('petsAllowed fail', () => check(listing(), { petsAllowed: true }, 'Pets not allowed'));
  it('accommodationFriendly pass', () => check(listing({}, {}, {}, acc()), { accommodationFriendly: true }));
  it('accommodationFriendly fail', () =>
    check(listing(), { accommodationFriendly: true }, 'Not accommodation-friendly'));
  it('accessibilityFeatures pass', () =>
    check(listing({}, {}, {}, acc()), { accessibilityFeatures: ['elevator', 'step_free_entrance'] }));
  it('accessibilityFeatures fail lists missing ones', () =>
    check(
      listing({}, {}, {}, acc()),
      { accessibilityFeatures: ['elevator', 'roll_in_shower', 'grab_bars'] },
      'Missing accessibility features: roll in shower, grab bars',
    ));
  it('accessibilityFeatures fail with no info', () =>
    check(listing(), { accessibilityFeatures: ['elevator'] }, 'Missing accessibility features: elevator'));
  it('noGuarantorNeeded pass', () =>
    check(listing({}, { noGuarantorOption: true }), { noGuarantorNeeded: true }));
  it('noGuarantorNeeded fail', () => check(listing(), { noGuarantorNeeded: true }, 'Requires a guarantor'));
  it('amenityBuilding pass (gym)', () => check(listing({}, {}, { gym: true }), { amenityBuilding: true }));
  it('amenityBuilding pass (rooftop)', () => check(listing({}, {}, { rooftop: true }), { amenityBuilding: true }));
  it('amenityBuilding pass (study rooms)', () =>
    check(listing({}, {}, { studyRooms: true }), { amenityBuilding: true }));
  it('amenityBuilding fail (pool only)', () =>
    check(listing({}, {}, { pool: true }), { amenityBuilding: true }, 'No gym, study rooms or rooftop'));
  it('onGrounds only pass', () => check(listing({}, { onGrounds: true }), { onGrounds: 'only' }));
  it('onGrounds only fail', () => check(listing(), { onGrounds: 'only' }, 'Not on Grounds'));
  it('onGrounds exclude pass', () => check(listing(), { onGrounds: 'exclude' }));
  it('onGrounds exclude fail', () =>
    check(listing({}, { onGrounds: true }), { onGrounds: 'exclude' }, 'On Grounds'));
  it('studioOr1Br pass (studio)', () => check(listing({ beds: 0, baths: 1 }), { studioOr1Br: true }));
  it('studioOr1Br pass (1BR)', () => check(listing({ beds: 1, baths: 1 }), { studioOr1Br: true }));
  it('studioOr1Br fail', () =>
    check(listing(), { studioOr1Br: true }, 'Has 4 bedrooms, not a studio or 1BR'));
  it('gradHeavy pass', () => check(listing({}, { gradHeavy: true }), { gradHeavy: true }));
  it('gradHeavy fail', () => check(listing(), { gradHeavy: true }, 'Not grad-heavy'));
});

describe('passesFilters: edge cases', () => {
  it('false and undefined booleans are ignored', () =>
    check(listing({ ac: false, furnished: false }), { ac: false, furnished: undefined }));
  it('empty accessibilityFeatures ignored', () => check(listing(), { accessibilityFeatures: [] }));
  it('multiple failures accumulate', () => {
    const r = passesFilters(listing({ ac: false, dishwasher: false }), { ac: true, dishwasher: true });
    expect(r.pass).toBe(false);
    expect(r.reasons).toEqual(['No dishwasher', 'No air conditioning']);
  });
});

describe('applyFilters', () => {
  it('keeps only passing listings, order preserved', () => {
    const a = listing({ id: 'a' });
    const b = listing({ id: 'b', ac: false });
    const c = listing({ id: 'c' });
    expect(applyFilters([a, b, c], { ac: true }).map((l) => l.floorPlan.id)).toEqual(['a', 'c']);
  });
  it('empty filters keep everything', () => expect(applyFilters([listing(), listing()], {})).toHaveLength(2));
  it('empty input -> empty', () => expect(applyFilters([], { ac: true })).toEqual([]));
});

describe('countActiveFilters', () => {
  it('empty -> 0', () => expect(countActiveFilters({})).toBe(0));
  it('counts defined truthy filters', () =>
    expect(countActiveFilters({ maxCostPerPerson: 900, groupSize: 4, ac: true })).toBe(3));
  it('ignores false and undefined', () =>
    expect(countActiveFilters({ ac: false, furnished: undefined, dishwasher: true })).toBe(1));
  it('ignores empty arrays, counts non-empty', () => {
    expect(countActiveFilters({ accessibilityFeatures: [] })).toBe(0);
    expect(countActiveFilters({ accessibilityFeatures: ['elevator'] })).toBe(1);
  });
  it('counts string filters', () =>
    expect(countActiveFilters({ noise: 'quiet', onGrounds: 'only', leaseType: 'joint' })).toBe(3));
});
