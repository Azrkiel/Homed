import { describe, expect, it } from 'vitest';
import { loadFixture } from '../../data/src/index';
import {
  locationScore, looksScore, neighborhoodMedians, priceScore, rankListings, scoreListing,
} from '../src/score';
import type {
  AccessibilityInfo, FloorPlan, Listing, Photo, Property, ScoringContext, WalkLookup, WalkTime,
} from '../src/types';

const TODAY = '2026-10-19';

function prop(over: Partial<Property> = {}): Property {
  return {
    id: 'p1', slug: 'p1', name: 'Alpha', address: '1 Main', location: { lat: 38, lng: -78 },
    kind: 'apartment_complex', onGrounds: false, neighborhood: 'Corner',
    amenities: {
      gym: false, studyRooms: false, rooftop: false, pool: false, elevator: false,
      parkingAvailable: false, petsAllowed: false,
    },
    onBusRoute: false, busRoutes: [], studyAbroadFriendly: false, noGuarantorOption: false,
    source: 'test', dataStatus: 'verified', lastVerified: TODAY, ...over,
  };
}

function fp(over: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'fp1', propertyId: 'p1', name: '4BR', beds: 4, baths: 2, rentAmount: 1000, rentBasis: 'per_bed',
    leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month', leaseType: 'joint',
    furnished: true, utilitiesIncluded: true, internetIncluded: true, inUnitLaundry: true,
    dishwasher: true, ac: true, unitsAvailable: 10, lastVerified: TODAY, ...over,
  };
}

function photo(over: Partial<Photo> = {}): Photo {
  return { id: 'ph', propertyId: 'p1', url: 'x', alt: 'x', isRendering: false, ratingCount: 0, ...over };
}

function listing(over: { property?: Partial<Property>; floorPlan?: Partial<FloorPlan>; photos?: Photo[]; accessibility?: AccessibilityInfo } = {}): Listing {
  const l: Listing = {
    property: prop(over.property),
    floorPlan: fp(over.floorPlan),
    photos: over.photos ?? [],
  };
  if (over.accessibility) l.accessibility = over.accessibility;
  return l;
}

/** targetId -> [walk, bus]; same for every property. */
function walkTable(table: Record<string, [number, number | null]>): WalkLookup {
  return (propertyId, targetId): WalkTime | undefined => {
    const row = table[targetId];
    if (!row) return undefined;
    return { propertyId, targetId, targetKind: 'building', walkMinutes: row[0], busMinutes: row[1], source: 'estimate' };
  };
}

function ctx(over: Partial<ScoringContext> = {}): ScoringContext {
  return {
    weights: { price: 0.4, location: 0.4, looks: 0.2 },
    budgetMax: 1200,
    meetings: [{ buildingId: 'b1', perWeek: 1 }],
    extras: [],
    walk: walkTable({ b1: [10, null] }),
    neighborhoodMedians: {},
    today: TODAY,
    ...over,
  };
}

const friendlyInfo: AccessibilityInfo = {
  propertyId: 'p1', features: ['step_free_entrance', 'elevator'], photoConfirmed: [],
  accommodationContact: 'Dana', accommodationProcess: 'Email the office.',
  assistanceAnimals: { serviceAnimalsAllowed: true, esaAllowed: true, noFees: true },
  updatedAt: '2026-10-01',
};

