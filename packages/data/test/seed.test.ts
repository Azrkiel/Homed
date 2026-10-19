import { describe, expect, it } from 'vitest';
import { loadFixture, loadSeed, type SeedData } from '../src/index';
import { seedCounts, validateSeed, type ValidateOptions } from '../scripts/validate';

const FX: ValidateOptions = { checkCounts: false, requireLandmarks: false };
function at<T>(a: T[], i: number): T {
  const v = a[i];
  if (v === undefined) throw new Error(`no element ${i}`);
  return v;
}
const clone = (): SeedData => structuredClone(loadFixture());
function reports(d: SeedData, re: RegExp) {
  const problems = validateSeed(d, FX);
  expect(
    problems.some((p) => re.test(p)),
    `expected a problem matching ${re}, got:\n${problems.join('\n')}`,
  ).toBe(true);
}

describe('validateSeed on the fixture', () => {
  it('fixture is clean (counts and landmark requirements off), apart from known photo gaps', () => {
    const problems = validateSeed(loadFixture(), FX);
    // fixtures/photos.json only covers p-fixture-lofts; fixtures are lead-owned so the gap is tolerated here.
    expect(problems.filter((p) => !p.endsWith('has no photos'))).toEqual([]);
    expect(problems.filter((p) => p.endsWith('has no photos'))).toEqual([
      'property p-fixture-rugby-house: has no photos',
      'property p-fixture-on-grounds: has no photos',
    ]);
  });
  it('fixture fails count and landmark checks by default', () => {
    const problems = validateSeed(loadFixture());
    expect(problems.some((p) => p.startsWith('count properties'))).toBe(true);
    expect(problems.some((p) => p.includes('required landmark'))).toBe(true);
  });
  it('seedCounts splits on/off Grounds', () => {
    const c = seedCounts(loadFixture());
    expect(c.properties).toBe(c.onGrounds + c.offGrounds);
  });
});

describe('validateSeed reports', () => {
  it('reports duplicate ids', () => {
    const d = clone();
    d.properties.push({ ...at(d.properties, 0) });
    reports(d, /duplicate id/);
  });
  it('reports a dangling propertyId', () => {
    const d = clone();
    at(d.floorPlans, 0).propertyId = 'p-nope';
    reports(d, /floorPlan .*propertyId "p-nope"/);
  });
  it('reports a dangling landlordId', () => {
    const d = clone();
    at(d.properties, 0).landlordId = 'll-nope';
    reports(d, /landlordId/);
  });
  it('reports major shares not summing to 1', () => {
    const d = clone();
    at(at(d.majors, 0).buildings, 0).share = 0.1;
    reports(d, /shares sum/);
  });
  it('reports leaseEnd <= leaseStart', () => {
    const d = clone();
    at(d.floorPlans, 0).leaseEnd = at(d.floorPlans, 0).leaseStart;
    reports(d, /leaseEnd/);
  });
  it('reports onGrounds without onGroundsInfo', () => {
    const d = clone();
    at(d.properties, 0).onGrounds = true;
    delete at(d.properties, 0).onGroundsInfo;
    reports(d, /onGroundsInfo is missing/);
  });
  it('reports an out-of-bbox coordinate', () => {
    const d = clone();
    at(d.properties, 0).location = { lat: 40, lng: -78.5 };
    reports(d, /outside bbox/);
  });
  it('reports a missing walk row', () => {
    const d = clone();
    d.walkTimes.pop();
    reports(d, /missing walk row/);
  });
  it('reports a duplicate walk row', () => {
    const d = clone();
    d.walkTimes.push({ ...at(d.walkTimes, 0) });
    reports(d, /expected exactly 1/);
  });
  it('reports bad slug, rent, dataStatus and worship without tradition', () => {
    const d = clone();
    at(d.properties, 0).slug = 'wrong';
    at(d.floorPlans, 0).rentAmount = 0;
    at(d.properties, 1).dataStatus = 'verified';
    d.landmarks.push({ id: 'church-x', name: 'X', location: { lat: 38.03, lng: -78.5 }, kind: 'worship' });
    reports(d, /slug/);
    reports(d, /rentAmount/);
    reports(d, /dataStatus/);
    reports(d, /missing tradition/);
  });
});

describe('real seed', () => {
  it('real seed passes validation', () => {
    const problems = validateSeed(loadSeed());
    expect(problems).toEqual([]);
  });
});
