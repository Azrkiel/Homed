import { describe, expect, it } from 'vitest';
import { VA_MAX_NONREFUNDABLE_FEE } from '@homed/core';
import { feeWarnings } from '../../src/lib/landlord/fee-warnings';

describe('feeWarnings', () => {
  it('no warnings when fees are absent or within the Virginia nonrefundable cap', () => {
    expect(feeWarnings({})).toEqual([]);
    expect(feeWarnings({ applicationFee: 0 })).toEqual([]);
    expect(feeWarnings({ applicationFee: 35, screeningCost: 40, applicationDeposit: 500, securityDeposit: 800 })).toEqual([]);
  });

  it('the cap itself is allowed', () => {
    expect(feeWarnings({ applicationFee: VA_MAX_NONREFUNDABLE_FEE })).toEqual([]);
  });

  it('an application fee over the cap warns with the core rule text', () => {
    const warnings = feeWarnings({ applicationFee: 75 });
    expect(warnings).toEqual([
      'Application fee of $75 is over the $50 Virginia limit on nonrefundable application fees (Va. Code 55.1-1203).',
    ]);
  });

  it('screening cost and deposits do not trigger the nonrefundable-fee warning', () => {
    expect(feeWarnings({ screeningCost: 500, applicationDeposit: 1000, securityDeposit: 2000 })).toEqual([]);
  });
});
