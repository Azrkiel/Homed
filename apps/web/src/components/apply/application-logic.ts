// Pure helpers for the application tracker pages and their actions. No React, no server imports.
import { LEASE_CHECKLIST, type Application, type ApplicationMember, type ApplicationStatus, type ID } from '@homed/core';
import type { BadgeTone } from '../ui/badge';
import { readField, type FormSource } from '../../lib/apply/form-input';
import { nextActions } from '../../lib/apply/tracker';

export interface BatchGroup {
  batchId: ID;
  /** Sorted by batchRank, rank 1 first. */
  applications: Application[];
}

export function isLeaderOf(app: Application, userId: ID): boolean {
  return app.userId === userId;
}

/** Leader, or a member row linked to this user. Invitees without an account are never linked. */
export function canViewApplication(app: Application, members: readonly ApplicationMember[], userId: ID): boolean {
  if (!userId) return false;
  return isLeaderOf(app, userId) || members.some((m) => m.userId === userId);
}

/** A batch is visible when the viewer can see at least one of its applications. Empty batches are never visible. */
export function canViewBatch(
  apps: readonly Application[],
  membersByApp: Readonly<Record<ID, readonly ApplicationMember[]>>,
  userId: ID,
): boolean {
  return apps.some((a) => canViewApplication(a, membersByApp[a.id] ?? [], userId));
}

/** Applications sharing a batchId. Batches keep first-seen order; members sorted by batchRank. */
export function groupByBatch(apps: readonly Application[]): BatchGroup[] {
  const order: ID[] = [];
  const byBatch = new Map<ID, Application[]>();
  for (const app of apps) {
    const list = byBatch.get(app.batchId);
    if (list) list.push(app);
    else {
      byBatch.set(app.batchId, [app]);
      order.push(app.batchId);
    }
  }
  return order.map((batchId) => ({
    batchId,
    applications: [...(byBatch.get(batchId) ?? [])].sort((a, b) => a.batchRank - b.batchRank),
  }));
}

export function leaderMember(members: readonly ApplicationMember[], userId: ID): ApplicationMember | undefined {
  return members.find((m) => m.kind === 'leader' && m.userId === userId);
}

/** The viewer's own unfinished rows that are not the leader row (roommates, guarantors linked to them). */
export function ownOpenMembers(members: readonly ApplicationMember[], userId: ID): ApplicationMember[] {
  return members.filter((m) => m.kind !== 'leader' && m.userId === userId && !m.done);
}

/** Checklist ids that were not posted as checked (`check-<id>` = "on"). Empty means all ticked. */
export function missingChecklistItems(checked: ReadonlySet<string>, ids: readonly string[] = LEASE_CHECKLIST.map((i) => i.id)): string[] {
  return ids.filter((id) => !checked.has(id));
}

/** Checklist ids posted as checked from a form. */
export function checkedChecklistItems(src: FormSource, ids: readonly string[] = LEASE_CHECKLIST.map((i) => i.id)): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    if (readField(src, `check-${id}`) === 'on') out.add(id);
  }
  return out;
}

/** Applications the leader may withdraw now. Roommates get []. */
export function withdrawableApplications(apps: readonly Application[], isLeader: boolean): Application[] {
  return apps.filter((a) => nextActions(a, isLeader).includes('withdraw'));
}

export function applicationStatusTone(status: ApplicationStatus): BadgeTone {
  switch (status) {
    case 'submitted':
    case 'under_review':
      return 'accent';
    case 'approved':
    case 'signed':
      return 'good';
    case 'waitlisted':
    case 'lease_sent':
      return 'warn';
    case 'denied':
      return 'bad';
    default:
      return 'neutral';
  }
}

/**
 * Origin for invite links from request headers: x-forwarded-host / host, x-forwarded-proto (default http).
 * '' when no host is known, so inviteUrl yields a relative /apply/invite/<token> path.
 */
export function originFromHeaders(h: { get(name: string): string | null }): string {
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return '';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}
