import type { ID, RankedListing, Swipe } from './types';
import { notImplemented } from './not-implemented';

/** The ranked listings the user has not swiped yet (in this group when groupId is given, else solo swipes only), in rank order. */
export function matchQueue(ranked: RankedListing[], swipes: Swipe[], userId: ID, groupId?: ID): RankedListing[] {
  return notImplemented('matchQueue');
}