describe('priceScore', () => {
  it('no budget -> neutral 50', () => expect(priceScore(1000, undefined, 1000, 900)).toBe(50));
  it('ratio 0.85 exactly -> 100', () => expect(priceScore(850, 1000, 850, undefined)).toBe(100));
  it('ratio well under 0.85 -> 100', () => expect(priceScore(500, 1000, 500, undefined)).toBe(100));
  it('ratio just above 0.85 is just below 100', () => expect(priceScore(860, 1000, 860, undefined)).toBe(93));
  it('ratio 0.925 -> 50', () => expect(priceScore(925, 1000, 925, undefined)).toBe(50));
  it('ratio 0.99 -> 7', () => expect(priceScore(990, 1000, 990, undefined)).toBe(7));
  it('ratio exactly 1 -> 0', () => expect(priceScore(1000, 1000, 1000, undefined)).toBe(0));
  it('ratio over 1 -> 0 even with a bonus', () => expect(priceScore(1200, 1000, 400, 1000)).toBe(0));
  it('rounds the linear part', () => expect(priceScore(900, 1000, 900, undefined)).toBe(67));
  it('bonus is median-relative: 10% under median -> +5', () => expect(priceScore(925, 1000, 900, 1000)).toBe(55));
  it('bonus clamps at +10', () => expect(priceScore(925, 1000, 500, 1000)).toBe(60));
  it('bonus never negative when pricier than median', () => expect(priceScore(925, 1000, 1200, 1000)).toBe(50));
  it('no median -> no bonus', () => expect(priceScore(925, 1000, 500, undefined)).toBe(50));
  it('result capped at 100', () => expect(priceScore(851, 1000, 500, 1000)).toBe(100));
  it('bonus applies only when ratio < 1', () => expect(priceScore(1000, 1000, 100, 1000)).toBe(0));
});

describe('locationScore', () => {
  it('0 min -> 100', () => expect(locationScore(0)).toBe(100));
  it('5 min -> 100', () => expect(locationScore(5)).toBe(100));
  it('6 min -> 96', () => expect(locationScore(6)).toBe(96));
  it('10 min -> 80', () => expect(locationScore(10)).toBe(80));
  it('17.5 min -> 50', () => expect(locationScore(17.5)).toBe(50));
  it('20 min -> 40', () => expect(locationScore(20)).toBe(40));
  it('29 min -> 4', () => expect(locationScore(29)).toBe(4));
  it('30 min -> 0', () => expect(locationScore(30)).toBe(0));
  it('45 min -> 0', () => expect(locationScore(45)).toBe(0));
});

describe('looksScore: age', () => {
  const l = (property: Partial<Property>, photos: Photo[] = []) => looksScore(listing({ property, photos }), TODAY);
  it('no year, no photos -> 50 age_only', () => expect(l({})).toEqual({ score: 50, basis: 'age_only' }));
  it('age 0 -> 100', () => expect(l({ yearBuilt: 2026 }).score).toBe(100));
  it('age 2 -> 100', () => expect(l({ yearBuilt: 2024 }).score).toBe(100));
  it('age 3 -> 98', () => expect(l({ yearBuilt: 2023 }).score).toBe(98));
  it('age 22 -> 58', () => expect(l({ yearBuilt: 2004 }).score).toBe(58));
  it('age 39 -> 22', () => expect(l({ yearBuilt: 1987 }).score).toBe(22));
  it('age 40 -> 20', () => expect(l({ yearBuilt: 1986 }).score).toBe(20));
  it('age over 40 -> 20', () => expect(l({ yearBuilt: 1900 }).score).toBe(20));
  it('future year -> 100', () => expect(l({ yearBuilt: 2027 }).score).toBe(100));
  it('future renovation -> 100', () => expect(l({ yearBuilt: 1950, yearRenovated: 2028 }).score).toBe(100));
  it('uses the later of built and renovated', () => expect(l({ yearBuilt: 1990, yearRenovated: 2020 }).score).toBe(92));
  it('renovated year older than built year: built wins', () => expect(l({ yearBuilt: 2020, yearRenovated: 1990 }).score).toBe(92));
  it('only renovated year given', () => expect(l({ yearRenovated: 2020 }).score).toBe(92));
  it('age is measured from ctx today, not the clock', () => {
    expect(looksScore(listing({ property: { yearBuilt: 2036 } }), '2035-01-01').score).toBe(100);
    expect(looksScore(listing({ property: { yearBuilt: 2000 } }), '2040-06-01').score).toBe(20);
  });
});

