import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { CreateGroupForm } from '@/components/groups/create-group-form';
import { loadMyGroups } from '@/lib/groups/data';
import { plural } from '@/lib/format';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Groups | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const user = await requireUser(undefined, '/groups');
  const groups = await loadMyGroups(user);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Groups"
        subtitle="Share a shortlist with your roommates, vote together, and find places everyone agrees on."
        className="pb-0"
      />

      <section aria-labelledby="my-groups-heading" className="grid gap-3">
        <h2 id="my-groups-heading" className="text-lg font-semibold text-ink">
          My groups
        </h2>
        {groups.length === 0 ? (
          <EmptyState
            title="No groups yet"
            body="Create a group below, then send its invite link to your roommates."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {groups.map(({ group, memberCount }) => (
              <li key={group.id}>
                <Card className="transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-focus">
                  <CardBody>
                    <Link
                      href={`/groups/${group.id}`}
                      className="block font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline-none"
                    >
                      {group.name}
                    </Link>
                    <p className="text-sm text-ink-2">{plural(memberCount, 'member')}</p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card as="section" className="max-w-xl">
        <CardBody className="grid gap-4">
          <h2 className="text-lg font-semibold text-ink">Create a group</h2>
          <CreateGroupForm />
        </CardBody>
      </Card>
    </div>
  );
}
