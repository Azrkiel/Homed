import { describe, expect, it } from 'vitest';
import { computeCost, leaseMonths, peopleInUnit } from '../src/cost';
import type { FloorPlan, Property } from '../src/types';

function fp(over: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'fp1', propertyId: 'p1', name: '4BR', beds: 4, baths: 4, rentAmount: 3200, rentBasis: 'per_unit',
    leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month', leaseType: 'individual',
    furnished: true, utilitiesIncluded: true, internetIncluded: true, inUnitLaundry: true,
    dishwasher: true, ac: true, unitsAvailable: 2, lastVerified: '2026-10-19', ...over,
  };
}
function prop(amenities: Partial<Property['amenities']> = {}): Property {
  return {
    id: 'p1', slug: 'p1', name: 'P', address: '1 Main', location: { lat: 38, lng: -78 },
    kind: 'apartment_complex', onGrounds: false, neighborhood: 'Corner',
    amenities: {
      gym: false, studyRooms: false, rooftop: false, pool: false, elevator: false,
      parkingAvailable: false, petsAllowed: false, ...amenities,
    },
    onBusRoute: false, busRoutes: [], studyAbroadFriendly: false, noGuarantorOption: false,
    source: 'test', dataStatus: 'verified', lastVerified: '2026-10-19',
  } as Property;
}

describe('peopleInUnit', () => {
  it('equals beds', () => expect(peopleInUnit(fp({ beds: 3 }))).toBe(3));
  it('studio is 1', () => expect(peopleInUnit(fp({ beds: 0 }))).toBe(1));
  it('1BR is 1', () => expect(peopleInUnit(fp({ beds: 1 }))).toBe(1));
});

describe('leaseMonths', () => {
  it('12-month lease', () => expect(leaseMonths(fp())).toBe(12));
  it('academic year (Aug 25 - May 15)', () =>
    expect(leaseMonths(fp({ leaseStart: '2027-08-25', leaseEnd: '2028-05-15' }))).toBe(9));
  it('semester', () => expect(leaseMonths(fp({ leaseStart: '2027-08-25', leaseEnd: '2027-12-20' }))).toBe(4));
  it('minimum 1', () => expect(leaseMonths(fp({ leaseStart: '2027-08-01', leaseEnd: '2027-08-05' }))).toBe(1));
  it('minimum 1 when end before start', () =>
    expect(leaseMonths(fp({ leaseStart: '2027-08-10', leaseEnd: '2027-08-01' }))).toBe(1));
});

describe('computeCost', () => {
  it('splits per_unit rent by bedrooms', () => {
    const c = computeCost(fp(), prop());
    expect(c.rent).toBe(800);
    expect(c.totalMonthly).toBe(800);
    expect(c.leaseMonths).toBe(12);
    expect(c.totalLease).toBe(9600);
    expect(c.note).toBeUndefined();
  });
  it('per_bed rent is not split', () => {
    expect(computeCost(fp({ rentBasis: 'per_bed', rentAmount: 950 }), prop()).rent).toBe(950);
  });
  it('studio per_unit is full rent', () => {
    expect(computeCost(fp({ beds: 0, rentAmount: 1400 }), prop()).rent).toBe(1400);
  });
  it('rounds rent to whole dollars', () => {
    expect(computeCost(fp({ beds: 3, rentAmount: 3100 }), prop()).rent).toBe(1033);
  });
  it('adds utilities and internet when not included', () => {
    const c = computeCost(
      fp({ utilitiesIncluded: false, utilitiesEstimate: 80, internetIncluded: false, internetEstimate: 40 }),
      prop(),
    );
    expect(c.utilities).toBe(80);
    expect(c.internet).toBe(40);
    expect(c.totalMonthly).toBe(920);
  });
  it('ignores estimates when included', () => {
    const c = computeCost(fp({ utilitiesEstimate: 80, internetEstimate: 40 }), prop());
    expect(c.utilities).toBe(0);
    expect(c.internet).toBe(0);
  });
  it('missing estimates count as 0', () => {
    const c = computeCost(fp({ utilitiesIncluded: false, internetIncluded: false }), prop());
    expect(c.utilities).toBe(0);
    expect(c.internet).toBe(0);
  });
  it('furniture added only when unfurnished', () => {
    expect(computeCost(fp({ furnished: false, furnitureMonthly: 60 }), prop()).furniture).toBe(60);
    expect(computeCost(fp({ furnished: true, furnitureMonthly: 60 }), prop()).furniture).toBe(0);
    expect(computeCost(fp({ furnished: false }), prop()).furniture).toBe(0);
  });
  it('parking only with includeParking and parkingAvailable', () => {
    const p = prop({ parkingAvailable: true, parkingMonthly: 100 });
    expect(computeCost(fp(), p).parking).toBe(0);
    expect(computeCost(fp(), p, { includeParking: true }).parking).toBe(100);
    expect(computeCost(fp(), p, { includeParking: true }).totalMonthly).toBe(900);
    const none = prop({ parkingAvailable: false, parkingMonthly: 100 });
    expect(computeCost(fp(), none, { includeParking: true }).parking).toBe(0);
  });
  it('unknown parking price is 0', () => {
    expect(computeCost(fp(), prop({ parkingAvailable: true }), { includeParking: true }).parking).toBe(0);
  });
  it('total is sum of rounded components', () => {
    const c = computeCost(
      fp({
        beds: 3, rentAmount: 3100, utilitiesIncluded: false, utilitiesEstimate: 80.4,
        furnished: false, furnitureMonthly: 59.6,
      }),
      prop(),
    );
    expect(c.utilities).toBe(80);
    expect(c.furniture).toBe(60);
    expect(c.totalMonthly).toBe(c.rent + c.utilities + c.internet + c.parking + c.furniture);
    expect(c.totalMonthly).toBe(1173);
  });
  it('academic_year note', () => {
    const c = computeCost(fp({ termKind: 'academic_year', leaseStart: '2027-08-25', leaseEnd: '2028-05-15' }), prop());
    expect(c.leaseMonths).toBe(9);
    expect(c.note).toBe('9-month lease: plan summer housing separately');
  });
  it('semester note', () => {
    const c = computeCost(fp({ termKind: 'semester', leaseStart: '2027-08-25', leaseEnd: '2027-12-20' }), prop());
    expect(c.note).toBe('4-month lease: plan summer housing separately');
  });
  it('no note for other term kinds', () => {
    expect(computeCost(fp({ termKind: 'other' }), prop()).note).toBeUndefined();
  });
  it('totalLease = totalMonthly x leaseMonths', () => {
    const c = computeCost(fp({ termKind: 'academic_year', leaseStart: '2027-08-25', leaseEnd: '2028-05-15' }), prop());
    expect(c.totalLease).toBe(c.totalMonthly * 9);
  });
});
