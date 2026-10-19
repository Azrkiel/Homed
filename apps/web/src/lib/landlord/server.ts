// Server-only helpers for landlord pages and actions. Thin on purpose: logic lives in access.ts and forms.ts.
import type { Landlord, User } from '@homed/core';
import { getRepo } from '../repo';
import { requireUser } from '../session';

/** Signed-in landlord (or admin). landlord is null for an admin without a landlord record. */
export async function requireLandlord(): Promise<{ user: User; landlord: Landlord | null }> {
  const user = await requireUser('landlord', '/landlord');
  const landlord = await getRepo().getLandlordByUser(user.id);
  return { user, landlord };
}
