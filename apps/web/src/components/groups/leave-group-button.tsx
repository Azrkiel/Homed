'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { leaveGroupAction } from '@/lib/groups/actions';

/** Two steps: "Leave group" opens a confirm step, then the leave runs and the user goes to /groups. */
export function LeaveGroupButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function leave() {
    setMessage('');
    startTransition(async () => {
      try {
        const result = await leaveGroupAction(groupId);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.push('/groups');
      } catch {
        setMessage('Could not leave the group. Please try again.');
      }
    });
  }

  return (
    <div className="grid gap-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink">Leave {groupName}? You will lose access to its shortlist and votes.</p>
          <Button variant="danger" size="sm" loading={pending} onClick={leave}>
            {pending ? 'Leaving' : 'Yes, leave group'}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Leave group
          </Button>
        </div>
      )}
      <p role="status" aria-live="polite" className={message ? 'text-sm font-medium text-bad' : 'sr-only'}>
        {message}
      </p>
    </div>
  );
}
