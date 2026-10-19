import type { CostBreakdown, FloorPlan, Property } from '@homed/core';
import { Alert, Button, Card, CardBody, cx } from '@/components/ui';
import { money, plural } from '@/lib/format';
import { termExplanation } from '@/lib/search/listing-detail';

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <tr className={cx('border-t border-line first:border-t-0', strong && 'font-semibold')}>
      <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-2">
        <span className={strong ? 'text-ink' : undefined}>{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </th>
      <td className="py-2 text-right tabular-nums text-ink">{value}</td>
    </tr>
  );
}

/**
 * True cost per person. `cost` comes from core computeCost; the parking toggle is two links that set
 * `?parking=1` so the page re-renders on the server.
 */
export function CostTable({
  cost,
  floorPlan,
  property,
  includeParking,
  basePath,
}: {
  cost: CostBreakdown;
  floorPlan: FloorPlan;
  property: Property;
  includeParking: boolean;
  basePath: string;
}) {
  const parkingAvailable = property.amenities.parkingAvailable;
  const term = termExplanation(floorPlan.termKind, cost.leaseMonths);
  const perUnit = floorPlan.rentBasis === 'per_unit';

  return (
    <Card as="section" className="overflow-hidden">
      <CardBody className="grid gap-3">
        <h2 className="text-xl font-semibold text-ink">True cost per person</h2>
        <table className="w-full text-sm">
          <caption className="sr-only">Monthly cost per person, with lease totals</caption>
          <tbody>
            <Row label="Rent" value={money(cost.rent)} hint={perUnit ? 'Unit rent split by bedroom' : 'Per bed'} />
            <Row
              label="Utilities"
              value={floorPlan.utilitiesIncluded ? 'Included' : money(cost.utilities)}
              hint={floorPlan.utilitiesIncluded ? undefined : floorPlan.utilitiesEstimate === undefined ? 'No estimate available' : 'Estimate'}
            />
            <Row
              label="Internet"
              value={floorPlan.internetIncluded ? 'Included' : money(cost.internet)}
              hint={floorPlan.internetIncluded ? undefined : floorPlan.internetEstimate === undefined ? 'No estimate available' : 'Estimate'}
            />
            <Row
              label="Parking"
              value={!parkingAvailable ? 'Not available' : includeParking ? money(cost.parking) : 'Not counted'}
              hint={
                parkingAvailable
                  ? property.amenities.parkingMonthly === undefined
                    ? 'Price unknown'
                    : `${money(property.amenities.parkingMonthly)} per space`
                  : undefined
              }
            />
            <Row
              label="Furniture"
              value={floorPlan.furnished ? 'Furnished' : money(cost.furniture)}
              hint={floorPlan.furnished ? undefined : floorPlan.furnitureMonthly === undefined ? 'Unfurnished' : 'Rental'}
            />
            <Row label="Total per month" value={money(cost.totalMonthly)} strong />
            <Row label={`Total for the lease (${plural(cost.leaseMonths, 'month')})`} value={money(cost.totalLease)} strong />
          </tbody>
        </table>

        {parkingAvailable && (
          <div role="group" aria-label="Parking in the cost" className="flex flex-wrap gap-2">
            <Button
              href={basePath}
              size="sm"
              variant={includeParking ? 'secondary' : 'primary'}
              aria-current={includeParking ? undefined : 'true'}
            >
              Without parking
            </Button>
            <Button
              href={`${basePath}?parking=1`}
              size="sm"
              variant={includeParking ? 'primary' : 'secondary'}
              aria-current={includeParking ? 'true' : undefined}
            >
              With parking
            </Button>
          </div>
        )}

        {cost.note && (
          <Alert tone="warn">{cost.note}</Alert>
        )}

        <div className="grid gap-1 rounded-card bg-surface-2 p-3 text-sm">
          <h3 className="font-semibold text-ink">{term.title}</h3>
          <p className="text-ink-2">{term.body}</p>
        </div>
      </CardBody>
    </Card>
  );
}