describe('looksScore: photos', () => {
  const built2025 = { yearBuilt: 2025 };
  const l = (photos: Photo[], property: Partial<Property> = built2025) => looksScore(listing({ property, photos }), TODAY);
  it('rating 5 on a new building -> 100 photos_and_age', () =>
    expect(l([photo({ looksRating: 5, ratingCount: 10 })])).toEqual({ score: 100, basis: 'photos_and_age' }));
  it('rating 1 maps to photo score 0', () => expect(l([photo({ looksRating: 1, ratingCount: 4 })]).score).toBe(50));
  it('rating 3 maps to photo score 50', () => expect(l([photo({ looksRating: 3, ratingCount: 4 })]).score).toBe(75));
  it('ratings are weighted by ratingCount', () =>
    expect(l([photo({ looksRating: 5, ratingCount: 1 }), photo({ id: 'b', looksRating: 1, ratingCount: 3 })]).score).toBe(63));
  it('renderings are ignored -> age_only', () =>
    expect(l([photo({ isRendering: true, looksRating: 5, ratingCount: 10 })])).toEqual({ score: 100, basis: 'age_only' }));
  it('rendering ratings do not mix into real ones', () =>
    expect(l([photo({ looksRating: 3, ratingCount: 2 }), photo({ id: 'r', isRendering: true, looksRating: 5, ratingCount: 50 })]).score).toBe(75));
  it('real photo with ratingCount 0 -> age_only', () =>
    expect(l([photo({ looksRating: 5, ratingCount: 0 })]).basis).toBe('age_only'));
  it('real photo with no rating -> age_only', () => expect(l([photo({ ratingCount: 5 })]).basis).toBe('age_only'));
  it('unknown year uses age 50 with photos', () =>
    expect(l([photo({ looksRating: 5, ratingCount: 1 })], {})).toEqual({ score: 75, basis: 'photos_and_age' }));
});

describe('neighborhoodMedians', () => {
  it('empty -> {}', () => expect(neighborhoodMedians([])).toEqual({}));
  it('single listing', () => expect(neighborhoodMedians([listing()])).toEqual({ Corner: 1000, __all__: 1000 }));
  it('odd count takes the middle value', () => {
    const ls = [900, 1500, 1100].map((r, i) => listing({ property: { id: `p${i}` }, floorPlan: { rentAmount: r } }));
    expect(neighborhoodMedians(ls).Corner).toBe(1100);
  });
  it('even count averages the middle two', () => {
    const ls = [1000, 1001].map((r, i) => listing({ property: { id: `p${i}` }, floorPlan: { rentAmount: r } }));
    expect(neighborhoodMedians(ls).Corner).toBe(1000.5);
  });
  it('per_unit rent is split by bedrooms', () => {
    const l = listing({ floorPlan: { rentBasis: 'per_unit', rentAmount: 4000, beds: 4 } });
    expect(neighborhoodMedians([l]).Corner).toBe(1000);
  });
  it('a studio per_unit rent is not split', () => {
    const l = listing({ floorPlan: { rentBasis: 'per_unit', rentAmount: 1500, beds: 0, baths: 1 } });
    expect(neighborhoodMedians([l]).Corner).toBe(1500);
  });
  it('groups by neighborhood and adds __all__', () => {
    const ls = [
      listing({ property: { neighborhood: 'Corner' }, floorPlan: { rentAmount: 1000 } }),
      listing({ property: { neighborhood: 'Corner' }, floorPlan: { rentAmount: 1200 } }),
      listing({ property: { neighborhood: 'JPA' }, floorPlan: { rentAmount: 2000 } }),
    ];
    expect(neighborhoodMedians(ls)).toEqual({ Corner: 1100, JPA: 2000, __all__: 1200 });
  });
  it('uses rent only, not utilities or furniture', () => {
    const l = listing({ floorPlan: { utilitiesIncluded: false, utilitiesEstimate: 200, furnished: false, furnitureMonthly: 50 } });
    expect(neighborhoodMedians([l]).Corner).toBe(1000);
  });
  it('does not mutate input order', () => {
    const ls = [1500, 900].map((r, i) => listing({ property: { id: `p${i}` }, floorPlan: { rentAmount: r } }));
    neighborhoodMedians(ls);
    expect(ls[0]?.floorPlan.rentAmount).toBe(1500);
  });
});

