// Student reviews for one property: averages, noise tag, published reviews, landlord replies, and the review form.
// Server component. Reviews are anonymous: no reviewer names or ids are rendered.
import Link from 'next/link';
import type { Review } from '@homed/core';
import { getRepo } from '@/lib/repo';
import { effectiveRole, getCurrentUser } from '@/lib/session';
import { noiseTag, summarizeReviews } from '@/lib/reviews/summary';
import { shortDate } from '@/lib/format';
import { Alert, Badge, Card, CardBody, EmptyState } from '@/components/ui';
import { ReviewForm } from './review-form';

const DIMENSIONS = [
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'landlordResponsiveness', label: 'Landlord responsiveness' },
  { key: 'value', label: 'Value' },
] as const;

function ratingLine(r: Review): string {
  const parts = [`Noise ${r.ratings.noise}/5`, `Maintenance ${r.ratings.maintenance}/5`, `Responsiveness ${r.ratings.landlordResponsiveness}/5`, `Value ${r.ratings.value}/5`];
  if (r.ratings.accommodation !== undefined) parts.push(`Accommodation ${r.ratings.accommodation}/5`);
  return parts.join(' · ');
}

export async function ReviewsSection({ propertyId }: { propertyId: string }) {
  const repo = getRepo();
  const published = await repo.listReviews(propertyId);
  const summary = summarizeReviews(published);
  const user = await getCurrentUser();
  const role = user ? effectiveRole(user) : null;

  // Only students can review; check their own review, pending or not, before showing the form.
  let myReview: Review | undefined;
  if (user && role === 'student') {
    const all = await repo.listReviews(propertyId, { includeAll: true });
    myReview = all.find((r) => r.userId === user.id);
  }

  const noise = summary.averages.noise;

  return (
    <section aria-labelledby="reviews-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="reviews-heading" className="text-lg font-semibold text-ink">
          Student reviews
          {summary.count > 0 && <span className="ml-2 text-sm font-normal text-ink-2">({summary.count})</span>}
        </h2>
        {noise !== null && <Badge tone="accent">Noise: {noiseTag(noise)}</Badge>}
      </div>

      {summary.count === 0 ? (
        <EmptyState title="No reviews yet" body="Students who live here can share how it went. Reviews appear after a quick check." />
      ) : (
        <Card>
          <CardBody className="grid gap-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="grid gap-1">
                <dt className="text-sm text-ink-2">Noise</dt>
                <dd className="text-xl font-semibold tabular-nums text-ink">{noise === null ? '-' : `${noise}/5`}</dd>
              </div>
              {DIMENSIONS.map((d) => (
                <div key={d.key} className="grid gap-1">
                  <dt className="text-sm text-ink-2">{d.label}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-ink">
                    {summary.averages[d.key] === null ? '-' : `${summary.averages[d.key]}/5`}
                  </dd>
                </div>
              ))}
            </dl>
            {summary.accommodation && (
              <p className="text-sm text-ink-2">
                Accommodation requests: {summary.accommodation.average}/5 from {summary.accommodation.count}{' '}
                {summary.accommodation.count === 1 ? 'review' : 'reviews'}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {published.length > 0 && (
        <ul className="grid gap-4">
          {published.map((r) => (
            <li key={r.id}>
              <Card as="article">
                <CardBody className="grid gap-3">
                  <div className="grid gap-1">
                    <p className="text-xs text-ink-2">Posted {shortDate(r.createdAt.slice(0, 10))}</p>
                    <p className="text-sm text-ink-2">{ratingLine(r)}</p>
                  </div>
                  <p className="whitespace-pre-line text-ink">{r.text}</p>
                  {r.landlordReply && (
                    <div className="grid gap-1 rounded-sm border-l-2 border-accent bg-surface-2 p-3">
                      <p className="text-sm font-semibold text-ink">Landlord reply</p>
                      <p className="whitespace-pre-line text-sm text-ink">{r.landlordReply}</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!user && (
        <p className="text-sm text-ink-2">
          <Link href="/signin" className="font-medium text-accent underline">
            Sign in with your @virginia.edu email to review
          </Link>
        </p>
      )}

      {user && role === 'student' && myReview?.status === 'pending' && (
        <Alert tone="info" title="Your review is pending moderation">
          It shows here once an admin publishes it.
        </Alert>
      )}

      {user && role === 'student' && myReview && myReview.status !== 'pending' && (
        <p className="text-sm text-ink-2">You have already reviewed this building.</p>
      )}

      {user && role === 'student' && !myReview && <ReviewForm propertyId={propertyId} />}
    </section>
  );
}
