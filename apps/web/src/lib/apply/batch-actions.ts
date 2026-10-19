'use server';
// Server action for the batch builder. Fees are quoted here from the stored floor plans, never from the form.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { quoteFees, type FeeQuote } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { parseBatchForm } from './batch';

export interface BatchState {
  error?: string;
}

const BUILDER_PATH = '/apply/new';

function failureMessage(e: unknown, fallback: string): string {
  return e instanceof RepoError && e.message ? e.message : fallback;
}

/**
 * Creates one application per place, all sharing a batch, then opens the batch tracker.
 * Returns a BatchState on any problem; redirect() runs outside try/catch.
 */
export async function createBatch(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const user = await requireUser(undefined, BUILDER_PATH);
  if (effectiveRole(user) === 'landlord') return { error: 'Applications are for students.' };

  const parsed = parseBatchForm(formData, { leaderEmail: user.email });
  if (!parsed.ok) return { error: parsed.message };

  const repo = getRepo();
  const fees: FeeQuote[] = [];
  const people = 1 + parsed.invitees.filter((inv) => inv.kind === 'roommate').length;
  try {
    for (const floorPlanId of parsed.floorPlanIds) {
      const listing = await repo.getListing(floorPlanId);
      if (!listing) return { error: 'One of these places is no longer listed. Remove it and try again.' };
      fees.push(quoteFees(listing.floorPlan, people));
    }
  } catch (e) {
    return { error: failureMessage(e, 'Could not check these places. Please try again.') };
  }

  let batchId: string | undefined;
  try {
    const apps = await repo.createApplicationBatch({
      leaderId: user.id,
      ...(parsed.groupId !== undefined ? { groupId: parsed.groupId } : {}),
      floorPlanIds: parsed.floorPlanIds,
      invitees: parsed.invitees,
      fees,
    });
    batchId = apps[0]?.batchId;
  } catch (e) {
    return { error: failureMessage(e, 'Could not send your applications. Please try again.') };
  }
  if (!batchId) return { error: 'Could not send your applications. Please try again.' };

  revalidatePath('/applications');
  redirect(`/applications/batch/${batchId}`);
}
