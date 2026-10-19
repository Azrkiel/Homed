import { describe, expect, it } from 'vitest';
import { isValidLatLng, roundCoord } from '../../src/lib/landlord/location';

describe('roundCoord', () => {
  it('rounds to six decimals', () => {
    expect(roundCoord(38.03361234567)).toBe(38.033612);
    expect(roundCoord(-78.5)).toBe(-78.5);
  });
});

describe('isValidLatLng', () => {
  it('accepts coordinates inside the world bounds', () => {
    expect(isValidLatLng('38.0336', '-78.508')).toBe(true);
    expect(isValidLatLng('-90', '180')).toBe(true);
  });

  it('rejects blanks, words and out-of-range values', () => {
    expect(isValidLatLng('', '-78')).toBe(false);
    expect(isValidLatLng('38', '  ')).toBe(false);
    expect(isValidLatLng('north', '-78')).toBe(false);
    expect(isValidLatLng('91', '0')).toBe(false);
    expect(isValidLatLng('0', '-181')).toBe(false);
  });
});