describe('scoreListing: totals', () => {
  it('blends price, location and looks with 40/40/20', () => {
    const s = scoreListing(listing(), ctx());
    expect([s.price, s.location, s.looks]).toEqual([100, 80, 50]);
    expect(s.total).toBe(82);
    expect(s.looksBasis).toBe('age_only');
  });
  it('normalises weights that do not sum to 1', () => {
    expect(scoreListing(listing(), ctx({ weights: { price: 2, location: 2, looks: 1 } })).total).toBe(82);
  });
  it('price-only weights', () => {
    expect(scoreListing(listing(), ctx({ weights: { price: 1, location: 0, looks: 0 } })).total).toBe(100);
  });
  it('looks-only weights', () => {
    expect(scoreListing(listing(), ctx({ weights: { price: 0, location: 0, looks: 1 } })).total).toBe(50);
  });
  it('all-zero weights fall back to the defaults', () => {
    expect(scoreListing(listing(), ctx({ weights: { price: 0, location: 0, looks: 0 } })).total).toBe(82);
  });
  it('includes cost and commute', () => {
    const s = scoreListing(listing(), ctx());
    expect(s.cost.totalMonthly).toBe(1000);
    expect(s.commute.averageMinutes).toBe(10);
  });
  it('uses the neighborhood median for the price bonus', () => {
    const base = ctx({ budgetMax: 1100 });
    expect(scoreListing(listing({ floorPlan: { rentAmount: 1000 } }), base).price).toBe(61);
    const withMedian = ctx({ budgetMax: 1100, neighborhoodMedians: { Corner: 1250 } });
    expect(scoreListing(listing({ floorPlan: { rentAmount: 1000 } }), withMedian).price).toBe(71);
  });
  it('is pure: same input, same output', () => {
    const l = listing();
    expect(scoreListing(l, ctx())).toEqual(scoreListing(l, ctx()));
  });
  it('no budget: budget becomes 1.3 x overall median', () => {
    // 1.3 * 1000 = 1300 -> ratio of 1100 is 0.846 -> 100
    const s = scoreListing(listing({ floorPlan: { rentAmount: 1100 } }), ctx({ budgetMax: undefined, neighborhoodMedians: { __all__: 1000 } }));
    expect(s.price).toBe(100);
  });
  it('no budget: effective budget is rounded', () => {
    // 1.3 * 1001 = 1301.3 -> 1301
    const s = scoreListing(listing({ floorPlan: { rentAmount: 1301 } }), ctx({ budgetMax: undefined, neighborhoodMedians: { __all__: 1001 } }));
    expect(s.price).toBe(0);
  });
  it('no budget and no __all__ median -> price 50', () => {
    expect(scoreListing(listing(), ctx({ budgetMax: undefined })).price).toBe(50);
  });
});

describe('scoreListing: location input', () => {
  it('meetings: weighted average commute', () => {
    const c = ctx({
      meetings: [{ buildingId: 'b1', perWeek: 1 }, { buildingId: 'b2', perWeek: 1 }],
      walk: walkTable({ b1: [10, null], b2: [20, null] }),
    });
    const s = scoreListing(listing(), c);
    expect(s.location).toBe(60);
    expect(s.why).toContain('15 min to your classes');
  });
  it('meetings use the faster bus time', () => {
    const c = ctx({ walk: walkTable({ b1: [20, 8] }) });
    const s = scoreListing(listing(), c);
    expect(s.why).toContain('8 min to your classes');
    expect(s.commute.usesBus).toBe(true);
  });
  it('meetings beat extras', () => {
    const c = ctx({ extras: ['gym'], walk: walkTable({ b1: [10, null], gym: [2, null] }) });
    expect(scoreListing(listing(), c).why).toContain('10 min to your classes');
  });
  it('no meetings: mean minutes to extras', () => {
    const c = ctx({ meetings: [], extras: ['gym', 'cafe'], walk: walkTable({ gym: [12, null], cafe: [6, null] }) });
    const s = scoreListing(listing(), c);
    expect(s.location).toBe(84);
    expect(s.why).toContain('9 min to your spots');
  });
  it('extras beat the Lawn', () => {
    const c = ctx({ meetings: [], extras: ['gym'], walk: walkTable({ gym: [4, null], lawn: [25, null] }) });
    expect(scoreListing(listing(), c).why).toContain('4 min to your spots');
  });
  it('no meetings or extras: walk to the Lawn', () => {
    const c = ctx({ meetings: [], walk: walkTable({ lawn: [12, null] }) });
    const s = scoreListing(listing(), c);
    expect(s.location).toBe(72);
    expect(s.why).toContain('12 min to the Lawn');
  });
  it('Lawn uses walking minutes and rounds', () => {
    const c = ctx({ meetings: [], walk: walkTable({ lawn: [12.4, 5] }) });
    expect(scoreListing(listing(), c).why).toContain('12 min to the Lawn');
  });
  it('no walk data at all -> location 50 and "walk times unavailable"', () => {
    const c = ctx({ meetings: [], walk: walkTable({}) });
    const s = scoreListing(listing(), c);
    expect(s.location).toBe(50);
    expect(s.why).toContain('walk times unavailable');
  });
  it('meetings present but no walk data -> neutral', () => {
    const c = ctx({ walk: walkTable({}) });
    const s = scoreListing(listing(), c);
    expect(s.location).toBe(50);
    expect(s.why).toContain('walk times unavailable');
  });
  it('meetings with no walk data fall back to extras', () => {
    const c = ctx({ extras: ['gym'], walk: walkTable({ gym: [10, null] }) });
    expect(scoreListing(listing(), c).why).toContain('10 min to your spots');
  });
});

