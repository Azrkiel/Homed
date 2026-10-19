import type { Application, ApplicationMember, ApplicationStatus } from '@homed/core';
import { describe, expect, it } from 'vitest';
import {
  batchLocked,
  canSubmitBatch,
  draftApps,
  inviteUrl,
  nextActions,
  parseGuarantorForm,
  trackerView,
} from '../../src/lib/apply/tracker';

function app(status: ApplicationStatus, history: ApplicationStatus[] = []): Application {
  const statuses: ApplicationStatus[] = history.length > 0 ? history : ['draft', status];
  return {
    id: `app-${status}`,
    userId: 'leader',
    floorPlanId: 'fp-1',
    batchId: 'batch-1',
    batchRank: 1,
    status,
    statusHistory: statuses.map((s, i) => ({ status: s, at: `2026-10-0${i + 1}T00:00:00Z`, by: 'leader' })),
    fees: { perPerson: [], perPersonTotal: 0, people: 1, applicationTotal: 0, complianceIssues: [] },
    createdAt: '2026-10-01T00:00:00Z',
  };
}

function member(id: string, done: boolean, extra: Partial<ApplicationMember> = {}): ApplicationMember {
  return {
    id,
    applicationId: 'app-1',
    kind: 'roommate',
    email: `${id}@virginia.edu`,
    inviteToken: `tok-${id}`,
    inviteStatus: 'accepted',
    done,
    updatedAt: '2026-10-01T00:00:00Z',
    ...extra,
  };
}

function states(status: ApplicationStatus, history?: ApplicationStatus[]): string[] {
  return trackerView(app(status, history)).steps.map((s) => s.state);
}

