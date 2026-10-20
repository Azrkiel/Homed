import Link from 'next/link';
import type { RankedListing } from '@homed/core';
import { Badge, Card, CardBody, EmptyState } from '@/components/ui';
import { minutes } from '@/lib/format';

export type WeekSummaryState =
  | { kind: 'no-meetings' }
  | { kind: 'ready'; best: RankedListing | null; saved: RankedListing | null; hasSaves: boolean };

function PlaceWeek({ heading, item }: { heading: string; item: RankedListing }) {
  const { property, floorPlan } = item.listing;
  const c = item.score.commute;
  const unavailable = c.weeklyMinutes <= 0 && c.averageMinutes <= 0;
  return (
    <Card as="article">
      <CardBody className="grid gap-2">
        <p className="text-sm font-medium text-accent">{heading}</p>
        <h3 className="text-lg font-semibold text-ink">
          <Link href={`/listings/${floorPlan.id}`} className="underline-offset-2 hover:underline">
            {property.name}, {floorPlan.name}
          </Link>
        </h3>
        {unavailable ? (
          <p className="text-ink-2">Your week: walk times unavailable</p>
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums text-ink">{`Your week: ${minutes(c.weeklyMinutes)} walking`}</p>
            <p className="text-sm text-ink-2">
              About {minutes(c.averageMinutes)} per trip
              {c.earliestClassMinutes !== null && <>, {minutes(c.earliestClassMinutes)} to your earliest class</>}.
            </p>
            {c.usesBus && <Badge tone="neutral">Some trips are faster by bus</Badge>}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** Weekly walking summary from the SAVED schedule. Server-rendered. */
export function WeekSummary({ state }: { state: WeekSummaryState }) {
  return (
    <section aria-labelledby="week-heading" className="grid gap-4">
      <h2 id="week-heading" className="text-lg font-semibold text-ink">
        Your week
      </h2>
      {state.kind === 'no-meetings' ? (
        <p className="text-sm text-ink-3">Nothing saved yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.best ? (
            <PlaceWeek heading="Best-ranked place" item={state.best} />
          ) : (
            <p className="text-ink-2">No places to rank yet.</p>
          )}
          {state.saved ? (
            <PlaceWeek heading="Top saved place" item={state.saved} />
          ) : (
            <Card as="article">
              <CardBody className="grid gap-2">
                <p className="text-sm font-medium text-accent">Top saved place</p>
                <p className="text-ink-2">
                  {state.hasSaves ? 'Your saved places are no longer listed.' : 'Save a place to compare its week.'}
                </p>
                {!state.hasSaves && (
                  <Link href="/search" className="text-sm font-medium text-accent underline">
                    Browse places
                  </Link>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
