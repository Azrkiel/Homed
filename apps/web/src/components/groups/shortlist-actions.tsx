'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { castVoteAction, removeFromShortlistAction } from '@/lib/groups/actions';

/** Yes / no buttons for the viewer. Pressing the active vote again clears it (value 0). */
export function VoteButtons({
  groupId,
  floorPlanId,
  name,
  myVote,
}: {
  groupId: string;
  floorPlanId: string;
  name: string;
  myVote: 1 | 0 | -1;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function vote(value: 1 | -1) {
    const next = myVote === value ? 0 : value;
    setMessage('');
    startTransition(async () => {
      try {
        const result = await castVoteAction(groupId, floorPlanId, next);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      } catch {
        setMessage('Could not record your vote. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={myVote === 1 ? 'primary' : 'secondary'}
        aria-pressed={myVote === 1}
        aria-label={`Vote yes on ${name}`}
        disabled={pending}
        onClick={() => vote(1)}
      >
        Yes
      </Button>
      <Button
        size="sm"
        variant={myVote === -1 ? 'primary' : 'secondary'}
        aria-pressed={myVote === -1}
        aria-label={`Vote no on ${name}`}
        disabled={pending}
        onClick={() => vote(-1)}
      >
        No
      </Button>
      <span role="status" aria-live="polite" className={message ? 'text-sm font-medium text-bad' : 'sr-only'}>
        {message}
      </span>
    </div>
  );
}

/** Removes a place from the shortlist. Any member may remove. */
export function RemoveShortlistButton({
  groupId,
  floorPlanId,
  name,
}: {
  groupId: string;
  floorPlanId: string;
  name: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function remove() {
    setMessage('');
    startTransition(async () => {
      try {
        const result = await removeFromShortlistAction(groupId, floorPlanId);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      } catch {
        setMessage('Could not remove that place. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" aria-label={`Remove ${name} from the shortlist`} loading={pending} onClick={remove}>
        {pending ? 'Removing' : 'Remove'}
      </Button>
      <span role="status" aria-live="polite" className={message ? 'text-sm font-medium text-bad' : 'sr-only'}>
        {message}
      </span>
    </div>
  );
}
