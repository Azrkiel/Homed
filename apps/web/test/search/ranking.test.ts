import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, applyFilters, computeCost, type Listing, type WalkTime } from '@homed/core';

type RankingModule = typeof import('../../src/lib/ranking');
type RepoModule = typeof import('../../src/lib/repo');

let ranking: RankingModule;
let repoMod: RepoModule;

beforeAll(async () => {
  // Fresh store and fixed "today" before the modules read their env.
  process.env.HOMED_DATA_DIR = mkdtempSync(join(tmpdir(), 'homed-ranking-'));
  process.env.HOMED_TODAY = '2026-10-19';
  delete process.env.HOMED_BACKEND;
  ranking = await import('../../src/lib/ranking');
  repoMod = await import('../../src/lib/repo');
});

async function allListings(): Promise<Listing[]> {
  return repoMod.getRepo().listListings();
}

async function newStudent(budgetMax?: number) {
  const repo = repoMod.getRepo();
  const user = await repo.createUser({ email: `student-${Math.random().toString(36).slice(2)}@virginia.edu`, name: 'Test Student', role: 'student' });
  return budgetMax === undefined ? user : repo.updateUser(user.id, { budgetMax });
}

describe('buildWalkLookup', () => {
  const rows: WalkTime[] = [
    { propertyId: 'p1', targetId: 'lawn', targetKind: 'landmark', walkMinutes: 7, busMinutes: null, source: 'osrm' },
    { propertyId: 'p1', targetId: 'b-x', targetKind: 'building', walkMinutes: 12, busMinutes: 9, source: 'estimate' },
  ];

  it('returns the row for a matching propertyId:targetId key', () => {
    const walk = ranking.buildWalkLookup(rows);
    expect(walk('p1', 'lawn')).toEqual(rows[0]);
    expect(walk('p1', 'b-x')).toEqual(rows[1]);
  });

  it('returns undefined for unknown pairs', () => {
    const walk = ranking.buildWalkLookup(rows);
    expect(walk('p2', 'lawn')).toBeUndefined();
    expect(walk('p1', 'nope')).toBeUndefined();
    expect(ranking.buildWalkLookup([])('p1', 'lawn')).toBeUndefined();
  });
});

describe('scoringContextFor', () => {
  it('signed out: default weights, no budget, no meetings, no extras', async () => {
    const ctx = await ranking.scoringContextFor(null);
    expect(ctx.weights).toEqual(DEFAULT_WEIGHTS);
    expect(ctx.budgetMax).toBeUndefined();
    expect(ctx.meetings).toEqual([]);
    expect(ctx.extras).toEqual([]);
    expect(ctx.today).toBe('2026-10-19');
  });

  it('signed in: budget and extras come from the user', async () => {
    const user = await newStudent(1200);
    const landmark = (await repoMod.getRepo().listLandmarks())[0];
    const withExtra = await repoMod.getRepo().updateUser(user.id, { extras: landmark ? [landmark.id] : [] });
    const ctx = await ranking.scoringContextFor(withExtra);
    expect(ctx.budgetMax).toBe(1200);
    expect(ctx.extras).toEqual(landmark ? [landmark.id] : []);
  });

  it('walk lookup reads the stored walk-time matrix', async () => {
    const ctx = await ranking.scoringContextFor(null);
    const row = (await repoMod.getRepo().listWalkTimes())[0];
    expect(row).toBeDefined();
    if (row) expect(ctx.walk(row.propertyId, row.targetId)).toEqual(row);
  });

  it('groupContext.budgetMax overrides the user budget', async () => {
    const user = await newStudent(900);
    const ctx = await ranking.scoringContextFor(user, { groupContext: { budgetMax: 1234 } });
    expect(ctx.budgetMax).toBe(1234);
    const kept = await ranking.scoringContextFor(user, { groupContext: { weights: DEFAULT_WEIGHTS } });
    expect(kept.budgetMax).toBe(900);
  });
});

describe('rankForUser', () => {
  it('signed out: every listing, sorted by score desc, with DEFAULT weights', async () => {
    const all = await allListings();
    const ranked = await ranking.rankForUser(null);
    expect(ranked).toHaveLength(all.length);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.score.total).toBeGreaterThanOrEqual(ranked[i]!.score.total);
    }
    const withDefaults = await ranking.rankForUser(null, { groupContext: { weights: DEFAULT_WEIGHTS } });
    expect(ranked.map((r) => [r.listing.floorPlan.id, r.score.total])).toEqual(
      withDefaults.map((r) => [r.listing.floorPlan.id, r.score.total]),
    );
  });

  it('filters give the filtered subset, and medians still use every listing', async () => {
    const all = await allListings();
    const costs = all.map((l) => computeCost(l.floorPlan, l.property).totalMonthly);
    const cap = Math.min(...costs);
    const filters = { maxCostPerPerson: cap };
    const expected = applyFilters(all, filters);
    expect(expected.length).toBeLessThan(all.length);

    const user = await newStudent(1500);
    const ranked = await ranking.rankForUser(user, { filters });
    expect(ranked.map((r) => r.listing.floorPlan.id).sort()).toEqual(expected.map((l) => l.floorPlan.id).sort());

    const unfiltered = await ranking.rankForUser(user);
    const unfilteredOne = unfiltered.find((r) => r.listing.floorPlan.id === ranked[0]?.listing.floorPlan.id);
    expect(unfilteredOne?.score.price).toBe(ranked[0]?.score.price);
  });
});

describe('getRankedListing', () => {
  it('scores a known listing with the same context as rankForUser', async () => {
    const all = await allListings();
    const first = all[0];
    expect(first).toBeDefined();
    if (!first) return;
    const one = await ranking.getRankedListing(null, first.floorPlan.id);
    const fromList = (await ranking.rankForUser(null)).find((r) => r.listing.floorPlan.id === first.floorPlan.id);
    expect(one?.listing.floorPlan.id).toBe(first.floorPlan.id);
    expect(one?.score).toEqual(fromList?.score);
  });

  it('returns null for an unknown id', async () => {
    expect(await ranking.getRankedListing(null, 'no-such-floor-plan')).toBeNull();
  });
});
