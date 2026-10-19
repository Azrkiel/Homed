'use client';
import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { ratePhotoAction } from '@/lib/search/actions';
import { Button } from '@/components/ui';

/** Current mean rating and count as text. */
function summary(rating: number | undefined, count: number): string {
  if (rating === undefined || count === 0) return 'No student ratings yet';
  return `${rating.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`;
}

/** 1-5 radio group for a real photo. Signed-out: a sign-in link back to the listing. */
export function PhotoRating({
  photoId,
  floorPlanId,
  signedIn,
  looksRating,
  ratingCount,
}: {
  photoId: string;
  floorPlanId: string;
  signedIn: boolean;
  looksRating?: number;
  ratingCount: number;
}) {
  const groupName = useId();
  const [value, setValue] = useState<number | null>(null);
  const [current, setCurrent] = useState({ rating: looksRating, count: ratingCount });
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === null) {
      setSaved(false);
      setMessage('Pick a rating from 1 to 5.');
      return;
    }
    setMessage('');
    startTransition(async () => {
      const result = await ratePhotoAction(photoId, value, floorPlanId);
      if (result.ok) {
        setSaved(true);
        setCurrent({ rating: result.looksRating, count: result.ratingCount });
      } else {
        setSaved(false);
        setMessage(result.message);
      }
    });
  }

  return (
    <div className="grid gap-1.5 text-sm">
      <p className="text-ink-2">{summary(current.rating, current.count)}</p>
      {signedIn ? (
        <form onSubmit={submit} className="grid gap-2">
          <fieldset className="min-w-0">
            <legend className="text-ink">How good does this look?</legend>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="relative inline-grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface font-medium text-ink has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-accent-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
                >
                  <input
                    type="radio"
                    name={groupName}
                    value={n}
                    checked={value === n}
                    onChange={() => setValue(n)}
                    className="sr-only"
                  />
                  <span aria-hidden="true">{n}</span>
                  <span className="sr-only">{n} out of 5</span>
                </label>
              ))}
              <Button type="submit" size="sm" variant="secondary" loading={pending}>
                Rate
              </Button>
            </div>
          </fieldset>
          <p role="status" className={message ? 'font-medium text-bad' : saved ? 'text-good' : 'sr-only'}>
            {message || (saved ? 'Thanks, your rating is saved.' : '')}
          </p>
        </form>
      ) : (
        <p>
          <Link
            href={`/signin?next=${encodeURIComponent(`/listings/${floorPlanId}`)}`}
            className="font-medium text-accent underline underline-offset-2"
          >
            Sign in to rate this photo
          </Link>
        </p>
      )}
    </div>
  );
}
