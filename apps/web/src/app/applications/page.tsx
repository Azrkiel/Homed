import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Listing } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { groupByBatch, isLeaderOf, type BatchGroup } from '@/components/apply/application-logic';
import { placeName, StatusChip } from '@/components/apply/application-views';
import { plural } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Applications | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  const user = await requireUser(undefined, '/applications');
  if (effectiveRole(user) === 'landlord') redirect('/');

  let groups: BatchGroup[] = [];
  let listings = new Map<string, Listing | null>();
  let loadError: string | null = null;
  try {
    const repo = getRepo();
    const apps = await repo.listApplicationsForUser(user.id);
    groups = groupByBatch(apps);
    const floorPlanIds = [...new Set(apps.map((a) => a.floorPlanId))];
    const entries = await Promise.all(floorPlanIds.map(async (id) => [id, await repo.getListing(id)] as const));
    listings = new Map(entries);
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load your applications right now.';
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Applications"
        subtitle="Every place you applied to, grouped by the batch you sent together. Track each one here."
        actions={
          <Button href="/profile/applicant" variant="secondary">
            Applicant profile
          </Button>
        }
      />

      {loadError ? (
        <Alert tone="bad" title="Could not load your applications">
          {loadError} Please refresh the page in a moment.
        </Alert>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No applications yet"
          body="Find a place you like, then tap Apply. You can apply to up to three places at once, alone or with roommates."
          action={
            <>
              <Button href="/search">Search places</Button>
              <Button href="/profile/applicant" variant="secondary">
                Set up your profile
              </Button>
            </>
          }
        />
      ) : (
        groups.map((group) => {
          const first = group.applications[0];
          const led = first ? isLeaderOf(first, user.id) : false;
          return (
            <Card as="section" key={group.batchId}>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <h2 className="text-lg font-semibold text-ink">
                    {plural(group.applications.length, 'place')}
                  </h2>
                  <p className="text-sm text-ink-2">{led ? 'You lead this application' : 'You are a roommate on this application'}</p>
                </div>
                <Link href={`/applications/batch/${group.batchId}`} className="text-sm font-medium text-accent underline">
                  Open batch
                </Link>
              </CardHeader>
              <CardBody className="grid gap-3">
                <ul className="grid gap-2">
                  {group.applications.map((app) => {
                    const listing = listings.get(app.floorPlanId) ?? null;
                    return (
                      <li
                        key={app.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <div className="grid min-w-0 gap-0.5">
                          <span className="text-xs font-medium text-ink-2">Choice {app.batchRank}</span>
                          <span className={listing ? 'font-medium text-ink' : 'font-medium text-ink-2'}>{placeName(listing)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusChip status={app.status} />
                          <Link href={`/applications/${app.id}`} className="text-sm font-medium text-accent underline">
                            View
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          );
        })
      )}
    </div>
  );
}
