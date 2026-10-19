'use server';
// Server actions for the application tracker. The repo does not authorize member updates and only checks
// status moves by actor, so every action here re-checks: the viewer leads the batch, the tracker rules
// (canSubmitBatch, nextActions) and, for signing, every lease checklist item posted as checked.
import { revalidatePath } from 'next/cache';
import type { Application, ApplicationMember } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { readField } from './form-input';
import { checkedChecklistItems, leaderMember, missingChecklistItems } from '../../components/apply/application-logic';
import { profileCompleteness } from './profile-form';
import { batchLocked, canSubmitBatch, draftApps, nextActions } from './tracker';

export interface ApplicationActionState {
  ok?: boolean;
  /** Success line shown under the form. */
  message?: string;
  error?: string;
  /** Set when the fix is on the applicant profile page. */
  needsProfile?: boolean;
}

const TRACKER_PATH = '/applications';

function failureMessage(e: unknown, fallback: string): string {
  return e instanceof RepoError && e.message ? e.message : fallback;
}

function revalidateTracker(batchId: string, applicationIds: readonly string[]): void {
  revalidatePath(TRACKER_PATH);
  revalidatePath(`/applications/batch/${batchId}`);
  for (const id of applicationIds) revalidatePath(`/applications/${id}`);
}

interface LoadedBatch {
  apps: Application[];
  membersByApp: Record<string, ApplicationMember[]>;
}

/** Batch the viewer leads. Unknown or not-yours batches return an error, never data. */
async function loadLedBatch(batchId: string, userId: string): Promise<LoadedBatch | { error: string }> {
  if (!batchId) return { error: 'That batch was not found.' };
  const repo = getRepo();
  const apps = await repo.listBatch(batchId);
  if (apps.length === 0) return { error: 'That batch was not found.' };
  if (!apps.every((a) => a.userId === userId)) return { error: 'Only the group leader can change this application.' };
  const membersByApp: Record<string, ApplicationMember[]> = {};
  for (const app of apps) membersByApp[app.id] = await repo.listApplicationMembers(app.id);
  return { apps, membersByApp };
}

/** Application the viewer leads. */
async function loadLedApplication(applicationId: string, userId: string): Promise<Application | { error: string }> {
  if (!applicationId) return { error: 'That application was not found.' };
  const app = await getRepo().getApplication(applicationId);
  if (!app) return { error: 'That application was not found.' };
  if (app.userId !== userId) return { error: 'Only the group leader can change this application.' };
  return app;
}

async function studentOrError(path: string): Promise<{ userId: string } | { error: string }> {
  const user = await requireUser(undefined, path);
  if (effectiveRole(user) === 'landlord') return { error: 'Applications are for students.' };
  return { userId: user.id };
}

/**
 * Leader marks their own part done on every application in the batch, after the applicant profile is complete.
 * Only while the batch is still a draft.
 */
export async function attachLeaderProfile(_prev: ApplicationActionState, formData: FormData): Promise<ApplicationActionState> {
  const who = await studentOrError(TRACKER_PATH);
  if ('error' in who) return who;
  const batchId = readField(formData, 'batchId');

  try {
    const repo = getRepo();
    const profile = await repo.getApplicantProfile(who.userId);
    if (!profileCompleteness(profile).complete) {
      return {
        error: 'Finish your applicant profile first. Add your legal name, phone, current address and student status.',
        needsProfile: true,
      };
    }

    const loaded = await loadLedBatch(batchId, who.userId);
    if ('error' in loaded) return loaded;
    if (batchLocked(loaded.apps)) return { error: 'This batch was already sent, so your part is locked.' };

    for (const app of draftApps(loaded.apps)) {
      const mine = leaderMember(loaded.membersByApp[app.id] ?? [], who.userId);
      if (!mine) return { error: 'You are not the leader on this application.' };
      if (!mine.done) await repo.updateApplicationMember(mine.id, { done: true });
    }
    revalidateTracker(batchId, loaded.apps.map((a) => a.id));
    return { ok: true, message: 'Your part is done.' };
  } catch (e) {
    return { error: failureMessage(e, 'Could not attach your profile. Please try again.') };
  }
}

