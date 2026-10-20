import { describe, expect, it } from 'vitest';
import type { CommuteSummary, GroupMember, ShortlistItem, Vote } from '@homed/core';
import {
  buildShortlistRows,
  inviteUrl,
  memberViews,
  overBudgetLabel,
  parseBudgetInput,
} from '../../src/lib/groups/view';

const member = (userId: string, role: 'leader' | 'member', joinedAt: string, budgetMax?: number): GroupMember => {
  const m: GroupMember = { groupId: 'g1', userId, role, joinedAt };
  if (budgetMax !== undefined) m.budgetMax = budgetMax;
  return m;
};

const names = new Map([
  ['u-lead', 'Ana'],
  ['u-b', 'Ben'],
  ['u-c', 'Cy'],
]);

describe('memberViews', () => {
  // Joined out of order on purpose; leader must still come first.
  const members: GroupMember[] = [
    member('u-c', 'member', '2026-10-04T00:00:00.000Z', 1337),
    member('u-lead', 'leader', '2026-10-01T00:00:00.000Z', 1111),
    member('u-b', 'member', '2026-10-02T00:00:00.000Z', 2468),
  ];

  it('puts the leader first, then members by joinedAt', () => {
    const views = memberViews(members, names, 'u-b');
    expect(views.map((v) => v.userId)).toEqual(['u-lead', 'u-b', 'u-c']);
    expect(views.map((v) => v.role)).toEqual(['leader', 'member', 'member']);
  });

  it('marks only the viewer with isYou and shows the viewer their own budget', () => {
    const views = memberViews(members, names, 'u-b');
    const you = views.find((v) => v.userId === 'u-b');
    expect(you).toMatchObject({ name: 'Ben', isYou: true, budgetMax: 2468, hasBudget: true });
    expect(views.filter((v) => v.isYou)).toHaveLength(1);
  });

  it('never includes other members budget numbers (privacy)', () => {
    const json = JSON.stringify(memberViews(members, names, 'u-b'));
    expect(json).not.toContain('1111');
    expect(json).not.toContain('1337');
    expect(json).toContain('2468');
    const other = memberViews(members, names, 'u-c');
    expect(JSON.stringify(other)).not.toContain('2468');
    expect(JSON.stringify(other)).not.toContain('1111');
  });

  it('reports hasBudget for other members without revealing the number', () => {
    const views = memberViews(members, names, 'u-b');
    const lead = views.find((v) => v.userId === 'u-lead');
    expect(lead).toMatchObject({ name: 'Ana', budgetMax: null, hasBudget: true, isYou: false });
  });

  it('reports no budget as null and hasBudget false', () => {
    const views = memberViews([member('u-lead', 'leader', '2026-10-01T00:00:00.000Z')], names, 'u-lead');
    expect(views[0]).toMatchObject({ budgetMax: null, hasBudget: false, isYou: true });
  });

  it('falls back to a generic name when the name is unknown', () => {
    const views = memberViews([member('u-x', 'member', '2026-10-01T00:00:00.000Z')], new Map(), 'u-y');
    expect(views[0]?.name).toBe('Member');
  });
});

