import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  APPLY_IS_NOT_SIGNING,
  LEASE_CHECKLIST,
  STUDENT_LEGAL_SERVICES,
  type ApplicationMember,
} from '@homed/core';
import { Alert, Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/apply/action-form';
import { LeaseSignForm } from '@/components/apply/lease-sign-form';
import {
  canViewApplication,
  isLeaderOf,
  originFromHeaders,
  ownOpenMembers,
} from '@/components/apply/application-logic';
import {
  FeeSummary,
  MemberList,
  placeName,
  StatusChip,
  StatusTimeline,
  TrackerSteps,
} from '@/components/apply/application-views';
import { signLease, withdrawApplications } from '@/lib/apply/application-actions';
import { nextActions } from '@/lib/apply/tracker';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Application | Homed' };
// No loading.tsx here: requireUser and notFound() must run before any HTML streams.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function ApplicationPage({ params }: Props) {
  const { id } = await params;
  const path = `/applications/${id}`;
  const user = await requireUser(undefined, path);
  if (effectiveRole(user) === 'landlord') redirect('/');

  const repo = getRepo();
  const app = await repo.getApplication(id);
  if (!app) notFound();
  const members: ApplicationMember[] = await repo.listApplicationMembers(app.id);
  if (!canViewApplication(app, members, user.id)) notFound();

  const isLeader = isLeaderOf(app, user.id);
  const listing = await repo.getListing(app.floorPlanId);
  const name = placeName(listing);
  const actions = nextActions(app, isLeader);
  const origin = isLeader ? originFromHeaders(await headers()) : '';
  const roommateLinks = isLeader ? [] : ownOpenMembers(members, user.id);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        eyebrow={`Choice ${app.batchRank}`}
        title={name}
        subtitle={`${isLeader ? 'You lead this application.' : 'You are a roommate on this application.'}`}
        actions={
          <Button href={`/applications/batch/${app.batchId}`} variant="secondary">
            Back to batch
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusChip status={app.status} />
      </div>

      <Alert tone="info">{APPLY_IS_NOT_SIGNING}</Alert>

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Progress</h2>
        </CardHeader>
        <CardBody className="grid gap-6">
          <TrackerSteps app={app} />
          <div className="grid gap-2">
            <h3 className="text-sm font-semibold text-ink">History</h3>
            <StatusTimeline history={app.statusHistory} />
          </div>
        </CardBody>
      </Card>

      {app.status === 'lease_sent' && (
        <Card as="section">
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink">Sign the lease</h2>
          </CardHeader>
          <CardBody className="grid gap-6">
            <Alert tone="info" title={STUDENT_LEGAL_SERVICES.name}>
              {STUDENT_LEGAL_SERVICES.blurb}{' '}
              <a href={STUDENT_LEGAL_SERVICES.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                Visit {STUDENT_LEGAL_SERVICES.name}
              </a>
            </Alert>
            {isLeader ? (
              <LeaseSignForm applicationId={app.id} items={LEASE_CHECKLIST} action={signLease} />
            ) : (
              <p className="text-sm text-ink-2">The group leader signs the lease for this application.</p>
            )}
          </CardBody>
        </Card>
      )}

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Who is done</h2>
        </CardHeader>
        <CardBody className="grid gap-4">
          {roommateLinks.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm text-ink-2">Your part is not done yet.</p>
              {roommateLinks.map((m) => (
                <div key={m.id}>
                  <Button href={`/apply/invite/${encodeURIComponent(m.inviteToken)}`} variant="secondary" size="sm">
                    Finish my part
                  </Button>
                </div>
              ))}
            </div>
          )}
          <MemberList members={members} leaderView={isLeader} origin={origin} />
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Fees</h2>
        </CardHeader>
        <CardBody className="grid gap-4">
          <FeeSummary fees={app.fees} />
          <p className="text-sm text-ink-2">Fees are paid to the landlord directly for now.</p>
        </CardBody>
      </Card>

      <Card as="section">
        <CardBody className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold text-ink">Landlords not on Homed</h2>
            <p className="text-sm text-ink-2">Send this packet to a landlord who does not use Homed yet.</p>
          </div>
          <a
            href={`/api/applications/${app.id}/pdf`}
            className="inline-flex w-fit items-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"
          >
            Download PDF for landlords not on Homed
          </a>
        </CardBody>
      </Card>

      {isLeader && actions.includes('submit') && (
        <Alert tone="info">
          This place is sent with the rest of its batch.{' '}
          <Link href={`/applications/batch/${app.batchId}`} className="font-medium underline">
            Go to the batch to submit
          </Link>
          .
        </Alert>
      )}

      {isLeader && actions.includes('withdraw') && (
        <Card as="section">
          <CardBody className="grid gap-3">
            <h2 className="text-lg font-semibold text-ink">Withdraw</h2>
            <p className="text-sm text-ink-2">Withdrawing ends this application. A signed lease cannot be withdrawn this way.</p>
            <ActionForm
              action={withdrawApplications}
              hidden={{ batchId: app.batchId, applicationId: app.id }}
              label="Withdraw this application"
              variant="danger"
              confirmMessage="Withdraw this application? You can't undo this."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
