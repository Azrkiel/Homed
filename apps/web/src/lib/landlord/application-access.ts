// Server-only: loads an application for a landlord viewer and applies the access rule. Callers 404 on null.
import type { Application, ApplicationMember, FloorPlan, ID, Property, User, UserRole } from '@homed/core';
import { getRepo } from '../repo';
import { effectiveRole } from '../session';
import { ownsProperty } from './access';

export interface LandlordApplicationRecord {
  application: Application;
  property: Property;
  floorPlan: FloorPlan;
  members: ApplicationMember[];
  role: UserRole;
}

/**
 * The application when `user` may see it as a landlord: the property's landlord record belongs to them, or
 * they are an admin. Drafts are the applicant's until submitted, so only admins see them. Null otherwise.
 */
export async function landlordApplicationFor(user: User, applicationId: ID): Promise<LandlordApplicationRecord | null> {
  const repo = getRepo();
  const application = await repo.getApplication(applicationId);
  if (!application) return null;
  const listing = await repo.getListing(application.floorPlanId);
  if (!listing) return null;
  const role = effectiveRole(user);
  const landlord = await repo.getLandlordByUser(user.id);
  if (!ownsProperty(landlord, listing.property, role)) return null;
  if (application.status === 'draft' && role !== 'admin') return null;
  const members = await repo.listApplicationMembers(application.id);
  return { application, property: listing.property, floorPlan: listing.floorPlan, members, role };
}

/** The stored document with this id, when it belongs to a member of this application. */
export async function documentOfApplication(documentId: ID, members: ApplicationMember[]) {
  const repo = getRepo();
  for (const member of members) {
    const doc = (await repo.listDocuments(member.id)).find((d) => d.id === documentId);
    if (doc) return doc;
  }
  return null;
}
