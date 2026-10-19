import type { Metadata } from 'next';
import type { RankedListing, Save } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Button, EmptyState, PageHeader } from '@/components/ui';
import { ListingCard } from '@/components/listing/listing-card';
import { SavedList, type SavedItem } from '@/components/compare/saved-list';
import { rankForUser } from '@/lib/ranking';
import { getRepo, today } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { swipeHref } from '@/lib/search/compare';

export const metadata: Metadata = { title: 'Saved | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

export default async function SavedPage() {
  const user = await requireUser(undefined, '/saved');
  const day = today();

  let saves: Save[] = [];
  let ranked: RankedListing[] = [];
  let loadError: string | null = null;
  try {
    saves = await getRepo().listSaves(user.id);
    ranked = await rankForUser(user);
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load your saved places right now.';
  }

  const byId = new Map(ranked.map((r) => [r.listing.floorPlan.id, r]));
  const noteOf = new Map(saves.map((s) => [s.floorPlanId, s.note ?? '']));
  // Best Match order for places still listed, then the ones that are gone.
  const live = ranked.filter((r) => noteOf.has(r.listing.floorPlan.id));
  const gone = saves.filter((s) => !byId.has(s.floorPlanId));

  const items: SavedItem[] = [
    ...live.map((r) => {
      const id = r.listing.floorPlan.id;
      return {
        floorPlanId: id,
        name: `${r.listing.property.name} ${r.listing.floorPlan.name}`,
        note: noteOf.get(id) ?? '',
        content: <ListingCard ranked={r} today={day} saved signedIn nextPath="/saved" />,
      };
    }),
    ...gone.map((s) => ({
      floorPlanId: s.floorPlanId,
      name: 'a place that is no longer listed',
      note: s.note ?? '',
      content: (
        <div className="rounded-card border border-dashed border-line bg-surface p-4">
          <p className="font-semibold text-ink">No longer listed</p>
          <p className="text-sm text-ink-2">This place was removed from the catalog. You can remove it from your list.</p>
        </div>
      ),
    })),
  ];
  const swipeIds = live.map((r) => r.listing.floorPlan.id);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Saved"
        subtitle="Your shortlist. Add notes, select two to four to compare, or swipe through them again."
        className="pb-0"
        actions={
          swipeIds.length > 0 ? (
            <Button href={swipeHref(swipeIds)} variant="secondary">
              Swipe these
            </Button>
          ) : undefined
        }
      />

      {loadError ? (
        <Alert tone="bad" title="Could not load your saved places">
          {loadError} Please refresh the page in a moment.
        </Alert>
      ) : items.length === 0 ? (
        <EmptyState
          title="No saved places yet"
          body="Tap the heart on a place you like and it shows up here, ready to compare."
          action={
            <>
              <Button href="/search">Search places</Button>
              <Button href="/match" variant="secondary">
                Swipe through matches
              </Button>
            </>
          }
        />
      ) : (
        <SavedList items={items} />
      )}
    </div>
  );
}
