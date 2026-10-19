'use client';
import { useState, useTransition } from 'react';
import type { ListingFilters } from '@homed/core';
import { Button } from '@/components/ui';
import { createSearchAlert } from '@/lib/search/actions';

/** "Alert me about new matches". Signed-out: link to sign in, returning to this search. */
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
      <Button href={`/signin?next=${encodeURIComponent(nextPath)}`} variant="secondary">
        Alert me about new matches
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await createSearchAlert(filters);
            setState(
              result.ok
                ? { tone: 'good', text: 'Alert saved. You will see new matches in Alerts.' }
                : { tone: 'bad', text: result.message },
            );
          })
        }
      >
        Alert me about new matches
      </Button>
      <p role="status" className={state ? (state.tone === 'good' ? 'text-sm text-good' : 'text-sm text-bad') : 'sr-only'}>
        {state?.text}
      </p>
    </div>
  );
}
