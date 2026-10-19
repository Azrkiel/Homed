import type { Alert, AlertEventDraft, Listing } from './types';
import { notImplemented } from './not-implemented';

/** "Only a few left" threshold: unitsAvailable at or below this (and above 0). */
export const FEW_LEFT_THRESHOLD = 3;

/**
 * Compare two catalog snapshots and produce alert events.
 * - new_listing: a floor plan in `next` not in `prev` that matches a search alert's filters
 *   (passesFilters), or belongs to a watched property.
 * - price_drop: same floor plan, lower rentAmount; message names the drop ("$1,450 -> $1,395").
 * - few_left: unitsAvailable crosses from > FEW_LEFT_THRESHOLD (or null) to 1..FEW_LEFT_THRESHOLD.
 * An alert only fires the triggers it lists. Property alerts fire for that property's floor plans;
 * search alerts fire for listings that pass the search's filters in `next`.
 * At most one event per (alert, floor plan, trigger) per call.
 */
export function diffForAlerts(prev: Listing[], next: Listing[], alerts: Alert[]): AlertEventDraft[] {
  return notImplemented('diffForAlerts');
}
