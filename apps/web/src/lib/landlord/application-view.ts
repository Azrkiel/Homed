// Pure view rules for the landlord applications inbox and detail. No store or framework imports.
import {
  canTransition,
  transitionActor,
  type ApplicationMember,
  type ApplicationStatus,
} from '@homed/core';

const ALL_STATUSES: ApplicationStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'waitlisted',
  'denied',
  'lease_sent',
  'signed',
  'withdrawn',
];

/** Button labels for the status moves a landlord makes. */
const LANDLORD_MOVE_LABELS: Partial<Record<ApplicationStatus, string>> = {
  under_review: 'Start review',
  approved: 'Approve',
  waitlisted: 'Waitlist',
  denied: 'Deny',
  lease_sent: 'Send lease',
};

export interface LandlordAction {
  to: ApplicationStatus;
  label: string;
}

/** Target statuses the landlord may move to from `status`, in status order. Applicant-only moves are left out. */
export function landlordActions(status: ApplicationStatus): LandlordAction[] {
  return ALL_STATUSES.filter((to) => canTransition(status, to) && transitionActor(status, to) === 'landlord').map(
    (to) => ({ to, label: LANDLORD_MOVE_LABELS[to] ?? to }),
  );
}

/** True when a landlord may make the move `from` -> `to`. */
export function isLandlordMove(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return landlordActions(from).some((a) => a.to === to);
}

/** Parses a form value into a known status, or null. */
export function parseStatus(value: FormDataEntryValue | null): ApplicationStatus | null {
  return typeof value === 'string' && (ALL_STATUSES as string[]).includes(value) ? (value as ApplicationStatus) : null;
}

const KIND_LABELS: Record<ApplicationMember['kind'], string> = {
  leader: 'Leader',
  roommate: 'Roommate',
  guarantor: 'Guarantor',
};

export function memberKindLabel(kind: ApplicationMember['kind']): string {
  return KIND_LABELS[kind];
}

/** Stored name, else the kind label. */
export function memberDisplayName(member: Pick<ApplicationMember, 'kind' | 'name'>): string {
  return member.name?.trim() || KIND_LABELS[member.kind];
}

const SAFE_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
};

/** Only pdf / png / jpeg are served with their type; anything else downloads as opaque bytes. */
export function safeContentType(mime: string): string {
  return SAFE_MIME[mime.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * ASCII-only filename safe for a quoted Content-Disposition value: no path parts, quotes, control
 * characters or non-ASCII. Empty results fall back to `fallback`.
 */
export function safeFilename(name: string, fallback = 'document'): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\;]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .trim();
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback;
}

/** Content-Disposition attachment header value for a sanitized filename. */
export function attachmentDisposition(filename: string): string {
  return `attachment; filename="${safeFilename(filename)}"`;
}
