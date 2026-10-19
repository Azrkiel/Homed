import { describe, expect, it } from 'vitest';
import { canAccessApplicationPacket } from '../../src/lib/landlord/access';

const LEADER = 'U-LEADER';
const LANDLORD = 'U-LANDLORD';
const OTHER_LANDLORD = 'U-OTHER-LANDLORD';
const ROOMMATE = 'U-ROOMMATE';

const base = { leaderId: LEADER, propertyLandlordUserId: LANDLORD };

describe('canAccessApplicationPacket', () => {
  it('opens to the leader', () => {
    expect(canAccessApplicationPacket({ ...base, userId: LEADER, role: 'student' })).toBe(true);
  });

  it('opens to the landlord user of the property', () => {
    expect(canAccessApplicationPacket({ ...base, userId: LANDLORD, role: 'landlord' })).toBe(true);
  });

  it('opens to admins', () => {
    expect(canAccessApplicationPacket({ ...base, userId: 'U-ADMIN', role: 'admin' })).toBe(true);
  });

  it('stays closed to roommates, other landlords and strangers', () => {
    expect(canAccessApplicationPacket({ ...base, userId: ROOMMATE, role: 'student' })).toBe(false);
    expect(canAccessApplicationPacket({ ...base, userId: OTHER_LANDLORD, role: 'landlord' })).toBe(false);
    expect(canAccessApplicationPacket({ ...base, userId: 'U-STRANGER', role: 'student' })).toBe(false);
  });

  it('stays closed when the property has no landlord user', () => {
    expect(
      canAccessApplicationPacket({ userId: LANDLORD, role: 'landlord', leaderId: LEADER, propertyLandlordUserId: undefined }),
    ).toBe(false);
  });
});
