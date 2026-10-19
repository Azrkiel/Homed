'use client';
import { useActionState } from 'react';
import { Button, Field, TextInput } from '@/components/ui';
import { createLandlordAction } from '@/lib/landlord/actions';
import { FormAlert } from './form-alert';

/** Creates the landlord record for the signed-in user. Form names: name, email, phone, website. */
export function OnboardingForm() {
  const [state, action, pending] = useActionState(createLandlordAction, null);
  return (
    <form action={action} className="grid max-w-xl gap-5">
      <FormAlert state={state} />
      <Field id="ob-name" label="Business or landlord name" required>
        {(a) => <TextInput {...a} name="name" autoComplete="organization" maxLength={120} />}
      </Field>
      <Field id="ob-email" label="Contact email" hint="Optional. Shown to students only if you choose.">
        {(a) => <TextInput {...a} name="email" type="email" autoComplete="email" maxLength={200} />}
      </Field>
      <Field id="ob-phone" label="Phone">
        {(a) => <TextInput {...a} name="phone" type="tel" autoComplete="tel" maxLength={40} />}
      </Field>
      <Field id="ob-website" label="Website" hint="Starts with https://">
        {(a) => <TextInput {...a} name="website" type="url" placeholder="https://" maxLength={2000} />}
      </Field>
      <div>
        <Button type="submit" loading={pending}>
          Create landlord profile
        </Button>
      </div>
    </form>
  );
}