/** Submits every remaining draft in the batch once canSubmitBatch passes. Safe to retry after a partial failure. */
export async function submitBatch(_prev: ApplicationActionState, formData: FormData): Promise<ApplicationActionState> {
  const who = await studentOrError(TRACKER_PATH);
  if ('error' in who) return who;
  const batchId = readField(formData, 'batchId');

  try {
    const loaded = await loadLedBatch(batchId, who.userId);
    if ('error' in loaded) return loaded;
    const check = canSubmitBatch(loaded.apps, loaded.membersByApp);
    if (!check.ok) return { error: check.reason ?? 'This batch is not ready to submit.' };

    const repo = getRepo();
    for (const app of draftApps(loaded.apps)) {
      await repo.updateApplicationStatus(app.id, 'submitted', who.userId);
    }
    revalidateTracker(batchId, loaded.apps.map((a) => a.id));
    return { ok: true, message: 'Submitted to the landlords.' };
  } catch (e) {
    return { error: failureMessage(e, 'Could not submit. Please try again.') };
  }
}

/**
 * Withdraws the listed applications (one per row, or all open ones). Every id must be in the batch,
 * led by the viewer, and withdrawable now (nextActions).
 */
export async function withdrawApplications(_prev: ApplicationActionState, formData: FormData): Promise<ApplicationActionState> {
  const who = await studentOrError(TRACKER_PATH);
  if ('error' in who) return who;
  const batchId = readField(formData, 'batchId');
  const ids = formData.getAll('applicationId').flatMap((v) => (typeof v === 'string' && v.trim() ? [v.trim()] : []));
  if (ids.length === 0) return { error: 'Choose an application to withdraw.' };

  try {
    const loaded = await loadLedBatch(batchId, who.userId);
    if ('error' in loaded) return loaded;
    const targets: Application[] = [];
    for (const id of ids) {
      const app = loaded.apps.find((a) => a.id === id);
      if (!app) return { error: 'That application is not in this batch.' };
      if (!nextActions(app, true).includes('withdraw')) return { error: 'That application can no longer be withdrawn.' };
      targets.push(app);
    }

    const repo = getRepo();
    for (const app of targets) {
      await repo.updateApplicationStatus(app.id, 'withdrawn', who.userId);
    }
    revalidateTracker(batchId, targets.map((a) => a.id));
    return { ok: true, message: targets.length === 1 ? 'Application withdrawn.' : `${targets.length} applications withdrawn.` };
  } catch (e) {
    return { error: failureMessage(e, 'Could not withdraw. Please try again.') };
  }
}

/**
 * Leader signs a lease that was sent. Every lease checklist item must be posted as checked (check-<id> = on);
 * the client enables the button only then, but the server does not trust that.
 */
export async function signLease(_prev: ApplicationActionState, formData: FormData): Promise<ApplicationActionState> {
  const who = await studentOrError(TRACKER_PATH);
  if ('error' in who) return who;
  const applicationId = readField(formData, 'applicationId');

  try {
    const app = await loadLedApplication(applicationId, who.userId);
    if ('error' in app) return app;
    if (!nextActions(app, true).includes('sign')) return { error: 'This lease is not ready to sign.' };

    const missing = missingChecklistItems(checkedChecklistItems(formData));
    if (missing.length > 0) {
      return { error: `Tick every item on the lease checklist before you sign (${missing.length} not ticked).` };
    }

    await getRepo().updateApplicationStatus(app.id, 'signed', who.userId);
    revalidateTracker(app.batchId, [app.id]);
    return { ok: true, message: 'Lease signed. You are all set.' };
  } catch (e) {
    return { error: failureMessage(e, 'Could not record your signature. Please try again.') };
  }
}
