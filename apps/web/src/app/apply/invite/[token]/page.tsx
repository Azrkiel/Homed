import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { APPLY_IS_NOT_SIGNING, pendingMembers, type Application, type ApplicationMember, type Listing } from '@homed/core';
import { Alert, Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { GuarantorConsentForm } from '@/components/apply/guarantor-consent-form';
import { RoommateAttachForm } from '@/components/apply/roommate-attach-form';
import { flattenMembers, guaranteeTargetName, otherMemberViews, sameEmail } from '@/components/apply/invite-logic';
import { FeeSummary, placeName } from '@/components/apply/application-views';
import { profileCompleteness } from '@/lib/apply/profile-form';
import { batchLocked } from '@/lib/apply/tracker';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Invite | Homed' };
// No loading.tsx here: notFound() and requireUser must run before any HTML streams.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

interface Place {
  app: Application;
  label: string;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const repo = getRepo();
  const member = token ? await repo.getMemberByInviteToken(token) : null;
  if (!member || member.kind === 'leader') notFound();

  const app = await repo.getApplication(member.applicationId);
  if (!app) notFound();
  const apps = await repo.listBatch(app.batchId);
  if (apps.length === 0) notFound();

  const membersByApp: Record<string, ApplicationMember[]> = {};
  for (const a of apps) membersByApp[a.id] = await repo.listApplicationMembers(a.id);
  const listings = new Map<string, Listing | null>();
  for (const a of apps) listings.set(a.id, await repo.getListing(a.floorPlanId));

  const places: Place[] = apps.map((a) => ({ app: a, label: placeName(listings.get(a.id) ?? null) }));
  const allRows = flattenMembers(membersByApp);
  const leaderName = (membersByApp[app.id] ?? []).find((m) => m.kind === 'leader')?.name?.trim() || undefined;
  const draft = !batchLocked(apps);

  if (member.kind === 'guarantor') {
    const target = guaranteeTargetName(member, allRows, leaderName);
    return (
      <div className="mx-auto grid max-w-2xl gap-6">
        <PageHeader title="Guarantor agreement" subtitle={`You are agreeing to guarantee ${target}'s application.`} />
        <Alert tone="info">
          {APPLY_IS_NOT_SIGNING} Fees are paid to the landlord directly for now.
        </Alert>

        <PlacesCard places={places} />

        <Card as="section">
          <CardHeader>
            <h2 className="text-lg font-semibold text-ink">Your part</h2>
          </CardHeader>
          <CardBody className="grid gap-5">
            {member.done ? (
              <Alert tone="good" title="Your part is done.">
                Thank you. {target} will see that you signed. You do not need to do anything else here.
              </Alert>
            ) : !draft ? (
              <Alert tone="info">This batch was already sent, so your part is locked.</Alert>
            ) : (
              <GuarantorConsentForm token={token} defaultName={member.name ?? ''} studentName={target} />
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  // Roommate: needs a signed-in student account with the invited email.
  const user = await requireUser(undefined, `/apply/invite/${encodeURIComponent(token)}`);
  if (effectiveRole(user) === 'landlord') redirect('/');

  if (!sameEmail(user.email, member.email)) {
    return (
      <div className="mx-auto grid max-w-md gap-6">
        <PageHeader title="Wrong account" />
        <Alert tone="warn" title="This link was sent to a different email address.">
          Sign in with the address the student invited, then open this link again.
        </Alert>
        <form action="/signout" method="post">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    );
  }

  const profile = await repo.getApplicantProfile(user.id);
  const profileReady = profileCompleteness(profile).complete;
  const sameApplication = membersByApp[app.id] ?? [];
  const others = otherMemberViews(sameApplication, member.id);
  const waiting = pendingMembers(sameApplication).filter((m) => m.id !== member.id).length;

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title="Roommate application" subtitle={`${leaderName ?? 'Your roommate'} invited you to apply together.`} />
      <Alert tone="info">
        {APPLY_IS_NOT_SIGNING} Fees are paid to the landlord directly for now.
      </Alert>

      <PlacesCard places={places} />

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Your applicant profile</h2>
        </CardHeader>
        <CardBody className="grid gap-3 text-sm">
          {profileReady ? (
            <p className="text-ink">Your profile is complete. It is attached when you mark your part done.</p>
          ) : (
            <Alert tone="warn" title="Your profile is not complete yet.">
              Add your legal name, phone, current address and student status at{' '}
              <Link href="/profile/applicant" className="font-medium text-accent underline">
                your applicant profile
              </Link>
              . Then come back to this invite link.
            </Alert>
          )}
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Your part</h2>
        </CardHeader>
        <CardBody className="grid gap-5">
          {member.done ? (
            <Alert tone="good" title="Your part is done.">
              {waiting > 0
                ? `Waiting on ${waiting} more ${waiting === 1 ? 'person' : 'people'} before the application can be submitted.`
                : 'Everyone on this application is done. The student can submit it.'}
            </Alert>
          ) : !draft ? (
            <Alert tone="info">This batch was already sent, so your part is locked.</Alert>
          ) : (
            <RoommateAttachForm token={token} profileReady={profileReady} />
          )}

          {others.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-sm font-semibold text-ink">Everyone else on this application</h3>
              <ul className="grid gap-2">
                {others.map((v) => (
                  <li key={v.memberId} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink">{v.name}</span>
                    <Badge tone={v.done ? 'good' : 'warn'}>{v.done ? 'Done' : 'Not done'}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Each place in the batch with its fees per person. */
function PlacesCard({ places }: { places: Place[] }) {
  return (
    <Card as="section">
      <CardHeader>
        <h2 className="text-lg font-semibold text-ink">{places.length > 1 ? 'Places in this batch' : 'Place'}</h2>
      </CardHeader>
      <CardBody className="grid gap-6">
        {places.map(({ app, label }) => (
          <div key={app.id} className="grid gap-2">
            <h3 className="text-sm font-semibold text-ink">{label}</h3>
            <FeeSummary fees={app.fees} />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