describe('buildShortlistRows', () => {
  const memberList: GroupMember[] = [
    member('u-lead', 'leader', '2026-10-01T00:00:00.000Z', 1500),
    member('u-b', 'member', '2026-10-02T00:00:00.000Z', 1000),
  ];

  const commute = (weeklyMinutes: number): CommuteSummary => ({
    weeklyMinutes,
    averageMinutes: weeklyMinutes / 2,
    earliestClassMinutes: 5,
    usesBus: false,
    extras: [],
  });

  const shortlist: ShortlistItem[] = [
    { groupId: 'g1', floorPlanId: 'fp-a', addedBy: 'u-lead', createdAt: '2026-10-05T00:00:00.000Z' },
    { groupId: 'g1', floorPlanId: 'fp-b', addedBy: 'u-b', note: 'near gym', createdAt: '2026-10-06T00:00:00.000Z' },
  ];

  const votes: Vote[] = [
    { groupId: 'g1', userId: 'u-lead', floorPlanId: 'fp-a', value: -1, createdAt: '2026-10-07T00:00:00.000Z' },
    { groupId: 'g1', userId: 'u-lead', floorPlanId: 'fp-b', value: 1, createdAt: '2026-10-07T00:00:00.000Z' },
    { groupId: 'g1', userId: 'u-b', floorPlanId: 'fp-b', value: 1, createdAt: '2026-10-07T00:00:00.000Z' },
    // Viewer changed their mind on fp-a: latest wins.
    { groupId: 'g1', userId: 'u-b', floorPlanId: 'fp-a', value: 1, createdAt: '2026-10-08T00:00:00.000Z' },
    { groupId: 'g1', userId: 'u-b', floorPlanId: 'fp-a', value: 0, createdAt: '2026-10-09T00:00:00.000Z' },
  ];

  const base = {
    shortlist,
    votes,
    members: memberList,
    viewerId: 'u-b',
    costPerPerson: (id: string) => (id === 'fp-a' ? 1200 : 900),
    commutesFor: (id: string) =>
      id === 'fp-a'
        ? [
            { userId: 'u-lead', commute: commute(60) },
            { userId: 'u-b', commute: commute(40) },
          ]
        : [],
  };

  it('orders rows by tally (yes minus no), then by when added', () => {
    const rows = buildShortlistRows(base);
    // fp-b: 2 yes; fp-a: 1 no (u-b's later clear wipes their yes; u-lead says no).
    expect(rows.map((r) => r.floorPlanId)).toEqual(['fp-b', 'fp-a']);
    expect(rows[0]?.tally).toMatchObject({ yes: 2, no: 0, unanimous: true });
  });

  it('gives the viewer their latest vote, or 0 when none', () => {
    const rows = buildShortlistRows(base);
    expect(rows.find((r) => r.floorPlanId === 'fp-a')?.myVote).toBe(0);
    expect(rows.find((r) => r.floorPlanId === 'fp-b')?.myVote).toBe(1);
    const asLead = buildShortlistRows({ ...base, viewerId: 'u-lead' });
    expect(asLead.find((r) => r.floorPlanId === 'fp-a')?.myVote).toBe(-1);
  });

  it('carries note and addedBy, null note when absent', () => {
    const rows = buildShortlistRows(base);
    expect(rows.find((r) => r.floorPlanId === 'fp-b')).toMatchObject({ note: 'near gym', addedBy: 'u-b' });
    expect(rows.find((r) => r.floorPlanId === 'fp-a')?.note).toBeNull();
  });

  it('lists members over budget at the cost per person', () => {
    const rows = buildShortlistRows(base);
    // 1200 is over u-b's 1000 but under u-lead's 1500.
    expect(rows.find((r) => r.floorPlanId === 'fp-a')?.overBudget).toEqual(['u-b']);
    expect(rows.find((r) => r.floorPlanId === 'fp-b')?.overBudget).toEqual([]);
  });

  it('gives no over-budget members and a null cost when cost is unknown', () => {
    const rows = buildShortlistRows({ ...base, costPerPerson: () => null });
    expect(rows.every((r) => r.overBudget.length === 0)).toBe(true);
    expect(rows.every((r) => r.costPerPerson === null)).toBe(true);
  });

  it('reports the cost per person on each row', () => {
    const rows = buildShortlistRows(base);
    expect(rows.find((r) => r.floorPlanId === 'fp-a')?.costPerPerson).toBe(1200);
  });

  it('merges commutes and uses null when there are none', () => {
    const rows = buildShortlistRows(base);
    expect(rows.find((r) => r.floorPlanId === 'fp-a')?.commute).toMatchObject({ weeklyMinutes: 100, averageMinutes: 25 });
    expect(rows.find((r) => r.floorPlanId === 'fp-b')?.commute).toBeNull();
  });

  it('returns no rows for an empty shortlist', () => {
    expect(buildShortlistRows({ ...base, shortlist: [] })).toEqual([]);
  });
});

