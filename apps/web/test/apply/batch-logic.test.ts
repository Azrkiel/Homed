import { describe, expect, it } from 'vitest';
import type { FloorPlan } from '@homed/core';
import {
  applicantCount,
  buildFeeSummary,
  guarantorOptions,
  padRows,
  roommateEmails,
  roommatesFromMembers,
  type BuilderPlace,
} from '../../src/components/apply/batch-logic';

function plan(overrides: Partial<FloorPlan>): FloorPlan {
  return {
    id: 'fp-x',
    propertyId: 'p-x',
    name: 'Plan',
    beds: 2,
    baths: 1,
    ...overrides,
  } as FloorPlan;
}

function place(id: string, overrides: Partial<FloorPlan>): BuilderPlace {
  return { floorPlanId: id, label: `Label ${id}`, floorPlan: plan({ id, ...overrides }) };
}

describe('roommateEmails / applicantCount', () => {
  it('drops blanks, trims and lowercases', () => {
    expect(roommateEmails([' A@Virginia.edu ', '', '   ', 'b@virginia.edu'])).toEqual(['a@virginia.edu', 'b@virginia.edu']);
  });

  it('counts the leader plus non-blank roommates', () => {
    expect(applicantCount([])).toBe(1);
    expect(applicantCount(['', 'a@virginia.edu', ''])).toBe(2);
  });
});

describe('buildFeeSummary', () => {
  const places = [
    place('fp-a', { applicationFee: 50, screeningCost: 30, applicationDeposit: 100 }),
    place('fp-b', { applicationFee: 75 }),
  ];

  it('quotes each place for the leader alone when no roommates', () => {
    const s = buildFeeSummary(places, []);
    expect(s.people).toBe(1);
    expect(s.places.map((p) => p.floorPlanId)).toEqual(['fp-a', 'fp-b']);
    expect(s.places[0]?.quote.perPersonTotal).toBe(180);
    expect(s.places[0]?.quote.applicationTotal).toBe(180);
    expect(s.total).toBe(180 + 75);
  });

  it('multiplies by people (leader + roommates) and sums the batch', () => {
    const s = buildFeeSummary(places, ['a@virginia.edu', '']);
    expect(s.people).toBe(2);
    expect(s.places[0]?.quote.applicationTotal).toBe(360);
    expect(s.places[1]?.quote.applicationTotal).toBe(150);
    expect(s.total).toBe(510);
  });

  it('tags VA compliance warnings with their place', () => {
    const s = buildFeeSummary(places, []);
    expect(s.warnings).toHaveLength(1);
    expect(s.warnings[0]).toMatchObject({ floorPlanId: 'fp-b', label: 'Label fp-b' });
    expect(s.warnings[0]?.message).toMatch(/\$50 Virginia limit/);
  });

  it('returns an empty summary for no places', () => {
    expect(buildFeeSummary([], ['a@virginia.edu'])).toEqual({ places: [], total: 0, warnings: [], people: 2 });
  });
});

describe('roommatesFromMembers', () => {
  it('removes the leader, lowercases and dedupes', () => {
    expect(roommatesFromMembers(['Leader@virginia.edu', 'Ann@virginia.edu', 'ann@virginia.edu', ''], 'leader@virginia.edu')).toEqual([
      'ann@virginia.edu',
    ]);
  });
});

describe('padRows / guarantorOptions', () => {
  it('pads to the minimum row count and keeps longer lists whole', () => {
    expect(padRows(['a'], 4)).toEqual(['a', '', '', '']);
    expect(padRows(['a', 'b', 'c', 'd', 'e'], 4)).toHaveLength(5);
  });

  it('lists the leader then non-blank roommates, deduped', () => {
    expect(guarantorOptions('Leader@virginia.edu', ['', 'a@virginia.edu', 'A@virginia.edu'])).toEqual([
      'leader@virginia.edu',
      'a@virginia.edu',
    ]);
  });
});
