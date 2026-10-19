import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MAX_BATCH_SIZE, type Listing } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Button, EmptyState, PageHeader } from '@/components/ui';
import { BatchBuilder } from '@/components/apply/batch-builder';
import { padRows, placeLabel, roommatesFromMembers, type BuilderPlace } from '@/components/apply/batch-logic';
import { profileCompleteness } from '@/lib/apply/profile-form';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Apply | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

const MAX_PARAM_IDS = 10;
const MAX_SAVED_LOOKUPS = 20;
const MISSING_LABELS: Record<string, string> = {
  legalName: 'legal name',
  phone: 'phone',
  currentAddress: 'current address',
  studentStatus: 'student status',
};

function asList(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter((s) => s !== '');
}

function toPlace(listing: Listing): BuilderPlace {
  return {
    floorPlanId: listing.floorPlan.id,
    label: placeLabel(listing.property.name, listing.floorPlan.name),
    floorPlan: listing.floorPlan,
  };
}

export default async function ApplyNewPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const fpIds = asList(sp.fp);
  const groupParam = asList(sp.group)[0] ?? '';

  const query = new URLSearchParams();
  for (const id of fpIds) query.append('fp', id);
  if (groupParam) query.set('group', groupParam);
  const path = `/apply/new${query.size > 0 ? `?${query.toString()}` : ''}`;

  const user = await requireUser(undefined, path);
  if (effectiveRole(user) === 'landlord') redirect('/');

  let loadError: string | null = null;
  let places: BuilderPlace[] = [];
  let savedOptions: BuilderPlace[] = [];
  let profileMissing: string[] = [];
  let profileComplete = true;
  let groups: { id: string; name: string }[] = [];
  const groupRoommates: Record<string, string[]> = {};
  let initialGroupId = '';

  try {
    const repo = getRepo();

    // Places: valid floor plans only, in URL order, deduped, capped.
    for (const id of fpIds.slice(0, MAX_PARAM_IDS)) {
      if (places.length >= MAX_BATCH_SIZE) break;
      if (places.some((p) => p.floorPlanId === id)) continue;
      const listing = await repo.getListing(id);
      if (listing) places.push(toPlace(listing));
    }
    const placeIds = places.map((p) => p.floorPlanId);

    // Add from saved: saved places not already in the batch.
    const saves = await repo.listSaves(user.id);
    for (const save of saves.slice(0, MAX_SAVED_LOOKUPS)) {
      if (placeIds.includes(save.floorPlanId)) continue;
      const listing = await repo.getListing(save.floorPlanId);
      if (listing) savedOptions.push(toPlace(listing));
    }

    // Profile check: builder still works when incomplete.
    const profile = await repo.getApplicantProfile(user.id);
    const completeness = profileCompleteness(profile);
    profileComplete = completeness.complete;
    profileMissing = completeness.missing;

    // Groups and each group's roommates (other members' emails), for prefill.
    const userGroups = await repo.listGroupsForUser(user.id);
    groups = userGroups.map((g) => ({ id: g.id, name: g.name }));
    for (const g of userGroups) {
      const members = await repo.listMembers(g.id);
      const emails: string[] = [];
      for (const m of members) {
        if (m.userId === user.id) continue;
        const other = await repo.getUser(m.userId);
        if (other) emails.push(other.email);
      }
      groupRoommates[g.id] = roommatesFromMembers(emails, user.email);
    }
    if (groupParam && userGroups.some((g) => g.id === groupParam)) initialGroupId = groupParam;
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load your places right now.';
  }

  const initialRoommates = padRows(groupRoommates[initialGroupId] ?? [], 4);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title="Apply"
        subtitle="Apply to up to three places at once. Everyone sees the same fees before anything is sent."
      />

      {loadError ? (
        <Alert tone="bad" title="Could not load this page">
          {loadError} Please refresh the page in a moment.
        </Alert>
      ) : places.length === 0 ? (
        <EmptyState
          title="Pick a place to apply to"
          body="Open a listing and tap Apply, or choose from the places you saved."
          action={
            <>
              <Button href="/search">Search places</Button>
              <Button href="/saved" variant="secondary">
                Go to saved
              </Button>
            </>
          }
        />
      ) : (
        <>
          {!profileComplete && (
            <Alert tone="warn" title="Finish your applicant profile">
              Still needed: {profileMissing.map((k) => MISSING_LABELS[k] ?? k).join(', ')}.{' '}
              <Link href="/profile/applicant" className="font-medium underline">
                Open your profile
              </Link>{' '}
              You can build your batch now and finish the profile later.
            </Alert>
          )}
          <BatchBuilder
            initialPlaces={places}
            savedOptions={savedOptions}
            leaderEmail={user.email}
            groups={groups}
            groupRoommates={groupRoommates}
            initialGroupId={initialGroupId}
            initialRoommates={initialRoommates}
          />
        </>
      )}
    </div>
  );
}
