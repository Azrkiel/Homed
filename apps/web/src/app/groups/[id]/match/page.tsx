import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { GroupDeck } from '@/components/groups/group-deck';
import { loadGroupMatch } from '@/lib/groups/data';
import { checkId } from '@/lib/groups/input';
import { today } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { listingName } from '@/lib/search/match';

export const metadata: Metadata = { title: 'Group match | Homed' };
// No loading.tsx here: requireUser and notFound() must run before any page HTML streams.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function GroupMatchPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(undefined, `/groups/${encodeURIComponent(id)}/match`);
  if (!checkId(id, 'group').ok) notFound();

  // Non-members get notFound() inside loadGroupMatch.
  const data = await loadGroupMatch(id, user);
  const groupId = data.group.id;
  const day = today();

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`Match: ${data.group.name}`}
        subtitle="A match is when everyone says yes."
        className="pb-0"
        actions={
          <Button href={`/groups/${groupId}`} variant="ghost">
            Back to group
          </Button>
        }
      />

      {data.matches.length > 0 && (
        <section aria-labelledby="group-matches-heading" className="grid gap-3 rounded-card border border-good bg-good-soft p-5">
          <h2 id="group-matches-heading" className="text-lg font-semibold text-good">
            Everyone agrees on
          </h2>
          <ul className="grid gap-2">
            {data.matches.map((m) => (
              <li key={m.floorPlanId}>
                <Link href={m.href} className="font-medium text-ink underline-offset-2 hover:underline">
                  {listingName(m)}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={`/groups/${groupId}`} className="text-sm font-medium text-ink underline underline-offset-2">
            See the group shortlist
          </Link>
        </section>
      )}

      <GroupDeck
        groupId={groupId}
        cards={data.cards}
        today={day}
        empty={
          <EmptyState
            title="Nothing left for the group to swipe"
            body="You have swiped on every place that fits this group, or the group has no places yet. Browse as a group to see the full list."
            action={
              <>
                <Button href={`/groups/${groupId}/browse`} variant="secondary">
                  Browse as a group
                </Button>
                <Button href={`/groups/${groupId}`} variant="ghost">
                  Back to group
                </Button>
              </>
            }
          />
        }
      />
    </div>
  );
}
