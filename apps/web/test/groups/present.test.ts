import { describe, expect, it } from 'vitest';
import type { CommuteSummary, Listing, VoteTally } from '@homed/core';
import { budgetLabel, commuteLine, inviteOrigin, listingLabel, voteSummary } from '../../src/lib/groups/present';

const tally: VoteTally = { floorPlanId: 'fp1', yes: 3, no: 1, pending: ['a', 'b'], unanimous: false };

describe('group present helpers', () => {
  it('summarises votes', () => {
    expect(voteSummary(tally)).toBe('3 yes, 1 no, 2 not voted');
    expect(voteSummary({ ...tally, yes: 0, no: 0, pending: [] })).toBe('0 yes, 0 no, 0 not voted');
  });

  it('formats the merged commute line', () => {
    const commute = { averageMinutes: 9.4 } as CommuteSummary;
    expect(commuteLine(commute)).toBe('Group average about 9 min to class');
    expect(commuteLine(null)).toBeNull();
  });

  it('labels listings and budgets', () => {
    const listing = { property: { name: 'Fontaine' }, floorPlan: { name: '4BR / 4BA' } } as Listing;
    expect(listingLabel(listing)).toBe('Fontaine 4BR / 4BA');
    expect(budgetLabel(true)).toBe('Budget set');
    expect(budgetLabel(false)).toBe('No budget');
  });

  it('builds an invite origin from headers only when the host is plain', () => {
    expect(inviteOrigin('homed.example', 'https, http')).toBe('https://homed.example');
    expect(inviteOrigin('localhost:3010', null)).toBe('http://localhost:3010');
    expect(inviteOrigin('[::1]:3010', 'http')).toBe('http://[::1]:3010');
    expect(inviteOrigin(null, null)).toBe('');
    expect(inviteOrigin('evil.com/x', null)).toBe('');
    expect(inviteOrigin('a.com"><script>', null)).toBe('');
  });
});
