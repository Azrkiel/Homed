import {
  canTransition,
  memberStatusViews,
  statusLabel,
  TRACKER_STEPS,
  type Application,
  type ApplicationMember,
  type ApplicationStatus,
} from '@homed/core';
import { readField, type FormSource } from './form-input';

export type StepState = 'done' | 'current' | 'upcoming';
export type Terminal = 'withdrawn' | 'denied' | 'waitlisted' | null;
export type ApplyAction = 'submit' | 'withdraw' | 'sign';

export interface TrackerStep {
  status: ApplicationStatus;
  label: string;
  state: StepState;
}

/** Tracker step that a status lights up. -1: no step (draft, withdrawn). waitlisted/denied use the decision step. */
const STEP_INDEX: Record<ApplicationStatus, number> = {
  draft: -1,
  submitted: 0,
  under_review: 1,
  approved: 2,
  waitlisted: 2,
  denied: 2,
  lease_sent: 3,
  signed: 4,
  withdrawn: -1,
};

const TERMINAL: Partial<Record<ApplicationStatus, Terminal>> = {
  withdrawn: 'withdrawn',
  denied: 'denied',
  waitlisted: 'waitlisted',
};

/**
 * Progress steps for one application. Status step is current, earlier steps done, later upcoming.
 * Withdrawn: nothing current; a step is done when the application reached that status (statusHistory).
 */
export function trackerView(app: Application): { steps: TrackerStep[]; terminal: Terminal } {
  const current = STEP_INDEX[app.status];
  const reached = new Set(app.statusHistory.map((h) => h.status));
  const steps: TrackerStep[] = TRACKER_STEPS.map((status, i) => {
    let state: StepState = 'upcoming';
    if (app.status === 'withdrawn') {
      if (reached.has(status)) state = 'done';
    } else if (current >= 0) {
      if (i < current) state = 'done';
      else if (i === current) state = 'current';
    }
    return { status, label: statusLabel(status).label, state };
  });
  return { steps, terminal: TERMINAL[app.status] ?? null };
}

/** The batch's applications still being put together. Withdrawn and already-sent ones are left out. */
export function draftApps(apps: Application[]): Application[] {
  return apps.filter((a) => a.status === 'draft');
}

/** Members can no longer change their part once no draft is left in the batch. */
export function batchLocked(apps: Application[]): boolean {
  return draftApps(apps).length === 0;
}

/**
 * A batch can be submitted when it still has drafts and every member of every draft is done.
 * Withdrawn choices are ignored, and drafts left by a half-finished submit can be sent on retry.
 * Empty member list counts as not done.
 */
export function canSubmitBatch(
  apps: Application[],
  membersByApp: Record<string, ApplicationMember[]>,
): { ok: boolean; reason?: string } {
  if (apps.length === 0) return { ok: false, reason: 'There is nothing to submit.' };
  const drafts = draftApps(apps);
  if (drafts.length === 0) return { ok: false, reason: 'There is nothing left to submit.' };

  for (const app of drafts) {
    const members = membersByApp[app.id] ?? [];
    if (members.length === 0) return { ok: false, reason: 'An application has no members.' };
    const pending = memberStatusViews(members).filter((m) => !m.done);
    const first = pending[0];
    if (first) {
      const more = pending.length - 1;
      const tail = more > 0 ? ` and ${more} more` : '';
      return { ok: false, reason: `Waiting on ${first.name}${tail}.` };
    }
  }
  return { ok: true };
}

/** Which actions the viewer may take now. Only the leader acts; non-leaders get []. */
export function nextActions(app: Application, isLeader: boolean): ApplyAction[] {
  const out: ApplyAction[] = [];
  if (!isLeader) return out;
  if (canTransition(app.status, 'submitted')) out.push('submit');
  if (canTransition(app.status, 'withdrawn')) out.push('withdraw');
  if (app.status === 'lease_sent') out.push('sign');
  return out;
}

/** Roommate or guarantor invite link. A trailing slash on origin is dropped. */
export function inviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/apply/invite/${encodeURIComponent(token)}`;
}

export type GuarantorConsentResult =
  | { ok: true; name: string; relationship: string; signature: string }
  | { ok: false; errors: Record<string, string> };

/** Signature match: case and whitespace ignored. */
function normalizeName(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/**
 * Guarantor consent form: name, relationship, typed full-name signature, consent checkbox ('on').
 * The signature must match the name, ignoring case and spaces.
 */
export function parseGuarantorForm(fd: FormSource): GuarantorConsentResult {
  const errors: Record<string, string> = {};
  const name = readField(fd, 'name');
  const relationship = readField(fd, 'relationship');
  const signature = readField(fd, 'signature');
  const consent = fd.get('consent');

  if (!name) errors.name = 'Enter your full name.';
  if (!relationship) errors.relationship = 'Enter how you are related to the student.';
  if (!signature) errors.signature = 'Type your full name to sign.';
  else if (name && normalizeName(signature) !== normalizeName(name)) {
    errors.signature = 'Your signature must match your full name.';
  }
  if (consent !== 'on') errors.consent = 'Tick the box to agree to guarantee the lease.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, name, relationship, signature };
}
