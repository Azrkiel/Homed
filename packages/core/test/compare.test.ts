import { describe, expect, it } from 'vitest';
import { buildCompareTable } from '../src/compare';
import type { CompareRow, CompareRowKey } from '../src/compare';
import type { CommuteSummary, CostBreakdown, FloorPlan, Property, RankedListing } from '../src/types';

interface Opts {
  total?: number;
  looks?: number;
  monthly?: number;
  lease?: number;
  months?: number;
  weekly?: number;
  earliest?: number | null;
  fp?: Partial<FloorPlan>;
  amenities?: Partial<Property['amenities']>;
}

function item(o: Opts = {}): RankedListing {
  const fp: FloorPlan = {
    id: 'fp1', propertyId: 'p1', name: '4BR', beds: 4, baths: 4, sqft: 1500, rentAmount: 3200,
    rentBasis: 'per_unit', leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month',
    leaseType: 'individual', furnished: false, utilitiesIncluded: false, internetIncluded: false,
    inUnitLaundry: false, dishwasher: false, ac: false, unitsAvailable: 2, lastVerified: '2026-10-19',
    ...o.fp,
  };
  const property = {
    id: 'p1', slug: 'p1', name: 'P', address: '1 Main', location: { lat: 38, lng: -78 },
    kind: 'apartment_complex', onGrounds: false, neighborhood: 'Corner',
    amenities: {
      gym: false, studyRooms: false, rooftop: false, pool: false, elevator: false,
      parkingAvailable: false, petsAllowed: false, ...o.amenities,
    },
    onBusRoute: false, busRoutes: [], studyAbroadFriendly: false, noGuarantorOption: false,
    source: 'test', dataStatus: 'verified', lastVerified: '2026-10-19',
  } as Property;
  const monthly = o.monthly ?? 1245;
  const cost: CostBreakdown = {
    rent: monthly, utilities: 0, internet: 0, parking: 0, furniture: 0, totalMonthly: monthly,
    leaseMonths: o.months ?? 12, totalLease: o.lease ?? 14940,
  };
  const commute: CommuteSummary = {
    weeklyMinutes: o.weekly ?? 130,
    averageMinutes: 10,
    earliestClassMinutes: o.earliest === undefined ? 9 : o.earliest,
    usesBus: false,
    extras: [],
  };
  return {
    listing: { property, floorPlan: fp, photos: [] },
    score: {
      total: o.total ?? 86, price: 80, location: 80, looks: o.looks ?? 72, looksBasis: 'age_only',
      why: '', cost, commute, badges: [],
    },
  };
}

const row = (rows: CompareRow[], key: CompareRowKey): CompareRow => {
  const r = rows.find((x) => x.key === key);
  if (!r) throw new Error(`missing row ${key}`);
  return r;
};
const best = (rows: CompareRow[], key: CompareRowKey): boolean[] => row(rows, key).cells.map((c) => c.best);
const shown = (rows: CompareRow[], key: CompareRowKey): string[] => row(rows, key).cells.map((c) => c.display);

describe('buildCompareTable size limits', () => {
  it('throws RangeError for 0 items', () => expect(() => buildCompareTable([])).toThrow(RangeError));
  it('throws RangeError for 1 item', () => expect(() => buildCompareTable([item()])).toThrow(RangeError));
  it('throws RangeError for 5 items', () =>
    expect(() => buildCompareTable([item(), item(), item(), item(), item()])).toThrow(RangeError));
  it('accepts 2 items', () => expect(() => buildCompareTable([item(), item()])).not.toThrow());
  it('accepts 4 items', () => expect(() => buildCompareTable([item(), item(), item(), item()])).not.toThrow());
});

describe('buildCompareTable structure', () => {
  it('rows are in CompareRowKey order', () => {
    expect(buildCompareTable([item(), item()]).map((r) => r.key)).toEqual([
      'score', 'costPerPerson', 'totalLease', 'weeklyWalk', 'earliestWalk', 'bedBath', 'sqft',
      'leaseTerm', 'leaseType', 'furnished', 'utilities', 'laundry', 'parking', 'looks',
    ]);
  });
  it('every row has one cell per item, in input order, and a label', () => {
    const rows = buildCompareTable([item({ total: 1 }), item({ total: 2 }), item({ total: 3 })]);
    for (const r of rows) {
      expect(r.cells).toHaveLength(3);
      expect(r.label.length).toBeGreaterThan(0);
    }
    expect(shown(rows, 'score')).toEqual(['1', '2', '3']);
  });
});

