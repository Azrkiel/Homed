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

/**
 * Who may move an application's status, exactly as the store enforces it: the property's own landlord,
 * or a user whose *stored* role is admin. Admins granted only through HOMED_ADMIN_EMAILS can view but
 * not act, so they never see buttons the store would reject.
 */
export function mayChangeApplicationStatus(landlord: Landlord | null, property: Property, storedRole: UserRole): boolean {
  if (storedRole === 'admin') return true;
  return landlord !== null && property.landlordId !== undefined && landlord.id === property.landlordId;
}
