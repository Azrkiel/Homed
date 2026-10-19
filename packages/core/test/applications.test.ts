import { describe, expect, it } from 'vitest';
import {
  APPLY_IS_NOT_SIGNING, canTransition, LEASE_CHECKLIST, MAX_BATCH_SIZE, memberStatusViews, pendingMembers,
  statusLabel, STUDENT_LEGAL_SERVICES, TRACKER_STEPS, transitionActor, withdrawSuggestions,
} from '../src/applications';
import type { Application, ApplicationMember, ApplicationStatus } from '../src/types';

const ALL: ApplicationStatus[] = [
  'draft', 'submitted', 'under_review', 'approved', 'waitlisted', 'denied', 'lease_sent', 'signed', 'withdrawn',
];

const ALLOWED: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'withdrawn'],
  under_review: ['approved', 'waitlisted', 'denied', 'withdrawn'],
  waitlisted: ['approved', 'denied', 'withdrawn'],
  approved: ['lease_sent', 'withdrawn'],
  lease_sent: ['signed', 'withdrawn'],
  denied: [],
  signed: [],
  withdrawn: [],
};

function app(id: string, status: ApplicationStatus, rank = 1): Application {
  return {
    id, userId: 'u1', floorPlanId: `fp-${id}`, batchId: 'b1', batchRank: rank, status, statusHistory: [],
    fees: { perPerson: [], perPersonTotal: 0, people: 1, applicationTotal: 0, complianceIssues: [] },
    createdAt: '2026-10-01T00:00:00Z',
  };
}

function member(over: Partial<ApplicationMember> = {}): ApplicationMember {
  return {
    id: 'm1', applicationId: 'a1', kind: 'roommate', email: 'r@virginia.edu', name: 'Riley',
    inviteToken: 'secret-token', inviteStatus: 'accepted', done: false, updatedAt: '2026-10-01T00:00:00Z',
    ...over,
  };
}