describe('display formats', () => {
  const rows = buildCompareTable([item(), item()]);
  const d = (k: CompareRowKey) => shown(rows, k)[0];
  it('score', () => expect(d('score')).toBe('86'));
  it('money', () => expect(d('costPerPerson')).toBe('$1,245/mo'));
  it('money below 1000 has no separator', () =>
    expect(shown(buildCompareTable([item({ monthly: 845 }), item()]), 'costPerPerson')[0]).toBe('$845/mo'));
  it('totalLease', () => expect(d('totalLease')).toBe('$14,940 (12 mo)'));
  it('totalLease uses leaseMonths', () =>
    expect(shown(buildCompareTable([item({ lease: 9000, months: 10 }), item()]), 'totalLease')[0]).toBe('$9,000 (10 mo)'));
  it('weeklyWalk uses formatMinutes', () => expect(d('weeklyWalk')).toBe('2 h 10 min'));
  it('weeklyWalk under an hour', () =>
    expect(shown(buildCompareTable([item({ weekly: 45 }), item()]), 'weeklyWalk')[0]).toBe('45 min'));
  it('earliestWalk', () => expect(d('earliestWalk')).toBe('9 min'));
  it('earliestWalk null is an em dash', () =>
    expect(shown(buildCompareTable([item({ earliest: null }), item()]), 'earliestWalk')[0]).toBe('—'));
  it('bedBath', () => expect(d('bedBath')).toBe('4 bd / 4 ba'));
  it('bedBath studio', () =>
    expect(shown(buildCompareTable([item({ fp: { beds: 0, baths: 1 } }), item()]), 'bedBath')[0]).toBe('0 bd / 1 ba'));
  it('sqft with separator', () => expect(d('sqft')).toBe('1,500 sq ft'));
  it('sqft missing is an em dash', () => {
    const r = buildCompareTable([item({ fp: { sqft: undefined } }), item()]);
    expect(row(r, 'sqft').cells[0]).toEqual({ display: '—', value: null, best: false });
  });
  it('leaseTerm labels', () => {
    const r = buildCompareTable([
      item({ fp: { termKind: '12_month' } }), item({ fp: { termKind: 'academic_year' } }),
      item({ fp: { termKind: 'semester' } }), item({ fp: { termKind: 'other' } }),
    ]);
    expect(shown(r, 'leaseTerm')).toEqual(['12-month', 'Academic year', 'Semester', 'Other']);
  });
  it('leaseType labels', () =>
    expect(shown(buildCompareTable([item(), item({ fp: { leaseType: 'joint' } })]), 'leaseType')).toEqual([
      'Individual', 'Joint',
    ]));
  it('yes/no rows', () => {
    const r = buildCompareTable([
      item(), item({ fp: { furnished: true, utilitiesIncluded: true, inUnitLaundry: true } }),
    ]);
    expect(shown(r, 'furnished')).toEqual(['No', 'Yes']);
    expect(shown(r, 'utilities')).toEqual(['No', 'Yes']);
    expect(shown(r, 'laundry')).toEqual(['No', 'Yes']);
  });
  it('parking variants', () => {
    const r = buildCompareTable([
      item(),
      item({ amenities: { parkingAvailable: true, parkingMonthly: 75 } }),
      item({ amenities: { parkingAvailable: true, parkingMonthly: 0 } }),
      item({ amenities: { parkingAvailable: true } }),
    ]);
    expect(shown(r, 'parking')).toEqual(['No', 'Yes, $75/mo', 'Yes, free', 'Yes']);
  });
  it('parking cost uses separators', () =>
    expect(
      shown(
        buildCompareTable([item({ amenities: { parkingAvailable: true, parkingMonthly: 1200 } }), item()]),
        'parking',
      )[0],
    ).toBe('Yes, $1,200/mo'));
  it('looks', () => expect(d('looks')).toBe('72'));
});

describe('best marking: lower is better', () => {
  it('costPerPerson', () =>
    expect(best(buildCompareTable([item({ monthly: 900 }), item({ monthly: 1100 }), item({ monthly: 1000 })]), 'costPerPerson'))
      .toEqual([true, false, false]));
  it('totalLease', () =>
    expect(best(buildCompareTable([item({ lease: 5 }), item({ lease: 3 })]), 'totalLease')).toEqual([false, true]));
  it('weeklyWalk', () =>
    expect(best(buildCompareTable([item({ weekly: 50 }), item({ weekly: 20 })]), 'weeklyWalk')).toEqual([false, true]));
  it('earliestWalk ignores null cells', () =>
    expect(best(buildCompareTable([item({ earliest: null }), item({ earliest: 12 }), item({ earliest: 8 })]), 'earliestWalk'))
      .toEqual([false, false, true]));
  it('ties all get best', () =>
    expect(best(buildCompareTable([item({ monthly: 900 }), item({ monthly: 900 }), item({ monthly: 1000 })]), 'costPerPerson'))
      .toEqual([true, true, false]));
});

