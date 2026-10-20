// Pure helpers for the roommate and guarantor invite pages and their actions. No React, no server imports.
import { memberStatusViews, type ApplicationMember, type ID, type MemberStatusView } from '@homed/core';

/** Lower-case, trimmed email. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when both emails are non-empty and equal, ignoring case and surrounding spaces. */
export function sameEmail(a: string, b: string): boolean {
  const left = normalizeEmail(a);
  return left !== '' && left === normalizeEmail(b);
}

/** Member rows of every application in a batch, in application order. */
export function flattenMembers(membersByApp: Readonly<Record<ID, readonly ApplicationMember[]>>): ApplicationMember[] {
  return Object.values(membersByApp).flatMap((rows) => [...rows]);
}

/**
 * Rows that one invitee controls across the batch: same kind, same email, on any application.
 * The invitee's own row is always included (even if the email differs in case or spacing), once.
 */
export function siblingRows(allRows: readonly ApplicationMember[], invitee: ApplicationMember): ApplicationMember[] {
  const out: ApplicationMember[] = [];
  const seen = new Set<ID>();
  for (const row of allRows) {
    const mine = row.id === invitee.id || (row.kind === invitee.kind && sameEmail(row.email, invitee.email));
    if (!mine || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  if (!seen.has(invitee.id)) out.unshift(invitee);
  return out;
}

/**
 * Name of the student a guarantor guarantees: the guaranteed member's name, else the leader's name,
 * else a generic phrase. Names only, never emails.
 */
export function guaranteeTargetName(
  guarantor: ApplicationMember,
  allRows: readonly ApplicationMember[],
  leaderName: string | undefined,
): string {
  const target = guarantor.guarantorFor ? allRows.find((r) => r.id === guarantor.guarantorFor) : undefined;
  return target?.name?.trim() || leaderName?.trim() || 'the student';
}

/** Roommate-visible status for the members of one application, minus the viewer's own row. Done / not done only. */
export function otherMemberViews(members: readonly ApplicationMember[], selfId: ID): MemberStatusView[] {
  return memberStatusViews([...members]).filter((v) => v.memberId !== selfId);
}
