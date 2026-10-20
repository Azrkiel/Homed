'use client';
// Form that runs a tracker server action and shows its result. Hidden fields carry ids; the server re-checks everything.
import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, ScrollIntoView, type ButtonVariant } from '@/components/ui';
import type { ApplicationActionState } from '@/lib/apply/application-actions';

export type TrackerAction = (prev: ApplicationActionState, formData: FormData) => Promise<ApplicationActionState>;

export function ActionForm({
  action,
  hidden,
  label,
  variant = 'primary',
  disabled = false,
  confirmMessage,
  hint,
}: {
  action: TrackerAction;
  hidden: Record<string, string | string[]>;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Shown in a confirm dialog before the form posts. */
  confirmMessage?: string;
  hint?: string;
}) {
  const [state, formAction, pending] = useActionState<ApplicationActionState, FormData>(action, {});

  return (
    <form
      action={formAction}
      className="grid gap-3"
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((v) => (
          <input key={`${name}:${v}`} type="hidden" name={name} value={v} />
        )),
      )}
      {hint && <p className="text-sm text-ink-2">{hint}</p>}
      <div>
        <Button type="submit" variant={variant} disabled={disabled} loading={pending}>
          {label}
        </Button>
      </div>
      {!pending && state.ok && state.message && (
        <ScrollIntoView>
          <Alert tone="good">{state.message}</Alert>
        </ScrollIntoView>
      )}
      {!pending && state.error && (
        <ScrollIntoView>
          <Alert tone="bad">
            {state.error}
            {state.needsProfile && (
              <>
                {' '}
                <Link href="/profile/applicant" className="font-medium text-accent underline">
                  Go to your applicant profile
                </Link>
              </>
            )}
          </Alert>
        </ScrollIntoView>
      )}
    </form>
  );
}
