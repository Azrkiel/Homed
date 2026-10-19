'use server';
// Landlord status moves for one application. Re-checks access, then the allowed landlord moves, then the store rules.
import { revalidatePath } from 'next/cache';
import { statusLabel } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { landlordApplicationFor } from './application-access';
import { isLandlordMove, parseStatus } from './application-view';
import type { LandlordActionState } from './result';

function fail(message: string): LandlordActionState {
  return { ok: false, message };
}

/** Form fields: applicationId, to (the target status). Submitted by one of the buttons in ApplicationStatusForm. */
export async function updateApplicationStatusAction(
  _prev: LandlordActionState,
  fd: FormData,
): Promise<LandlordActionState> {
  const applicationId = fd.get('applicationId');
  if (typeof applicationId !== 'string' || !applicationId) return fail('Application not found.');
  const user = await requireUser('landlord', `/landlord/applications/${applicationId}`);

  const record = await landlordApplicationFor(user, applicationId);
  if (!record) return fail('Application not found.');

  const to = parseStatus(fd.get('to'));
  if (!to) return fail('Choose a status to move to.');
  const from = record.application.status;
  if (!isLandlordMove(from, to)) {
    return fail(`You cannot move this application from ${statusLabel(from).label} to ${statusLabel(to).label}.`);
  }

  try {
    await getRepo().updateApplicationStatus(applicationId, to, user.id);
  } catch (e) {
    if (e instanceof RepoError) return fail(e.message || 'Could not update the status. Please try again.');
    throw e;
  }

  revalidatePath('/landlord');
  revalidatePath('/landlord/applications');
  revalidatePath(`/landlord/applications/${applicationId}`);
  return { ok: true, message: 'Status updated.' };
}
