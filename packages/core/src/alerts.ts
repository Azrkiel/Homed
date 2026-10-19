import type { Alert, AlertEventDraft, AlertTrigger, Listing } from './types';
import { passesFilters } from './filters';

/** "Only a few left" threshold: unitsAvailable at or below this (and above 0). */
export const FEW_LEFT_THRESHOLD = 3;

const usd = (n: number): string => `$${n.toLocaleString('en-US')}`;

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
  const prevById = new Map(prev.map((l) => [l.floorPlan.id, l]));
  const out: AlertEventDraft[] = [];
  const seen = new Set<string>();

  for (const alert of alerts) {
    for (const l of next) {
      const matches =
        alert.target.kind === 'property'
          ? l.property.id === alert.target.propertyId
          : passesFilters(l, alert.target.filters).pass;
      if (!matches) continue;

      const old = prevById.get(l.floorPlan.id);
      const label = `${l.property.name} ${l.floorPlan.name}`;
      const fire = (trigger: AlertTrigger, message: string): void => {
        if (!alert.triggers.includes(trigger)) return;
        const key = JSON.stringify([alert.id, l.floorPlan.id, trigger]);
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          alertId: alert.id,
          userId: alert.userId,
          trigger,
          propertyId: l.property.id,
          floorPlanId: l.floorPlan.id,
          message,
        });
      };

      if (!old) {
        fire('new_listing', `New listing: ${label}`);
        continue;
      }
      if (l.floorPlan.rentAmount < old.floorPlan.rentAmount) {
        fire('price_drop', `Price drop at ${label}: ${usd(old.floorPlan.rentAmount)} -> ${usd(l.floorPlan.rentAmount)}`);
      }
      const was = old.floorPlan.unitsAvailable;
      const now = l.floorPlan.unitsAvailable;
      if (now !== null && now >= 1 && now <= FEW_LEFT_THRESHOLD && (was === null || was > FEW_LEFT_THRESHOLD)) {
        fire('few_left', `Only ${now} left at ${label}`);
      }
    }
  }
  return out;
}
