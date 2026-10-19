// Catalog stats for the landing page ("is waiting safe?"). Pure.
import { computeCost, type Listing } from '@homed/core';

export interface CatalogStats {
  /** Distinct properties. */
  places: number;
  floorPlans: number;
  /** Places with at least one floor plan listing unitsAvailable > 0. */
  placesOpen: number;
  /** Places where no floor plan has a known count (all null). */
  placesUnknown: number;
  /** Places with a known count of 0 on every floor plan. */
  placesFull: number;
  /** Floor plans with unitsAvailable > 0. */
  floorPlansOpen: number;
  /** Floor plans with unitsAvailable === null. */
  floorPlansUnknown: number;
  /** Median all-in monthly cost per person, whole dollars; null with no listings. */
  medianMonthly: number | null;
  /** Latest lastVerified across properties and floor plans; null with no listings. */
  lastVerified: string | null;
}

export type WaitingTone = 'good' | 'warn' | 'neutral';
export interface WaitingSignal {
  tone: WaitingTone;
  text: string;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const hi = sorted[mid] ?? 0;
  if (sorted.length % 2 === 1) return hi;
  const lo = sorted[mid - 1] ?? hi;
  return Math.round((lo + hi) / 2);
}

export function computeCatalogStats(listings: Listing[]): CatalogStats {
  const byProperty = new Map<string, Listing[]>();
  for (const l of listings) {
    const list = byProperty.get(l.property.id);
    if (list) list.push(l);
    else byProperty.set(l.property.id, [l]);
  }
  let placesOpen = 0;
  let placesUnknown = 0;
  let placesFull = 0;
  for (const group of byProperty.values()) {
    const counts = group.map((l) => l.floorPlan.unitsAvailable);
    if (counts.some((c) => c !== null && c > 0)) placesOpen++;
    else if (counts.every((c) => c === null)) placesUnknown++;
    else placesFull++;
  }
  let lastVerified: string | null = null;
  for (const l of listings) {
    for (const d of [l.floorPlan.lastVerified, l.property.lastVerified]) {
      if (d && (lastVerified === null || d > lastVerified)) lastVerified = d;
    }
  }
  return {
    places: byProperty.size,
    floorPlans: listings.length,
    placesOpen,
    placesUnknown,
    placesFull,
    floorPlansOpen: listings.filter((l) => (l.floorPlan.unitsAvailable ?? 0) > 0).length,
    floorPlansUnknown: listings.filter((l) => l.floorPlan.unitsAvailable === null).length,
    medianMonthly: median(listings.map((l) => computeCost(l.floorPlan, l.property).totalMonthly)),
    lastVerified,
  };
}

/** One honest line about whether there is time to compare. */
export function waitingSignal(stats: CatalogStats): WaitingSignal {
  const { places, placesOpen, placesUnknown } = stats;
  if (places === 0) return { tone: 'neutral', text: 'No listings are loaded yet, so there is nothing to compare.' };
  const unknown = placesUnknown > 0 ? ` ${placesUnknown} more do not say.` : '';
  const noun = places === 1 ? 'place' : 'places';
  if (placesOpen === 0) {
    return {
      tone: 'warn',
      text: `None of ${places} ${noun} list open units right now.${unknown} Set an alert and ask landlords about waitlists.`,
    };
  }
  if (placesOpen * 2 >= places) {
    return {
      tone: 'good',
      text: `${placesOpen} of ${places} ${noun} still list open units: you have time to compare.${unknown}`,
    };
  }
  return {
    tone: 'warn',
    text: `Only ${placesOpen} of ${places} ${noun} still list open units. Compare soon, but never sign under pressure.${unknown}`,
  };
}
