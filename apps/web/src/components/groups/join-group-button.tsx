'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui';
import { joinGroupAction } from '@/lib/groups/actions';

/** Joins by invite code, then opens the group. Errors (for example a full group) show next to the button. */
export function JoinGroupButton({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError('');
    startTransition(async () => {
      try {
        const result = await joinGroupAction(code);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.push(`/groups/${result.groupId}`);
      } catch {
        setError('Could not join the group. Please try again.');
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div>
        <Button onClick={onClick} loading={pending}>
          {pending ? 'Joining' : 'Join group'}
        </Button>
      </div>
      <p role="status" aria-live="polite" className={error ? 'text-sm font-medium text-bad' : 'sr-only'}>
        {error}
      </p>
    </div>
  );
}
