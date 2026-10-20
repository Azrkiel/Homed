import type { Application, ApplicationMember, ApplicationStatus, MemberStatusView } from './types';

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
  if (!batch.some((a) => a.status === 'approved')) return [];
  const closed: ApplicationStatus[] = ['approved', 'denied', 'withdrawn', 'signed'];
  return batch.filter((a) => !closed.includes(a.status));
}

/** Roommates see only done / not done for each other. Never income, documents or contact details. Name falls back to "Roommate" / "Guarantor". */
export function memberStatusViews(members: ApplicationMember[]): MemberStatusView[] {
  return members.map((m) => ({
    memberId: m.id,
    name: m.name || (m.kind === 'guarantor' ? 'Guarantor' : 'Roommate'),
    kind: m.kind,
    done: m.done,
  }));
}

/** Members holding things up (not done), for the leader view. */
export function pendingMembers(members: ApplicationMember[]): ApplicationMember[] {
  return members.filter((m) => !m.done);
}

const STATUS_LABELS: Record<ApplicationStatus, { label: string; detail: string }> = {
  draft: { label: 'Draft', detail: 'Not sent yet. Finish your application and submit it.' },
  submitted: { label: 'Submitted', detail: 'Sent to the landlord. They have not started reviewing it yet.' },
  under_review: { label: 'Under review', detail: 'The landlord is reviewing your application.' },
  approved: { label: 'Approved', detail: 'The landlord approved your application. A lease should be on its way.' },
  waitlisted: { label: 'Waitlisted', detail: 'No unit is free right now. The landlord will contact you if one opens up.' },
  denied: { label: 'Denied', detail: 'The landlord did not approve this application.' },
  lease_sent: { label: 'Lease sent', detail: 'Read the lease carefully, then sign it if you agree.' },
  signed: { label: 'Signed', detail: 'The lease is signed. You are all set.' },
  withdrawn: { label: 'Withdrawn', detail: 'This application was withdrawn.' },
};

/** Status label + one-line explanation for the tracker. */
export function statusLabel(status: ApplicationStatus): { label: string; detail: string } {
  return STATUS_LABELS[status];
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
export const LEASE_CHECKLIST: { id: string; text: string }[] = [
  { id: 'rent-due', text: 'The monthly rent amount, when it is due, how to pay, and any late fee.' },
  { id: 'lease-dates', text: 'The lease start and end dates match when you actually need to move in and out.' },
  { id: 'liability', text: 'Whether the lease is individual or joint. With a joint lease, you can be held responsible for your roommates unpaid rent.' },
  { id: 'deposit', text: 'The security deposit amount, what it covers, and when and how it is returned.' },
  { id: 'utilities', text: 'Which utilities and internet are included, and what you pay for yourself.' },
  { id: 'subletting', text: 'Whether you may sublet or assign the lease, for example if you study abroad.' },
  { id: 'early-termination', text: 'What it costs to end the lease early, and how much notice you must give.' },
  { id: 'renewal', text: 'How renewal works, when you must give notice, and whether the rent can go up.' },
  { id: 'guarantor', text: 'What your guarantor is agreeing to pay, and for how long.' },
  { id: 'move-in-inspection', text: 'A move-in inspection: note and photograph existing damage so it is not charged to you later.' },
  { id: 'maintenance', text: 'How to request repairs, and how fast the landlord must respond.' },
  { id: 'parking-pets', text: 'The rules and costs for parking and pets, including any fees.' },
  { id: 'fees', text: 'Every fee in the lease: application, admin, cleaning, and move-out charges.' },
];
