import { describe, expect, it } from 'vitest';
import { STALE_AFTER_DAYS, daysBetween, isStale, verifiedLabel } from '../src/freshness';

describe('daysBetween', () => {
  it('same day is 0', () => expect(daysBetween('2026-10-19', '2026-10-19')).toBe(0));
  it('counts forward', () => expect(daysBetween('2026-10-01', '2026-10-19')).toBe(18));
  it('negative when to < from', () => expect(daysBetween('2026-10-19', '2026-10-17')).toBe(-2));
  it('crosses month and year', () => expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3));
  it('handles leap day', () => expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2));
  it('unaffected by DST changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });
});

describe('isStale', () => {
  it('threshold is 14', () => expect(STALE_AFTER_DAYS).toBe(14));
  it('exactly 14 days is not stale', () => expect(isStale('2026-10-05', '2026-10-19')).toBe(false));
  it('15 days is stale', () => expect(isStale('2026-10-04', '2026-10-19')).toBe(true));
  it('fresh is not stale', () => expect(isStale('2026-10-19', '2026-10-19')).toBe(false));
  it('future verification is not stale', () => expect(isStale('2026-10-25', '2026-10-19')).toBe(false));
});

describe('verifiedLabel', () => {
  it('today', () => expect(verifiedLabel('2026-10-19', '2026-10-19')).toBe('Verified today'));
  it('yesterday', () => expect(verifiedLabel('2026-10-18', '2026-10-19')).toBe('Verified yesterday'));
  it('days ago', () => expect(verifiedLabel('2026-10-16', '2026-10-19')).toBe('Verified 3 days ago'));
  it('14 days still verified', () => expect(verifiedLabel('2026-10-05', '2026-10-19')).toBe('Verified 14 days ago'));
  it('15 days is not verified', () => expect(verifiedLabel('2026-10-04', '2026-10-19')).toBe('Not verified in 15 days'));
  it('long ago', () => expect(verifiedLabel('2026-09-29', '2026-10-19')).toBe('Not verified in 20 days'));
});
