import Link from 'next/link';
import { isStale, verifiedLabel, type ISODate, type ListingBadge, type RankedListing } from '@homed/core';
import { Badge, ScoreRing, cx } from '@/components/ui';
import { bedBath, money } from '@/lib/format';
import { PhotoOrPlaceholder } from './photo-or-placeholder';
import { SaveToggle } from './save-toggle';

/** The one badge worth showing on a card, most useful first. */
const CARD_BADGE: [ListingBadge, string][] = [
  ['few_left', 'Few left'],
  ['renderings_only', 'Renderings only'],
  ['on_grounds', 'On Grounds'],
];

/** The why line without its price part: the card already shows the price. */
function reason(why: string): string {
  return why
    .split(' · ')
    .filter((part) => !part.includes('all-in'))
    .join(' · ');
}

/**
 * One ranked listing: photo, name, price, why, score and save. The title link covers the whole card
 * (stretched link); the save button sits above it.
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
  const badge = CARD_BADGE.find(([b]) => score.badges.includes(b));
  const why = reason(score.why);

  return (
    <article
      aria-label={`${property.name}, ${floorPlan.name}`}
      className={cx(
        'group relative flex min-w-0 gap-4 rounded-card border border-line bg-surface p-3 transition-colors focus-within:ring-2 focus-within:ring-focus hover:border-navy/30',
        stale && 'opacity-75',
        className,
      )}
    >
      <PhotoOrPlaceholder
        photos={photos}
        name={property.name}
        kind={property.kind}
        dimmed={stale}
        className="h-24 w-32 shrink-0 rounded-md sm:h-28 sm:w-36"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink">
              <Link href={`/listings/${floorPlan.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                {property.name}
              </Link>
            </h3>
            <p className="truncate text-sm text-ink-3">
              {floorPlan.name} &middot; {bedBath(floorPlan.beds, floorPlan.baths)}
            </p>
          </div>
          <ScoreRing score={score.total} size="sm" />
        </div>

        <p className="flex items-baseline gap-1">
          <span className="text-lg font-semibold tabular-nums text-navy">{money(score.cost.totalMonthly)}</span>
          <span className="text-sm text-ink-3" title="Rent plus utilities, internet and furniture, per person">
            /mo
          </span>
        </p>

        <div className="mt-auto flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm text-ink-2">
            {stale ? <span className="text-warn">{verifiedLabel(floorPlan.lastVerified, today)}</span> : why}
          </p>
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            {badge && <Badge tone={badge[0] === 'renderings_only' ? 'warn' : 'accent'}>{badge[1]}</Badge>}
            <SaveToggle floorPlanId={floorPlan.id} name={`${property.name} ${floorPlan.name}`} saved={saved} signedIn={signedIn} nextPath={nextPath} />
          </div>
        </div>
      </div>
    </article>
  );
}
