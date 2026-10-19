'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button, Field, TextInput } from '@/components/ui';
import { setMyBudgetAction } from '@/lib/groups/actions';

/**
 * The viewer's own per-person budget. `initial` is the viewer's own number (null when unset); no other
 * member's budget ever reaches this component.
 */
export function BudgetForm({ groupId, initial }: { groupId: string; initial: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial === null ? '' : String(initial));
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = value;
    setStatus(null);
    startTransition(async () => {
      try {
        const result = await setMyBudgetAction(groupId, raw);
        if (!result.ok) {
          setStatus({ tone: 'bad', text: result.message });
          return;
        }
        setStatus({ tone: 'ok', text: raw.trim() === '' ? 'Budget cleared.' : 'Budget saved.' });
        router.refresh();
      } catch {
        setStatus({ tone: 'bad', text: 'Could not save your budget. Please try again.' });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3" aria-describedby="my-budget-status">
      <Field
        id="my-budget"
        label="Your budget per person"
        hint="Monthly all-in, whole dollars, like 1500. Leave blank to clear. Only you see this number."
      >
        {(a) => (
          <div className="flex flex-wrap items-center gap-3">
            <TextInput
              {...a}
              name="budget"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 1500"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-40"
            />
            <Button type="submit" variant="secondary" loading={pending}>
              {pending ? 'Saving' : 'Save budget'}
            </Button>
          </div>
        )}
      </Field>
      <p
        id="my-budget-status"
        role="status"
        aria-live="polite"
        className={status?.tone === 'bad' ? 'text-sm font-medium text-bad' : status ? 'text-sm font-medium text-good' : 'sr-only'}
      >
        {status?.text ?? ''}
      </p>
    </form>
  );
}