describe('canTransition: full matrix', () => {
  for (const from of ALL) {
    for (const to of ALL) {
      const expected = ALLOWED[from].includes(to);
      it(`${from} -> ${to} is ${expected ? 'allowed' : 'blocked'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
      });
    }
  }
});

describe('transitionActor: full matrix', () => {
  const applicantMoves = new Set(['draft>submitted', 'lease_sent>signed']);
  for (const from of ALL) {
    for (const to of ALL) {
      const allowed = ALLOWED[from].includes(to);
      const expected = !allowed
        ? null
        : to === 'withdrawn' || applicantMoves.has(`${from}>${to}`)
          ? 'applicant'
          : 'landlord';
      it(`${from} -> ${to} is ${String(expected)}`, () => {
        expect(transitionActor(from, to)).toBe(expected);
      });
    }
  }
});

describe('constants', () => {
  it('MAX_BATCH_SIZE is 3', () => expect(MAX_BATCH_SIZE).toBe(3));
  it('TRACKER_STEPS order', () =>
    expect(TRACKER_STEPS).toEqual(['submitted', 'under_review', 'approved', 'lease_sent', 'signed']));
  it('has the apply-is-not-signing notice', () => expect(APPLY_IS_NOT_SIGNING).toMatch(/not signing/));
  it('has legal services info', () => expect(STUDENT_LEGAL_SERVICES.url).toMatch(/^https:/));
});

describe('statusLabel', () => {
  it('under_review matches the spec', () => {
    expect(statusLabel('under_review')).toEqual({
      label: 'Under review',
      detail: 'The landlord is reviewing your application.',
    });
  });
  for (const s of ALL) {
    it(`${s} has a label and detail`, () => {
      const r = statusLabel(s);
      expect(r.label.trim().length).toBeGreaterThan(0);
      expect(r.detail.trim().length).toBeGreaterThan(0);
    });
  }
  it('labels are unique', () => {
    expect(new Set(ALL.map((s) => statusLabel(s).label)).size).toBe(ALL.length);
  });
});

describe('withdrawSuggestions', () => {
  it('is empty for an empty batch', () => expect(withdrawSuggestions([])).toEqual([]));

  it('is empty when none approved', () => {
    expect(withdrawSuggestions([app('a', 'submitted'), app('b', 'under_review', 2), app('c', 'waitlisted', 3)])).toEqual([]);
  });

  it('returns the other open applications, not the approved one', () => {
    const a = app('a', 'approved');
    const b = app('b', 'under_review', 2);
    const c = app('c', 'submitted', 3);
    expect(withdrawSuggestions([a, b, c])).toEqual([b, c]);
  });

  it('excludes denied, withdrawn and signed', () => {
    const batch = [app('a', 'approved'), app('b', 'denied', 2), app('c', 'withdrawn', 3), app('d', 'signed', 4)];
    expect(withdrawSuggestions(batch)).toEqual([]);
  });

  it('keeps waitlisted and draft as open', () => {
    const w = app('w', 'waitlisted', 2);
    const d = app('d', 'draft', 3);
    expect(withdrawSuggestions([app('a', 'approved'), w, d])).toEqual([w, d]);
  });

  it('preserves input order and does not mutate', () => {
    const batch = [app('x', 'under_review', 2), app('a', 'approved'), app('y', 'submitted', 3)];
    const copy = [...batch];
    expect(withdrawSuggestions(batch).map((a) => a.id)).toEqual(['x', 'y']);
    expect(batch).toEqual(copy);
  });

  it('a lone approved application yields nothing', () => {
    expect(withdrawSuggestions([app('a', 'approved')])).toEqual([]);
  });
});

describe('memberStatusViews', () => {
  it('returns [] for no members', () => expect(memberStatusViews([])).toEqual([]));

  it('exposes exactly memberId, name, kind, done', () => {
    const [v] = memberStatusViews([member({ done: true })]);
    expect(Object.keys(v!).sort()).toEqual(['done', 'kind', 'memberId', 'name']);
    expect(v).toEqual({ memberId: 'm1', name: 'Riley', kind: 'roommate', done: true });
  });

  it('never leaks email, token, userId, or extra fields', () => {
    const rich = {
      ...member({ userId: 'u9', guarantorFor: 'm0' }),
      monthlyIncome: 5000,
      documents: ['pay-stub.pdf'],
      phone: '555-1234',
    } as ApplicationMember;
    const [v] = memberStatusViews([rich]);
    expect(Object.keys(v!).sort()).toEqual(['done', 'kind', 'memberId', 'name']);
    const json = JSON.stringify(v);
    for (const s of ['r@virginia.edu', 'secret-token', 'u9', '5000', 'pay-stub', '555-1234']) {
      expect(json).not.toContain(s);
    }
  });

  it('falls back to "Roommate" for a nameless roommate', () => {
    expect(memberStatusViews([member({ name: undefined })])[0]?.name).toBe('Roommate');
  });

  it('falls back to "Guarantor" for a nameless guarantor', () => {
    expect(memberStatusViews([member({ kind: 'guarantor', name: undefined })])[0]?.name).toBe('Guarantor');
  });

  it('falls back on an empty-string name', () => {
    expect(memberStatusViews([member({ name: '' })])[0]?.name).toBe('Roommate');
    expect(memberStatusViews([member({ kind: 'guarantor', name: '' })])[0]?.name).toBe('Guarantor');
  });

  it('keeps real names for guarantors and roommates', () => {
    const v = memberStatusViews([member({ kind: 'guarantor', name: 'Pat' }), member({ id: 'm2', name: 'Sam' })]);
    expect(v.map((x) => x.name)).toEqual(['Pat', 'Sam']);
  });

  it('keeps order and kinds, leader included', () => {
    const v = memberStatusViews([
      member({ id: 'l', kind: 'leader', name: 'Lee', done: true }),
      member({ id: 'r', kind: 'roommate' }),
      member({ id: 'g', kind: 'guarantor', done: true }),
    ]);
    expect(v.map((x) => [x.memberId, x.kind, x.done])).toEqual([
      ['l', 'leader', true], ['r', 'roommate', false], ['g', 'guarantor', true],
    ]);
  });
});

describe('pendingMembers', () => {
  it('returns [] for no members', () => expect(pendingMembers([])).toEqual([]));
  it('returns [] when everyone is done', () => {
    expect(pendingMembers([member({ done: true }), member({ id: 'm2', done: true })])).toEqual([]);
  });
  it('returns only members not done, as the same objects, in order', () => {
    const a = member({ id: 'a', done: true });
    const b = member({ id: 'b' });
    const c = member({ id: 'c', kind: 'guarantor' });
    const r = pendingMembers([a, b, c]);
    expect(r).toEqual([b, c]);
    expect(r[0]).toBe(b);
  });
  it('includes members who have not accepted their invite', () => {
    const p = member({ id: 'p', inviteStatus: 'pending' });
    expect(pendingMembers([p])).toEqual([p]);
  });
});

describe('LEASE_CHECKLIST', () => {
  it('has 10-14 items', () => {
    expect(LEASE_CHECKLIST.length).toBeGreaterThanOrEqual(10);
    expect(LEASE_CHECKLIST.length).toBeLessThanOrEqual(14);
  });
  it('has unique non-empty ids', () => {
    const ids = LEASE_CHECKLIST.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.trim().length).toBeGreaterThan(0);
  });
  it('has non-empty text and only id/text keys', () => {
    for (const i of LEASE_CHECKLIST) {
      expect(i.text.trim().length).toBeGreaterThan(10);
      expect(Object.keys(i).sort()).toEqual(['id', 'text']);
    }
  });
  it('covers the required topics', () => {
    const all = LEASE_CHECKLIST.map((i) => i.text.toLowerCase()).join(' | ');
    for (const w of ['rent', 'dates', 'joint', 'deposit', 'utilit', 'sublet', 'early', 'renew', 'guarantor',
      'inspection', 'repair', 'parking', 'pets', 'fee']) {
      expect(all).toContain(w);
    }
  });
});
