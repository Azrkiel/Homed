import type { Listing, ListingFilters, WeightPreset } from '@homed/core';
import { Button, EmptyState } from '@/components/ui';
import { plural } from '@/lib/format';
import { FILTER_LABELS, explainEmpty } from '@/lib/search/empty';
import { searchHref, withoutFilter } from '@/lib/search/href';
import { describeFilter } from '@/lib/search/describe';
import type { SortKey } from '@/lib/search/params';

/** Explains an empty result: the filter that removed the most places, with one-click removal. */
export function SearchEmpty({
  allListings,
  filters,
  sort,
  preset,
}: {
  allListings: Listing[];
  filters: ListingFilters;
  sort: SortKey;
  preset: WeightPreset | null;
}) {
  if (allListings.length === 0) {
    return (
      <EmptyState
        title="No places listed yet"
        body="The catalog is empty right now. Check back soon, or set an alert once listings arrive."
      />
    );
  }

  const why = explainEmpty(allListings, filters);
  if (!why) {
    return (
      <EmptyState
        title="No places match these filters together"
        body="Each filter on its own still leaves some places, but not in combination. Remove one or two to widen the search."
        action={
          <Button href={searchHref({}, { sort, preset })} variant="secondary">
            Clear all filters
          </Button>
        }
      />
    );
  }

  const label = FILTER_LABELS[why.key];
  return (
    <EmptyState
      title="No places match your filters"
      body={
        <>
          <p>
            The <strong>{label}</strong> filter ({describeFilter(why.key, filters)}) removed {plural(why.removed, 'place')}
            {why.example ? <> (for example: {why.example})</> : null}.
          </p>
          <p className="mt-2">Remove it to see more, or clear everything and start over.</p>
        </>
      }
      action={
        <>
          <Button href={searchHref(withoutFilter(filters, why.key), { sort, preset })}>Remove {label} filter</Button>
          <Button href={searchHref({}, { sort, preset })} variant="secondary">
            Clear all filters
          </Button>
        </>
      }
    />
  );
}
