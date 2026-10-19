import { describe, expect, it } from 'vitest';
import {
  groupBudget,
  groupMatches,
  makeInviteCode,
  membersOverBudget,
  mergeCommutes,
  tallyVotes,
} from '../src/group';
import type { CommuteSummary, GroupMember, ShortlistItem, Swipe, Vote } from '../src/types';

const commute = (o: Partial<CommuteSummary> = {}): CommuteSummary => ({
  weeklyMinutes: 100,
  averageMinutes: 10,
  earliestClassMinutes: 10,
  usesBus: false,
  extras: [],
  ...o,
});
const member = (userId: string, budgetMax?: number): GroupMember => ({
  groupId: 'g',
  userId,
  role: 'member',
  joinedAt: '2026-01-01T00:00:00Z',
  ...(budgetMax === undefined ? {} : { budgetMax }),
});
const item = (floorPlanId: string, createdAt = '2026-01-01T00:00:00Z'): ShortlistItem => ({
  groupId: 'g',
  floorPlanId,
  addedBy: 'a',
  createdAt,
});
const vote = (userId: string, floorPlanId: string, value: 1 | 0 | -1, createdAt: string, groupId = 'g'): Vote => ({
  groupId,
  userId,
  floorPlanId,
  value,
  createdAt,
});
const swipe = (
  userId: string,
  floorPlanId: string,
  direction: 'right' | 'left',
  createdAt: string,
  groupId: string | null = 'g',
): Swipe => ({
  userId,
  floorPlanId,
  direction,
  createdAt,
  ...(groupId === null ? {} : { groupId }),
});
const T = (n: number) => `2026-01-0${n}T00:00:00Z`;

describe('mergeCommutes', () => {
  it('returns null for empty input', () => {
    expect(mergeCommutes([])).toBeNull();
  });
  it('returns null when every member has 0 weekly minutes', () => {
    expect(mergeCommutes([{ userId: 'a', commute: commute({ weeklyMinutes: 0 }) }])).toBeNull();
  });
  it('merges mean / sum / max / any', () => {
    const r = mergeCommutes([
      { userId: 'a', commute: commute({ weeklyMinutes: 100, averageMinutes: 10, earliestClassMinutes: 8 }) },
      { userId: 'b', commute: commute({ weeklyMinutes: 60, averageMinutes: 20, earliestClassMinutes: 15, usesBus: true }) },
    ]);
    expect(r).toEqual({ weeklyMinutes: 160, averageMinutes: 15, earliestClassMinutes: 15, usesBus: true, extras: [] });
  });
  it('single member passes through', () => {
    const c = commute({ extras: [{ landmarkId: 'gym', minutes: 5 }] });
    expect(mergeCommutes([{ userId: 'a', commute: c }])).toEqual(c);
  });
  it('leaves out zero-weekly members from the averages', () => {
    const r = mergeCommutes([
      { userId: 'a', commute: commute({ weeklyMinutes: 0, averageMinutes: 100, earliestClassMinutes: 99, usesBus: true }) },
      { userId: 'b', commute: commute({ weeklyMinutes: 50, averageMinutes: 6, earliestClassMinutes: 4 }) },
    ]);
    expect(r).toMatchObject({ weeklyMinutes: 50, averageMinutes: 6, earliestClassMinutes: 4, usesBus: false });
  });
  it('takes extras from the first member', () => {
    const r = mergeCommutes([
      { userId: 'a', commute: commute({ extras: [{ landmarkId: 'gym', minutes: 3 }] }) },
      { userId: 'b', commute: commute({ extras: [{ landmarkId: 'gym', minutes: 30 }] }) },
    ]);
    expect(r?.extras).toEqual([{ landmarkId: 'gym', minutes: 3 }]);
  });
  it('takes extras from the first included member when the first is left out', () => {
    const r = mergeCommutes([
      { userId: 'a', commute: commute({ weeklyMinutes: 0, extras: [{ landmarkId: 'gym', minutes: 1 }] }) },
      { userId: 'b', commute: commute({ extras: [{ landmarkId: 'gym', minutes: 30 }] }) },
    ]);
    expect(r?.extras).toEqual([{ landmarkId: 'gym', minutes: 30 }]);
  });
  it('earliestClassMinutes ignores nulls, null when all null', () => {
    const mixed = mergeCommutes([
      { userId: 'a', commute: commute({ earliestClassMinutes: null }) },
      { userId: 'b', commute: commute({ earliestClassMinutes: 7 }) },
    ]);
    expect(mixed?.earliestClassMinutes).toBe(7);
    const none = mergeCommutes([{ userId: 'a', commute: commute({ earliestClassMinutes: null }) }]);
    expect(none?.earliestClassMinutes).toBeNull();
  });
  it('usesBus false when nobody uses the bus', () => {
    expect(mergeCommutes([{ userId: 'a', commute: commute() }])?.usesBus).toBe(false);
  });
});

