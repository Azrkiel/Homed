// Pure display helpers. Money and dates are formatted by hand so output matches on every engine.
import { formatMinutes } from '@homed/core';
import type { AlertTrigger, LeaseTermKind, ListingBadge } from './api-types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1234 -> "$1,234". Rounds to whole dollars. */
export function money(amount: number): string {
  const whole = Math.round(amount);
  const digits = Math.abs(whole)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${whole < 0 ? '-' : ''}$${digits}`;
}

/** 1234 -> "$1,234/mo". */
export function perMonth(amount: number): string {
  return `${money(amount)}/mo`;
}

/** Minutes from @homed/core: 45 -> "45 min", 130 -> "2 h 10 min". */
export function minutesLabel(minutes: number): string {
  return formatMinutes(minutes);
}

/** "2026-08-15" -> "Aug 15, 2026". Falls back to the raw string when it is not a date. */
export function dateLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return iso;
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

/** ISO timestamp -> "Oct 19, 3:05 PM" in local time. */
export function dateTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${MONTHS[date.getMonth()] ?? ''} ${date.getDate()}, ${hour12}:${minutes} ${suffix}`;
}

const BADGE_LABELS: Record<ListingBadge, string> = {
  renderings_only: 'Renderings only',
  stale: 'Needs re-check',
  accommodation_friendly: 'Accommodation friendly',
  few_left: 'Few left',
  private_bath: 'Private bath',
  on_grounds: 'On Grounds',
  individual_lease: 'Individual lease',
};

export function badgeLabel(badge: ListingBadge): string {
  return BADGE_LABELS[badge];
}

const TERM_LABELS: Record<LeaseTermKind, string> = {
  '12_month': '12-month lease',
  academic_year: 'Academic year',
  semester: 'Semester',
  other: 'Other term',
};

export function termLabel(kind: LeaseTermKind): string {
  return TERM_LABELS[kind];
}

const ALERT_LABELS: Record<AlertTrigger, string> = {
  new_listing: 'New listing',
  price_drop: 'Price drop',
  few_left: 'Few left',
};

export function alertLabel(trigger: AlertTrigger): string {
  return ALERT_LABELS[trigger];
}

export function yesNo(value: boolean): string {
  return value ? 'Yes' : 'No';
}

/** Only http(s) links may be opened from listing data. */
export function safeHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
