'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { addToShortlistAction } from '@/lib/groups/actions';
import { shortlistLabel } from '@/lib/groups/browse';

/** Adds one listing to this group's shortlist. Shows "On shortlist" once it is there. */
export function GroupShortlistButton({
  groupId,
  floorPlanId,
  name,
  shortlisted,
}: {
  groupId: string;
  floorPlanId: string;
  name: string;
  shortlisted: boolean;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const on = shortlisted || added;

  function add() {
    setMessage('');
    startTransition(async () => {
      try {
        const res = await addToShortlistAction(groupId, floorPlanId);
        if (!res.ok) {
          setMessage(res.message);
          return;
        }
        setAdded(true);
        router.refresh();
      } catch {
        setMessage('Could not add that place. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={on ? 'secondary' : 'primary'}
        disabled={on || pending}
        aria-label={on ? `${name} is on the shortlist` : `Add ${name} to the shortlist`}
        onClick={add}
      >
        {shortlistLabel(on)}
      </Button>
      <span role="status" aria-live="polite" className={message ? 'text-sm font-medium text-bad' : 'sr-only'}>
        {message}
      </span>
    </div>
  );
}
