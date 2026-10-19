import { describe, expect, it } from 'vitest';
import type { FloorPlan, Listing, Property } from '@homed/core';
import { groupPortfolio } from '../../src/lib/landlord/portfolio';

function prop(id: string, name: string, landlordId?: string): Property {
  return {
    id,
    slug: id,
    name,
    address: '1 Way',
    location: { lat: 38, lng: -78 },
    kind: 'apartment_complex',
    onGrounds: false,
    neighborhood: 'Rugby Road',
    amenities: {
      gym: false,
      studyRooms: false,
      rooftop: false,
      pool: false,
      elevator: false,
      parkingAvailable: false,
      petsAllowed: false,
    },
    onBusRoute: false,
    busRoutes: [],
    studyAbroadFriendly: false,
    noGuarantorOption: false,
    source: 'landlord portal',
    dataStatus: 'unverified_seed',
    lastVerified: '2026-10-19',
    ...(landlordId ? { landlordId } : {}),
  };
}

function plan(id: string, propertyId: string, name: string): FloorPlan {
  return {
    id,
    propertyId,
    name,
    beds: 1,
    baths: 1,
    rentAmount: 1000,
    rentBasis: 'per_unit',
    leaseStart: '2027-08-01',
    leaseEnd: '2028-07-31',
    termKind: '12_month',
    leaseType: 'individual',
    furnished: false,
    utilitiesIncluded: false,
    internetIncluded: false,
    inUnitLaundry: false,
    dishwasher: false,
    ac: true,
    unitsAvailable: 2,
    lastVerified: '2026-10-19',
  };
}

function listing(p: Property, f: FloorPlan): Listing {
  return { property: p, floorPlan: f, photos: [] };
}

describe('groupPortfolio', () => {
  const mine = prop('P1', 'Zeta House', 'L1');
  const alsoMine = prop('P2', 'Alpha Lofts', 'L1');
  const theirs = prop('P3', 'Other Co', 'L2');

  it('keeps only the landlord properties and sorts them by name', () => {
    const groups = groupPortfolio(
      [listing(mine, plan('F1', 'P1', '2BR')), listing(alsoMine, plan('F2', 'P2', '1BR')), listing(theirs, plan('F3', 'P3', 'Studio'))],
      'L1',
    );
    expect(groups.map((g) => g.property.name)).toEqual(['Alpha Lofts', 'Zeta House']);
  });

  it('groups several floor plans under one property, sorted by name, without duplicates', () => {
    const f2 = plan('F2', 'P1', '1BR');
    const f1 = plan('F1', 'P1', '2BR');
    const groups = groupPortfolio([listing(mine, f1), listing(mine, f2), listing(mine, f1)], 'L1');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.floorPlans.map((f) => f.name)).toEqual(['1BR', '2BR']);
  });

  it('returns nothing for a landlord with no joined listings', () => {
    expect(groupPortfolio([listing(theirs, plan('F3', 'P3', 'Studio'))], 'L1')).toEqual([]);
    expect(groupPortfolio([], 'L1')).toEqual([]);
  });

  it('does not list a property whose landlordId is unset', () => {
    const orphan = prop('P9', 'Seeded');
    expect(groupPortfolio([listing(orphan, plan('F9', 'P9', 'Studio'))], 'L1')).toEqual([]);
  });
});
