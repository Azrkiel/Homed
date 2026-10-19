'use client';
import { useActionState } from 'react';
import { Alert, Button, Field, TextInput, cx } from '@/components/ui';
import { signInAction, type SignInState } from './actions';

const ROLES = [
  { value: 'student', label: 'Student', hint: 'Use your @virginia.edu email' },
  { value: 'landlord', label: 'Landlord', hint: 'Any email address' },
] as const;

export function SignInForm({ mode, next }: { mode: 'local' | 'supabase'; next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const role = state.role ?? 'student';

  if (state.sent) {
    return (
      <Alert tone="good" title="Check your email">
        We sent a sign-in link to <strong>{state.email}</strong>. Open it on this device to finish signing in.
      </Alert>
    );
  }

  const emailError = state.error;
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="next" value={next} />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">I am a</legend>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <label
              key={r.value}
              className={cx(
                'flex cursor-pointer flex-col gap-0.5 rounded-card border border-line bg-surface px-4 py-3',
                'has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  defaultChecked={r.value === role}
                  className="size-4 accent-accent"
                />
                {r.label}
              </span>
              <span className="text-xs text-ink-2">{r.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field id="email" label="Email" required error={emailError}>
        {(a) => (
          <TextInput
            {...a}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@virginia.edu"
            defaultValue={state.email}
          />
        )}
      </Field>

      <Field id="name" label="Name (optional)">
        {(a) => <TextInput {...a} name="name" autoComplete="name" defaultValue={state.name} />}
      </Field>

      <p className="text-sm text-ink-2">
        {mode === 'local' ? 'Demo sign-in: no email is sent.' : 'We email you a one-time sign-in link. No password needed.'}
      </p>

      <Button type="submit" size="lg" loading={pending} fullWidth>
        {mode === 'local' ? 'Sign in' : 'Email me a link'}
      </Button>
    </form>
  );
}
