import type { CommuteSummary, GroupMember, ID, ShortlistItem, Swipe, Vote } from './types';

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_LENGTH = 8;

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
  const used = members.filter((m) => m.commute.weeklyMinutes !== 0);
  const first = used[0];
  if (!first) return null;
  const earliest = used
    .map((m) => m.commute.earliestClassMinutes)
    .filter((v): v is number => v !== null);
  return {
    weeklyMinutes: used.reduce((a, m) => a + m.commute.weeklyMinutes, 0),
    averageMinutes: used.reduce((a, m) => a + m.commute.averageMinutes, 0) / used.length,
    earliestClassMinutes: earliest.length > 0 ? Math.max(...earliest) : null,
    usesBus: used.some((m) => m.commute.usesBus),
    extras: first.commute.extras,
  };
}

/** The tightest per-person budget among members that set one; undefined if none. */
export function groupBudget(members: GroupMember[]): number | undefined {
  const budgets = members.map((m) => m.budgetMax).filter((b): b is number => b !== undefined);
  return budgets.length > 0 ? Math.min(...budgets) : undefined;
}

/** Members whose budget the per-person cost exceeds. */
export function membersOverBudget(members: GroupMember[], costPerPerson: number): ID[] {
  return members
    .filter((m) => m.budgetMax !== undefined && costPerPerson > m.budgetMax)
    .map((m) => m.userId);
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
  const members = new Set(memberIds);
  const tallies = shortlist.map((item) => {
    const latest = new Map<ID, Vote>();
    for (const v of votes) {
      if (v.groupId !== item.groupId || v.floorPlanId !== item.floorPlanId || !members.has(v.userId)) continue;
      const prev = latest.get(v.userId);
      if (!prev || v.createdAt >= prev.createdAt) latest.set(v.userId, v);
    }
    let yes = 0;
    let no = 0;
    const pending: ID[] = [];
    for (const id of memberIds) {
      const value = latest.get(id)?.value ?? 0;
      if (value === 1) yes++;
      else if (value === -1) no++;
      else pending.push(id);
    }
    const tally: VoteTally = {
      floorPlanId: item.floorPlanId,
      yes,
      no,
      pending,
      unanimous: memberIds.length > 0 && yes === memberIds.length,
    };
    return { tally, createdAt: item.createdAt };
  });
  tallies.sort((a, b) => {
    const d = b.tally.yes - b.tally.no - (a.tally.yes - a.tally.no);
    if (d !== 0) return d;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
  return tallies.map((t) => t.tally);
}

/** Floor plans every member swiped right on in this group (latest swipe per user wins). */
export function groupMatches(swipes: Swipe[], groupId: ID, memberIds: ID[]): ID[] {
  if (memberIds.length === 0) return [];
  const members = new Set(memberIds);
  const latest = new Map<ID, Map<ID, Swipe>>();
  const order: ID[] = [];
  for (const s of swipes) {
    if (s.groupId !== groupId || !members.has(s.userId)) continue;
    let byUser = latest.get(s.floorPlanId);
    if (!byUser) {
      byUser = new Map();
      latest.set(s.floorPlanId, byUser);
      order.push(s.floorPlanId);
    }
    const prev = byUser.get(s.userId);
    if (!prev || s.createdAt >= prev.createdAt) byUser.set(s.userId, s);
  }
  return order.filter((fp) => {
    const byUser = latest.get(fp);
    return memberIds.every((id) => byUser?.get(id)?.direction === 'right');
  });
}

/** Short unambiguous invite code (no 0/O/1/I/L), length 8, uppercase. `random` is injectable for tests. */
export function makeInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i++) {
    const idx = Math.min(INVITE_ALPHABET.length - 1, Math.max(0, Math.floor(random() * INVITE_ALPHABET.length)));
    code += INVITE_ALPHABET.charAt(idx);
  }
  return code;
}