describe('groupBudget', () => {
  it('undefined for empty', () => expect(groupBudget([])).toBeUndefined());
  it('undefined when nobody set one', () => expect(groupBudget([member('a'), member('b')])).toBeUndefined());
  it('tightest budget', () => expect(groupBudget([member('a', 1200), member('b', 900), member('c')])).toBe(900));
  it('budget of 0 counts', () => expect(groupBudget([member('a', 0), member('b', 500)])).toBe(0));
});

describe('membersOverBudget', () => {
  it('empty for no members', () => expect(membersOverBudget([], 1000)).toEqual([]));
  it('lists members whose budget is exceeded', () => {
    expect(membersOverBudget([member('a', 900), member('b', 1100), member('c', 1000)], 1000)).toEqual(['a']);
  });
  it('ignores members without a budget', () => {
    expect(membersOverBudget([member('a'), member('b', 500)], 800)).toEqual(['b']);
  });
  it('equal cost is not over', () => expect(membersOverBudget([member('a', 800)], 800)).toEqual([]));
});

describe('tallyVotes', () => {
  it('empty shortlist -> empty', () => expect(tallyVotes([], [vote('a', 'f', 1, T(1))], ['a'])).toEqual([]));
  it('no votes -> everyone pending, not unanimous', () => {
    expect(tallyVotes([item('f')], [], ['a', 'b'])).toEqual([
      { floorPlanId: 'f', yes: 0, no: 0, pending: ['a', 'b'], unanimous: false },
    ]);
  });
  it('counts yes and no', () => {
    const [t] = tallyVotes([item('f')], [vote('a', 'f', 1, T(1)), vote('b', 'f', -1, T(1))], ['a', 'b', 'c']);
    expect(t).toMatchObject({ yes: 1, no: 1, pending: ['c'], unanimous: false });
  });
  it('latest vote wins by createdAt regardless of array order', () => {
    const votes = [vote('a', 'f', -1, T(3)), vote('a', 'f', 1, T(2))];
    expect(tallyVotes([item('f')], votes, ['a'])[0]).toMatchObject({ yes: 0, no: 1 });
  });
  it('a later 0 vote clears an earlier yes -> pending', () => {
    const votes = [vote('a', 'f', 1, T(1)), vote('a', 'f', 0, T(2))];
    expect(tallyVotes([item('f')], votes, ['a'])[0]).toMatchObject({ yes: 0, no: 0, pending: ['a'] });
  });
  it('value 0 only = pending', () => {
    expect(tallyVotes([item('f')], [vote('a', 'f', 0, T(1))], ['a'])[0]?.pending).toEqual(['a']);
  });
  it('unanimous when all members said yes', () => {
    const votes = [vote('a', 'f', 1, T(1)), vote('b', 'f', 1, T(1))];
    expect(tallyVotes([item('f')], votes, ['a', 'b'])[0]?.unanimous).toBe(true);
  });
  it('not unanimous with empty member list', () => {
    expect(tallyVotes([item('f')], [], [])[0]?.unanimous).toBe(false);
  });
  it('ignores votes from non-members, other plans and other groups', () => {
    const votes = [vote('x', 'f', 1, T(1)), vote('a', 'other', 1, T(1)), vote('a', 'f', 1, T(1), 'g2')];
    expect(tallyVotes([item('f')], votes, ['a'])[0]).toMatchObject({ yes: 0, pending: ['a'] });
  });
  it('sorts by yes - no desc', () => {
    const votes = [vote('a', 'f1', -1, T(1)), vote('a', 'f2', 1, T(1)), vote('b', 'f3', 1, T(1)), vote('a', 'f3', 1, T(1))];
    const r = tallyVotes([item('f1'), item('f2'), item('f3')], votes, ['a', 'b']);
    expect(r.map((t) => t.floorPlanId)).toEqual(['f3', 'f2', 'f1']);
  });
  it('ties break by shortlist createdAt ascending', () => {
    const r = tallyVotes([item('late', T(5)), item('early', T(1))], [], ['a']);
    expect(r.map((t) => t.floorPlanId)).toEqual(['early', 'late']);
  });
});

