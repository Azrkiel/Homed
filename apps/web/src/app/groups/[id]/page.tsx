import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Listing } from '@homed/core';
import { Button, Card, CardBody, PageHeader } from '@/components/ui';
import { InviteLink } from '@/components/groups/invite-link';
import { LeaveGroupButton } from '@/components/groups/leave-group-button';
import { MembersSection } from '@/components/groups/members-section';
import { ShortlistSection } from '@/components/groups/shortlist-section';
import { plural } from '@/lib/format';
import { loadGroupData } from '@/lib/groups/data';
import { inviteOrigin, listingLabel } from '@/lib/groups/present';
import { checkId } from '@/lib/groups/input';
import { inviteUrl } from '@/lib/groups/view';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Group | Homed' };
// No loading.tsx here: requireUser and notFound() must run before any page HTML streams.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function GroupPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(undefined, `/groups/${encodeURIComponent(id)}`);
  if (!checkId(id, 'group').ok) notFound();

  // Non-members get notFound() inside loadGroupData.
  const data = await loadGroupData(id, user);
  const { group, views, leader, rows, listings, matches } = data;

  const h = await headers();
  const origin = inviteOrigin(h.get('host'), h.get('x-forwarded-proto'));
  const invite = inviteUrl(origin, group.inviteCode);

  // Listing lookup for shortlist rows and matches. Ranked listings come first; the rest are fetched.
  const listingFor = new Map<string, Listing>();
  for (const [floorPlanId, ranked] of listings) listingFor.set(floorPlanId, ranked.listing);
  const missing = [...new Set([...matches, ...rows.map((r) => r.floorPlanId)])].filter((fp) => !listingFor.has(fp));
  const fetched = await Promise.all(missing.map((fp) => getRepo().getListing(fp)));
  missing.forEach((fp, i) => {
    const listing = fetched[i];
    if (listing) listingFor.set(fp, listing);
  });

  const matchItems = matches
    .map((fp) => ({ floorPlanId: fp, listing: listingFor.get(fp) ?? null }))
    .filter((m): m is { floorPlanId: string; listing: Listing } => m.listing !== null);

  return (
    <div className="grid gap-6">
      <PageHeader
        title={group.name}
        subtitle={`${plural(views.length, 'member')} · Led by ${leader.name}`}
        className="pb-0"
        actions={
          <>
            <Button href={`/groups/${group.id}/browse`} variant="secondary">
              Browse as a group
            </Button>
            <Button href={`/groups/${group.id}/match`}>Match together</Button>
          </>
        }
      />

      <MembersSection groupId={group.id} views={views} />

      <section aria-labelledby="invite-heading">
        <Card>
          <CardBody className="grid gap-3">
            <h2 id="invite-heading" className="text-lg font-semibold text-ink">
              Invite
            </h2>
            <p className="text-sm text-ink-2">Send this link to roommates. Anyone who opens it can join the group.</p>
            <InviteLink url={invite} />
          </CardBody>
        </Card>
      </section>

      {matchItems.length > 0 && (
        <section aria-labelledby="matches-heading" className="grid gap-3 rounded-card border border-good bg-good-soft p-5">
          <h2 id="matches-heading" className="text-lg font-semibold text-good">
            Everyone agrees
          </h2>
          <p className="text-sm text-ink">Every member swiped right on these places.</p>
          <ul className="grid gap-2">
            {matchItems.map(({ floorPlanId, listing }) => (
              <li key={floorPlanId}>
                <Link href={`/listings/${floorPlanId}`} className="font-medium text-ink underline-offset-2 hover:underline">
                  {listingLabel(listing)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ShortlistSection
        groupId={group.id}
        rows={rows}
        listingFor={listingFor}
        names={data.names}
        viewerId={user.id}
      />

      <section aria-labelledby="leave-heading">
        <Card>
          <CardBody className="grid gap-3">
            <h2 id="leave-heading" className="text-lg font-semibold text-ink">
              Leave group
            </h2>
            <LeaveGroupButton groupId={group.id} groupName={group.name} />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
