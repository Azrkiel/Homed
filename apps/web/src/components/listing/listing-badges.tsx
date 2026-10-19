import type { ListingBadge, Property } from '@homed/core';
import { Badge, type BadgeTone } from '@/components/ui';

const BADGES: Record<ListingBadge, { label: string; tone: BadgeTone }> = {
  renderings_only: { label: 'Renderings only', tone: 'warn' },
  stale: { label: 'Stale listing', tone: 'warn' },
  accommodation_friendly: { label: 'Accommodation-friendly', tone: 'good' },
  few_left: { label: 'Few left', tone: 'accent' },
  private_bath: { label: 'Private bath', tone: 'neutral' },
  on_grounds: { label: 'On Grounds', tone: 'accent' },
  individual_lease: { label: 'Individual lease', tone: 'neutral' },
};

/** Badges for a listing. "On Grounds" appears once. "Stale" is shown by StaleNotice instead. */
export function ListingBadges({ badges, kind }: { badges: ListingBadge[]; kind: Property['kind'] }) {
  const set = new Set<ListingBadge>(badges);
  set.delete('stale');
  if (kind === 'on_grounds') set.add('on_grounds');
  const list = [...set];
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Highlights">
      {list.map((b) => (
        <li key={b}>
          <Badge tone={BADGES[b].tone}>{BADGES[b].label}</Badge>
        </li>
      ))}
    </ul>
  );
}
