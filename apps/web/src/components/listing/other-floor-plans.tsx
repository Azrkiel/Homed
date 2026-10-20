import Link from 'next/link';
import type { Listing } from '@homed/core';
import { bedBath, money } from '@/lib/format';

/** Other floor plans in the same building, as compact links. Renders nothing when there are none. */
export function OtherFloorPlans({ plans, propertyName }: { plans: Listing[]; propertyName: string }) {
  if (plans.length === 0) return null;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
          {plans.map(({ floorPlan }) => (
            <li key={floorPlan.id}>
              <Link
                href={`/listings/${floorPlan.id}`}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2"
              >
                <span className="font-medium text-ink">
                  {floorPlan.name} <span className="font-normal text-ink-2">{bedBath(floorPlan.beds, floorPlan.baths)}</span>
                </span>
                <span className="tabular-nums text-ink">
                  {money(floorPlan.rentAmount)}
                  <span className="text-ink-2">{floorPlan.rentBasis === 'per_bed' ? '/bed' : '/unit'}</span>
                </span>
              </Link>
            </li>
          ))}
    </ul>
  );
}
