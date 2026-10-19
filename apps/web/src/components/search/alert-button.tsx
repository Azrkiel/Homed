'use client';
import { useState, useTransition } from 'react';
import type { ListingFilters } from '@homed/core';
import { Button } from '@/components/ui';
import { createSearchAlert } from '@/lib/search/actions';

/** "Get alerts" for this search. Signed-out: link to sign in, returning to this search. */
export function AlertButton({
  filters,
  signedIn,
  nextPath,
}: {
  filters: ListingFilters;
  signedIn: boolean;
  nextPath: string;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  if (!signedIn) {
    return (
      <Button href={`/signin?next=${encodeURIComponent(nextPath)}`} variant="secondary" size="sm">
        Get alerts
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        loading={pending}
        disabled={state?.tone === 'good'}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await createSearchAlert(filters);
              setState(
                result.ok
                  ? { tone: 'good', text: 'Alerts on for this search.' }
                  : { tone: 'bad', text: result.message },
              );
            } catch {
              setState({ tone: 'bad', text: 'Could not save the alert. Try again.' });
            }
          })
        }
      >
        {state?.tone === 'good' ? 'Alerts on' : 'Get alerts'}
      </Button>
      <p role="status" className={state?.tone === 'bad' ? 'text-sm text-bad' : 'sr-only'}>
        {state?.text}
      </p>
    </div>
  );
}
