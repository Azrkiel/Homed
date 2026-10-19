import type { FloorPlan, Property } from '@homed/core';
import { Card, CardBody } from '@/components/ui';
import { bedBath, shortDate } from '@/lib/format';
import { leaseTypeLabel, termKindLabel } from '@/lib/search/listing-detail';

const yn = (v: boolean) => (v ? 'Yes' : 'No');

function bedBathRatio(beds: number, baths: number): string {
  if (beds === 0) return 'Studio';
  const r = beds / baths;
  return Number.isInteger(r) ? `${r}:1` : `${beds}:${baths}`;
}

/** Fact sheet for the floor plan. */
export function ListingFacts({ floorPlan, property }: { floorPlan: FloorPlan; property: Property }) {
  const parking = property.amenities.parkingAvailable
    ? property.amenities.parkingMonthly === undefined
      ? 'Available'
      : property.amenities.parkingMonthly === 0
        ? 'Available, free'
        : `Available, $${property.amenities.parkingMonthly}/mo`
    : 'Not available';
  const facts: [string, string][] = [
    ['Bedrooms / baths', bedBath(floorPlan.beds, floorPlan.baths)],
    ['Bed:bath', bedBathRatio(floorPlan.beds, floorPlan.baths)],
    ['Size', floorPlan.sqft ? `${floorPlan.sqft} sq ft` : 'Not listed'],
    ['Lease dates', `${shortDate(floorPlan.leaseStart)} to ${shortDate(floorPlan.leaseEnd)}`],
    ['Lease term', termKindLabel(floorPlan.termKind)],
    ['Lease type', leaseTypeLabel(floorPlan.leaseType)],
    ['Furnished', yn(floorPlan.furnished)],
    ['Utilities included', yn(floorPlan.utilitiesIncluded)],
    ['In-unit laundry', yn(floorPlan.inUnitLaundry)],
    ['Air conditioning', yn(floorPlan.ac)],
    ['Dishwasher', yn(floorPlan.dishwasher)],
    ['Parking', parking],
    ['Address', property.address],
  ];
  return (
    <Card as="section">
      <CardBody className="grid gap-3">
        <h2 className="text-xl font-semibold text-ink">Facts</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="flex flex-wrap justify-between gap-x-3 border-b border-line pb-2">
              <dt className="text-ink-2">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}
