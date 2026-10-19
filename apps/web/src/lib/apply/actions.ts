'use server';
// Server actions for the applicant profile and its documents. RepoError becomes a friendly message, never a stack.
import { revalidatePath } from 'next/cache';
import { RepoError } from '@homed/db';
import { getRepo, today } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { readField } from './form-input';
import { contentMatchesType, deleteAfterDate, safeFilename, validateUpload } from './documents';
import { loadApplicantDocuments } from './profile-documents';
import { parseProfileForm, profileToFormValues } from './profile-form';

const PROFILE_PATH = '/profile/applicant';

export interface ProfileState {
  saved?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** The submitted values, echoed back so a failed save keeps what the student typed. */
  values?: Record<string, string>;
}

export interface UploadState {
  uploaded?: boolean;
  error?: string;
}

function failureMessage(e: unknown, fallback: string): string {
  return e instanceof RepoError && e.message ? e.message : fallback;
}

function echoValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(profileToFormValues(null))) out[key] = readField(formData, key);
  return out;
}

/** Saves the Common App profile for the signed-in student. Landlords are redirected away by the page. */
export async function saveApplicantProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser(undefined, PROFILE_PATH);
  if (effectiveRole(user) === 'landlord') return { error: 'Applicant profiles are for students.' };

  const parsed = parseProfileForm(formData, user.id, { today: today() });
  if (!parsed.ok) {
    return { error: 'Fix the highlighted fields and save again.', fieldErrors: parsed.errors, values: echoValues(formData) };
  }
  try {
    await getRepo().saveApplicantProfile(parsed.profile);
  } catch (e) {
    return { error: failureMessage(e, 'Could not save your profile. Please try again.'), values: echoValues(formData) };
  }
  revalidatePath(PROFILE_PATH);
  return { saved: true };
}

/**
 * Stores one document on the user's member row for their newest application.
 * Bytes are encrypted by the repository and deleted after the decision (90 day backstop).
 */
export async function uploadApplicantDocument(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const user = await requireUser(undefined, PROFILE_PATH);
  if (effectiveRole(user) === 'landlord') return { error: 'Applicant profiles are for students.' };

  const file = formData.get('file');
  if (!(file instanceof File) || (file.size === 0 && file.name === '')) return { error: 'Choose a file to upload.' };

  const check = validateUpload({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) return { error: check.message };

  try {
    const repo = getRepo();
    await repo.purgeExpiredDocuments(today());
    const { uploadMembers } = await loadApplicantDocuments(repo, user.id);
    if (uploadMembers.length === 0) return { error: 'You can attach documents once you start an application.' };

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!contentMatchesType(bytes, check.mime)) {
      return { error: "That file's contents don't look like a real PDF, PNG or JPG. Export it again and retry." };
    }
    // One copy per open application in the batch, so each landlord sees it and each copy can be
    // deleted with its own application's decision.
    for (const member of uploadMembers) {
      await repo.putDocument({
        memberId: member.id,
        filename: safeFilename(file.name),
        mime: check.mime,
        bytes,
        deleteAfter: deleteAfterDate(today()),
      });
    }
  } catch (e) {
    return { error: failureMessage(e, 'Could not upload the file. Please try again.') };
  }
  revalidatePath(PROFILE_PATH);
  return { uploaded: true };
}
