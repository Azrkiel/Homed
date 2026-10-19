// Document rows on the applicant profile. Uploads attach to the user's member row on their newest application.
import type { Application, ApplicationDocument, ApplicationMember, ID } from '@homed/core';
import type { ApplicationRepo } from '@homed/db';

export type ProfileDocumentRepo = Pick<ApplicationRepo, 'listApplicationsForUser' | 'listApplicationMembers' | 'listDocuments'>;

export interface ApplicationDocuments {
  application: Application;
  member: ApplicationMember;
  /** Newest first. */
  documents: ApplicationDocument[];
}

export interface ApplicantDocuments {
  /** Member row that new uploads attach to. Undefined when the user has no application yet. */
  uploadMember?: ApplicationMember;
  /** Only applications with at least one document, newest application first. */
  groups: ApplicationDocuments[];
}

/** Sorts by an ISO timestamp, newest first. Returns a new array. */
function newestFirst<T>(rows: readonly T[], at: (row: T) => string): T[] {
  return [...rows].sort((a, b) => (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0));
}

/** The user's member row on the most recently created application that has one. */
export function pickUploadMember(
  applications: readonly Application[],
  membersByApplication: ReadonlyMap<ID, readonly ApplicationMember[]>,
  userId: ID,
): ApplicationMember | undefined {
  for (const app of newestFirst(applications, (a) => a.createdAt)) {
    const member = membersByApplication.get(app.id)?.find((m) => m.userId === userId);
    if (member) return member;
  }
  return undefined;
}

/** Drops empty groups, sorts applications newest first and each group's documents newest first. */
export function groupDocumentsByApplication(groups: readonly ApplicationDocuments[]): ApplicationDocuments[] {
  const withDocs = groups
    .filter((g) => g.documents.length > 0)
    .map((g) => ({ ...g, documents: newestFirst(g.documents, (d) => d.createdAt) }));
  return newestFirst(withDocs, (g) => g.application.createdAt);
}

/** Everything the profile page needs about the user's documents, from their applications and member rows. */
export async function loadApplicantDocuments(repo: ProfileDocumentRepo, userId: ID): Promise<ApplicantDocuments> {
  const applications = await repo.listApplicationsForUser(userId);
  const entries = await Promise.all(
    applications.map(async (application) => ({ application, members: await repo.listApplicationMembers(application.id) })),
  );
  const membersByApplication = new Map<ID, ApplicationMember[]>(entries.map((e) => [e.application.id, e.members]));
  const uploadMember = pickUploadMember(applications, membersByApplication, userId);

  const groups: ApplicationDocuments[] = [];
  for (const { application, members } of entries) {
    for (const member of members) {
      if (member.userId !== userId) continue;
      const documents = await repo.listDocuments(member.id);
      groups.push({ application, member, documents });
    }
  }
  return { uploadMember, groups: groupDocumentsByApplication(groups) };
}
