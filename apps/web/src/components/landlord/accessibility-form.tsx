'use client';
import { useActionState } from 'react';
import { ACCESSIBILITY_FEATURE_LABELS, type AccessibilityInfo } from '@homed/core';
import { Button, Checkbox, Field, Textarea, TextInput } from '@/components/ui';
import { ACCESSIBILITY_FEATURES } from '@/lib/landlord/forms';
import { saveAccessibilityAction } from '@/lib/landlord/actions';
import { FormAlert } from './form-alert';

/**
 * Accessibility checklist, accommodation contact and process, assistance animals.
 * Form names: propertyId, feature_<feature> (one per AccessibilityFeature), accommodationContact,
 * accommodationProcess, typicalResponseDays, service_animals_allowed, esa_allowed, animal_no_fees.
 * "Confirmed by photo" is not set here; it comes from photo review.
 */
export function AccessibilityForm({ propertyId, info }: { propertyId: string; info?: AccessibilityInfo }) {
  const [state, action, pending] = useActionState(saveAccessibilityAction, null);
  const has = new Set(info?.features ?? []);
  return (
    <form action={action} className="grid gap-8">
      <input type="hidden" name="propertyId" value={propertyId} />
      <FormAlert state={state} />

      <div className="grid gap-2 rounded-card border border-line bg-surface-2 p-4 text-sm text-ink">
        <p className="font-semibold">Why this matters</p>
        <p>
          Under the federal Fair Housing Act, landlords must consider reasonable accommodation requests from residents
          with disabilities, including requests to change a rule, policy or practice. Tell students here what you already
          offer and how to ask for more.
        </p>
        <p>
          Assistance animals (service animals and emotional support animals) are generally not treated as pets. Pet fees
          and pet rent usually do not apply to them.
        </p>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold text-ink">Physical features</legend>
        {ACCESSIBILITY_FEATURES.map((f) => (
          <Checkbox
            key={f}
            id={`a11y-${f}`}
            name={`feature_${f}`}
            label={ACCESSIBILITY_FEATURE_LABELS[f]}
            defaultChecked={has.has(f)}
          />
        ))}
      </fieldset>

      <fieldset className="grid gap-5">
        <legend className="mb-2 text-lg font-semibold text-ink">Accommodation contact and process</legend>
        <Field id="a11y-contact" label="Accommodation contact" hint="A named person or office. Name, role and how to reach them.">
          {(c) => <TextInput {...c} name="accommodationContact" maxLength={200} defaultValue={info?.accommodationContact} />}
        </Field>
        <Field id="a11y-process" label="How to request an accommodation" hint="Steps a resident follows, and what you will do next. Up to 2000 characters.">
          {(c) => <Textarea {...c} name="accommodationProcess" rows={5} maxLength={2000} defaultValue={info?.accommodationProcess} />}
        </Field>
        <Field id="a11y-days" label="Typical response time (days)" hint="How long a request usually takes to answer.">
          {(c) => (
            <TextInput {...c} name="typicalResponseDays" type="number" inputMode="numeric" min={0} max={365} defaultValue={info?.typicalResponseDays} />
          )}
        </Field>
      </fieldset>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-lg font-semibold text-ink">Assistance animals</legend>
        <Checkbox id="a11y-service" name="service_animals_allowed" label="Service animals allowed" defaultChecked={info?.assistanceAnimals.serviceAnimalsAllowed} />
        <Checkbox id="a11y-esa" name="esa_allowed" label="Emotional support animals allowed" defaultChecked={info?.assistanceAnimals.esaAllowed} />
        <Checkbox
          id="a11y-nofees"
          name="animal_no_fees"
          label="No pet fees or pet rent for service or emotional support animals"
          defaultChecked={info?.assistanceAnimals.noFees}
        />
      </fieldset>

      <div>
        <Button type="submit" loading={pending}>
          Save accessibility details
        </Button>
      </div>
    </form>
  );
}