describe('overBudgetLabel', () => {
  it('is null when nobody is over budget', () => {
    expect(overBudgetLabel([], names, 'u-b')).toBeNull();
  });

  it('says so for the viewer alone', () => {
    expect(overBudgetLabel(['u-b'], names, 'u-b')).toBe('Over budget for you');
  });

  it('counts the others when the viewer is included', () => {
    expect(overBudgetLabel(['u-b', 'u-lead'], names, 'u-b')).toBe('Over budget for you and 1 other');
    expect(overBudgetLabel(['u-lead', 'u-c', 'u-b'], names, 'u-b')).toBe('Over budget for you and 2 others');
  });

  it('counts members when the viewer is not over budget', () => {
    expect(overBudgetLabel(['u-lead'], names, 'u-b')).toBe('Over budget for 1 member');
    expect(overBudgetLabel(['u-lead', 'u-c'], names, 'u-b')).toBe('Over budget for 2 members');
  });

  it('never shows a budget number', () => {
    const labels = [
      overBudgetLabel(['u-b'], names, 'u-b'),
      overBudgetLabel(['u-lead', 'u-c', 'u-b'], names, 'u-b'),
      overBudgetLabel(['u-lead', 'u-c'], names, 'u-b'),
    ];
    for (const label of labels) expect(label).not.toMatch(/\d{3,}|\$/);
  });
});

describe('inviteUrl', () => {
  it('builds the join link', () => {
    expect(inviteUrl('https://homed.app', 'ABCD2345')).toBe('https://homed.app/groups/join/ABCD2345');
  });

  it('drops trailing slashes on the origin', () => {
    expect(inviteUrl('https://homed.app/', 'ABCD2345')).toBe('https://homed.app/groups/join/ABCD2345');
    expect(inviteUrl('http://localhost:3010//', 'XY')).toBe('http://localhost:3010/groups/join/XY');
  });
});

describe('parseBudgetInput', () => {
  it('treats blank input as clearing the budget', () => {
    expect(parseBudgetInput('')).toEqual({ ok: true, value: null });
    expect(parseBudgetInput('   ')).toEqual({ ok: true, value: null });
  });

  it('accepts plain whole dollars', () => {
    expect(parseBudgetInput('1500')).toEqual({ ok: true, value: 1500 });
    expect(parseBudgetInput(' 900 ')).toEqual({ ok: true, value: 900 });
  });

  it('accepts a leading dollar sign and commas', () => {
    expect(parseBudgetInput('$1,500')).toEqual({ ok: true, value: 1500 });
    expect(parseBudgetInput('$1500')).toEqual({ ok: true, value: 1500 });
    expect(parseBudgetInput('1,500')).toEqual({ ok: true, value: 1500 });
    expect(parseBudgetInput('$20,000')).toEqual({ ok: true, value: 20000 });
  });

  it('accepts the bounds 1 and 20000', () => {
    expect(parseBudgetInput('1')).toEqual({ ok: true, value: 1 });
    expect(parseBudgetInput('20000')).toEqual({ ok: true, value: 20000 });
  });

  it('rejects zero and amounts above 20000 with a plain message', () => {
    const zero = parseBudgetInput('0');
    expect(zero.ok).toBe(false);
    const big = parseBudgetInput('20001');
    expect(big.ok).toBe(false);
    if (!zero.ok && !big.ok) {
      expect(zero.message).toMatch(/\$1 to \$20,000/);
      expect(big.message).toMatch(/\$1 to \$20,000/);
    }
  });

  it('rejects cents, signs, decimals, letters and bad comma placement', () => {
    for (const bad of ['1500.50', '-5', '1e3', 'abc', '$', '1,50', '1 500', '$ 1500', '1,5000', '12,34,567']) {
      const r = parseBudgetInput(bad);
      expect(r.ok, bad).toBe(false);
    }
  });

  it('gives a message for invalid input', () => {
    const r = parseBudgetInput('lots');
    expect(r).toEqual({ ok: false, message: expect.any(String) });
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0);
  });
});
