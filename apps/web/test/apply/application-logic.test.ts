import { LEASE_CHECKLIST, type Application, type ApplicationMember, type ApplicationStatus } from '@homed/core';
import { describe, expect, it } from 'vitest';
import {
  applicationStatusTone,
  canViewApplication,
  canViewBatch,
  checkedChecklistItems,
  groupByBatch,
  leaderMember,
  missingChecklistItems,
  originFromHeaders,
  ownOpenMembers,
  withdrawableApplications,
} from '../../src/components/apply/application-logic';

function app(id: string, extra: Partial<Application> = {}): Application {
  return {
    id,
    userId: 'leader',
    floorPlanId: `fp-${id}`,
    batchId: 'batch-1',
    batchRank: 1,
    status: 'draft',
    statusHistory: [{ status: 'draft', at: '2026-10-01T00:00:00Z', by: 'leader' }],
    fees: { perPerson: [], perPersonTotal: 0, people: 1, applicationTotal: 0, complianceIssues: [] },
    createdAt: '2026-10-01T00:00:00Z',
    ...extra,
  };
}

function member(id: string, applicationId: string, extra: Partial<ApplicationMember> = {}): ApplicationMember {
  return {
    id,
    applicationId,
    kind: 'roommate',
    email: `${id}@virginia.edu`,
    inviteToken: `tok-${id}`,
    inviteStatus: 'pending',
    done: false,
    updatedAt: '2026-10-01T00:00:00Z',
    ...extra,
  };
}

describe('canViewApplication', () => {
  const a = app('a1');
  const members = [
    member('leader-m', 'a1', { kind: 'leader', userId: 'leader', done: true }),
    member('roomie-m', 'a1', { userId: 'roomie' }),
    member('guar-m', 'a1', { kind: 'guarantor' }),
  ];

  it('lets the leader and linked members in', () => {
    expect(canViewApplication(a, members, 'leader')).toBe(true);
    expect(canViewApplication(a, members, 'roomie')).toBe(true);
  });

  it('keeps out strangers and unlinked invitees', () => {
    expect(canViewApplication(a, members, 'stranger')).toBe(false);
    expect(canViewApplication(a, members, '')).toBe(false);
  });
});

describe('canViewBatch', () => {
  it('is false for an empty batch', () => {
    expect(canViewBatch([], {}, 'leader')).toBe(false);
  });

  it('is true when the viewer leads or is a member of any application in the batch', () => {
    const apps = [app('a1'), app('a2', { batchRank: 2, floorPlanId: 'fp-a2' })];
    const membersByApp = {
      a1: [member('m1', 'a1', { userId: 'roomie' })],
      a2: [member('m2', 'a2')],
    };
    expect(canViewBatch(apps, membersByApp, 'leader')).toBe(true);
    expect(canViewBatch(apps, membersByApp, 'roomie')).toBe(true);
    expect(canViewBatch(apps, membersByApp, 'nobody')).toBe(false);
  });
});

describe('groupByBatch', () => {
  it('groups by batchId in first-seen order and sorts each batch by batchRank', () => {
    const apps = [
      app('x2', { batchId: 'b-new', batchRank: 2 }),
      app('y1', { batchId: 'b-old', batchRank: 1 }),
      app('x1', { batchId: 'b-new', batchRank: 1 }),
      app('y2', { batchId: 'b-old', batchRank: 2 }),
    ];
    const groups = groupByBatch(apps);
    expect(groups.map((g) => g.batchId)).toEqual(['b-new', 'b-old']);
    expect(groups[0]?.applications.map((a) => a.id)).toEqual(['x1', 'x2']);
    expect(groups[1]?.applications.map((a) => a.id)).toEqual(['y1', 'y2']);
  });

  it('returns no groups for no applications', () => {
    expect(groupByBatch([])).toEqual([]);
  });
});

describe('member helpers', () => {
  const members = [
    member('leader-m', 'a1', { kind: 'leader', userId: 'leader' }),
    member('roomie-open', 'a1', { userId: 'roomie' }),
    member('roomie-done', 'a2', { userId: 'roomie', done: true }),
    member('other', 'a1', { userId: 'other' }),
  ];

  it('finds the leader row by user id', () => {
    expect(leaderMember(members, 'leader')?.id).toBe('leader-m');
    expect(leaderMember(members, 'roomie')).toBeUndefined();
  });

  it('lists only the viewer\'s own unfinished non-leader rows', () => {
    expect(ownOpenMembers(members, 'roomie').map((m) => m.id)).toEqual(['roomie-open']);
    expect(ownOpenMembers(members, 'leader')).toEqual([]);
  });
});

describe('lease checklist', () => {
  const all = LEASE_CHECKLIST.map((i) => i.id);

  it('reports every item as missing when none are checked', () => {
    expect(missingChecklistItems(new Set(), all)).toEqual(all);
  });

  it('reports only the unchecked items', () => {
    const [first, ...rest] = all;
    expect(missingChecklistItems(new Set([first!]), all)).toEqual(rest);
  });

  it('is complete when every id is checked', () => {
    expect(missingChecklistItems(new Set(all), all)).toEqual([]);
  });

  it('reads check-<id> fields with value "on" as checked, ignoring others', () => {
    const fd = new URLSearchParams();
    fd.set(`check-${all[0]}`, 'on');
    fd.set(`check-${all[1]}`, 'off');
    fd.set('unrelated', 'on');
    expect([...checkedChecklistItems(fd, all)]).toEqual([all[0]]);
  });
});

describe('withdrawableApplications', () => {
  it('returns nothing for a roommate, and only applications the leader may withdraw', () => {
    const apps = [
      app('d', { status: 'draft' }),
      app('w', { status: 'withdrawn' }),
      app('s', { status: 'signed' }),
    ];
    expect(withdrawableApplications(apps, false)).toEqual([]);
    expect(withdrawableApplications(apps, true).map((a) => a.id)).toEqual(['d']);
  });
});

describe('applicationStatusTone', () => {
  it('maps each status to a badge tone', () => {
    const tones: Record<ApplicationStatus, string> = {
      draft: 'neutral',
      submitted: 'accent',
      under_review: 'accent',
      approved: 'good',
      waitlisted: 'warn',
      denied: 'bad',
      lease_sent: 'warn',
      signed: 'good',
      withdrawn: 'neutral',
    };
    for (const [status, tone] of Object.entries(tones)) {
      expect(applicationStatusTone(status as ApplicationStatus)).toBe(tone);
    }
  });
});

describe('originFromHeaders', () => {
  const headersOf = (h: Record<string, string>) => ({ get: (name: string) => h[name.toLowerCase()] ?? null });

  it('uses forwarded host and proto when present', () => {
    expect(originFromHeaders(headersOf({ 'x-forwarded-host': 'homed.example', 'x-forwarded-proto': 'https', host: 'localhost:3010' }))).toBe(
      'https://homed.example',
    );
  });

  it('falls back to host with http', () => {
    expect(originFromHeaders(headersOf({ host: 'localhost:3010' }))).toBe('http://localhost:3010');
  });

  it('returns an empty origin when no host is known, so links stay relative', () => {
    expect(originFromHeaders(headersOf({}))).toBe('');
  });
});
