'use client';
import { useState, useTransition } from 'react';
import { createPropertyAlert } from '@/lib/search/actions';
import { Button } from '@/components/ui';

/** "Watch this building": a property alert. Signed-out: a link to sign in that returns to `nextPath`. */
export function WatchButton({
  propertyId,
  signedIn,
  nextPath,
}: {
  propertyId: string;
  signedIn: boolean;
  nextPath: string;
}) {
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button href={`/signin?next=${encodeURIComponent(nextPath)}`} variant="secondary">
        Watch this building
      </Button>
    );
  }

  function onClick() {
    setMessage('');
    startTransition(async () => {
      try {
        const result = await createPropertyAlert(propertyId, nextPath);
        if (result.ok) setDone(true);
        else setMessage(result.message);
      } catch {
        setMessage('Could not create the alert. Try again.');
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        onClick={onClick}
        loading={pending}
        disabled={done}
      >
        {done ? 'Watching this building' : 'Watch this building'}
      </Button>
      <span role="status" className={message ? 'text-xs text-bad' : done ? 'text-xs text-good' : 'sr-only'}>
        {message || (done ? 'Alert created. We will tell you about new listings, price drops and few-left.' : '')}
      </span>
    </span>
  );
}
