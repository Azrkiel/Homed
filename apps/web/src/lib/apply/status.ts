// Every application status change in the web app goes through here, so documents are deleted after
// the decision (Plan.md: "Sensitive files are encrypted and deleted after the decision").
import type { Application, ApplicationStatus, ID } from '@homed/core';
import type { ApplicationRepo } from '@homed/db';
import { DOCUMENTS_CLOSED } from './profile-documents';

export async function changeApplicationStatus(
  repo: Pick<ApplicationRepo, 'updateApplicationStatus' | 'deleteDocumentsForApplication'>,
  applicationId: ID,
  to: ApplicationStatus,
  byUserId: ID,
): Promise<Application> {
  const app = await repo.updateApplicationStatus(applicationId, to, byUserId);
  if (DOCUMENTS_CLOSED.has(to)) await repo.deleteDocumentsForApplication(applicationId);
  return app;
}
