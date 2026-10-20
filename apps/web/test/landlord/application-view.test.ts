import { describe, expect, it } from 'vitest';
import type { ApplicationStatus } from '@homed/core';
import {
  attachmentDisposition,
  isLandlordMove,
  landlordActions,
  memberDisplayName,
  parseStatus,
  safeContentType,
  safeFilename,
} from '../../src/lib/landlord/application-view';

describe('landlordActions', () => {
  const targets = (s: ApplicationStatus) => landlordActions(s).map((a) => a.to);

  it('lists the landlord-only moves per status', () => {
    expect(targets('draft')).toEqual([]);
    expect(targets('submitted')).toEqual(['under_review']);
    expect(targets('under_review')).toEqual(['approved', 'waitlisted', 'denied']);
    expect(targets('waitlisted')).toEqual(['approved', 'denied']);
    expect(targets('approved')).toEqual(['lease_sent']);
    expect(targets('lease_sent')).toEqual([]);
    expect(targets('denied')).toEqual([]);
    expect(targets('signed')).toEqual([]);
    expect(targets('withdrawn')).toEqual([]);
  });

  it('never offers applicant moves (submit, sign, withdraw)', () => {
    for (const s of ['draft', 'submitted', 'under_review', 'waitlisted', 'approved', 'lease_sent'] as const) {
      expect(targets(s)).not.toContain('withdrawn');
      expect(targets(s)).not.toContain('signed');
    }
    expect(targets('draft')).not.toContain('submitted');
  });

  it('gives each action a human label', () => {
    expect(landlordActions('under_review')).toEqual([
      { to: 'approved', label: 'Approve' },
      { to: 'waitlisted', label: 'Waitlist' },
      { to: 'denied', label: 'Deny' },
    ]);
    expect(landlordActions('approved')).toEqual([{ to: 'lease_sent', label: 'Send lease' }]);
  });

  it('isLandlordMove matches the list', () => {
    expect(isLandlordMove('under_review', 'approved')).toBe(true);
    expect(isLandlordMove('under_review', 'withdrawn')).toBe(false);
    expect(isLandlordMove('submitted', 'approved')).toBe(false);
    expect(isLandlordMove('denied', 'approved')).toBe(false);
    expect(isLandlordMove('lease_sent', 'signed')).toBe(false);
  });
});

describe('parseStatus', () => {
  it('accepts known statuses only', () => {
    expect(parseStatus('approved')).toBe('approved');
    expect(parseStatus('bogus')).toBeNull();
    expect(parseStatus(null)).toBeNull();
  });
});

describe('display helpers', () => {
  it('falls back to the kind label for unnamed members', () => {
    expect(memberDisplayName({ kind: 'roommate' })).toBe('Roommate');
    expect(memberDisplayName({ kind: 'guarantor', name: '  ' })).toBe('Guarantor');
    expect(memberDisplayName({ kind: 'leader', name: 'Ada' })).toBe('Ada');
  });

  it('serves only known document types inline, everything else as octet-stream', () => {
    expect(safeContentType('application/pdf')).toBe('application/pdf');
    expect(safeContentType('IMAGE/PNG')).toBe('image/png');
    expect(safeContentType('text/html')).toBe('application/octet-stream');
  });

  it('sanitizes filenames for Content-Disposition', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('lease "final";.pdf')).toBe('lease _final__.pdf');
    expect(safeFilename('résumé\r\n.pdf')).toBe('r_sum___.pdf');
    expect(safeFilename('..')).toBe('document');
    expect(safeFilename('   ')).toBe('document');
    expect(safeFilename('x'.repeat(300)).length).toBe(120);
    expect(attachmentDisposition('a"b.pdf')).toBe('attachment; filename="a_b.pdf"');
  });
});
