// Pure access rules for the landlord portal. Server code calls these after loading the rows.
import type { Landlord, Property, UserRole, ID } from '@homed/core';

/**
 * Admins always pass. A landlord-role user owns a property when its landlordId is their landlord record.
 * Other roles never own, even if a stray landlord record matches.
 */
export function ownsProperty(landlord: Landlord | null, property: Property | null, role: UserRole): boolean {
  if (role === 'admin') return true;
  if (role !== 'landlord') return false;
  if (!landlord || !property) return false;
  return property.landlordId !== undefined && landlord.id === property.landlordId;
}

/**
 * An application packet opens to its leader, to the landlord user who owns the property, and to admins.
 * Roommates and guarantors do not see the packet through this helper.
 */
export function canAccessApplicationPacket(input: {
  userId: ID;
  role: UserRole;
  leaderId: ID;
  propertyLandlordUserId: ID | undefined;
}): boolean {
  if (input.role === 'admin') return true;
  if (input.userId === input.leaderId) return true;
  return input.propertyLandlordUserId !== undefined && input.userId === input.propertyLandlordUserId;
}
