import type { Metadata } from 'next';
import Link from 'next/link';
import { buildCompareTable, type RankedListing } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Button, EmptyState, PageHeader } from '@/components/ui';
import { CompareTable } from '@/components/compare/compare-table';
import { ComparePicker, type PickerItem } from '@/components/compare/compare-picker';
import { rankForUser } from '@/lib/ranking';
import { getRepo, today } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { bedBath, money } from '@/lib/format';
import { COMPARE_MAX, compareHref, compareMode, parseCompareIds } from '@/lib/search/compare';

export const metadata: Metadata = { title: 'Compare | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(undefined, '/compare');
  const params = await searchParams;
  const requested = parseCompareIds(params);

  let ranked: RankedListing[] = [];
  let savedIds = new Set<string>();
  let loadError: string | null = null;
  try {
    ranked = await rankForUser(user);
    savedIds = new Set((await getRepo().listSaves(user.id)).map((s) => s.floorPlanId));
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load listings right now.';
  }

  if (loadError) {
    return (
      <div className="grid gap-5">
        <PageHeader title="Compare" className="pb-0" />
        <Alert tone="bad" title="Could not load the comparison">
          {loadError} Please refresh the page in a moment.
        </Alert>
      </div>
    );
  }

  const byId = new Map(ranked.map((r) => [r.listing.floorPlan.id, r]));
  const valid = requested.filter((id) => byId.has(id));
  const ignored = requested.length - valid.length;
  const mode = compareMode(valid.length);
  const items = valid.flatMap((id) => byId.get(id) ?? []);

  const pickerItems: PickerItem[] = ranked
    .filter((r) => savedIds.has(r.listing.floorPlan.id))
    .map((r) => ({
      floorPlanId: r.listing.floorPlan.id,
      label: `${r.listing.property.name} ${r.listing.floorPlan.name}`,
      detail: `${bedBath(r.listing.floorPlan.beds, r.listing.floorPlan.baths)} · ${money(r.score.cost.totalMonthly)}/person/mo all-in`,
    }));

  const picker =
    pickerItems.length > 0 ? (
      <ComparePicker items={pickerItems} initial={valid} />
    ) : (
      <EmptyState
        title="Nothing saved to compare yet"
        body="Save two to four places, then compare them side by side."
        action={
          <>
            <Button href="/search">Search places</Button>
            <Button href="/match" variant="secondary">
              Swipe through matches
            </Button>
          </>
        }
      />
    );

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Compare"
        subtitle="Two to four places side by side. Best values are highlighted."
        className="pb-0"
        actions={
          <Button href="/saved" variant="secondary">
            Saved places
          </Button>
        }
      />

      {ignored > 0 && (
        <Alert tone="warn" title="Some places were skipped">
          {ignored} {ignored === 1 ? 'place' : 'places'} in the link {ignored === 1 ? 'is' : 'are'} no longer listed and{' '}
          {ignored === 1 ? 'was' : 'were'} ignored.
        </Alert>
      )}

      {mode === 'table' && (
        <CompareTable
          items={items}
          rows={buildCompareTable(items)}
          ids={valid}
          savedIds={savedIds}
          today={today()}
          nextPath={compareHref(valid)}
        />
      )}

      {(mode === 'too-few' || mode === 'too-many') && (
        <Alert tone="info" title="Pick 2 to 4 places to compare">
          {mode === 'too-few'
            ? 'Comparing needs at least two places. Add another below.'
            : `Comparing shows at most ${COMPARE_MAX} places at once, and this link has ${valid.length}.`}
          {mode === 'too-many' && (
            <>
              {' '}
              <Link href={compareHref(valid.slice(0, COMPARE_MAX))} className="font-medium underline underline-offset-2">
                Compare the first {COMPARE_MAX}
              </Link>
            </>
          )}
        </Alert>
      )}

      {mode !== 'table' && picker}
    </div>
  );
}
