import type { ApplicantProfile } from '@homed/core';
import { money, shortDate } from '@/lib/format';

const STUDENT_STATUS = { undergraduate: 'Undergraduate', graduate: 'Graduate', other: 'Other' } as const;
const INCOME_SOURCE = {
  guarantor: 'Guarantor',
  employment: 'Employment',
  financial_aid: 'Financial aid',
  savings: 'Savings',
  other: 'Other',
} as const;

/** Applicant profile as a landlord sees it (landlordSafeProfile: sensitive fields minus date of birth). Server component. */
export function ApplicantProfileView({ profile }: { profile: ApplicantProfile }) {
  const s = profile.sensitive;
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      <Row label="Legal name" value={profile.legalName} />
      <Row label="Student status" value={STUDENT_STATUS[profile.studentStatus]} />
      <Row label="Expected graduation" value={profile.expectedGraduation} />
      <Row label="Phone" value={profile.phone} />
      <Row label="Current address" value={profile.currentAddress} />
      <Row label="ID checked" value={profile.idVerified ? 'Yes' : 'Not yet'} />
      <Row label="Monthly income" value={s.monthlyIncome === undefined ? undefined : money(s.monthlyIncome)} />
      <Row label="Income source" value={s.incomeSource ? INCOME_SOURCE[s.incomeSource] : undefined} />
      {s.guarantor && (
        <Row
          label="Guarantor"
          value={`${s.guarantor.name}, ${s.guarantor.relationship}, ${s.guarantor.email}${s.guarantor.phone ? `, ${s.guarantor.phone}` : ''}`}
          wide
        />
      )}
      {s.rentalHistory.length > 0 && (
        <div className="grid gap-1 sm:col-span-2">
          <dt className="text-ink-2">Rental history</dt>
          <dd>
            <ul className="grid gap-1">
              {s.rentalHistory.map((r, i) => (
                <li key={i}>
                  {r.address}, {shortDate(r.from)} to {r.to ? shortDate(r.to) : 'present'}
                  {r.landlordName ? `, landlord ${r.landlordName}` : ''}
                  {r.landlordContact ? ` (${r.landlordContact})` : ''}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {s.references.length > 0 && (
        <div className="grid gap-1 sm:col-span-2">
          <dt className="text-ink-2">References</dt>
          <dd>
            <ul className="grid gap-1">
              {s.references.map((r, i) => (
                <li key={i}>
                  {r.name}, {r.relationship}, {r.contact}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}

function Row({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? 'grid gap-1 sm:col-span-2' : 'grid gap-1'}>
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
