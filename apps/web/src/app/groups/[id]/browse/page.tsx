import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmptyState, Button, PageHeader } from '@/components/ui';
import { ListingCard } from '@/components/listing/listing-card';
import { GroupShortlistButton } from '@/components/groups/group-shortlist-button';
import { plural } from '@/lib/format';
import { browseSlice, BROWSE_LIMIT } from '@/lib/groups/browse';
import { loadGroupBrowse } from '@/lib/groups/data';
import { defaultGroupSize } from '@/lib/groups/context';
import { checkId } from '@/lib/groups/input';
import { today } from '@/lib/repo';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Browse as a group | Homed' };
// No loading.tsx here: requireUser and notFound() must run before any page HTML streams.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function GroupBrowsePage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(undefined, `/groups/${encodeURIComponent(id)}/browse`);
  if (!checkId(id, 'group').ok) notFound();

  // Non-members get notFound() inside loadGroupBrowse.
  const data = await loadGroupBrowse(id, user);
  const groupId = data.group.id;
  const nextPath = `/groups/${groupId}/browse`;
  const shown = browseSlice(data.ranked, BROWSE_LIMIT);
  const day = today();
  const size = defaultGroupSize(data.memberCount);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={data.group.name}
        subtitle="Places ranked for the whole group."
        className="pb-0"
        actions={
          <Button href={`/groups/${groupId}`} variant="ghost">
            Back to group
          </Button>
        }
      />

      <div className="grid gap-1 rounded-card border border-line bg-surface p-4 text-sm text-ink-2">
        <p className="text-ink">{data.note}</p>
        <p>
          Results use the leader&apos;s weights, the tightest member budget, and everyone&apos;s class schedules.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-lg font-semibold text-ink" aria-live="polite">
          {plural(data.ranked.length, 'place')}
        </h2>
        {data.ranked.length > shown.length && (
          <p className="text-sm text-ink-2">Showing the first {shown.length}.</p>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title="No places fit this group yet"
          body={`Results are limited to places with exactly ${size} bedroom${size === 1 ? '' : 's'} to match a group of ${size}. Check the group's budgets and class schedules, or try the search page for more options.`}
          action={
            <>
              <Button href="/search" variant="secondary">
                Search places
              </Button>
              <Button href={`/groups/${groupId}`} variant="ghost">
                Back to group
              </Button>
            </>
          }
        />
      ) : (
        <ul className="grid gap-4">
          {shown.map((r) => {
            const fp = r.listing.floorPlan.id;
            return (
              <li key={fp} className="grid gap-2">
                <ListingCard ranked={r} today={day} saved={false} signedIn nextPath={nextPath} />
                <div className="flex justify-end">
                  <GroupShortlistButton
                    groupId={groupId}
                    floorPlanId={fp}
                    name={`${r.listing.property.name} ${r.listing.floorPlan.name}`}
                    shortlisted={data.shortlisted.has(fp)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
