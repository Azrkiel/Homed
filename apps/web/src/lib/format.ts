// Pure display helpers. No Intl or Date parsing: output must not depend on the server's locale or timezone.
import { formatMinutes } from '@homed/core';

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "$1,234" (whole dollars, rounded half away from zero). */
export function money(n: number): string {
  const rounded = Math.round(Math.abs(n));
  const sign = n < 0 && rounded !== 0 ? '-' : '';
  return `${sign}$${group(String(rounded))}`;
}

/** Like money, but two decimals when the amount is not a whole dollar. */
export function moneyPrecise(n: number): string {
  if (Number.isInteger(n)) return money(n);
  const sign = n < 0 ? '-' : '';
  const [whole = '0', frac = '00'] = Math.abs(n).toFixed(2).split('.');
  return `${sign}$${group(whole)}.${frac}`;
}

/** "45 min" / "2 h 10 min". Delegates to core. */
export function minutes(n: number): string {
  return formatMinutes(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2027-08-15" -> "Aug 15, 2027". Parsed as calendar parts, so no timezone shift. Invalid input is returned unchanged. */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const monthName = MONTHS[month - 1];
  if (!monthName || day < 1 || day > daysInMonth(year, month)) return iso;
  return `${monthName} ${day}, ${year}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** "1 listing" / "3 listings". Pass pluralWord for irregular plurals ("person" / "people"). */
export function plural(n: number, word: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? word : (pluralWord ?? `${word}s`)}`;
}

/** "2 bd / 2 ba", "Studio / 1 ba". */
export function bedBath(beds: number, baths: number): string {
  const bed = beds === 0 ? 'Studio' : `${beds} bd`;
  return `${bed} / ${baths} ba`;
}
