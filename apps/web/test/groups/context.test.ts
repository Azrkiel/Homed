import { describe, expect, it } from 'vitest';
import type { GroupMember, ScoreWeights, User, WeeklyMeeting } from '@homed/core';
import { defaultGroupSize, groupContextFor, groupSizeNote } from '../../src/lib/groups/context';

const WEIGHTS: ScoreWeights = { price: 0.5, location: 0.3, looks: 0.2 };

function leader(overrides: Partial<User> = {}): User {
  return {
    id: 'u-leader',
    email: 'lead@virginia.edu',
    name: 'Lead',
    role: 'student',
    weights: WEIGHTS,
    extras: ['gym', 'corner'],
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function member(userId: string, budgetMax?: number): GroupMember {
  const m: GroupMember = {
    groupId: 'g1',
    userId,
    role: userId === 'u-leader' ? 'leader' : 'member',
    joinedAt: '2026-10-02T00:00:00.000Z',
  };
  if (budgetMax !== undefined) m.budgetMax = budgetMax;
  return m;
}

const meeting = (buildingId: string, perWeek = 1): WeeklyMeeting => ({ buildingId, perWeek });

describe('groupContextFor', () => {
  it('takes weights and extras from the leader', () => {
    const ctx = groupContextFor(leader(), [member('u-leader', 1500)], [[meeting('thn')]]);
    expect(ctx.weights).toEqual(WEIGHTS);
    expect(ctx.extras).toEqual(['gym', 'corner']);
  });

  it('uses the tightest member budget', () => {
    const ctx = groupContextFor(
      leader(),
      [member('u-leader', 1800), member('u-b', 1200), member('u-c', 1500)],
      [[], [], []],
    );
    expect(ctx.budgetMax).toBe(1200);
  });

  it('ignores members without a budget when others set one', () => {
    const ctx = groupContextFor(leader(), [member('u-leader'), member('u-b', 1400)], [[], []]);
    expect(ctx.budgetMax).toBe(1400);
  });

  it('omits budgetMax entirely when no member sets one', () => {
    const ctx = groupContextFor(leader(), [member('u-leader'), member('u-b')], [[], []]);
    expect('budgetMax' in ctx).toBe(false);
    expect(ctx.budgetMax).toBeUndefined();
  });

  it('concatenates every member meetings in member order', () => {
    const a = [meeting('thn'), meeting('rice', 2)];
    const b = [meeting('olsson')];
    const c: WeeklyMeeting[] = [];
    const ctx = groupContextFor(leader(), [member('u-leader'), member('u-b'), member('u-c')], [a, b, c]);
    expect(ctx.meetings).toEqual([...a, ...b]);
  });

  it('returns no meetings when nobody has any', () => {
    const ctx = groupContextFor(leader(), [member('u-leader')], [[]]);
    expect(ctx.meetings).toEqual([]);
  });
});

describe('defaultGroupSize', () => {
  it('equals the member count inside 1..8', () => {
    expect(defaultGroupSize(1)).toBe(1);
    expect(defaultGroupSize(3)).toBe(3);
    expect(defaultGroupSize(8)).toBe(8);
  });

  it('clamps to 1..8', () => {
    expect(defaultGroupSize(0)).toBe(1);
    expect(defaultGroupSize(-2)).toBe(1);
    expect(defaultGroupSize(9)).toBe(8);
    expect(defaultGroupSize(20)).toBe(8);
  });
});

describe('groupSizeNote', () => {
  it('names the bedroom count and group size for a group', () => {
    expect(groupSizeNote(3)).toBe('Showing places with exactly 3 bedrooms for your group of 3.');
  });

  it('describes solo searches as 1-bedroom and studio places', () => {
    expect(groupSizeNote(1)).toBe('Showing 1-bedroom and studio places for just you.');
  });

  it('matches the clamped default size above 8', () => {
    expect(groupSizeNote(10)).toBe('Showing places with exactly 8 bedrooms for your group of 8.');
  });
});
