'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui';
import { updateApplicationStatusAction } from '@/lib/landlord/application-actions';
import type { LandlordAction } from '@/lib/landlord/application-view';
import { FormAlert } from './form-alert';

/** One POST form; each button submits its own target status as `to`. Empty `actions` renders nothing. */
export function ApplicationStatusForm({
  applicationId,
  actions,
}: {
  applicationId: string;
  actions: LandlordAction[];
}) {
  const [state, formAction, pending] = useActionState(updateApplicationStatusAction, null);
  if (actions.length === 0) return <p className="text-sm text-ink-2">No status changes are open to you for this application.</p>;
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.to}
            type="submit"
            name="to"
            value={a.to}
            variant={a.to === 'denied' ? 'danger' : a.to === 'approved' ? 'primary' : 'secondary'}
            loading={pending}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <FormAlert state={state} />
    </form>
  );
}
