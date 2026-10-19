import { describe, expect, it } from 'vitest';
import { bedBath, minutes, money, moneyPrecise, plural, shortDate } from '../../src/lib/format';

describe('money', () => {
  it('whole dollars with grouping', () => {
    expect(money(1234)).toBe('$1,234');
    expect(money(800)).toBe('$800');
    expect(money(1234567)).toBe('$1,234,567');
  });
  it('rounds to whole dollars', () => {
    expect(money(1234.4)).toBe('$1,234');
    expect(money(1234.5)).toBe('$1,235');
  });
  it('zero and negatives', () => {
    expect(money(0)).toBe('$0');
    expect(money(-120)).toBe('-$120');
  });
});

describe('moneyPrecise', () => {
  it('no decimals for integers', () => {
    expect(moneyPrecise(1234)).toBe('$1,234');
  });
  it('two decimals for non-integers', () => {
    expect(moneyPrecise(1234.5)).toBe('$1,234.50');
    expect(moneyPrecise(12.345)).toBe('$12.35');
  });
});

describe('minutes', () => {
  it('delegates to core formatMinutes', () => {
    expect(minutes(45)).toBe('45 min');
    expect(minutes(130)).toBe('2 h 10 min');
    expect(minutes(120)).toBe('2 h');
  });
});

describe('shortDate', () => {
  it('formats ISO dates without timezone shift', () => {
    expect(shortDate('2027-08-15')).toBe('Aug 15, 2027');
    expect(shortDate('2027-01-01')).toBe('Jan 1, 2027');
    expect(shortDate('2028-12-31')).toBe('Dec 31, 2028');
  });
  it('returns input when not a valid ISO date', () => {
    expect(shortDate('soon')).toBe('soon');
  });
});

describe('plural', () => {
  it('singular for one, plural otherwise', () => {
    expect(plural(1, 'listing')).toBe('1 listing');
    expect(plural(0, 'listing')).toBe('0 listings');
    expect(plural(3, 'listing')).toBe('3 listings');
  });
  it('accepts an explicit plural form', () => {
    expect(plural(2, 'person', 'people')).toBe('2 people');
  });
});

describe('bedBath', () => {
  it('beds and baths', () => {
    expect(bedBath(2, 2)).toBe('2 bd / 2 ba');
    expect(bedBath(4, 1.5)).toBe('4 bd / 1.5 ba');
  });
  it('studio for zero beds', () => {
    expect(bedBath(0, 1)).toBe('Studio / 1 ba');
  });
});
