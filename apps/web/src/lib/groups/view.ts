// Pure view helpers for the group pages. Never shows another member's budget number.
import {
  mergeCommutes,
  membersOverBudget,
  tallyVotes,
  type CommuteSummary,
  type GroupMember,
  type ShortlistItem,
  type Vote,
  type VoteTally,
  type MemberCommute,
} from '@homed/core';

export interface MemberView {
  userId: string;
  name: string;
  role: 'leader' | 'member';
  isYou: boolean;
  /** Only the viewer's own budget; null for everyone else. */
  budgetMax: number | null;
  hasBudget: boolean;
}

/** Leader first, then by joinedAt. Other members' budgets are never included, only hasBudget. */
export function memberViews(members: GroupMember[], names: Map<string, string>, viewerId: string): MemberView[] {
  const sorted = [...members].sort((a, b) => {
    if (a.role !== b.role) return a.role === 'leader' ? -1 : 1;
    return a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0;
  });
  return sorted.map((m) => {
    const isYou = m.userId === viewerId;
    return {
      userId: m.userId,
      name: names.get(m.userId) ?? 'Member',
      role: m.role,
      isYou,
      budgetMax: isYou && m.budgetMax !== undefined ? m.budgetMax : null,
      hasBudget: m.budgetMax !== undefined,
    };
  });
}

export interface ShortlistRow {
  floorPlanId: string;
  note: string | null;
  addedBy: string;
  tally: VoteTally;
  myVote: 1 | 0 | -1;
  /** Member ids whose budget is below costPerPerson. */
  overBudget: string[];
  commute: CommuteSummary | null;
  costPerPerson: number | null;
}

export interface BuildShortlistArgs {
  shortlist: ShortlistItem[];
  votes: Vote[];
  members: GroupMember[];
  viewerId: string;
  costPerPerson: (floorPlanId: string) => number | null;
  commutesFor: (floorPlanId: string) => MemberCommute[];
}

/** Shortlist rows in tallyVotes order. Null cost -> no over-budget members. */
export function buildShortlistRows(args: BuildShortlistArgs): ShortlistRow[] {
  const { shortlist, votes, members, viewerId, costPerPerson, commutesFor } = args;
  const memberIds = members.map((m) => m.userId);
  const itemByFloorPlan = new Map(shortlist.map((item) => [item.floorPlanId, item]));

  return tallyVotes(shortlist, votes, memberIds).map((tally) => {
    const item = itemByFloorPlan.get(tally.floorPlanId);
    const cost = costPerPerson(tally.floorPlanId);
    return {
      floorPlanId: tally.floorPlanId,
      note: item?.note ?? null,
      addedBy: item?.addedBy ?? '',
      tally,
      myVote: myVoteFor(votes, item?.groupId, tally.floorPlanId, viewerId),
      overBudget: cost === null ? [] : membersOverBudget(members, cost),
      commute: mergeCommutes(commutesFor(tally.floorPlanId)),
      costPerPerson: cost,
    };
  });
}

/** The viewer's latest vote on one floor plan in one group; 0 when none. */
function myVoteFor(votes: Vote[], groupId: string | undefined, floorPlanId: string, viewerId: string): 1 | 0 | -1 {
  let latest: Vote | undefined;
  for (const v of votes) {
    if (v.groupId !== groupId || v.floorPlanId !== floorPlanId || v.userId !== viewerId) continue;
    if (!latest || v.createdAt >= latest.createdAt) latest = v;
  }
  return latest?.value ?? 0;
}

/**
 * Short status line for over-budget members. Only counts are shown, never names or budget numbers.
 * `_names` is accepted for call-site symmetry but unused on purpose.
 */
export function overBudgetLabel(overBudget: string[], _names: Map<string, string>, viewerId: string): string | null {
  if (overBudget.length === 0) return null;
  const viewerOver = overBudget.includes(viewerId);
  const others = overBudget.length - (viewerOver ? 1 : 0);
  if (viewerOver) {
    if (others === 0) return 'Over budget for you';
    return `Over budget for you and ${others} other${others === 1 ? '' : 's'}`;
  }
  return others === 1 ? 'Over budget for 1 member' : `Over budget for ${others} members`;
}

/** Join link for an invite code. Trailing slashes on the origin are dropped. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/groups/join/${code}`;
}

export type BudgetInputResult = { ok: true; value: number | null } | { ok: false; message: string };

const BUDGET_FORMAT = /^\$?(\d{1,3}(?:,\d{3})+|\d+)$/;
const BUDGET_MIN = 1;
const BUDGET_MAX = 20000;

/** Parse a per-person budget typed by a member. Blank clears it (null). Whole dollars, $1 to $20,000. */
export function parseBudgetInput(raw: string): BudgetInputResult {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  const match = BUDGET_FORMAT.exec(text);
  if (!match) {
    return { ok: false, message: 'Enter a whole-dollar amount like 1500, or leave it blank to clear.' };
  }
  const value = Number((match[1] ?? '').replace(/,/g, ''));
  if (value < BUDGET_MIN || value > BUDGET_MAX) {
    return { ok: false, message: 'Enter an amount from $1 to $20,000.' };
  }
  return { ok: true, value };
}
