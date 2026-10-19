'use server';
// Server actions for the roommate and guarantor invite pages. The hidden `token` picks the member row; the
// roommate must also be signed in with the invited email. Member updates are not authorized by the repo,
// so every write here re-checks the token, the email match, the draft status and the batch.
import { revalidatePath } from 'next/cache';
import type { Application, ApplicationMember } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { readField } from './form-input';
import { profileCompleteness } from './profile-form';
import { parseGuarantorForm } from './tracker';
import { flattenMembers, sameEmail, siblingRows } from '../../components/apply/invite-logic';

export interface InviteActionState {
  ok?: boolean;
  /** Success line shown under the form. */
  message?: string;
  error?: string;
  /** Guarantor form: per-field errors and the typed values, echoed back. */
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** Set when the fix is on the applicant profile page. */
  needsProfile?: boolean;
}

const INVALID_LINK = 'This invite link is not valid. Ask the student for a new one.';
const LOCKED = 'This batch was already sent, so your part is locked.';

function failureMessage(e: unknown, fallback: string): string {
  return e instanceof RepoError && e.message ? e.message : fallback;
}

/** Invite page path for a token. Not exported: a 'use server' file may only export async functions. */
function invitePath(token: string): string {
  return `/apply/invite/${encodeURIComponent(token)}`;
}

interface LoadedBatch {
  apps: Application[];
  membersByApp: Record<string, ApplicationMember[]>;
}

/** The batch that holds the member's application. Null when the application is gone. */
async function loadBatchFor(applicationId: string): Promise<LoadedBatch | null> {
  const repo = getRepo();
  const app = await repo.getApplication(applicationId);
  if (!app) return null;
  const apps = await repo.listBatch(app.batchId);
  if (apps.length === 0) return null;
  const membersByApp: Record<string, ApplicationMember[]> = {};
  for (const a of apps) membersByApp[a.id] = await repo.listApplicationMembers(a.id);
  return { apps, membersByApp };
}

/** Revalidates the tracker, the batch, each application and the invite page. */
function revalidateInvite(token: string, loaded: LoadedBatch): void {
  revalidatePath('/applications');
  const batchId = loaded.apps[0]?.batchId;
  if (batchId) revalidatePath(`/applications/batch/${batchId}`);
  for (const app of loaded.apps) revalidatePath(`/applications/${app.id}`);
  revalidatePath(invitePath(token));
}

/**
 * Signed-in roommate attaches their applicant profile and marks their part done on every application in the
 * batch where their email has a roommate row. Only while the batch is still a draft.
 */
export async function attachRoommateProfile(_prev: InviteActionState, formData: FormData): Promise<InviteActionState> {
  const token = readField(formData, 'token');
  if (!token) return { error: INVALID_LINK };
  const user = await requireUser(undefined, invitePath(token));
  if (effectiveRole(user) === 'landlord') return { error: 'Applications are for students.' };

  try {
    const repo = getRepo();
    const member = await repo.getMemberByInviteToken(token);
    if (!member || member.kind !== 'roommate') return { error: INVALID_LINK };
    if (!sameEmail(user.email, member.email)) {
      return { error: 'This link was sent to a different email address. Sign in with that address to continue.' };
    }

    const profile = await repo.getApplicantProfile(user.id);
    if (!profile || !profileCompleteness(profile).complete) {
      return {
        error: 'Finish your applicant profile first. Add your legal name, phone, current address and student status.',
        needsProfile: true,
      };
    }

    const loaded = await loadBatchFor(member.applicationId);
    if (!loaded) return { error: INVALID_LINK };
    if (loaded.apps.some((a) => a.status !== 'draft')) return { error: LOCKED };
    if (loaded.apps.some((a) => a.userId === user.id)) return { error: 'You lead this application, so you do not need an invite.' };

    const rows = siblingRows(flattenMembers(loaded.membersByApp), member).filter((r) => r.kind === 'roommate');
    for (const row of rows) {
      await repo.updateApplicationMember(row.id, {
        userId: user.id,
        name: profile.legalName,
        inviteStatus: 'accepted',
        done: true,
      });
    }

    revalidateInvite(token, loaded);
    return { ok: true, message: 'Your part is done.' };
  } catch (e) {
    return { error: failureMessage(e, 'Could not attach your profile. Please try again.') };
  }
}

/**
 * Guarantor signs the consent form (no account). Sets name, done and inviteStatus on every guarantor row with
 * the same email across the batch. Only while the batch is still a draft.
 */
export async function signGuarantorConsent(_prev: InviteActionState, formData: FormData): Promise<InviteActionState> {
  const token = readField(formData, 'token');
  if (!token) return { error: INVALID_LINK };
  const echo = {
    name: readField(formData, 'name'),
    relationship: readField(formData, 'relationship'),
    signature: readField(formData, 'signature'),
  };

  const parsed = parseGuarantorForm(formData);
  if (!parsed.ok) {
    return { error: 'Fix the highlighted fields and sign again.', fieldErrors: parsed.errors, values: echo };
  }

  try {
    const repo = getRepo();
    const member = await repo.getMemberByInviteToken(token);
    if (!member || member.kind !== 'guarantor') return { error: INVALID_LINK };

    const loaded = await loadBatchFor(member.applicationId);
    if (!loaded) return { error: INVALID_LINK };
    if (loaded.apps.some((a) => a.status !== 'draft')) return { error: LOCKED };

    const rows = siblingRows(flattenMembers(loaded.membersByApp), member).filter((r) => r.kind === 'guarantor');
    for (const row of rows) {
      await repo.updateApplicationMember(row.id, {
        name: parsed.name,
        inviteStatus: 'accepted',
        done: true,
      });
    }

    revalidateInvite(token, loaded);
    return { ok: true, message: 'Thank you. Your part is done.' };
  } catch (e) {
    return { error: failureMessage(e, 'Could not save your signature. Please try again.'), values: echo };
  }
}
