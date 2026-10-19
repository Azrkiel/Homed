'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { deleteAlertAction, markAlertEventReadAction, markAllAlertEventsReadAction } from '@/lib/search/actions';
import type { ActionResult } from '@/lib/search/actions';

function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message);
      else onOk?.();
    });
  }
  return { pending, error, run };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-bad">
      {error}
    </p>
  ) : null;
}

export function MarkReadButton({ eventId }: { eventId: string }) {
  const { pending, error, run } = useRun();
  return (
    <span className="grid gap-1">
      <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => markAlertEventReadAction(eventId))}>
        Mark read
      </Button>
      <ErrorLine error={error} />
    </span>
  );
}

export function MarkAllReadButton() {
  const { pending, error, run } = useRun();
  return (
    <span className="grid gap-1">
      <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => markAllAlertEventsReadAction())}>
        Mark all read
      </Button>
      <ErrorLine error={error} />
    </span>
  );
}

/** Two-step delete: "Delete" -> "Delete this alert?" with Yes / Cancel. */
export function DeleteAlertButton({ alertId, label }: { alertId: string; label: string }) {
  const { pending, error, run } = useRun();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="grid gap-1">
      {confirming ? (
        <div role="group" aria-label={`Confirm deleting ${label}`} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink">Delete this alert?</span>
          <Button
            size="sm"
            variant="danger"
            loading={pending}
            onClick={() => run(() => deleteAlertAction(alertId), () => setConfirming(false))}
          >
            Yes, delete
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)} autoFocus>
            Cancel
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" aria-label={`Delete alert: ${label}`} onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}
      <ErrorLine error={error} />
    </div>
  );
}
