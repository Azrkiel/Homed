import type { ISODate } from '@homed/core';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written YYYY-MM-DD (2028-02-29 ok, 2027-02-29 not). */
export function isIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Calendar math in UTC, no timezone drift. Throws RangeError on a malformed date. */
export function addDaysIso(date: ISODate, days: number): ISODate {
  if (!isIsoDate(date)) throw new RangeError(`not an ISO date: ${date}`);
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d + days);
  return dt.toISOString().slice(0, 10);
}