describe('best marking: higher is better', () => {
  it('score', () =>
    expect(best(buildCompareTable([item({ total: 70 }), item({ total: 90 })]), 'score')).toEqual([false, true]));
  it('looks', () =>
    expect(best(buildCompareTable([item({ looks: 95 }), item({ looks: 40 })]), 'looks')).toEqual([true, false]));
  it('sqft', () =>
    expect(best(buildCompareTable([item({ fp: { sqft: 900 } }), item({ fp: { sqft: 1400 } })]), 'sqft')).toEqual([false, true]));
  it('sqft null cells are never best', () =>
    expect(best(buildCompareTable([item({ fp: { sqft: undefined } }), item({ fp: { sqft: 700 } })]), 'sqft'))
      .toEqual([false, true]));
  it('bedBath uses bath:bed ratio', () => {
    const r = buildCompareTable([
      item({ fp: { beds: 4, baths: 2 } }), item({ fp: { beds: 2, baths: 2 } }), item({ fp: { beds: 4, baths: 3 } }),
    ]);
    expect(best(r, 'bedBath')).toEqual([false, true, false]);
  });
  it('bedBath ties (2/1 and 4/2) both best', () => {
    const r = buildCompareTable([
      item({ fp: { beds: 2, baths: 1 } }), item({ fp: { beds: 4, baths: 2 } }), item({ fp: { beds: 4, baths: 1 } }),
    ]);
    expect(best(r, 'bedBath')).toEqual([true, true, false]);
  });
  it('bedBath studio counts as one bed', () => {
    const r = buildCompareTable([item({ fp: { beds: 0, baths: 1 } }), item({ fp: { beds: 2, baths: 1 } })]);
    expect(best(r, 'bedBath')).toEqual([true, false]);
  });
});

describe('best marking: no winner', () => {
  it('all-tie row marks nothing', () => {
    const r = buildCompareTable([item(), item(), item()]);
    expect(best(r, 'score')).toEqual([false, false, false]);
    expect(best(r, 'costPerPerson')).toEqual([false, false, false]);
  });
  it('null-only row marks nothing', () => {
    const r = buildCompareTable([item({ earliest: null }), item({ earliest: null })]);
    expect(best(r, 'earliestWalk')).toEqual([false, false]);
    expect(best(buildCompareTable([item({ fp: { sqft: undefined } }), item({ fp: { sqft: undefined } })]), 'sqft'))
      .toEqual([false, false]);
  });
  it('leaseTerm and leaseType never mark', () => {
    const r = buildCompareTable([item(), item({ fp: { termKind: 'semester', leaseType: 'joint' } })]);
    expect(best(r, 'leaseTerm')).toEqual([false, false]);
    expect(best(r, 'leaseType')).toEqual([false, false]);
    expect(row(r, 'leaseTerm').cells.every((c) => c.value === null)).toBe(true);
  });
});

describe('best marking: yes/no rows', () => {
  it('marks the yes cells', () => {
    const r = buildCompareTable([
      item({ fp: { furnished: true, utilitiesIncluded: true, inUnitLaundry: true } }),
      item(),
      item({ fp: { furnished: true } }),
    ]);
    expect(best(r, 'furnished')).toEqual([true, false, true]);
    expect(best(r, 'utilities')).toEqual([true, false, false]);
    expect(best(r, 'laundry')).toEqual([true, false, false]);
  });
  it('all yes marks nothing', () =>
    expect(best(buildCompareTable([item({ fp: { furnished: true } }), item({ fp: { furnished: true } })]), 'furnished'))
      .toEqual([false, false]));
  it('all no marks nothing', () => expect(best(buildCompareTable([item(), item()]), 'laundry')).toEqual([false, false]));
  it('parking: any availability counts as yes', () => {
    const r = buildCompareTable([
      item(), item({ amenities: { parkingAvailable: true, parkingMonthly: 75 } }),
      item({ amenities: { parkingAvailable: true, parkingMonthly: 0 } }),
    ]);
    expect(best(r, 'parking')).toEqual([false, true, true]);
  });
  it('yes cells carry value 1, no cells 0', () =>
    expect(row(buildCompareTable([item({ fp: { furnished: true } }), item()]), 'furnished').cells.map((c) => c.value))
      .toEqual([1, 0]));
});
