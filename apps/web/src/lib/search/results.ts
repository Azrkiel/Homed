// Pure helpers over ranked results: map markers and walk-data checks.
import type { MatchScore, RankedListing } from '@homed/core';

export interface PropertyMarker {
  propertyId: string;
  name: string;
  lat: number;
  lng: number;
  onGrounds: boolean;
  /** Best Match of the property's best floor plan. */
  score: number;
  /** Lowest all-in monthly cost per person among the property's results. */
  fromPrice: number;
  /** Listing page of the best-scoring floor plan. */
  href: string;
  floorPlanName: string;
}

/** One marker per property: the best score among its ranked floor plans (ties: cheaper). */
export function propertyMarkers(ranked: RankedListing[]): PropertyMarker[] {
  const byProperty = new Map<string, { marker: PropertyMarker; planPrice: number }>();
  for (const { listing, score } of ranked) {
    const { property, floorPlan } = listing;
    if (!Number.isFinite(property.location.lat) || !Number.isFinite(property.location.lng)) continue;
    const price = score.cost.totalMonthly;
    const entry = byProperty.get(property.id);
    if (!entry) {
      byProperty.set(property.id, {
        planPrice: price,
        marker: {
          propertyId: property.id,
          name: property.name,
          lat: property.location.lat,
          lng: property.location.lng,
          onGrounds: property.onGrounds || property.kind === 'on_grounds',
          score: score.total,
          fromPrice: price,
          href: `/listings/${floorPlan.id}`,
          floorPlanName: floorPlan.name,
        },
      });
      continue;
    }
    const m = entry.marker;
    m.fromPrice = Math.min(m.fromPrice, price);
    if (score.total > m.score || (score.total === m.score && price < entry.planPrice)) {
      m.score = score.total;
      m.href = `/listings/${floorPlan.id}`;
      m.floorPlanName = floorPlan.name;
      entry.planPrice = price;
    }
  }
  return [...byProperty.values()].map((e) => e.marker);
}

/** False when there are no class trips and no extra landmarks to measure. */
export function hasWalkData(score: MatchScore): boolean {
  return score.commute.earliestClassMinutes !== null || score.commute.extras.length > 0;
}
