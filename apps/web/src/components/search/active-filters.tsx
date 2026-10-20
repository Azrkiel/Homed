import Link from 'next/link';
import type { ListingFilters, WeightPreset } from '@homed/core';
import { searchHref, withoutFilter } from '@/lib/search/href';
import { activeFilterEntries } from '@/lib/search/describe';
import type { SortKey } from '@/lib/search/params';

/** Removable chips for each active filter. Each chip is a link that drops just that filter. */
export function ActiveFilters({
  filters,
  sort,
  preset,
}: {
  filters: ListingFilters;
  sort: SortKey;
  preset: WeightPreset | null;
}) {
  const entries = activeFilterEntries(filters);
  if (entries.length === 0) return null;
  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {entries.map(({ key, label }) => (
        <li key={key}>
          <Link
            href={searchHref(withoutFilter(filters, key), { sort, preset })}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pl-3 pr-2 text-sm font-medium text-accent hover:brightness-95"
          >
            {label}
            <span aria-hidden="true">&times;</span>
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
      <li>
        <Link href={searchHref({}, { sort, preset })} className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink">
          Clear all
        </Link>
      </li>
    </ul>
  );
}
