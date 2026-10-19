import type { CommuteSummary, GroupMember, ID, ShortlistItem, Swipe, Vote } from './types';
import { notImplemented } from './not-implemented';

export interface MemberCommute {
  userId: ID;
  commute: CommuteSummary;
}

/**
 * Merged group commute for one property: averageMinutes = mean of members' averageMinutes,
 * weeklyMinutes = sum, earliestClassMinutes = max across members (the worst early walk), usesBus = any,
 * extras = from the first member. Members whose commute has weeklyMinutes 0 are left out; none left -> null.
 */
export function mergeCommutes(members: MemberCommute[]): CommuteSummary | null {
  return notImplemented('mergeCommutes');
}

/** The tightest per-person budget among members that set one; undefined if none. */
export function groupBudget(members: GroupMember[]): number | undefined {
  return notImplemented('groupBudget');
}

/** Members whose budget the per-person cost exceeds. */
export function membersOverBudget(members: GroupMember[], costPerPerson: number): ID[] {
  return notImplemented('membersOverBudget');
}

export interface VoteTally {
  floorPlanId: ID;
  yes: number;
  no: number;
  /** Members who have not voted (value 0 or no vote). */
  pending: ID[];
  /** Everyone voted yes. */
  unanimous: boolean;
}

/** Tally the latest vote per (user, floor plan) for every shortlist item, sorted by yes - no desc, then createdAt. */
export function tallyVotes(shortlist: ShortlistItem[], votes: Vote[], memberIds: ID[]): VoteTally[] {
  return notImplemented('tallyVotes');
}

/** Floor plans every member swiped right on in this group (latest swipe per user wins). */
export function groupMatches(swipes: Swipe[], groupId: ID, memberIds: ID[]): ID[] {
  return notImplemented('groupMatches');
}

/** Short unambiguous invite code (no 0/O/1/I/L), length 8, uppercase. `random` is injectable for tests. */
export function makeInviteCode(random?: () => number): string {
  return notImplemented('makeInviteCode');
}
