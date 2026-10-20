import Link from 'next/link';
import { Badge, ScoreRing, cx } from '@/components/ui';
import { money } from '@/lib/format';
import { PropertyIllustration } from '@/components/listing/property-illustration';
import { StaleNotice } from '@/components/listing/stale-notice';
import { listingName, type MatchCard } from '@/lib/search/match';

/**
 * One Match card: big photo, name, Best Match, all-in cost, why line, walk and badges.
 * `showLink` adds the "Open full listing" link (only on the top card; hidden copies pass false).
 */
export function MatchCardView({
  card,
  today,
  showLink = false,
  className,
}: {
  card: MatchCard;
  today: string;
  showLink?: boolean;
  className?: string;
}) {
  const name = listingName(card);
  return (
    <article
      aria-label={name}
      className={cx(
        'flex flex-col overflow-hidden rounded-card border bg-surface shadow-card',
        card.stale ? 'border-dashed border-warn' : 'border-line',
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2 sm:aspect-[16/9]">
        {/* Remote photo hosts are not known at build time, so a plain img is used. draggable=false keeps the browser from starting a native image drag. */}
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photo.url}
            alt={card.photo.alt || name}
            loading="lazy"
            draggable={false}
            className={cx('size-full select-none object-cover', card.stale && 'opacity-60 grayscale')}
          />
        ) : (
          <PropertyIllustration
            kind={card.kind}
            seed={card.propertyName}
            name={name}
            className={cx('pointer-events-none absolute inset-0 select-none', card.stale && 'opacity-60 grayscale')}
          />
        )}
        {card.photo?.isRendering && (
          <Badge tone="neutral" className="absolute left-3 top-3 bg-surface/90 shadow-card">
            Rendering
          </Badge>
        )}
      </div>

      <div className="grid gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-balance text-ink">{card.propertyName}</h2>
            <p className="text-sm text-ink-2">
              {card.floorPlanName} &middot; {card.bedBath} &middot; {card.neighborhood}
            </p>
          </div>
          <ScoreRing score={card.scoreTotal} size="md" />
        </div>

        <p className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums text-navy">{money(card.totalMonthly)}</span>
          <span className="text-sm text-ink-3">/mo</span>
        </p>
        <p className="text-ink-2">{card.walk ?? card.why.split(' · ').filter((p) => !p.includes('all-in')).join(' · ')}</p>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
          {card.stale ? <StaleNotice lastVerified={card.lastVerified} today={today} /> : <span />}
          {showLink && (
            <Link
              href={card.href}
              className="rounded text-sm font-medium text-navy underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              Details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
