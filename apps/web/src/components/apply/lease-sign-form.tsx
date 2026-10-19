'use client';
// Lease checklist with the sign button. The button stays disabled until every item is ticked;
// signLease re-checks the posted items on the server.
import { useActionState, useState } from 'react';
import { Alert, Button, Checkbox, ScrollIntoView } from '@/components/ui';
import type { ApplicationActionState } from '@/lib/apply/application-actions';
import type { TrackerAction } from './action-form';

export function LeaseSignForm({
  applicationId,
  items,
  action,
}: {
  applicationId: string;
  items: { id: string; text: string }[];
  action: TrackerAction;
}) {
  const [state, formAction, pending] = useActionState<ApplicationActionState, FormData>(action, {});
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const remaining = items.filter((i) => !ticked[i.id]).length;

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="applicationId" value={applicationId} />
      <fieldset className="grid gap-4">
        <legend className="text-sm text-ink-2">
          Tick each item once you have read it in the lease. {remaining > 0 ? `${remaining} left.` : 'All ticked.'}
        </legend>
        {items.map((item) => (
          <Checkbox
            key={item.id}
            id={`check-${item.id}`}
            name={`check-${item.id}`}
            value="on"
            label={item.text}
            checked={Boolean(ticked[item.id])}
            onChange={(e) => {
              // Read now: React clears currentTarget before a deferred state updater runs.
              const checked = e.currentTarget.checked;
              setTicked((prev) => ({ ...prev, [item.id]: checked }));
            }}
          />
        ))}
      </fieldset>
      <div>
        <Button type="submit" disabled={remaining > 0} loading={pending}>
          I signed the lease
        </Button>
        {remaining > 0 && <p className="mt-2 text-sm text-ink-2">Tick all {items.length} items to enable signing.</p>}
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
