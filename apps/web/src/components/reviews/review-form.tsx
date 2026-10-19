'use client';
import { useState, useTransition, type FormEvent } from 'react';
import { Alert, Button, Card, CardBody, Field, Select, Textarea } from '@/components/ui';
import { submitReview } from '@/lib/reviews/actions';
import { REVIEW_MAX_CHARS } from '@/lib/reviews/summary';

const RATINGS = [
  { name: 'noise', label: 'Noise (1 = loud, 5 = quiet)' },
  { name: 'maintenance', label: 'Maintenance' },
  { name: 'landlordResponsiveness', label: 'Landlord responsiveness' },
  { name: 'value', label: 'Value for the price' },
] as const;

/** Anonymous student review. The server action validates; a success shows the pending notice. */
export function ReviewForm({ propertyId }: { propertyId: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('propertyId', propertyId);
    startTransition(async () => {
      const result = await submitReview(fd);
      if (result.ok) {
        setSubmitted(true);
        setMessage(null);
      } else {
        setMessage(result.message);
      }
    });
  }

  if (submitted) {
    return (
      <Alert tone="good" title="Thanks for reviewing">
        Your review is pending moderation. It shows here once an admin publishes it.
      </Alert>
    );
  }

  return (
    <Card as="section" aria-labelledby="review-form-heading">
      <CardBody className="grid gap-5">
        <h3 id="review-form-heading" className="text-base font-semibold text-ink">
          Review this building
        </h3>
        <p className="text-sm text-ink-2">Reviews are anonymous. New reviews are checked by an admin before they appear.</p>
        {message && <Alert tone="bad">{message}</Alert>}
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {RATINGS.map((r) => (
              <Field key={r.name} id={`review-${r.name}`} label={r.label} required>
                {(a) => (
                  <Select {...a} name={r.name} defaultValue="" required>
                    <option value="" disabled>
                      Choose 1 to 5
                    </option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ))}
            <Field id="review-accommodation" label="Accommodation request (optional)" hint="Leave blank if you did not request one.">
              {(a) => (
                <Select {...a} name="accommodation" defaultValue="">
                  <option value="">Not applicable</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Field id="review-text" label="Your review" required hint={`Up to ${REVIEW_MAX_CHARS} characters.`}>
            {(a) => <Textarea {...a} name="text" rows={5} maxLength={REVIEW_MAX_CHARS} />}
          </Field>
          <div>
            <Button type="submit" loading={pending}>
              Post review
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
