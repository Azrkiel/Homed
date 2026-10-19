'use client';
import { useActionState } from 'react';
import { Alert, Button, Card, CardBody, Field, ScrollIntoView, Select, TextInput } from '@/components/ui';
import { saveApplicantProfile, type ProfileState } from '@/lib/apply/actions';
import { INCOME_SOURCES, REFERENCE_ROWS, RENTAL_ROWS, STUDENT_STATUSES } from '@/lib/apply/profile-form';

const STATUS_LABELS: Record<(typeof STUDENT_STATUSES)[number], string> = {
  undergraduate: 'Undergraduate',
  graduate: 'Graduate',
  other: 'Other',
};

const INCOME_LABELS: Record<(typeof INCOME_SOURCES)[number], string> = {
  guarantor: 'Guarantor',
  employment: 'Employment',
  financial_aid: 'Financial aid',
  savings: 'Savings',
  other: 'Other',
};

type Values = Record<string, string>;

export function ApplicantForm({ initialValues }: { initialValues: Values }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(saveApplicantProfile, {});
  const values: Values = state.values ?? initialValues;
  const fe = state.fieldErrors ?? {};

  /** Text input bound to a form field name; defaults come from the saved profile or the echoed submit. */
  const text = (name: string, label: string, opts: { type?: string; required?: boolean; hint?: string; placeholder?: string; inputMode?: 'decimal' | 'tel' | 'numeric' | 'text' | 'email' } = {}) => (
    <Field id={name} label={label} required={opts.required} hint={opts.hint} error={fe[name]}>
      {(a) => (
        <TextInput
          {...a}
          name={name}
          type={opts.type ?? 'text'}
          inputMode={opts.inputMode}
          placeholder={opts.placeholder}
          defaultValue={values[name] ?? ''}
          maxLength={opts.type === 'date' ? undefined : 200}
          autoComplete="off"
        />
      )}
    </Field>
  );

  return (
    <form action={formAction} className="grid gap-6">
      {!pending && state.saved && (
        <ScrollIntoView>
          <Alert tone="good" title="Profile saved">
            Your applicant profile is up to date. Roommates see only whether your part is done.
          </Alert>
        </ScrollIntoView>
      )}
      {!pending && state.error && (
        <ScrollIntoView>
          <Alert tone="bad">{state.error}</Alert>
        </ScrollIntoView>
      )}

      <Card as="section">
        <CardBody className="grid gap-5">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold text-ink">Common App for housing</h2>
            <p className="text-sm text-ink-2">Fill this once. It is reused for every place you apply to.</p>
          </div>
          {text('legalName', 'Legal name', { required: true, hint: 'As it appears on your ID.' })}
          <div className="grid gap-5 sm:grid-cols-2">
            {text('phone', 'Phone', { required: true, type: 'tel', inputMode: 'tel', placeholder: '(434) 555-0100' })}
            <Field id="studentStatus" label="Student status" required error={fe.studentStatus}>
              {(a) => (
                <Select {...a} name="studentStatus" defaultValue={values.studentStatus ?? ''}>
                  <option value="">Choose one</option>
                  {STUDENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {text('currentAddress', 'Current address', { required: true })}
          {text('expectedGraduation', 'Expected graduation', { placeholder: 'May 2028' })}
        </CardBody>
      </Card>

      <Card as="section">
        <CardBody className="grid gap-6">
          <div className="grid gap-2">
            <h2 className="text-lg font-semibold text-ink">Sensitive details</h2>
            <Alert tone="info">
              This section is encrypted and never shown to roommates.
            </Alert>
            <p className="text-sm text-ink-2">
              No Social Security number is collected here. The screening partner collects ID details later.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {text('monthlyIncome', 'Monthly income (USD)', {
              inputMode: 'decimal',
              placeholder: '1200',
              hint: 'Your own monthly amount. Leave blank if none.',
            })}
            <Field id="incomeSource" label="Income source" error={fe.incomeSource}>
              {(a) => (
                <Select {...a} name="incomeSource" defaultValue={values.incomeSource ?? ''}>
                  <option value="">Not set</option>
                  {INCOME_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {INCOME_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {text('dateOfBirth', 'Date of birth', { type: 'date' })}

          <fieldset className="grid gap-4 rounded-card border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Guarantor (optional)</legend>
            <p className="text-sm text-ink-2">Fill in the name, email and relationship, or leave all of them blank.</p>
            <div className="grid gap-5 sm:grid-cols-2">
              {text('guarantorName', 'Guarantor name')}
              {text('guarantorEmail', 'Guarantor email', { type: 'email' })}
              {text('guarantorRelationship', 'Relationship', { placeholder: 'Parent' })}
              {text('guarantorPhone', 'Guarantor phone', { type: 'tel', inputMode: 'tel' })}
            </div>
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-ink">Rental history (up to {RENTAL_ROWS})</legend>
            <p className="text-sm text-ink-2">Start with your most recent place. A row needs an address and a start date.</p>
            {Array.from({ length: RENTAL_ROWS }, (_, n) => (
              <div key={n} className="grid gap-4 rounded-card border border-line p-4 sm:grid-cols-2">
                <p className="text-sm font-medium text-ink-2 sm:col-span-2">Place {n + 1}</p>
                <div className="sm:col-span-2">{text(`rh_address_${n}`, 'Address')}</div>
                {text(`rh_landlordName_${n}`, 'Landlord name')}
                {text(`rh_landlordContact_${n}`, 'Landlord phone or email')}
                {text(`rh_from_${n}`, 'Start date', { type: 'date' })}
                {text(`rh_to_${n}`, 'End date', { type: 'date' })}
              </div>
            ))}
          </fieldset>

          <fieldset className="grid gap-4">
            <legend className="text-sm font-semibold text-ink">References (up to {REFERENCE_ROWS})</legend>
            <p className="text-sm text-ink-2">Fill in all three fields for each reference, or leave a row blank.</p>
            {Array.from({ length: REFERENCE_ROWS }, (_, n) => (
              <div key={n} className="grid gap-4 rounded-card border border-line p-4 sm:grid-cols-3">
                <p className="text-sm font-medium text-ink-2 sm:col-span-3">Reference {n + 1}</p>
                {text(`ref_name_${n}`, 'Name')}
                {text(`ref_contact_${n}`, 'Phone or email')}
                {text(`ref_relationship_${n}`, 'How you know them')}
              </div>
            ))}
          </fieldset>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}
