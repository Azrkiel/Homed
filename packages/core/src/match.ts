import type { ID, RankedListing, Swipe } from './types';

/** The ranked listings the user has not swiped yet (in this group when groupId is given, else solo swipes only), in rank order. */
export function matchQueue(ranked: RankedListing[], swipes: Swipe[], userId: ID, groupId?: ID): RankedListing[] {
  const seen = new Set<ID>();
  for (const s of swipes) {
    if (s.userId === userId && s.groupId === groupId) seen.add(s.floorPlanId);
  }
  return ranked.filter((r) => !seen.has(r.listing.floorPlan.id));
}