describe('scoreListing: why line', () => {
  it('under budget', () => {
    expect(scoreListing(listing(), ctx()).why).toBe('$200 under budget · 10 min to your classes');
  });
  it('over budget', () => {
    expect(scoreListing(listing(), ctx({ budgetMax: 900 })).why).toBe('$100 over budget · 10 min to your classes');
  });
  it('right at budget', () => {
    expect(scoreListing(listing(), ctx({ budgetMax: 1000 })).why).toBe('right at budget · 10 min to your classes');
  });
  it('group budget never reveals the dollar gap (it would expose the tightest member budget)', () => {
    expect(scoreListing(listing(), ctx({ budgetLabel: 'group' })).why).toBe('within group budget · 10 min to your classes');
    expect(scoreListing(listing(), ctx({ budgetMax: 900, budgetLabel: 'group' })).why).toBe('over group budget · 10 min to your classes');
    expect(scoreListing(listing(), ctx({ budgetMax: 1000, budgetLabel: 'group' })).why).toBe('right at group budget · 10 min to your classes');
  });
  it('no budget: all-in monthly cost with thousands separator', () => {
    const s = scoreListing(listing({ floorPlan: { rentAmount: 1245 } }), ctx({ budgetMax: undefined }));
    expect(s.why).toBe('$1,245/mo all-in · 10 min to your classes');
  });
  it('no budget: under 1000 has no separator', () => {
    const s = scoreListing(listing({ floorPlan: { rentAmount: 950 } }), ctx({ budgetMax: undefined }));
    expect(s.why.startsWith('$950/mo all-in')).toBe(true);
  });
  it('under budget uses a thousands separator', () => {
    const s = scoreListing(listing(), ctx({ budgetMax: 3000 }));
    expect(s.why.startsWith('$2,000 under budget')).toBe(true);
  });
  it('over budget uses a thousands separator', () => {
    const s = scoreListing(listing({ floorPlan: { rentAmount: 2600 } }), ctx({ budgetMax: 1100 }));
    expect(s.why.startsWith('$1,500 over budget')).toBe(true);
  });
  it('difference uses all-in cost, not rent alone', () => {
    const s = scoreListing(listing({ floorPlan: { utilitiesIncluded: false, utilitiesEstimate: 100 } }), ctx());
    expect(s.why.startsWith('$100 under budget')).toBe(true);
  });
  it('full line with renovation', () => {
    const l = listing({ property: { yearRenovated: 2024, yearBuilt: 1990 }, photos: [photo()] });
    expect(scoreListing(l, ctx()).why).toBe('$200 under budget · 10 min to your classes · renovated 2024');
  });
  it('renovated beats built', () => {
    expect(scoreListing(listing({ property: { yearBuilt: 2025, yearRenovated: 2023 } }), ctx()).why).toContain('renovated 2023');
  });
  it('new for next year', () => {
    expect(scoreListing(listing({ property: { yearBuilt: 2027 } }), ctx()).why.endsWith('new for 2027')).toBe(true);
  });
  it('built within the last five years', () => {
    expect(scoreListing(listing({ property: { yearBuilt: 2022 } }), ctx()).why.endsWith('built 2022')).toBe(true);
  });
  it('built exactly five years ago is shown', () => {
    expect(scoreListing(listing({ property: { yearBuilt: 2021 } }), ctx()).why.endsWith('built 2021')).toBe(true);
  });
  it('built six years ago is omitted', () => {
    expect(scoreListing(listing({ property: { yearBuilt: 2020 } }), ctx()).why).toBe('$200 under budget · 10 min to your classes');
  });
  it('built this year', () => {
    expect(scoreListing(listing({ property: { yearBuilt: 2026 } }), ctx()).why.endsWith('built 2026')).toBe(true);
  });
  it('renderings only replaces the year part', () => {
    const l = listing({ property: { yearRenovated: 2024 }, photos: [photo({ isRendering: true })] });
    expect(scoreListing(l, ctx()).why).toBe('$200 under budget · 10 min to your classes · renderings only');
  });
  it('real photos present -> no renderings part', () => {
    const l = listing({ photos: [photo({ isRendering: true }), photo({ id: 'r' })] });
    expect(scoreListing(l, ctx()).why).not.toContain('renderings');
  });
  it('no photos is not "renderings only"', () => {
    expect(scoreListing(listing(), ctx()).why).not.toContain('renderings');
  });
  it('three parts are joined with a middle dot', () => {
    const s = scoreListing(listing({ property: { yearBuilt: 2027 } }), ctx());
    expect(s.why.split(' · ')).toHaveLength(3);
  });
});

