// Pure display helpers for the group pages. No React, no I/O. Never takes another member's budget.
import type { CommuteSummary, Listing, VoteTally } from '@homed/core';
import { minutes } from '../format';

/** "3 yes, 1 no, 2 not voted". */
export function voteSummary(tally: VoteTally): string {
  return `${tally.yes} yes, ${tally.no} no, ${tally.pending.length} not voted`;
}

/** "Group average about 9 min to class", or null when there is no merged commute. */
export function commuteLine(commute: CommuteSummary | null): string | null {
  if (!commute) return null;
  return `Group average about ${minutes(Math.round(commute.averageMinutes))} to class`;
}

/** "Property Floor plan", the name used for a listing in group pages. */
export function listingLabel(listing: Pick<Listing, 'property' | 'floorPlan'>): string {
  return `${listing.property.name} ${listing.floorPlan.name}`;
}

/** Member-facing budget label. Only presence is shown for other members. */
export function budgetLabel(hasBudget: boolean): string {
  return hasBudget ? 'Budget set' : 'No budget';
}

const HOST = /^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])(?::\d{1,5})?$/;

/**
 * Origin for invite links, from the request's Host and X-Forwarded-Proto headers. Defaults to http.
 * Returns '' when the host is missing or not a plain host[:port], so a hostile header cannot leak into the link.
 */
export function inviteOrigin(host: string | null, forwardedProto: string | null): string {
  if (!host || !HOST.test(host)) return '';
  const first = (forwardedProto ?? '').split(',')[0]?.trim().toLowerCase();
  const scheme = first === 'https' ? 'https' : 'http';
  return `${scheme}://${host}`;
}