describe('trackerView', () => {
  it('shows the five steps with labels in order', () => {
    const v = trackerView(app('submitted'));
    expect(v.steps.map((s) => s.status)).toEqual(['submitted', 'under_review', 'approved', 'lease_sent', 'signed']);
    expect(v.steps[0]?.label).toBe('Submitted');
    expect(v.steps[2]?.label).toBe('Approved');
  });

  it('marks earlier steps done, the status step current, later steps upcoming', () => {
    expect(states('under_review')).toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    expect(states('lease_sent')).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
    expect(states('signed')).toEqual(['done', 'done', 'done', 'done', 'current']);
  });

  it('shows nothing done or current for a draft', () => {
    expect(states('draft')).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('shows waitlisted and denied at the decision step as current', () => {
    expect(states('waitlisted', ['draft', 'submitted', 'under_review', 'waitlisted'])).toEqual([
      'done', 'done', 'current', 'upcoming', 'upcoming',
    ]);
    expect(states('denied', ['draft', 'submitted', 'under_review', 'denied'])).toEqual([
      'done', 'done', 'current', 'upcoming', 'upcoming',
    ]);
  });

  it('reports the terminal state', () => {
    expect(trackerView(app('withdrawn')).terminal).toBe('withdrawn');
    expect(trackerView(app('denied')).terminal).toBe('denied');
    expect(trackerView(app('waitlisted')).terminal).toBe('waitlisted');
    expect(trackerView(app('under_review')).terminal).toBeNull();
    expect(trackerView(app('signed')).terminal).toBeNull();
  });

  it('withdrawn has nothing current and marks only steps reached in history', () => {
    expect(states('withdrawn', ['draft', 'submitted', 'under_review', 'withdrawn'])).toEqual([
      'done', 'done', 'upcoming', 'upcoming', 'upcoming',
    ]);
    expect(states('withdrawn', ['draft', 'withdrawn'])).toEqual([
      'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming',
    ]);
  });
});

describe('canSubmitBatch', () => {
  const a = app('draft');
  const b = { ...app('draft'), id: 'app-b' };

  it('is ok when every member of every draft is done', () => {
    expect(canSubmitBatch([a, b], { [a.id]: [member('m1', true)], [b.id]: [member('m2', true)] })).toEqual({ ok: true });
  });

  it('rejects an empty batch', () => {
    expect(canSubmitBatch([], {})).toEqual({ ok: false, reason: 'There is nothing to submit.' });
  });

  it('ignores a withdrawn draft: the other choices can still be sent', () => {
    const gone = { ...app('withdrawn'), id: 'app-b' };
    const r = canSubmitBatch([a, gone], { [a.id]: [member('m1', true)], [gone.id]: [member('m2', false)] });
    expect(r).toEqual({ ok: true });
  });

  it('is retry-safe: drafts left after a half-finished submit can still be sent', () => {
    const sent = { ...app('submitted'), id: 'app-b' };
    const r = canSubmitBatch([a, sent], { [a.id]: [member('m1', true)], [sent.id]: [member('m2', true)] });
    expect(r).toEqual({ ok: true });
  });

  it('rejects when no draft is left', () => {
    const sent = { ...app('submitted'), id: 'app-b' };
    const gone = { ...app('withdrawn'), id: 'app-c' };
    const r = canSubmitBatch([sent, gone], { [sent.id]: [member('m1', true)], [gone.id]: [member('m2', true)] });
    expect(r).toEqual({ ok: false, reason: 'There is nothing left to submit.' });
  });

  it('draftApps and batchLocked', () => {
    const gone = { ...app('withdrawn'), id: 'app-b' };
    expect(draftApps([a, gone]).map((x) => x.id)).toEqual([a.id]);
    expect(batchLocked([a, gone])).toBe(false);
    expect(batchLocked([gone])).toBe(true);
  });

  it('names the first pending member and counts the rest', () => {
    const one = canSubmitBatch([a], { [a.id]: [member('m1', true), member('m2', false, { name: 'Sam' })] });
    expect(one).toEqual({ ok: false, reason: 'Waiting on Sam.' });
    const many = canSubmitBatch([a], {
      [a.id]: [member('m2', false, { name: 'Sam' }), member('m3', false, { kind: 'guarantor' })],
    });
    expect(many).toEqual({ ok: false, reason: 'Waiting on Sam and 1 more.' });
  });

  it('uses role fallback names for unnamed members', () => {
    const r = canSubmitBatch([a], { [a.id]: [member('g1', false, { kind: 'guarantor' })] });
    expect(r).toEqual({ ok: false, reason: 'Waiting on Guarantor.' });
  });

  it('rejects an application with no members', () => {
    expect(canSubmitBatch([a], {})).toEqual({ ok: false, reason: 'An application has no members.' });
  });
});

describe('nextActions', () => {
  it('gives the leader submit on a draft, and withdraw where allowed', () => {
    expect(nextActions(app('draft'), true)).toEqual(['submit', 'withdraw']);
    expect(nextActions(app('under_review'), true)).toEqual(['withdraw']);
    expect(nextActions(app('approved'), true)).toEqual(['withdraw']);
  });

  it('gives sign only on lease_sent for the leader', () => {
    expect(nextActions(app('lease_sent'), true)).toEqual(['withdraw', 'sign']);
    expect(nextActions(app('approved'), true)).not.toContain('sign');
    expect(nextActions(app('signed'), true)).toEqual([]);
  });

  it('gives nothing once a terminal status is reached', () => {
    expect(nextActions(app('denied'), true)).toEqual([]);
    expect(nextActions(app('withdrawn'), true)).toEqual([]);
  });

  it('gives non-leaders no actions', () => {
    expect(nextActions(app('draft'), false)).toEqual([]);
    expect(nextActions(app('lease_sent'), false)).toEqual([]);
  });
});

describe('inviteUrl', () => {
  it('builds the invite path from origin and token', () => {
    expect(inviteUrl('https://homed.example', 'abc_DEF-123')).toBe('https://homed.example/apply/invite/abc_DEF-123');
  });

  it('drops trailing slashes on the origin', () => {
    expect(inviteUrl('http://localhost:3010/', 'tok')).toBe('http://localhost:3010/apply/invite/tok');
  });
});

describe('parseGuarantorForm', () => {
  const good = () =>
    new URLSearchParams({ name: ' Pat  Lee ', relationship: 'Parent', signature: 'pat lee', consent: 'on' });

  it('accepts a matching signature ignoring case and spaces', () => {
    expect(parseGuarantorForm(good())).toEqual({ ok: true, name: 'Pat  Lee', relationship: 'Parent', signature: 'pat lee' });
  });

  it('rejects a signature that differs from the name', () => {
    const fd = good();
    fd.set('signature', 'Pat Smith');
    const r = parseGuarantorForm(fd);
    expect(r).toEqual({ ok: false, errors: { signature: 'Your signature must match your full name.' } });
  });

  it('requires name, relationship and signature', () => {
    const r = parseGuarantorForm(new URLSearchParams({ consent: 'on' }));
    expect(r).toEqual({
      ok: false,
      errors: {
        name: 'Enter your full name.',
        relationship: 'Enter how you are related to the student.',
        signature: 'Type your full name to sign.',
      },
    });
  });

  it('requires the consent checkbox to be ticked', () => {
    const fd = good();
    fd.delete('consent');
    expect(parseGuarantorForm(fd)).toEqual({
      ok: false,
      errors: { consent: 'Tick the box to agree to guarantee the lease.' },
    });
    const wrong = good();
    wrong.set('consent', 'yes');
    expect(parseGuarantorForm(wrong).ok).toBe(false);
  });

  it('accepts FormData as well as URLSearchParams', () => {
    const fd = new FormData();
    fd.set('name', 'Pat Lee');
    fd.set('relationship', 'Parent');
    fd.set('signature', 'Pat Lee');
    fd.set('consent', 'on');
    expect(parseGuarantorForm(fd).ok).toBe(true);
  });
});
