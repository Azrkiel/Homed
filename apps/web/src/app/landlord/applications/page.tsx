import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { requireLandlord } from '@/lib/landlord/server';
import { getRepo } from '@/lib/repo';
import { statusLabel } from '@homed/core';
import type { ApplicationStatus } from '@homed/core';

export const metadata: Metadata = { title: 'Applications | Homed' };

const TONE: Partial<Record<ApplicationStatus, 'neutral' | 'accent' | 'good' | 'warn' | 'bad'>> = {
  submitted: 'accent',
  under_review: 'accent',
  approved: 'good',
  lease_sent: 'good',
  signed: 'good',
  waitlisted: 'warn',
  denied: 'bad',
  withdrawn: 'neutral',
};

/** Applications to this landlord's properties, newest first. Admins without a landlord record see the empty state. */
export default async function LandlordApplicationsPage() {
  const { landlord } = await requireLandlord();
  const repo = getRepo();
  const [applications, listings] = await Promise.all([
    landlord ? repo.listApplicationsForLandlord(landlord.id) : Promise.resolve([]),
    repo.listListings(),
  ]);
  const byFloorPlan = new Map(listings.map((l) => [l.floorPlan.id, l]));
  const leaders = await Promise.all(applications.map((a) => repo.getUser(a.userId)));

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Landlords"
        title="Applications"
        subtitle="Applications to your properties. Open one to review the applicant profiles, documents and status."
        actions={<Link href="/landlord" className="text-sm font-medium text-accent underline-offset-4 hover:underline">Back to dashboard</Link>}
      />

      {applications.length === 0 ? (
        <EmptyState title="No applications yet" body="Applications appear here after a student submits one for a floor plan you list." />
      ) : (
        <ul className="grid gap-4">
          {applications.map((app, i) => {
            const listing = byFloorPlan.get(app.floorPlanId);
            const leader = leaders[i];
            const status = statusLabel(app.status);
            return (
              <li key={app.id}>
                <Card as="article">
                  <CardBody className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="grid min-w-0 gap-1">
                      <h2 className="text-base font-semibold text-ink">
                        <Link
                          href={`/landlord/applications/${app.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {listing ? `${listing.property.name}, ${listing.floorPlan.name}` : 'Unknown floor plan'}
                        </Link>
                      </h2>
                      <p className="text-sm text-ink-2">
                        Leader: {leader?.name || 'Unknown'}
                        {app.submittedAt ? ` · Submitted ${shortDate(app.submittedAt.slice(0, 10))}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONE[app.status] ?? 'neutral'}>{status.label}</Badge>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
