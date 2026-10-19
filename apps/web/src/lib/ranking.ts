// Server-side ranking for the signed-in or signed-out user. Scoring, cost and filters live in @homed/core.
import {
  DEFAULT_WEIGHTS,
  applyFilters,
  neighborhoodMedians,
  normalizeWeights,
  rankListings,
  scoreListing,
  weeklyMeetings,
  type ID,
  type Listing,
  type ListingFilters,
  type RankedListing,
  type ScoreWeights,
  type ScoringContext,
  type User,
  type WalkLookup,
  type WalkTime,
  type WeeklyMeeting,
} from '@homed/core';
import { getRepo, today } from './repo';

/** Overrides for a group (Phase 6). Any field that is set replaces the user-derived value. */
export interface GroupContext {
  weights?: ScoreWeights;
  budgetMax?: number;
  meetings?: WeeklyMeeting[];
  extras?: ID[];
}

export interface RankOptions {
  filters?: ListingFilters;
  groupContext?: GroupContext;
}

/** Index walk times by `${propertyId}:${targetId}`. Pure. */
export function buildWalkLookup(rows: WalkTime[]): WalkLookup {
  const byKey = new Map<string, WalkTime>();
  for (const row of rows) byKey.set(`${row.propertyId}:${row.targetId}`, row);
  return (propertyId, targetId) => byKey.get(`${propertyId}:${targetId}`);
}

/**
 * ScoringContext for a user (or signed out when null). Medians cover all listings unless `listings`
 * is passed. Group values, when set, win over the user's.
 */
export async function scoringContextFor(
  user: User | null,
  opts: { groupContext?: GroupContext; listings?: Listing[] } = {},
): Promise<ScoringContext> {
  const repo = getRepo();
  const [schedule, majors, walkRows, listings] = await Promise.all([
    user ? repo.getSchedule(user.id) : Promise.resolve(null),
    repo.listMajors(),
    repo.listWalkTimes(),
    opts.listings ?? repo.listListings(),
  ]);
  const group = opts.groupContext ?? {};

  return {
    weights: group.weights ? normalizeWeights(group.weights) : user ? normalizeWeights(user.weights) : { ...DEFAULT_WEIGHTS },
    budgetMax: group.budgetMax !== undefined ? group.budgetMax : user?.budgetMax,
    meetings: group.meetings ?? weeklyMeetings(schedule, majors),
    extras: group.extras ?? (user ? user.extras : []),
    walk: buildWalkLookup(walkRows),
    neighborhoodMedians: neighborhoodMedians(listings),
    today: today(),
  };
}

/** Ranked listings for the user (or signed out). Filters narrow the list; medians use every listing. */
export async function rankForUser(user: User | null, opts: RankOptions = {}): Promise<RankedListing[]> {
  const all = await getRepo().listListings();
  const ctx = await scoringContextFor(user, { groupContext: opts.groupContext, listings: all });
  const subset = opts.filters ? applyFilters(all, opts.filters) : all;
  return rankListings(subset, ctx);
}

/** One listing scored with the same context as rankForUser. Null when the floor plan is unknown. */
export async function getRankedListing(
  user: User | null,
  floorPlanId: ID,
  opts: { groupContext?: GroupContext } = {},
): Promise<RankedListing | null> {
  const repo = getRepo();
  const listing = await repo.getListing(floorPlanId);
  if (!listing) return null;
  const all = await repo.listListings();
  const ctx = await scoringContextFor(user, { groupContext: opts.groupContext, listings: all });
  return { listing, score: scoreListing(listing, ctx) };
}
