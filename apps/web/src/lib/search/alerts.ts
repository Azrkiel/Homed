// Alerts page helpers. Pure.
import type { AlertEvent, AlertTrigger, Listing } from '@homed/core';
import { localDate, shortDate } from '../format';

export const TRIGGER_LABELS: Record<AlertTrigger, string> = {
  new_listing: 'New listing',
  price_drop: 'Price drop',
  few_left: 'Few left',
};

export function triggerLabel(t: AlertTrigger): string {
  return TRIGGER_LABELS[t] ?? t;
}

/** Newest first; ties keep input order. */
export function sortEventsNewestFirst(events: AlertEvent[]): AlertEvent[] {
  return [...events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Listing link for an event: its floor plan, else the property's first floor plan, else null. */
export function eventListingHref(event: AlertEvent, listings: Listing[]): string | null {
  if (event.floorPlanId) return `/listings/${event.floorPlanId}`;
  const first = listings.find((l) => l.property.id === event.propertyId);
  return first ? `/listings/${first.floorPlan.id}` : null;
}

/** "Oct 18, 2026" from an ISO date-time. */
export function eventDate(createdAt: string): string {
  return shortDate(localDate(createdAt));
}