describe('groupMatches', () => {
  it('empty swipes -> empty', () => expect(groupMatches([], 'g', ['a'])).toEqual([]));
  it('empty members -> empty', () => expect(groupMatches([swipe('a', 'f', 'right', T(1))], 'g', [])).toEqual([]));
  it('requires every member to swipe right', () => {
    const s = [swipe('a', 'f1', 'right', T(1)), swipe('b', 'f1', 'right', T(1)), swipe('a', 'f2', 'right', T(1))];
    expect(groupMatches(s, 'g', ['a', 'b'])).toEqual(['f1']);
  });
  it('a left swipe blocks the match', () => {
    const s = [swipe('a', 'f', 'right', T(1)), swipe('b', 'f', 'left', T(1))];
    expect(groupMatches(s, 'g', ['a', 'b'])).toEqual([]);
  });
  it('latest swipe per user wins', () => {
    const s = [swipe('a', 'f', 'right', T(1)), swipe('b', 'f', 'left', T(1)), swipe('b', 'f', 'right', T(2))];
    expect(groupMatches(s, 'g', ['a', 'b'])).toEqual(['f']);
    const s2 = [swipe('b', 'f', 'right', T(1)), swipe('a', 'f', 'right', T(1)), swipe('b', 'f', 'left', T(2))];
    expect(groupMatches(s2, 'g', ['a', 'b'])).toEqual([]);
  });
  it('ignores swipes from other groups and solo swipes', () => {
    const s = [swipe('a', 'f', 'right', T(1)), swipe('b', 'f', 'right', T(1), 'g2'), swipe('b', 'f', 'right', T(1), null)];
    expect(groupMatches(s, 'g', ['a', 'b'])).toEqual([]);
  });
  it('ignores swipes from non-members', () => {
    const s = [swipe('a', 'f', 'right', T(1)), swipe('x', 'f', 'left', T(1))];
    expect(groupMatches(s, 'g', ['a'])).toEqual(['f']);
  });
});

describe('makeInviteCode', () => {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  it('is 8 chars from the alphabet by default', () => {
    for (let i = 0; i < 50; i++) expect(makeInviteCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });
  it('never includes 0 O 1 I L', () => {
    for (let i = 0; i < 50; i++) expect(makeInviteCode()).not.toMatch(/[01OIL]/);
  });
  it('alphabet has 31 characters', () => expect(ALPHABET).toHaveLength(31));
  it('random() = 0 -> first character repeated', () => expect(makeInviteCode(() => 0)).toBe('AAAAAAAA'));
  it('random() near 1 -> last character, no overflow', () => {
    expect(makeInviteCode(() => 0.9999999999)).toBe('99999999');
    expect(makeInviteCode(() => 1)).toBe('99999999');
  });
  it('is deterministic for a given random sequence', () => {
    const seq = () => {
      let i = 0;
      return () => (i++ % 31) / 31;
    };
    const a = makeInviteCode(seq());
    expect(a).toBe(ALPHABET.slice(0, 8));
    expect(makeInviteCode(seq())).toBe(a);
  });
  it('calls random once per character', () => {
    let n = 0;
    makeInviteCode(() => {
      n++;
      return 0.5;
    });
    expect(n).toBe(8);
  });
  it('maps each alphabet slot', () => {
    for (let k = 0; k < 31; k++) {
      expect(makeInviteCode(() => (k + 0.5) / 31)).toBe(ALPHABET.charAt(k).repeat(8));
    }
  });
});
