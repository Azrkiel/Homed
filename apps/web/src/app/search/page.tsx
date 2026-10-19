import type { Metadata } from 'next';
import { WEIGHT_PRESETS, normalizeWeights, type Listing, type RankedListing, type WeightPreset } from '@homed/core';
import { RepoError } from '@homed/db';
import Link from 'next/link';
import { Alert, SegmentedControl } from '@/components/ui';
import { ListingCard } from '@/components/listing/listing-card';
import { ActiveFilters } from '@/components/search/active-filters';
import { AlertButton } from '@/components/search/alert-button';
import { FilterDrawer } from '@/components/search/filter-drawer';
import { MapWrapper } from '@/components/search/map-wrapper';
import { ResultsLayout } from '@/components/search/results-layout';
import { SearchEmpty } from '@/components/search/search-empty';
import { WeightPresets } from '@/components/search/weight-presets';
import { plural } from '@/lib/format';
import { rankForUser } from '@/lib/ranking';
import { getRepo, today } from '@/lib/repo';
import { getCurrentUser } from '@/lib/session';
import { searchHref } from '@/lib/search/href';
import { filtersFromParams, sortFromParams, sortRanked, type SortKey } from '@/lib/search/params';
import { PRESET_KEYS, matchPreset, presetFromParam } from '@/lib/search/presets';
import { propertyMarkers } from '@/lib/search/results';

export const metadata: Metadata = { title: 'Search | Homed' };
export const dynamic = 'force-dynamic';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'match', label: 'Best match' },
  { key: 'price', label: 'Price' },
  { key: 'walk', label: 'Walk' },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const sort = sortFromParams(params);
  const user = await getCurrentUser();
  const signedIn = user !== null;
  const urlPreset = signedIn ? undefined : presetFromParam(params.preset);
  const groupContext = urlPreset ? { weights: normalizeWeights(WEIGHT_PRESETS[urlPreset].weights) } : undefined;

  let ranked: RankedListing[] = [];
  let allListings: Listing[] = [];
  let saved = new Set<string>();
  let loadError: string | null = null;
  try {
    const repo = getRepo();
    const [all, rankedRaw, saves] = await Promise.all([
      repo.listListings(),
      rankForUser(user, { filters, groupContext }),
      user ? repo.listSaves(user.id) : Promise.resolve([]),
    ]);
    allListings = all;
    ranked = sortRanked(rankedRaw, sort);
    saved = new Set(saves.map((s) => s.floorPlanId));
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load listings right now.';
  }

  const activePreset: WeightPreset | 'custom' = urlPreset ?? (user ? matchPreset(user.weights) : 'balanced');
  const presetForUrl = urlPreset ?? null;
  const currentUrl = searchHref(filters, { sort, preset: presetForUrl });
  const presetHrefs = Object.fromEntries(
    PRESET_KEYS.map((k) => [k, searchHref(filters, { sort, preset: k })]),
  ) as Record<WeightPreset, string>;
  const today_ = today();

  const list = (
    <div className="grid min-w-0 gap-3">
      {ranked.length === 0 ? (
        <SearchEmpty allListings={allListings} filters={filters} sort={sort} preset={presetForUrl} />
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {ranked.map((r) => (
            <li key={r.listing.floorPlan.id}>
              <ListingCard
                ranked={r}
                today={today_}
                saved={saved.has(r.listing.floorPlan.id)}
                signedIn={signedIn}
                nextPath={currentUrl}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const hasClasses = ranked.some((r) => r.score.commute.weeklyMinutes > 0);

  return (
    <div className="grid gap-5">
      {loadError ? (
        <Alert tone="bad" title="Could not load listings">
          {loadError}
        </Alert>
      ) : (
        <>
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterDrawer filters={filters} sort={sort} preset={presetForUrl} />
              <WeightPresets active={activePreset} signedIn={signedIn} hrefs={presetHrefs} />
            </div>
            <ActiveFilters filters={filters} sort={sort} preset={presetForUrl} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold text-navy" aria-live="polite">
                {plural(ranked.length, 'place')}
              </h1>
              {!hasClasses && ranked.length > 0 && (
                <Link href={signedIn ? '/classes' : '/signin?next=%2Fclasses'} className="text-sm text-ink-3 hover:text-ink">
                  Add your classes to rank by walk
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SegmentedControl
                label="Sort results"
                items={SORTS.map((s) => ({
                  href: searchHref(filters, { sort: s.key, preset: presetForUrl }),
                  label: s.label,
                  active: s.key === sort,
                }))}
              />
              <AlertButton filters={filters} signedIn={signedIn} nextPath={currentUrl} />
            </div>
          </div>

          <ResultsLayout list={list} map={<MapWrapper markers={propertyMarkers(ranked)} />} />
        </>
      )}
    </div>
  );
}