describe('scoreListing: badges', () => {
  const badges = (l: Listing, c: ScoringContext = ctx()) => scoreListing(l, c).badges;
  it('none by default', () => expect(badges(listing())).toEqual([]));
  it('renderings_only when photos are all renderings', () =>
    expect(badges(listing({ photos: [photo({ isRendering: true })] }))).toEqual(['renderings_only']));
  it('no renderings_only when any photo is real', () =>
    expect(badges(listing({ photos: [photo({ isRendering: true }), photo({ id: 'b' })] }))).toEqual([]));
  it('stale when verified 15 days ago', () =>
    expect(badges(listing({ floorPlan: { lastVerified: '2026-10-04' } }))).toEqual(['stale']));
  it('not stale at exactly 14 days', () =>
    expect(badges(listing({ floorPlan: { lastVerified: '2026-10-05' } }))).toEqual([]));
  it('stale is judged from ctx.today', () =>
    expect(badges(listing(), ctx({ today: '2026-12-01' }))).toEqual(['stale']));
  it('accommodation_friendly', () =>
    expect(badges(listing({ accessibility: friendlyInfo }))).toEqual(['accommodation_friendly']));
  it('few_left at 1', () => expect(badges(listing({ floorPlan: { unitsAvailable: 1 } }))).toEqual(['few_left']));
  it('few_left at the threshold (3)', () => expect(badges(listing({ floorPlan: { unitsAvailable: 3 } }))).toEqual(['few_left']));
  it('no few_left at 4', () => expect(badges(listing({ floorPlan: { unitsAvailable: 4 } }))).toEqual([]));
  it('no few_left at 0', () => expect(badges(listing({ floorPlan: { unitsAvailable: 0 } }))).toEqual([]));
  it('no few_left when unknown', () => expect(badges(listing({ floorPlan: { unitsAvailable: null } }))).toEqual([]));
  it('private_bath when baths >= people', () =>
    expect(badges(listing({ floorPlan: { beds: 4, baths: 4 } }))).toEqual(['private_bath']));
  it('private_bath when baths exceed people', () =>
    expect(badges(listing({ floorPlan: { beds: 2, baths: 3 } }))).toEqual(['private_bath']));
  it('studio with one bath is private_bath', () =>
    expect(badges(listing({ floorPlan: { beds: 0, baths: 1 } }))).toEqual(['private_bath']));
  it('no private_bath when baths < people', () =>
    expect(badges(listing({ floorPlan: { beds: 4, baths: 3 } }))).toEqual([]));
  it('on_grounds', () => expect(badges(listing({ property: { onGrounds: true } }))).toEqual(['on_grounds']));
  it('individual_lease', () =>
    expect(badges(listing({ floorPlan: { leaseType: 'individual' } }))).toEqual(['individual_lease']));
  it('all badges come out in the documented order', () => {
    const l = listing({
      property: { onGrounds: true },
      floorPlan: { leaseType: 'individual', unitsAvailable: 2, beds: 2, baths: 2, lastVerified: '2026-01-01' },
      photos: [photo({ isRendering: true })],
      accessibility: friendlyInfo,
    });
    expect(badges(l)).toEqual([
      'renderings_only', 'stale', 'accommodation_friendly', 'few_left', 'private_bath', 'on_grounds', 'individual_lease',
    ]);
  });
});

