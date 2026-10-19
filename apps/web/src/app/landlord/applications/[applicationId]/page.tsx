import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  APPLY_IS_NOT_SIGNING,
  statusLabel,
  type ApplicantProfile,
  type ApplicationDocument,
  type ApplicationMember,
} from '@homed/core';
import { Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';
import { ApplicantProfileView } from '@/components/landlord/applicant-profile-view';
import { ApplicationStatusForm } from '@/components/landlord/application-status-form';
import { landlordApplicationFor } from '@/lib/landlord/application-access';
import { landlordSafeProfile } from '@/lib/landlord/application-pdf';
import { landlordActions, memberDisplayName, memberKindLabel } from '@/lib/landlord/application-view';
import { requireLandlord } from '@/lib/landlord/server';
import { money, localDate, shortDate } from '@/lib/format';
import { getRepo, today } from '@/lib/repo';

export const metadata: Metadata = { title: 'Application | Homed' };

type Props = { params: Promise<{ applicationId: string }> };

const RENT_BASIS = { per_bed: 'per person', per_unit: 'per unit' } as const;

/** One application for a landlord. Not found (not forbidden) unless the property is theirs or they are an admin. */
export default async function LandlordApplicationPage({ params }: Props) {
  const { applicationId } = await params;
  const { user } = await requireLandlord();
  const record = await landlordApplicationFor(user, applicationId);
  if (!record) notFound();

  const { application, property, floorPlan, members } = record;
  const repo = getRepo();
  // Backstop for the 90-day limit: cheap, and this is where expired files would otherwise be read.
  await repo.purgeExpiredDocuments(today());
  const status = statusLabel(application.status);

  const profiles = new Map<string, ApplicantProfile>();
  const documents = new Map<string, ApplicationDocument[]>();
  for (const m of members) {
    if (m.userId && !profiles.has(m.userId)) {
      const raw = await repo.getApplicantProfile(m.userId);
      const profile = raw ? landlordSafeProfile(raw) : null;
      if (profile) profiles.set(m.userId, profile);
    }
    documents.set(m.id, await repo.listDocuments(m.id));
  }

  const actors = new Map<string, string>();
  for (const h of application.statusHistory) {
    if (actors.has(h.by)) continue;
    const u = await repo.getUser(h.by);
    actors.set(h.by, u?.name || 'Unknown');
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Applications"
        title={`${property.name}, ${floorPlan.name}`}
        subtitle={`${property.address} · ${money(floorPlan.rentAmount)} a month, ${RENT_BASIS[floorPlan.rentBasis]}`}
        actions={
          <>
            <Button href="/landlord/applications" variant="ghost" size="sm">
              All applications
            </Button>
            <Button href={`/api/applications/${application.id}/pdf`} variant="secondary" size="sm">
              Download packet (PDF)
            </Button>
          </>
        }
      />

      <Card as="section">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Status</h2>
          <Badge tone={application.status === 'denied' ? 'bad' : 'accent'}>{status.label}</Badge>
        </CardHeader>
        <CardBody className="grid gap-5">
          <p className="text-sm text-ink-2">{status.detail}</p>
          <ApplicationStatusForm applicationId={application.id} actions={record.canAct ? landlordActions(application.status) : []} />
          <p className="text-xs text-ink-2">{APPLY_IS_NOT_SIGNING}</p>
        </CardBody>
      </Card>

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Fees</h2>
        </CardHeader>
        <CardBody className="grid gap-3 text-sm">
          <ul className="grid gap-1">
            {application.fees.perPerson.map((line) => (
              <li key={line.label} className="flex flex-wrap justify-between gap-2">
                <span className="text-ink">
                  {line.label}
                  <span className="text-ink-2">{line.refundable ? ' (refundable)' : ' (non-refundable)'}</span>
                </span>
                <span className="tabular-nums text-ink">{money(line.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink-2">
            Per person {money(application.fees.perPersonTotal)} × {application.fees.people} ={' '}
            <span className="font-medium text-ink">{money(application.fees.applicationTotal)}</span>
          </p>
          {application.fees.complianceIssues.length > 0 && (
            <ul className="grid gap-1 text-warn">
              {application.fees.complianceIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <section aria-labelledby="members-heading" className="grid gap-5">
        <h2 id="members-heading" className="text-xl font-semibold text-ink">
          Applicants
        </h2>
        <p className="text-sm text-ink-2">
          Homed never stores credit reports. Applicant details below are what the applicant provided; documents are
          encrypted and deleted after the decision.
        </p>
        {members.map((m) => (
          <MemberCard
            key={m.id}
            member={m}
            profile={m.userId ? profiles.get(m.userId) : undefined}
            documents={documents.get(m.id) ?? []}
            applicationId={application.id}
          />
        ))}
      </section>

      <Card as="section">
        <CardHeader>
          <h2 className="text-lg font-semibold text-ink">Status history</h2>
        </CardHeader>
        <CardBody>
          <ol className="grid gap-2 text-sm">
            {application.statusHistory.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex flex-wrap gap-2">
                <span className="text-ink-2">{shortDate(localDate(h.at))}</span>
                <span className="font-medium text-ink">{statusLabel(h.status).label}</span>
                <span className="text-ink-2">by {actors.get(h.by) ?? 'Unknown'}</span>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}

function MemberCard({
  member,
  profile,
  documents,
  applicationId,
}: {
  member: ApplicationMember;
  profile: ApplicantProfile | undefined;
  documents: ApplicationDocument[];
  applicationId: string;
}) {
  return (
    <Card as="article">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 className="text-base font-semibold text-ink">{memberDisplayName(member)}</h3>
          <p className="text-sm text-ink-2">
            {memberKindLabel(member.kind)} · {member.email}
          </p>
        </div>
        <Badge tone={member.done ? 'good' : 'warn'}>{member.done ? 'Done' : 'Not done yet'}</Badge>
      </CardHeader>
      <CardBody className="grid gap-5">
        {profile ? (
          <ApplicantProfileView profile={profile} />
        ) : (
          <p className="text-sm text-ink-2">No applicant profile attached yet.</p>
        )}
        <div className="grid gap-2">
          <h4 className="text-sm font-semibold text-ink">Documents</h4>
          {documents.length === 0 ? (
            <p className="text-sm text-ink-2">No documents uploaded.</p>
          ) : (
            <ul className="grid gap-1 text-sm">
              {documents.map((d) => (
                <li key={d.id}>
                  <a
                    href={`/landlord/applications/${applicationId}/documents/${d.id}`}
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {d.filename}
                  </a>
                  <span className="text-ink-2"> · uploaded {shortDate(localDate(d.createdAt))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
