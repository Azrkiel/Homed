import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEFAULT_WEIGHTS, computeCost, isStale, normalizeWeights, weeklyMeetings, type Listing, type RankedListing } from '@homed/core';
import type { Building, Landmark, WalkTime, WeeklyMeeting } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Badge, PageHeader, ScoreRing } from '@/components/ui';
import { AddToGroupButton } from '@/components/groups/add-to-group-button';
import { ApplyButton } from '@/components/apply/apply-button';
import { ReviewsSection } from '@/components/reviews/reviews-section';
import { AccessibilitySection } from '@/components/listing/accessibility-section';
import { CostLine } from '@/components/listing/cost-line';
import { CostTable } from '@/components/listing/cost-table';
import { ListingBadges } from '@/components/listing/listing-badges';
import { ListingFacts } from '@/components/listing/listing-facts';
import { OnGroundsBox } from '@/components/listing/on-grounds-box';
import { OtherFloorPlans } from '@/components/listing/other-floor-plans';
import { PhotoGallery } from '@/components/listing/photo-gallery';
import { SaveToggle } from '@/components/listing/save-toggle';
import { ScoreBreakdown } from '@/components/listing/score-breakdown';
import { StaleNotice } from '@/components/listing/stale-notice';
import { WalkTimes } from '@/components/listing/walk-times';
import { WatchButton } from '@/components/listing/watch-button';
import { ListingStatusNote } from '@/components/landlord/listing-status-note';
import { LANDLORD_SOURCE } from '@/lib/landlord/forms';
import { getRankedListing } from '@/lib/ranking';
import { getRepo, today } from '@/lib/repo';
import { getCurrentUser } from '@/lib/session';
import { busNote, classWalkRows, landmarkWalkRows, parkingFromParam } from '@/lib/search/listing-detail';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ floorPlanId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { floorPlanId } = await params;
  try {
    const listing = await getRepo().getListing(floorPlanId);
    if (listing) return { title: `${listing.property.name} ${listing.floorPlan.name} | Homed` };
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
  }
  return { title: 'Listing | Homed' };
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { floorPlanId } = await params;
  const query = await searchParams;
  const includeParking = parkingFromParam(query.parking);
  const user = await getCurrentUser();
  const signedIn = user !== null;
  const basePath = `/listings/${floorPlanId}`;

  let ranked: RankedListing | null;
  let others: Listing[] = [];
  let buildings: Building[] = [];
  let landmarks: Landmark[] = [];
  let walks: WalkTime[] = [];
  let meetings: WeeklyMeeting[] = [];
  let saved = false;
  try {
    const repo = getRepo();
    ranked = await getRankedListing(user, floorPlanId);
    if (ranked) {
      const propertyId = ranked.listing.property.id;
      const [siblings, b, l, w, schedule, majors, saves] = await Promise.all([
        repo.listPropertyListings(propertyId),
        repo.listBuildings(),
        repo.listLandmarks(),
        repo.listWalkTimes([propertyId]),
        user ? repo.getSchedule(user.id) : Promise.resolve(null),
        repo.listMajors(),
        user ? repo.listSaves(user.id) : Promise.resolve([]),
      ]);
      others = siblings.filter((s) => s.floorPlan.id !== floorPlanId);
      buildings = b;
      landmarks = l;
      walks = w;
      meetings = weeklyMeetings(schedule, majors);
      saved = saves.some((s) => s.floorPlanId === floorPlanId);
    }
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    return (
      <div className="mx-auto grid max-w-lg gap-4 py-12">
        <Alert tone="bad" title="We could not load this listing">
          {e.message || 'Something went wrong on our side.'} Please try again in a moment.
        </Alert>
      </div>
    );
  }
  if (!ranked) notFound();

  const { listing, score } = ranked;
  const { property, floorPlan, photos, accessibility } = listing;
  const todayIso = today();
  const stale = isStale(floorPlan.lastVerified, todayIso);
  const cost = computeCost(floorPlan, property, { includeParking });
  const weights = user ? normalizeWeights(user.weights) : { ...DEFAULT_WEIGHTS };
  const renderingsOnly = score.badges.includes('renderings_only');
  const onGrounds = property.kind === 'on_grounds';
  const classes = classWalkRows(meetings, buildings, walks, property.id);
  const landmarkRows = landmarkWalkRows(landmarks, walks, property.id);
  const title = `${property.name}, ${floorPlan.name}`;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={property.neighborhood}
        title={property.name}
        subtitle={`${floorPlan.name} · ${property.address}`}
        className="pb-0"
        actions={
          <>
            <AddToGroupButton floorPlanId={floorPlan.id} />
            <ApplyButton floorPlanId={floorPlan.id} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <ScoreRing score={score.total} size="md" />
        <div className="grid gap-1">
          <CostLine total={cost.totalMonthly} />
          <ListingBadges badges={score.badges} kind={property.kind} />
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:ml-auto">
          <SaveToggle floorPlanId={floorPlan.id} name={title} saved={saved} signedIn={signedIn} nextPath={basePath} />
          <WatchButton propertyId={property.id} signedIn={signedIn} nextPath={basePath} />
        </div>
      </div>

      {property.dataStatus === 'unverified_seed' && (
        <Alert tone="warn" title="Unverified listing">
          This listing has not been confirmed with the landlord. Check the price, dates and availability before you apply.
        </Alert>
      )}
      {stale && (
        <Alert tone="warn" title="This listing may be out of date">
          <StaleNotice lastVerified={floorPlan.lastVerified} today={todayIso} />
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 gap-6">
          <PhotoGallery photos={photos} floorPlanId={floorPlan.id} name={property.name} signedIn={signedIn} dimmed={stale} />
          <ListingFacts floorPlan={floorPlan} property={property} />
          <WalkTimes
            classes={classes}
            landmarks={landmarkRows}
            hasClasses={meetings.length > 0}
            signedIn={signedIn}
            busNote={busNote(property.onBusRoute, property.busRoutes)}
            nextPath={basePath}
          />
          {onGrounds && <OnGroundsBox info={property.onGroundsInfo} />}
          <AccessibilitySection info={accessibility} onGrounds={onGrounds} />
          <OtherFloorPlans plans={others} propertyName={property.name} />
          <section aria-labelledby="source-heading" className="grid gap-1 text-sm text-ink-2">
            <h2 id="source-heading" className="text-base font-semibold text-ink">
              Data source
            </h2>
            {property.source === LANDLORD_SOURCE ? (
              <ListingStatusNote dataStatus={property.dataStatus} />
            ) : (
              <p>
                Source: {property.source}.{' '}
                {property.dataStatus === 'verified' ? <Badge tone="good">Verified data</Badge> : <Badge tone="warn">Unverified</Badge>}
              </p>
            )}
            <StaleNotice lastVerified={floorPlan.lastVerified} today={todayIso} />
          </section>
          <ReviewsSection propertyId={property.id} nextPath={basePath} />
        </div>

        <aside aria-label="Cost and match summary" className="grid min-w-0 gap-6 lg:sticky lg:top-4">
          <CostTable cost={cost} floorPlan={floorPlan} property={property} includeParking={includeParking} basePath={basePath} />
          <ScoreBreakdown score={score} weights={weights} renderingsOnly={renderingsOnly} personal={signedIn} />
        </aside>
      </div>
    </div>
  );
}
