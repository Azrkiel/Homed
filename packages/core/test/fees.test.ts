import { describe, expect, it } from 'vitest';
import { batchTotal, quoteFees, VA_MAX_NONREFUNDABLE_FEE } from '../src/fees';
import type { FeeQuote, FloorPlan } from '../src/types';

function fp(over: Partial<FloorPlan> = {}): FloorPlan {
  return {
    id: 'fp1', propertyId: 'p1', name: '4BR / 4BA', beds: 4, baths: 4, rentAmount: 900,
    rentBasis: 'per_bed', leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month',
    leaseType: 'individual', furnished: false, utilitiesIncluded: false, internetIncluded: false,
    inUnitLaundry: true, dishwasher: true, ac: true, unitsAvailable: 2, lastVerified: '2026-10-01',
    ...over,
  };
}

function quote(applicationTotal: number): FeeQuote {
  return { perPerson: [], perPersonTotal: 0, people: 1, applicationTotal, complianceIssues: [] };
}

describe('VA_MAX_NONREFUNDABLE_FEE', () => {
  it('is 50', () => expect(VA_MAX_NONREFUNDABLE_FEE).toBe(50));
});

describe('quoteFees', () => {
  it('omits all lines when every fee is undefined', () => {
    const q = quoteFees(fp(), 1);
    expect(q.perPerson).toEqual([]);
    expect(q.perPersonTotal).toBe(0);
    expect(q.applicationTotal).toBe(0);
    expect(q.complianceIssues).toEqual([]);
  });

  it('omits zero lines', () => {
    const q = quoteFees(fp({ applicationFee: 0, screeningCost: 0, applicationDeposit: 0 }), 3);
    expect(q.perPerson).toEqual([]);
    expect(q.applicationTotal).toBe(0);
  });

  it('omits only the zero lines', () => {
    const q = quoteFees(fp({ applicationFee: 50, screeningCost: 0, applicationDeposit: 100 }), 1);
    expect(q.perPerson.map((l) => l.label)).toEqual(['Application fee', 'Refundable application deposit']);
  });

  it('treats undefined fees as zero', () => {
    const q = quoteFees(fp({ applicationFee: undefined, screeningCost: 30 }), 1);
    expect(q.perPerson).toEqual([{ label: 'Screening cost', amount: 30, refundable: false }]);
  });

  it('treats null fees (JSON boundary) as zero', () => {
    const q = quoteFees(fp({ applicationFee: null as unknown as undefined, applicationDeposit: 20 }), 1);
    expect(q.perPerson.map((l) => l.label)).toEqual(['Refundable application deposit']);
    expect(q.perPersonTotal).toBe(20);
  });

  it('builds all three lines in order with refundable flags', () => {
    const q = quoteFees(fp({ applicationFee: 50, screeningCost: 35, applicationDeposit: 100 }), 1);
    expect(q.perPerson).toEqual([
      { label: 'Application fee', amount: 50, refundable: false },
      { label: 'Screening cost', amount: 35, refundable: false },
      { label: 'Refundable application deposit', amount: 100, refundable: true },
    ]);
  });

  it('one person: total equals per-person sum', () => {
    const q = quoteFees(fp({ applicationFee: 50, screeningCost: 35, applicationDeposit: 100 }), 1);
    expect(q.perPersonTotal).toBe(185);
    expect(q.people).toBe(1);
    expect(q.applicationTotal).toBe(185);
  });

  it('several people: total is people x per-person sum', () => {
    const q = quoteFees(fp({ applicationFee: 50, screeningCost: 35, applicationDeposit: 100 }), 4);
    expect(q.perPersonTotal).toBe(185);
    expect(q.people).toBe(4);
    expect(q.applicationTotal).toBe(740);
  });

  it('per-person lines do not scale with people', () => {
    const q = quoteFees(fp({ applicationFee: 40 }), 5);
    expect(q.perPerson[0]?.amount).toBe(40);
    expect(q.applicationTotal).toBe(200);
  });

  it('two people with a single line', () => {
    expect(quoteFees(fp({ screeningCost: 25 }), 2).applicationTotal).toBe(50);
  });

  it('no compliance issue at exactly the cap', () => {
    expect(quoteFees(fp({ applicationFee: 50 }), 1).complianceIssues).toEqual([]);
  });

  it('no compliance issue under the cap', () => {
    expect(quoteFees(fp({ applicationFee: 25 }), 1).complianceIssues).toEqual([]);
  });

  it('flags a fee over the cap', () => {
    const q = quoteFees(fp({ applicationFee: 75 }), 2);
    expect(q.complianceIssues).toHaveLength(1);
    expect(q.complianceIssues[0]).toContain('$75');
    expect(q.complianceIssues[0]).toContain('$50');
    expect(q.complianceIssues[0]).toContain('55.1-1203');
  });

  it('flags $51', () => {
    expect(quoteFees(fp({ applicationFee: 51 }), 1).complianceIssues).toHaveLength(1);
  });

  it('still totals an over-cap fee', () => {
    expect(quoteFees(fp({ applicationFee: 75 }), 2).applicationTotal).toBe(150);
  });

  it('screening cost and deposit do not trigger the cap', () => {
    const q = quoteFees(fp({ applicationFee: 50, screeningCost: 200, applicationDeposit: 500 }), 1);
    expect(q.complianceIssues).toEqual([]);
  });
});

describe('batchTotal', () => {
  it('is 0 for an empty batch', () => expect(batchTotal([])).toBe(0));
  it('returns a single quote total', () => expect(batchTotal([quote(185)])).toBe(185));
  it('sums several quotes', () => expect(batchTotal([quote(100), quote(250), quote(0)])).toBe(350));
  it('sums real quotes', () => {
    const a = quoteFees(fp({ applicationFee: 50, screeningCost: 35 }), 4);
    const b = quoteFees(fp({ applicationFee: 30 }), 4);
    expect(batchTotal([a, b])).toBe(340 + 120);
  });
});
