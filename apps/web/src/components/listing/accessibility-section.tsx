import { ACCESSIBILITY_FEATURE_LABELS, accommodationBadge, type AccessibilityInfo } from '@homed/core';
import { Badge } from '@/components/ui';

export const SDAC_HOUSING_URL = 'https://studenthealth.virginia.edu/sdac-housing-accommodations';

/** Accessibility and accommodations: features, contact and process, assistance animals, the badge and what is missing. */
export function AccessibilitySection({ info, onGrounds }: { info: AccessibilityInfo | undefined; onGrounds: boolean }) {
  const badge = accommodationBadge(info);
  const confirmed = new Set(info?.photoConfirmed ?? []);

  return (
    <div className="grid gap-4">
        {badge.friendly && <Badge tone="good" className="w-fit">Accommodation-friendly</Badge>}

        {!info ? (
          <p className="text-sm text-ink-2">No details yet. Ask the landlord before you apply.</p>
        ) : (
          <>
            {info.features.length > 0 && (
              <ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Accessibility features">
                {info.features.map((f) => (
                  <li key={f} className="flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span aria-hidden="true" className="text-good">&#10003;</span>
                    {ACCESSIBILITY_FEATURE_LABELS[f]}
                    {confirmed.has(f) && <Badge tone="good">Photo-confirmed</Badge>}
                  </li>
                ))}
              </ul>
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

        {onGrounds && (
          <p className="text-sm text-ink-2">
            On-Grounds requests go through the{' '}
            <a href={SDAC_HOUSING_URL} className="font-medium text-navy underline underline-offset-2" target="_blank" rel="noreferrer">
              Student Disability Access Center
            </a>
            , every year.
          </p>
        )}
    </div>
  );
}
