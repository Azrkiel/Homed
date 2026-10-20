import type { Metadata } from 'next';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ConfirmAvailabilityForm } from '@/components/landlord/confirm-availability-form';
import { ListingStatusNote } from '@/components/landlord/listing-status-note';
import { OnboardingForm } from '@/components/landlord/onboarding-form';
import { ReviewReplyForm } from '@/components/landlord/review-reply-form';
import { money, shortDate } from '@/lib/format';
import { availabilityState } from '@/lib/landlord/availability';
import { groupPortfolio } from '@/lib/landlord/portfolio';
import { requireLandlord } from '@/lib/landlord/server';
import { getRepo, today } from '@/lib/repo';

export const metadata: Metadata = { title: 'Landlord dashboard | Homed' };

const RENT_BASIS = { per_bed: 'per person', per_unit: 'per unit' } as const;

export default async function LandlordPage() {
  const { landlord } = await requireLandlord();

  if (!landlord) {
    return (
      <div className="grid gap-6">
        <PageHeader
          eyebrow="Landlords"
          title="Set up your landlord profile"
          subtitle="Set up your landlord profile."
        />
        <OnboardingForm />
      </div>
    );
  }

  const repo = getRepo();
  const now = today();
  const [listings, applications] = await Promise.all([repo.listListings(), repo.listApplicationsForLandlord(landlord.id)]);
  const portfolio = groupPortfolio(listings, landlord.id);
  const reviewRows = (
    await Promise.all(
      portfolio.map(async (g) => (await repo.listReviews(g.property.id)).map((review) => ({ review, name: g.property.name }))),
    )
  ).flat();

  return (
    <div className="grid gap-10">
      <PageHeader
        eyebrow="Landlords"
        title="Landlord dashboard"
        subtitle="Confirm availability weekly."
        actions={
          <>
            <Button href="/landlord/applications" variant="secondary">
              Applications ({applications.length})
            </Button>
            <Button href="/landlord/properties/new">Add a property</Button>
          </>
        }
      />

      <section aria-labelledby="properties-heading" className="grid gap-5">
        <h2 id="properties-heading" className="text-xl font-semibold text-ink">
          Your properties
        </h2>
        {portfolio.length === 0 ? (
          <EmptyState
            title="No properties with floor plans yet"
            body="Add a property, then add its first floor plan. A property with no floor plan is not listed here; open it from the link shown after you create it."
            action={<Button href="/landlord/properties/new">Add a property</Button>}
          />
        ) : (
          portfolio.map((g) => (
            <Card as="section" key={g.property.id} className="overflow-hidden">
              <CardHeader className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1.5">
                  <h3 className="text-lg font-semibold text-ink">{g.property.name}</h3>
                  <p className="text-sm text-ink-2">
                    {g.property.address} · {g.property.neighborhood}
                  </p>
                  <ListingStatusNote dataStatus={g.property.dataStatus} />
                </div>
                <Button href={`/landlord/properties/${g.property.id}`} variant="secondary" size="sm">
                  Edit property<span className="sr-only"> {g.property.name}</span>
                </Button>
              </CardHeader>
              <CardBody>
                <ul className="grid gap-6">
                  {g.floorPlans.map((fp) => {
                    const s = availabilityState(fp, now);
                    return (
                      <li key={fp.id} className="grid gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-semibold text-ink">{fp.name}</h4>
                          <a
                            href={`/landlord/properties/${g.property.id}#floor-plan-${fp.id}`}
                            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                          >
                            Edit floor plan<span className="sr-only"> {fp.name}</span>
                          </a>
                        </div>
                        <p className="text-sm text-ink-2">
                          {money(fp.rentAmount)} a month, {RENT_BASIS[fp.rentBasis]} · {s.unitsText}
                        </p>
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={s.stale ? 'font-medium text-bad' : 'text-ink-2'}>{s.verifiedText}</span>
                          {s.stale && <Badge tone="bad">Stale: confirm now</Badge>}
                        </p>
                        <ConfirmAvailabilityForm
                          propertyId={g.property.id}
                          floorPlanId={fp.id}
                          floorPlanName={fp.name}
                          unitsValue={s.unitsValue}
                        />
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          ))
        )}
      </section>

      <section aria-labelledby="reviews-heading" className="grid gap-5">
        <h2 id="reviews-heading" className="text-xl font-semibold text-ink">
          Reviews
        </h2>
        {reviewRows.length === 0 ? (
          <p className="text-sm text-ink-2">No published reviews yet.</p>
        ) : (
          <ul className="grid gap-4">
            {reviewRows.map(({ review, name }) => (
              <li key={review.id}>
                <Card as="article">
                  <CardBody className="grid gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold text-ink">{name}</h3>
                      <p className="text-xs text-ink-2">Posted {shortDate(review.createdAt)}</p>
                    </div>
                    <p className="text-sm text-ink-2">
                      Noise {review.ratings.noise}/5 · Maintenance {review.ratings.maintenance}/5 · Responsiveness{' '}
                      {review.ratings.landlordResponsiveness}/5 · Value {review.ratings.value}/5
                      {review.ratings.accommodation !== undefined ? ` · Accommodation ${review.ratings.accommodation}/5` : ''}
                    </p>
                    <p className="whitespace-pre-line text-ink">{review.text}</p>
                    {review.landlordReply ? (
                      <div className="rounded-sm bg-surface-2 p-3">
                        <p className="text-xs font-semibold text-ink-2">Your reply</p>
                        <p className="whitespace-pre-line text-sm text-ink">{review.landlordReply}</p>
                      </div>
                    ) : (
                      <ReviewReplyForm reviewId={review.id} />
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
