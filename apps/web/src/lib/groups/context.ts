// Pure group helpers: the ranking context for a group and the group-size default. No I/O.
import { groupBudget, type GroupMember, type User, type WeeklyMeeting } from '@homed/core';
import type { GroupContext } from '../ranking';

/**
 * Ranking overrides for a group. Weights and extras come from the leader; the budget is the
 * tightest member budget (omitted when nobody set one); meetings are every member's, concatenated.
 */
export function groupContextFor(
  leader: User,
  members: GroupMember[],
  meetingsByMember: WeeklyMeeting[][],
): GroupContext {
  const ctx: GroupContext = {
    group: true,
    weights: leader.weights,
    meetings: meetingsByMember.flat(),
    extras: leader.extras,
  };
  const budget = groupBudget(members);
  if (budget !== undefined) ctx.budgetMax = budget;
  return ctx;
}

/** Default group-size filter: the member count, kept within 1..8. */
export function defaultGroupSize(memberCount: number): number {
  return Math.min(8, Math.max(1, memberCount));
}

/** One-line note shown above results for the group-size filter. Studios count as 1 bedroom. */
export function groupSizeNote(memberCount: number): string {
  const size = defaultGroupSize(memberCount);
  if (size === 1) return 'Showing 1-bedroom and studio places for just you.';
  return `Showing places with exactly ${size} bedrooms for your group of ${size}.`;
}
