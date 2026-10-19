import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEFAULT_WEIGHTS, computeCost, isStale, normalizeWeights, weeklyMeetings, type Listing, type RankedListing } from '@homed/core';
import type { Building, Landmark, WalkTime, WeeklyMeeting } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Badge, Disclosure } from '@/components/ui';
import { AddToGroupButton } from '@/components/groups/add-to-group-button';
import { ApplyButton } from '@/components/apply/apply-button';
import { ReviewsSection } from '@/components/reviews/reviews-section';
import { AccessibilitySection } from '@/components/listing/accessibility-section';
import { CostTable } from '@/components/listing/cost-table';
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">{property.name}</h1>
          <p className="text-ink-2">
            {floorPlan.name} &middot; {property.neighborhood}
            {property.dataStatus === 'unverified_seed' && (
              <Badge tone="warn" className="ml-2 align-middle">
                Unverified
              </Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveToggle floorPlanId={floorPlan.id} name={title} saved={saved} signedIn={signedIn} nextPath={basePath} />
          <ApplyButton floorPlanId={floorPlan.id} />
        </div>
      </header>

      {stale && (
        <Alert tone="warn">
          <StaleNotice lastVerified={floorPlan.lastVerified} today={todayIso} />
        </Alert>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 gap-6">
          <PhotoGallery photos={photos} kind={property.kind} floorPlanId={floorPlan.id} name={property.name} signedIn={signedIn} dimmed={stale} />
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

          <div>
            <Disclosure title="Accessibility">
              <AccessibilitySection info={accessibility} onGrounds={onGrounds} />
            </Disclosure>
            {others.length > 0 && (
              <Disclosure title="Other floor plans" meta={others.length}>
                <OtherFloorPlans plans={others} propertyName={property.name} />
              </Disclosure>
            )}
            <Disclosure title="Reviews">
              <ReviewsSection propertyId={property.id} nextPath={basePath} />
            </Disclosure>
            <Disclosure title="Source">
              <div className="grid gap-1 text-sm text-ink-2">
                {property.source === LANDLORD_SOURCE ? <ListingStatusNote dataStatus={property.dataStatus} /> : <p className="break-words">{property.source}</p>}
                <StaleNotice lastVerified={floorPlan.lastVerified} today={todayIso} />
              </div>
            </Disclosure>
          </div>
        </div>

        <aside aria-label="Cost and match" className="grid min-w-0 gap-4 lg:sticky lg:top-20">
          <CostTable cost={cost} floorPlan={floorPlan} property={property} includeParking={includeParking} basePath={basePath} />
          <ScoreBreakdown score={score} weights={weights} renderingsOnly={renderingsOnly} personal={signedIn} />
          <div className="flex flex-wrap gap-2">
            <AddToGroupButton floorPlanId={floorPlan.id} />
            <WatchButton propertyId={property.id} signedIn={signedIn} nextPath={basePath} />
          </div>
        </aside>
      </div>
    </div>
  );
}
