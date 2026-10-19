import type { ISODate } from './types';
import { notImplemented } from './not-implemented';

/** Listings not confirmed in this many days are dimmed. */
export const STALE_AFTER_DAYS = 14;

/** Whole days from `from` to `to` (ISO dates); negative when to < from. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return notImplemented('daysBetween');
}

export function isStale(lastVerified: ISODate, today: ISODate): boolean {
  return notImplemented('isStale');
}

/** "Verified today" / "Verified 3 days ago" / "Not verified in 20 days". */
export function verifiedLabel(lastVerified: ISODate, today: ISODate): string {
  return notImplemented('verifiedLabel');
}
