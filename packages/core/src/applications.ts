import type { Application, ApplicationMember, ApplicationStatus, MemberStatusView } from './types';
import { notImplemented } from './not-implemented';

/** Max places in one batch. */
export const MAX_BATCH_SIZE = 3;

/**
 * Allowed status moves:
 * draft -> submitted | withdrawn
 * submitted -> under_review | withdrawn
 * under_review -> approved | waitlisted | denied | withdrawn
 * waitlisted -> approved | denied | withdrawn
 * approved -> lease_sent | withdrawn
 * lease_sent -> signed | withdrawn
 * denied, signed, withdrawn: terminal.
 */
export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_MOVES[from].includes(to);
}

const ALLOWED_MOVES: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'withdrawn'],
  under_review: ['approved', 'waitlisted', 'denied', 'withdrawn'],
  waitlisted: ['approved', 'denied', 'withdrawn'],
  approved: ['lease_sent', 'withdrawn'],
  lease_sent: ['signed', 'withdrawn'],
  denied: [],
  signed: [],
  withdrawn: [],
};

/**
 * Who may make an allowed move: applicants make draft -> submitted, lease_sent -> signed and
 * any -> withdrawn; the landlord makes every other allowed move. Disallowed move -> null.
 */
export function transitionActor(from: ApplicationStatus, to: ApplicationStatus): 'applicant' | 'landlord' | null {
  if (!canTransition(from, to)) return null;
  if (to === 'withdrawn') return 'applicant';
  if (from === 'draft' && to === 'submitted') return 'applicant';
  if (from === 'lease_sent' && to === 'signed') return 'applicant';
  return 'landlord';
}

/** After one application in a batch is approved: the other still-open (not denied/withdrawn/signed) applications to offer withdrawing. None approved -> []. */
export function withdrawSuggestions(batch: Application[]): Application[] {
  return notImplemented('withdrawSuggestions');
}

/** Roommates see only done / not done for each other. Never income, documents or contact details. Name falls back to "Roommate" / "Guarantor". */
export function memberStatusViews(members: ApplicationMember[]): MemberStatusView[] {
  return notImplemented('memberStatusViews');
}

/** Members holding things up (not done), for the leader view. */
export function pendingMembers(members: ApplicationMember[]): ApplicationMember[] {
  return notImplemented('pendingMembers');
}

/** Status label + one-line explanation for the tracker. */
export function statusLabel(status: ApplicationStatus): { label: string; detail: string } {
  return notImplemented('statusLabel');
}

/** Ordered tracker steps for the progress bar. waitlisted/denied display at the 'approved' (decision) step. */
export const TRACKER_STEPS: ApplicationStatus[] = ['submitted', 'under_review', 'approved', 'lease_sent', 'signed'];

/** Shown on every application screen. */
export const APPLY_IS_NOT_SIGNING =
  'Applying is not signing. You can withdraw an application, but a signed lease is binding.';

export const STUDENT_LEGAL_SERVICES = {
  name: 'UVA Student Legal Services',
  url: 'https://www.studentlegalservices.org/',
  blurb: 'Free, confidential lease review for UVA students. Have them read your lease before you sign.',
};

/**
 * Plain-language lease checklist shown before signing. Shared by web and mobile.
 * Phase 2 fills this with 10-14 items (rent and due date, lease dates vs move-in, individual vs
 * joint liability, deposit and its return, utilities, subletting, early termination, renewal,
 * guarantor obligations, move-in inspection, maintenance requests, parking, pets, fees).
 */
export const LEASE_CHECKLIST: { id: string; text: string }[] = [];
