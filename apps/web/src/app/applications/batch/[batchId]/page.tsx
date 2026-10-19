import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  APPLY_IS_NOT_SIGNING,
  batchTotal,
  pendingMembers,
  withdrawSuggestions,
  type ApplicationMember,
  type Listing,
} from '@homed/core';
import { Alert, Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/apply/action-form';
import {
  canViewBatch,
  isLeaderOf,
  leaderMember,
  originFromHeaders,
  ownOpenMembers,
  withdrawableApplications,
} from '@/components/apply/application-logic';
import { FeeSummary, MemberList, placeName, StatusChip } from '@/components/apply/application-views';
import { attachLeaderProfile, submitBatch, withdrawApplications } from '@/lib/apply/application-actions';
import { profileCompleteness } from '@/lib/apply/profile-form';
import { canSubmitBatch } from '@/lib/apply/tracker';
import { moneyPrecise, plural } from '@/lib/format';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Batch | Homed' };
// No loading.tsx here: requireUser and notFound() must run before any HTML streams.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ batchId: string }> };

export default async function BatchPage({ params }: Props) {
  const { batchId } = await params;
  const path = `/applications/batch/${batchId}`;
  const user = await requireUser(undefined, path);
  if (effectiveRole(user) === 'landlord') redirect('/');

  const repo = getRepo();
  const apps = await repo.listBatch(batchId);
  if (apps.length === 0) notFound();
  const membersByApp: Record<string, ApplicationMember[]> = {};
  for (const app of apps) membersByApp[app.id] = await repo.listApplicationMembers(app.id);
  if (!canViewBatch(apps, membersByApp, user.id)) notFound();

  const listings = new Map<string, Listing | null>();
  for (const app of apps) listings.set(app.id, await repo.getListing(app.floorPlanId));

  const isLeader = apps.every((a) => isLeaderOf(a, user.id));
  const draft = apps.every((a) => a.status === 'draft');
  const total = batchTotal(apps.map((a) => a.fees));

  const leaderNames = (() => {
    const names: string[] = [];
    for (const app of apps) for (const m of pendingMembers(membersByApp[app.id] ?? [])) {
      const label = m.name ?? (m.kind === 'guarantor' ? 'a guarantor' : 'a roommate');
      if (!names.includes(label)) names.push(label);
    }
    return names;
  })();

  const origin = isLeader ? originFromHeaders(await headers()) : '';
  const profile = isLeader ? await repo.getApplicantProfile(user.id) : null;
  const profileReady = profileCompleteness(profile).complete;
  const myPartOpen = isLeader && apps.some((a) => !(leaderMember(membersByApp[a.id] ?? [], user.id)?.done ?? true));
  const submit = canSubmitBatch(apps, membersByApp);
  const approved = apps.find((a) => a.status === 'approved');
  const suggestions = approved ? withdrawSuggestions(apps) : [];
  const withdrawable = withdrawableApplications(apps, isLeader);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title={apps.length > 1 ? 'Your batch' : 'Your application'}
        subtitle={`${plural(apps.length, 'place')}, ranked by your preference. ${isLeader ? 'You lead this application.' : 'You are a roommate on this application.'}`}
        actions={
          <Button href="/applications" variant="secondary">
            All applications
          </Button>
        }
      />

      <Alert tone="info">
        {APPLY_IS_NOT_SIGNING} Fees are paid to the landlord directly for now.
      </Alert>

      {isLeader && leaderNames.length > 0 && (
        <Alert tone="warn" title="Waiting on">
          {leaderNames.join(', ')}. You can send them their invite links below.
        </Alert>
      )}

      {isLeader && approved && suggestions.length > 0 && (
        <Card as="section">
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink">
              You were approved at {placeName(listings.get(approved.id))}. Withdraw your other applications?
            </h2>
          </CardHeader>
          <CardBody className="grid gap-4">
            <p className="text-sm text-ink-2">
              You can only lease one place. Withdrawing the others tells those landlords you are no longer interested.
            </p>
            <ul className="grid gap-2">
              {suggestions.map((app) => (
                <li key={app.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-ink">{placeName(listings.get(app.id))}</span>
                  <StatusChip status={app.status} />
                </li>
              ))}
            </ul>
            <ActionForm
              action={withdrawApplications}
              hidden={{ batchId, applicationId: suggestions.map((a) => a.id) }}
              label="Withdraw all other applications"
              variant="danger"
              confirmMessage="Withdraw all the other applications? You can't undo this."
            />
          </CardBody>
        </Card>
      )}

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Places</h2>
        </CardHeader>
        <CardBody className="grid gap-5">
          <ol className="grid gap-4">
            {apps.map((app) => {
              const listing = listings.get(app.id) ?? null;
              const canWithdraw = withdrawable.some((w) => w.id === app.id);
              return (
                <li key={app.id} className="grid gap-3 rounded-sm border border-line bg-surface-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-0.5">
                      <span className="text-xs font-medium text-ink-2">Choice {app.batchRank}</span>
                      <span className="font-semibold text-ink">{placeName(listing)}</span>
                      <span className="text-sm text-ink-2">Application fees {moneyPrecise(app.fees.applicationTotal)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <StatusChip status={app.status} />
                      <Link href={`/applications/${app.id}`} className="text-sm font-medium text-accent underline">
                        Details
                      </Link>
                    </div>
                  </div>
                  {isLeader && canWithdraw && (
                    <ActionForm
                      action={withdrawApplications}
                      hidden={{ batchId, applicationId: app.id }}
                      label="Withdraw this application"
                      variant="secondary"
                      confirmMessage="Withdraw this application? You can't undo this."
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
            <span className="text-ink-2">Batch fee total</span>
            <strong className="text-lg text-ink">{moneyPrecise(total)}</strong>
          </div>
          {isLeader && withdrawable.length > 1 && (
            <ActionForm
              action={withdrawApplications}
              hidden={{ batchId, applicationId: withdrawable.map((a) => a.id) }}
              label="Withdraw all open applications"
              variant="danger"
              confirmMessage="Withdraw every open application in this batch? You can't undo this."
            />
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Fees by place</h2>
        </CardHeader>
        <CardBody className="grid gap-6">
          <p className="text-sm text-ink-2">Every charge is shown before anything is sent. Fees are paid to the landlord directly for now.</p>
          {apps.map((app) => (
            <div key={`fees-${app.id}`} className="grid gap-2">
              <h3 className="text-sm font-semibold text-ink">{placeName(listings.get(app.id))}</h3>
              <FeeSummary fees={app.fees} />
            </div>
          ))}
        </CardBody>
      </Card>

      {isLeader && draft && (
        <Card as="section">
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink">Send it</h2>
          </CardHeader>
          <CardBody className="grid gap-6">
            {myPartOpen && (
              <div className="grid gap-3">
                <p className="text-sm text-ink-2">
                  Your part is your applicant profile. Roommates see only that it is done.
                </p>
                {!profileReady && (
                  <Alert tone="warn">
                    Finish your applicant profile first. <Link href="/profile/applicant" className="font-medium underline">Go to your profile</Link>
                  </Alert>
                )}
                <ActionForm
                  action={attachLeaderProfile}
                  hidden={{ batchId }}
                  label="Attach my profile and mark my part done"
                  variant="secondary"
                />
              </div>
            )}
            <ActionForm
              action={submitBatch}
              hidden={{ batchId }}
              label={`Submit ${plural(apps.length, 'application')}`}
              disabled={!submit.ok}
              hint={submit.ok ? 'Every member is done. Submitting sends all of these places to their landlords.' : submit.reason}
            />
          </CardBody>
        </Card>
      )}

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Who is done</h2>
        </CardHeader>
        <CardBody className="grid gap-6">
          {!isLeader && ownOpenMembers(apps.flatMap((a) => membersByApp[a.id] ?? []), user.id).length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm text-ink-2">Finish your part with the link for each place:</p>
              <ul className="grid gap-2">
                {apps.flatMap((app) =>
                  ownOpenMembers(membersByApp[app.id] ?? [], user.id).map((m) => (
                    <li key={m.id}>
                      <Button href={`/apply/invite/${encodeURIComponent(m.inviteToken)}`} variant="secondary" size="sm">
                        Finish my part for {placeName(listings.get(app.id))}
                      </Button>
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}
          {apps.map((app) => (
            <div key={`members-${app.id}`} className="grid gap-2">
              <h3 className="text-sm font-semibold text-ink">{placeName(listings.get(app.id))}</h3>
              <MemberList members={membersByApp[app.id] ?? []} leaderView={isLeader} origin={origin} />
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
