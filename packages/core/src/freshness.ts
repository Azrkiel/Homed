import type { ISODate } from './types';

/** Listings not confirmed in this many days are dimmed. */
export const STALE_AFTER_DAYS = 14;

/** Whole days from `from` to `to` (ISO dates); negative when to < from. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function isStale(lastVerified: ISODate, today: ISODate): boolean {
  return daysBetween(lastVerified, today) > STALE_AFTER_DAYS;
}

/** "Verified today" / "Verified 3 days ago" / "Not verified in 20 days". */
export function verifiedLabel(lastVerified: ISODate, today: ISODate): string {
  const n = daysBetween(lastVerified, today);
  if (n <= 0) return 'Verified today';
  if (n === 1) return 'Verified yesterday';
  if (n <= STALE_AFTER_DAYS) return `Verified ${n} days ago`;
  return `Not verified in ${n} days`;
}