describe('rankListings', () => {
  const named = (name: string, rent: number, id = name) =>
    listing({ property: { id, name }, floorPlan: { id: `fp-${id}`, propertyId: id, rentAmount: rent } });

  it('empty -> []', () => expect(rankListings([], ctx())).toEqual([]));
  it('sorts by total descending', () => {
    // budget 1200: rent 1190 scores low on price, 800 scores 100.
    const r = rankListings([named('Pricey', 1190), named('Cheap', 800)], ctx());
    expect(r.map((x) => x.listing.property.name)).toEqual(['Cheap', 'Pricey']);
    expect(r[0]!.score.total).toBeGreaterThan(r[1]!.score.total);
  });
  it('ties on total go to the lower monthly cost', () => {
    const r = rankListings([named('Aaa', 900), named('Zzz', 800)], ctx({ budgetMax: 2000 }));
    expect(r[0]!.score.total).toBe(r[1]!.score.total);
    expect(r.map((x) => x.listing.property.name)).toEqual(['Zzz', 'Aaa']);
  });
  it('ties on total and cost go to the name, ascending', () => {
    const r = rankListings([named('Beta', 900), named('Alpha', 900), named('Gamma', 900)], ctx());
    expect(r.map((x) => x.listing.property.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
  it('total beats cost: higher total wins even when pricier', () => {
    const near = named('Near', 900, 'near');
    const far = named('Far', 800, 'far');
    const c = ctx({ weights: { price: 0.1, location: 0.9, looks: 0 }, walk: (pid, tid) => walkTable({ b1: [pid === 'near' ? 5 : 25, null] })(pid, tid) });
    expect(rankListings([far, near], c).map((x) => x.listing.property.name)).toEqual(['Near', 'Far']);
  });
  it('does not mutate the input array', () => {
    const input = [named('B', 900), named('A', 900)];
    rankListings(input, ctx());
    expect(input.map((l) => l.property.name)).toEqual(['B', 'A']);
  });
  it('each result carries its own score', () => {
    const r = rankListings([named('A', 900)], ctx());
    expect(r[0]!.score).toEqual(scoreListing(r[0]!.listing, ctx()));
  });
});

describe('fixture data', () => {
  it('scores and ranks every fixture listing without throwing', () => {
    const seed = loadFixture();
    const listings: Listing[] = seed.floorPlans.flatMap((floorPlan) => {
      const property = seed.properties.find((p) => p.id === floorPlan.propertyId);
      if (!property) return [];
      const photos = seed.photos.filter((p) => p.propertyId === property.id && (!p.floorPlanId || p.floorPlanId === floorPlan.id));
      const accessibility = seed.accessibility.find((a) => a.propertyId === property.id);
      const l: Listing = { property, floorPlan, photos };
      if (accessibility) l.accessibility = accessibility;
      return [l];
    });
    expect(listings.length).toBeGreaterThan(0);
    const c = ctx({
      meetings: [], budgetMax: undefined,
      walk: (propertyId, targetId) => seed.walkTimes.find((w) => w.propertyId === propertyId && w.targetId === targetId),
      neighborhoodMedians: neighborhoodMedians(listings),
    });
    const ranked = rankListings(listings, c);
    expect(ranked).toHaveLength(listings.length);
    for (const r of ranked) {
      expect(r.score.total).toBeGreaterThanOrEqual(0);
      expect(r.score.total).toBeLessThanOrEqual(100);
      expect(Number.isInteger(r.score.total)).toBe(true);
      expect(r.score.why.length).toBeGreaterThan(0);
    }
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.score.total).toBeGreaterThanOrEqual(ranked[i]!.score.total);
    }
  });
});
