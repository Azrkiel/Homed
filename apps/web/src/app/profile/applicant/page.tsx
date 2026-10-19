import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert, Card, CardBody, PageHeader } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { loadApplicantDocuments, type ApplicantDocuments } from '@/lib/apply/profile-documents';
import { profileCompleteness, profileToFormValues, type ApplicantProfileDraft } from '@/lib/apply/profile-form';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { ApplicantForm } from './applicant-form';
import { DocumentUpload } from './document-upload';

export const metadata: Metadata = { title: 'Applicant profile | Homed' };
export const dynamic = 'force-dynamic';

const MISSING_LABELS: Record<string, string> = {
  legalName: 'legal name',
  phone: 'phone',
  currentAddress: 'current address',
  studentStatus: 'student status',
};

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
};

export default async function ApplicantProfilePage() {
  const user = await requireUser(undefined, '/profile/applicant');
  if (effectiveRole(user) === 'landlord') redirect('/');

  let profile: ApplicantProfileDraft | null = null;
  let docs: ApplicantDocuments = { uploadMembers: [], groups: [] };
  let loadError = false;
  try {
    const repo = getRepo();
    const stored = await repo.getApplicantProfile(user.id);
    profile = stored;
    docs = await loadApplicantDocuments(repo, user.id);
  } catch {
    loadError = true;
  }

  const { complete, missing } = profileCompleteness(profile);

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <PageHeader
        title="Applicant profile"
        subtitle="One profile for every place you apply to. Landlords see it only when you apply."
      />
      {loadError && (
        <Alert tone="warn">Your saved profile could not load. Reload to try again.</Alert>
      )}
      {!loadError && !complete && (
        <Alert tone="info">
          Finish your profile before you apply. Still needed: {missing.map((k) => MISSING_LABELS[k] ?? k).join(', ')}.
        </Alert>
      )}

      <ApplicantForm initialValues={profileToFormValues(profile)} />

      <Card as="section">
        <CardBody className="grid gap-5">
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold text-ink">Documents</h2>
            <p className="text-sm text-ink-2">
              Files are encrypted. They are deleted after the decision on your application, and no later than 90 days
              after upload. Roommates never see them.
            </p>
          </div>

          {docs.uploadMember ? (
            <DocumentUpload />
          ) : (
            <p className="text-sm text-ink-2">You can attach documents once you start an application.</p>
          )}

          {docs.groups.length > 0 && (
            <div className="grid gap-5">
              {docs.groups.map((group) => (
                <div key={group.member.id} className="grid gap-2">
                  <h3 className="text-sm font-semibold text-ink">
                    Application started {shortDate(group.application.createdAt.slice(0, 10))}
                  </h3>
                  <ul className="grid gap-2">
                    {group.documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-line bg-surface-2 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 break-all font-medium text-ink">{d.filename}</span>
                        <span className="text-ink-2">
                          {MIME_LABELS[d.mime] ?? d.mime} · uploaded {shortDate(d.createdAt.slice(0, 10))} · deletes by{' '}
                          {shortDate(d.deleteAfter)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
