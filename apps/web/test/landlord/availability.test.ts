import { describe, expect, it } from 'vitest';
import { availabilityState, parseUnitsInput } from '../../src/lib/landlord/availability';

describe('availabilityState', () => {
  it('marks a fresh confirmation as current', () => {
    const s = availabilityState({ unitsAvailable: 3, lastVerified: '2026-10-18' }, '2026-10-19');
    expect(s.stale).toBe(false);
    expect(s.verifiedText).toBe('Verified yesterday');
    expect(s.unitsText).toBe('3 available');
    expect(s.unitsValue).toBe('3');
  });

  it('marks anything older than 14 days stale', () => {
    const s = availabilityState({ unitsAvailable: 1, lastVerified: '2026-10-01' }, '2026-10-19');
    expect(s.stale).toBe(true);
    expect(s.verifiedText).toBe('Not verified in 18 days');
  });

  it('treats 14 days as still current (boundary)', () => {
    expect(availabilityState({ unitsAvailable: 1, lastVerified: '2026-10-05' }, '2026-10-19').stale).toBe(false);
  });

  it('describes unknown and zero units', () => {
    const unknown = availabilityState({ unitsAvailable: null, lastVerified: '2026-10-19' }, '2026-10-19');
    expect(unknown.unitsText).toBe('Units not set');
    expect(unknown.unitsValue).toBe('');
    expect(availabilityState({ unitsAvailable: 0, lastVerified: '2026-10-19' }, '2026-10-19').unitsText).toBe('None available');
    expect(availabilityState({ unitsAvailable: 1, lastVerified: '2026-10-19' }, '2026-10-19').unitsText).toBe('1 available');
  });
});

describe('parseUnitsInput', () => {
  it('blank is unknown', () => {
    expect(parseUnitsInput('  ')).toEqual({ ok: true, value: null });
    expect(parseUnitsInput(null)).toEqual({ ok: true, value: null });
  });

  it('accepts whole numbers 0-1000', () => {
    expect(parseUnitsInput('0')).toEqual({ ok: true, value: 0 });
    expect(parseUnitsInput(' 12 ')).toEqual({ ok: true, value: 12 });
    expect(parseUnitsInput('1000')).toEqual({ ok: true, value: 1000 });
  });

  it('rejects negatives, decimals, words and large values', () => {
    expect(parseUnitsInput('-1').ok).toBe(false);
    expect(parseUnitsInput('1.5').ok).toBe(false);
    expect(parseUnitsInput('two').ok).toBe(false);
    expect(parseUnitsInput('1001').ok).toBe(false);
  });
});
