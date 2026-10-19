'use client';
import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { toggleSave } from '@/lib/search/actions';
import { cx } from '@/components/ui';

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.4 3.3 4.2 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
    </svg>
  );
}

const BTN =
  'inline-grid size-10 place-items-center rounded-full border border-line bg-surface transition-colors hover:bg-surface-2';

/**
 * Heart button. Signed-out: a link to sign in that returns to `nextPath`.
 * Signed-in: optimistic toggle via the toggleSave server action.
 */
export function SaveToggle({
  floorPlanId,
  name,
  saved,
  signedIn,
  nextPath = '/search',
  className,
}: {
  floorPlanId: string;
  name: string;
  saved: boolean;
  signedIn: boolean;
  nextPath?: string;
  className?: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(saved, (_current, next: boolean) => next);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');

  if (!signedIn) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(nextPath)}`}
        aria-label={`Sign in to save ${name}`}
        title="Sign in to save"
        className={cx(BTN, 'text-ink-2', className)}
      >
        <Heart filled={false} />
      </Link>
    );
  }

  function onClick() {
    const next = !optimistic;
    setMessage('');
    startTransition(async () => {
      setOptimistic(next);
      const result = await toggleSave(floorPlanId, nextPath);
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <span className={cx('inline-flex flex-col items-end', className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={optimistic}
        aria-busy={pending || undefined}
        aria-label={optimistic ? `Remove ${name} from saved` : `Save ${name}`}
        className={cx(BTN, optimistic ? 'border-accent text-accent' : 'text-ink-2')}
      >
        <Heart filled={optimistic} />
      </button>
      <span role="status" className={message ? 'mt-1 max-w-40 text-xs text-bad' : 'sr-only'}>
        {message}
      </span>
    </span>
  );
}
