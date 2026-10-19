import Link from 'next/link';
import { isStale, type ISODate, type RankedListing } from '@homed/core';
import { ScoreRing, cx } from '@/components/ui';
import { AddToGroupButton } from '@/components/groups/add-to-group-button';
import { bedBath, minutes } from '@/lib/format';
import { hasWalkData } from '@/lib/search/results';
import { CostLine } from './cost-line';
import { ListingBadges } from './listing-badges';
import { PhotoOrPlaceholder } from './photo-or-placeholder';
import { SaveToggle } from './save-toggle';
import { StaleNotice } from './stale-notice';

/**
 * One ranked listing. The title link is the single primary link and covers the whole card (stretched
 * link); the save and group buttons sit above it with `relative z-10`.
 */
export function ListingCard({
  ranked,
  today,
  saved,
  signedIn,
  nextPath,
  className,
}: {
  ranked: RankedListing;
  today: ISODate;
  saved: boolean;
  signedIn: boolean;
  /** Where sign-in and revalidation return to (the current page URL). */
  nextPath: string;
  className?: string;
}) {
  const { listing, score } = ranked;
  const { property, floorPlan, photos } = listing;
  const stale = isStale(floorPlan.lastVerified, today);
  const walk = hasWalkData(score);
  const href = `/listings/${floorPlan.id}`;

  return (
    <article
      aria-label={`${property.name}, ${floorPlan.name}`}
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-card border bg-surface shadow-card transition-shadow focus-within:ring-2 focus-within:ring-focus hover:shadow-lg sm:flex-row',
        stale ? 'border-dashed border-warn' : 'border-line',
        className,
      )}
    >
      <PhotoOrPlaceholder photos={photos} name={property.name} dimmed={stale} className="sm:w-44 sm:shrink-0 sm:aspect-auto" />

      <div className="grid min-w-0 flex-1 content-start gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">
              <Link
                href={href}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {property.name}
              </Link>
            </h3>
            <p className="text-sm text-ink-2">
              {floorPlan.name} &middot; {bedBath(floorPlan.beds, floorPlan.baths)} &middot; {property.neighborhood}
            </p>
          </div>
          <ScoreRing score={score.total} size="sm" />
        </div>

        <CostLine total={score.cost.totalMonthly} />
        <p className="text-sm text-ink">{score.why}</p>

        {walk ? (
          score.commute.earliestClassMinutes !== null && (
            <p className="text-sm text-ink-2">
              About {minutes(Math.round(score.commute.averageMinutes))} to class{score.commute.usesBus ? ' (bus helps)' : ''}
            </p>
          )
        ) : (
          <p className="text-sm text-ink-2">
            {signedIn ? 'Walk times unavailable. Add your classes to rank by your walk.' : 'Add your classes to see your walk.'}
          </p>
        )}

        <ListingBadges badges={score.badges} kind={property.kind} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <StaleNotice lastVerified={floorPlan.lastVerified} today={today} />
          <div className="relative z-10 flex items-center gap-2">
            <AddToGroupButton floorPlanId={floorPlan.id} />
            <SaveToggle
              floorPlanId={floorPlan.id}
              name={`${property.name} ${floorPlan.name}`}
              saved={saved}
              signedIn={signedIn}
              nextPath={nextPath}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
