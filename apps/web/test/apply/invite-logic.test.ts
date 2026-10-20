import type { ApplicationMember } from '@homed/core';
import { describe, expect, it } from 'vitest';
import {
  flattenMembers,
  guaranteeTargetName,
  normalizeEmail,
  otherMemberViews,
  sameEmail,
  siblingRows,
} from '../../src/components/apply/invite-logic';

function row(id: string, applicationId: string, extra: Partial<ApplicationMember> = {}): ApplicationMember {
  return {
    id,
    applicationId,
    kind: 'roommate',
    email: 'pat@virginia.edu',
    inviteToken: `tok-${id}`,
    inviteStatus: 'pending',
    done: false,
    updatedAt: '2026-10-18T00:00:00Z',
    ...extra,
  };
}

describe('email match', () => {
  it('ignores case and surrounding spaces', () => {
    expect(normalizeEmail('  Pat@Virginia.EDU ')).toBe('pat@virginia.edu');
    expect(sameEmail('Pat@virginia.edu', ' pat@VIRGINIA.edu')).toBe(true);
  });

  it('rejects different addresses and empty values', () => {
    expect(sameEmail('pat@virginia.edu', 'sam@virginia.edu')).toBe(false);
    expect(sameEmail('', '')).toBe(false);
    expect(sameEmail('  ', '  ')).toBe(false);
  });
});

describe('siblingRows', () => {
  it('finds the same email across every application in the batch, same kind only', () => {
    const a1 = row('r1', 'app-1');
    const a2 = row('r2', 'app-2', { email: 'PAT@virginia.edu' });
    const otherPerson = row('r3', 'app-2', { email: 'sam@virginia.edu' });
    const guarantorSameEmail = row('g1', 'app-2', { kind: 'guarantor' });
    const rows = flattenMembers({ 'app-1': [a1], 'app-2': [a2, otherPerson, guarantorSameEmail] });

    const got = siblingRows(rows, a1).map((r) => r.id);
    expect(got).toEqual(['r1', 'r2']);
  });

  it('keeps the invitee row even when it is missing from the list, and never duplicates it', () => {
    const invitee = row('r1', 'app-1');
    expect(siblingRows([invitee, invitee], invitee).map((r) => r.id)).toEqual(['r1']);
    expect(siblingRows([], invitee).map((r) => r.id)).toEqual(['r1']);
  });
});

describe('guaranteeTargetName', () => {
  const leader = row('l1', 'app-1', { kind: 'leader', name: 'Alex Leader' });
  const roommate = row('r1', 'app-1', { name: 'Pat Roommate' });

  it('uses the guaranteed member name when present', () => {
    const g = row('g1', 'app-1', { kind: 'guarantor', guarantorFor: 'r1' });
    expect(guaranteeTargetName(g, [leader, roommate, g], 'Alex Leader')).toBe('Pat Roommate');
  });

  it('falls back to the leader name when no guaranteed member is set or it has no name', () => {
    const plain = row('g1', 'app-1', { kind: 'guarantor' });
    expect(guaranteeTargetName(plain, [leader, roommate], 'Alex Leader')).toBe('Alex Leader');

    const unnamed = row('r2', 'app-1');
    const g2 = row('g2', 'app-1', { kind: 'guarantor', guarantorFor: 'r2' });
    expect(guaranteeTargetName(g2, [unnamed], 'Alex Leader')).toBe('Alex Leader');
  });

  it('falls back to a generic phrase when nothing has a name', () => {
    const g = row('g1', 'app-1', { kind: 'guarantor' });
    expect(guaranteeTargetName(g, [], undefined)).toBe('the student');
  });
});

describe('otherMemberViews', () => {
  it('lists the other members as done / not done and never exposes emails', () => {
    const me = row('r1', 'app-1', { name: 'Pat', done: false });
    const leader = row('l1', 'app-1', { kind: 'leader', name: 'Alex', done: true, email: 'alex@virginia.edu' });
    const views = otherMemberViews([me, leader], 'r1');
    expect(views).toEqual([{ memberId: 'l1', name: 'Alex', kind: 'leader', done: true }]);
    expect(JSON.stringify(views)).not.toContain('@');
  });
});
