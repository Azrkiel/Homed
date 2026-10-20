// Groups the catalog into one landlord's portfolio for the dashboard. Pure: takes Listing[] from the repo.
import type { FloorPlan, ID, Listing, Property } from '@homed/core';

export interface PortfolioProperty {
  property: Property;
  /** Sorted by name. */
  floorPlans: FloorPlan[];
}

/**
 * The landlord's properties with their floor plans, sorted by property name.
 *
 * LIMITATION: the repo has no list-properties call, so a property with zero floor plans has no Listing
 * and does not appear here. Such a property stays reachable through the editor link shown right after
 * creation (and by URL). Fixing this needs a repo method that lists properties by landlordId.
 */
export function groupPortfolio(listings: Listing[], landlordId: ID): PortfolioProperty[] {
  const byProperty = new Map<ID, PortfolioProperty>();
  for (const l of listings) {
    if (l.property.landlordId !== landlordId) continue;
    let entry = byProperty.get(l.property.id);
    if (!entry) {
      entry = { property: l.property, floorPlans: [] };
      byProperty.set(l.property.id, entry);
    }
    if (!entry.floorPlans.some((f) => f.id === l.floorPlan.id)) entry.floorPlans.push(l.floorPlan);
  }
  const out = [...byProperty.values()];
  for (const p of out) p.floorPlans.sort((a, b) => a.name.localeCompare(b.name));
  return out.sort((a, b) => a.property.name.localeCompare(b.property.name));
}
