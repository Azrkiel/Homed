import { describe, expect, it } from 'vitest';
import type { Landlord, Property } from '@homed/core';
import { canAccessApplicationPacket, mayChangeApplicationStatus, ownsProperty } from '../../src/lib/landlord/access';

const landlord: Landlord = {
  id: 'L1',
  userId: 'U-LANDLORD',
  name: 'Hoo Rentals',
  verified: false,
  createdAt: '2026-10-01T00:00:00.000Z',
};

function property(landlordId: string | undefined): Property {
  return {
    id: 'P1',
    slug: 'p1',
    name: 'P1',
    address: '1 Way',
    location: { lat: 38, lng: -78 },
    kind: 'house',
    onGrounds: false,
    neighborhood: 'Rugby Road',
    landlordId,
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
  };
}

describe('ownsProperty', () => {
  it('a landlord owns a property whose landlordId is their record', () => {
    expect(ownsProperty(landlord, property('L1'), 'landlord')).toBe(true);
  });

  it('a landlord does not own another landlord’s property', () => {
    expect(ownsProperty(landlord, property('L2'), 'landlord')).toBe(false);
  });

  it('a property with no landlordId is owned by no landlord', () => {
    expect(ownsProperty(landlord, property(undefined), 'landlord')).toBe(false);
  });

  it('no landlord record or no property -> false for a landlord', () => {
    expect(ownsProperty(null, property('L1'), 'landlord')).toBe(false);
    expect(ownsProperty(landlord, null, 'landlord')).toBe(false);
  });

  it('admins always own', () => {
    expect(ownsProperty(null, null, 'admin')).toBe(true);
    expect(ownsProperty(landlord, property('L2'), 'admin')).toBe(true);
  });

  it('students never own a property, even one with a matching id', () => {
    expect(ownsProperty(landlord, property('L1'), 'student')).toBe(false);
  });
});

describe('canAccessApplicationPacket', () => {
  const base = { userId: 'U-STUDENT', role: 'student' as const, leaderId: 'U-STUDENT', propertyLandlordUserId: 'U-LANDLORD' };

  it('the leader can open their own packet', () => {
    expect(canAccessApplicationPacket(base)).toBe(true);
  });

  it('the landlord user of the property can open the packet', () => {
    expect(canAccessApplicationPacket({ ...base, userId: 'U-LANDLORD', role: 'landlord' })).toBe(true);
  });

  it('admins can open any packet', () => {
    expect(canAccessApplicationPacket({ ...base, userId: 'U-OTHER', role: 'admin' })).toBe(true);
  });

  it('a roommate, another landlord, or any other student cannot', () => {
    expect(canAccessApplicationPacket({ ...base, userId: 'U-ROOMMATE' })).toBe(false);
    expect(canAccessApplicationPacket({ ...base, userId: 'U-OTHER-LANDLORD', role: 'landlord' })).toBe(false);
  });

  it('a property with no landlord user cannot grant access to undefined users', () => {
    expect(canAccessApplicationPacket({ ...base, userId: 'U-ROOMMATE', propertyLandlordUserId: undefined })).toBe(false);
  });
});

describe('mayChangeApplicationStatus (mirrors the store rule)', () => {
  const property = { landlordId: 'L1' } as Property;
  const mine = { id: 'L1' } as Landlord;
  const theirs = { id: 'L2' } as Landlord;
  it("the property's own landlord may act", () => {
    expect(mayChangeApplicationStatus(mine, property, 'landlord')).toBe(true);
    expect(mayChangeApplicationStatus(theirs, property, 'landlord')).toBe(false);
  });
  it('an admin by stored role may act; an admin only by HOMED_ADMIN_EMAILS (stored student) may not', () => {
    expect(mayChangeApplicationStatus(null, property, 'admin')).toBe(true);
    expect(mayChangeApplicationStatus(null, property, 'student')).toBe(false);
  });
});
