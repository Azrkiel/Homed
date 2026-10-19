'use client';
// Guarantor consent form: name, relationship, typed signature and a consent box. No account, no ID numbers.
import { useActionState } from 'react';
import { Alert, Button, Checkbox, Field, ScrollIntoView, TextInput } from '@/components/ui';
import { signGuarantorConsent, type InviteActionState } from '@/lib/apply/invite-actions';

export function GuarantorConsentForm({
  token,
  defaultName,
  studentName,
}: {
  token: string;
  defaultName: string;
  studentName: string;
}) {
  const [state, formAction, pending] = useActionState<InviteActionState, FormData>(signGuarantorConsent, {});
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="token" value={token} />

      <Field id="g-name" label="Your full name" required error={errors.name}>
        {(a) => <TextInput {...a} name="name" autoComplete="name" defaultValue={values.name ?? defaultName} />}
      </Field>

      <Field id="g-relationship" label={`How you are related to ${studentName}`} required error={errors.relationship}>
        {(a) => <TextInput {...a} name="relationship" defaultValue={values.relationship ?? ''} placeholder="Parent, grandparent, other" />}
      </Field>

      <Field
        id="g-signature"
        label="Type your full name to sign"
        required
        hint="Your typed name counts as your signature. It must match your full name."
        error={errors.signature}
      >
        {(a) => <TextInput {...a} name="signature" autoComplete="off" defaultValue={values.signature ?? ''} />}
      </Field>

      <div className="grid gap-2 rounded-sm border border-line bg-surface-2 p-4">
        <p className="text-sm text-ink">
          If {studentName} cannot pay the rent or fees under this lease, I agree to guarantee the rent and fees for
          this application. This is a financial commitment that can last as long as the lease.
        </p>
        <Checkbox id="g-consent" name="consent" label="I agree to guarantee the rent and fees for this application." />
        {errors.consent && (
          <p className="text-sm font-medium text-bad" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      <p className="text-sm text-ink-2">
        You do not need an account or any ID numbers here. The screening partner may contact you later.
      </p>

      <div>
        <Button type="submit" loading={pending}>
          Sign and mark my part done
        </Button>
      </div>

      {!pending && state.ok && state.message && (
        <ScrollIntoView>
          <Alert tone="good">{state.message}</Alert>
        </ScrollIntoView>
      )}
      {!pending && state.error && (
        <ScrollIntoView>
          <Alert tone="bad">{state.error}</Alert>
        </ScrollIntoView>
      )}
    </form>
  );
}
