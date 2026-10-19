import Link from 'next/link';
import type { Listing } from '@homed/core';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import { CostLine } from '@/components/listing/cost-line';
import { PhotoOrPlaceholder } from '@/components/listing/photo-or-placeholder';
import { overBudgetLabel, type ShortlistRow } from '@/lib/groups/view';
import { commuteLine, listingLabel, voteSummary } from '@/lib/groups/present';
import { RemoveShortlistButton, VoteButtons } from './shortlist-actions';

/**
 * Shortlist rows. `listingFor` resolves floor plan ids to listings (ranked or fetched); a missing one
 * shows as no longer listed. Over-budget and names come from helpers that never expose budget numbers.
 */
export function ShortlistSection({
  groupId,
  rows,
  listingFor,
  names,
  viewerId,
}: {
  groupId: string;
  rows: ShortlistRow[];
  listingFor: Map<string, Listing>;
  names: Map<string, string>;
  viewerId: string;
}) {
  return (
    <section aria-labelledby="shortlist-heading" className="grid gap-4">
      <h2 id="shortlist-heading" className="text-lg font-semibold text-ink">
        Shortlist ({rows.length})
      </h2>

      {rows.length === 0 ? (
        <EmptyState
          title="No places on the shortlist yet"
          body="Add places from search with the Add to group button, then vote on them here."
          action={
            <>
              <Button href="/search">Search places</Button>
              <Button href={`/groups/${groupId}/browse`} variant="secondary">
                Browse as a group
              </Button>
            </>
          }
        />
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => {
            const listing = listingFor.get(row.floorPlanId);
            const name = listing ? listingLabel(listing) : 'A place no longer listed';
            const overLabel = overBudgetLabel(row.overBudget, names, viewerId);
            const commute = commuteLine(row.commute);
            const addedBy = names.get(row.addedBy) ?? 'a member';
            return (
              <li key={row.floorPlanId}>
                <Card as="article" className="flex flex-col overflow-hidden sm:flex-row">
                  {listing && (
                    <PhotoOrPlaceholder photos={listing.photos} name={name} className="sm:w-44 sm:shrink-0 sm:aspect-auto" />
                  )}
                  <div className="grid min-w-0 flex-1 content-start gap-2.5 p-4">
                    <h3 className="text-base font-semibold text-ink">
                      {listing ? (
                        <Link href={`/listings/${row.floorPlanId}`} className="underline-offset-2 hover:underline">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </h3>

                    {row.costPerPerson !== null && <CostLine total={row.costPerPerson} />}

                    {row.note && <p className="text-sm text-ink">{row.note}</p>}
                    <p className="text-xs text-ink-2">Added by {addedBy}</p>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                      <span>{voteSummary(row.tally)}</span>
                      {row.tally.unanimous && <Badge tone="good">Unanimous</Badge>}
                    </div>

                    {commute && <p className="text-sm text-ink-2">{commute}</p>}
                    {overLabel && <Badge tone="warn" className="w-fit">{overLabel}</Badge>}

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
                      <VoteButtons groupId={groupId} floorPlanId={row.floorPlanId} name={name} myVote={row.myVote} />
                      <RemoveShortlistButton groupId={groupId} floorPlanId={row.floorPlanId} name={name} />
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
