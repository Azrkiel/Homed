import { ACCESSIBILITY_FEATURE_LABELS, accommodationBadge, type AccessibilityInfo } from '@homed/core';
import { Badge, Card, CardBody } from '@/components/ui';
import { shortDate } from '@/lib/format';

export const SDAC_HOUSING_URL = 'https://studenthealth.virginia.edu/sdac-housing-accommodations';

/** Accessibility and accommodations: features, contact and process, assistance animals, the badge and what is missing. */
export function AccessibilitySection({ info, onGrounds }: { info: AccessibilityInfo | undefined; onGrounds: boolean }) {
  const badge = accommodationBadge(info);
  const confirmed = new Set(info?.photoConfirmed ?? []);

  return (
    <Card as="section">
      <CardBody className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="a11y-heading" className="text-xl font-semibold text-ink">
            Accessibility and accommodations
          </h2>
          {badge.friendly ? <Badge tone="good">Accommodation-friendly</Badge> : <Badge tone="neutral">Not yet accommodation-friendly</Badge>}
        </div>

        {!info ? (
          <p className="text-sm text-ink-2">
            No accessibility information on file for this building. Ask the landlord about step-free access, elevators and
            your accommodation needs before you apply.
          </p>
        ) : (
          <>
            {info.features.length > 0 ? (
              <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Accessibility features">
                {info.features.map((f) => (
                  <li key={f} className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span aria-hidden="true" className="text-good">&#10003;</span>
                    {ACCESSIBILITY_FEATURE_LABELS[f]}
                    {confirmed.has(f) && <Badge tone="good">Photo-confirmed</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-2">No accessibility features are listed.</p>
            )}

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-ink">Accommodation contact</dt>
                <dd className="text-ink-2">{info.accommodationContact ?? 'Not listed'}</dd>
              </div>
              <div>
                <dt className="font-medium text-ink">How to request</dt>
                <dd className="text-ink-2">
                  {info.accommodationProcess ?? 'No written process listed'}
                  {info.typicalResponseDays !== undefined && ` Typical response: ${info.typicalResponseDays} days.`}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-ink">Assistance animals</dt>
                <dd className="text-ink-2">
                  Service animals {info.assistanceAnimals.serviceAnimalsAllowed ? 'allowed' : 'not listed as allowed'}; emotional
                  support animals {info.assistanceAnimals.esaAllowed ? 'allowed' : 'not listed as allowed'};{' '}
                  {info.assistanceAnimals.noFees ? 'no pet fees or pet rent.' : 'fees may apply.'}
                </dd>
              </div>
            </dl>
          </>
        )}

        {!badge.friendly && (
          <div className="grid gap-1 text-sm">
            <p className="font-medium text-ink">What is missing for the Accommodation-friendly badge</p>
            <ul className="list-disc pl-5 text-ink-2">
              {badge.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {info && <p className="text-xs text-ink-3">Accessibility details updated {shortDate(info.updatedAt)}.</p>}

        {onGrounds && (
          <div className="grid gap-1 rounded-card bg-info-soft p-3 text-sm text-ink">
            <p>
              On-Grounds housing accommodations go through{' '}
              <a href={SDAC_HOUSING_URL} className="font-medium text-info underline underline-offset-2" target="_blank" rel="noreferrer">
                UVA Student Disability Access Center housing accommodations
              </a>
              .
            </p>
            <p>Requests are made every year, and approval does not guarantee a spot.</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
