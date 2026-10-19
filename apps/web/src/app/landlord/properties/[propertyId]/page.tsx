import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Alert, Badge, Button, Card, CardBody, PageHeader } from '@/components/ui';
import { AccessibilityForm } from '@/components/landlord/accessibility-form';
import { DeleteFloorPlanForm, FloorPlanForm } from '@/components/landlord/floor-plan-form';
import { ListingStatusNote } from '@/components/landlord/listing-status-note';
import { PropertyForm } from '@/components/landlord/property-form';
import { PhotoAddForm, PhotoDeleteForm } from '@/components/landlord/photo-forms';
import { ownsProperty } from '@/lib/landlord/access';
import { requireLandlord } from '@/lib/landlord/server';
import { getRepo } from '@/lib/repo';
import { effectiveRole } from '@/lib/session';
import type { FloorPlan, Photo } from '@homed/core';

export const metadata: Metadata = { title: 'Edit property | Homed' };

type Props = {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Property editor: details, floor plans, photos, accessibility. Not found (not forbidden) for other landlords' properties. */
export default async function EditPropertyPage({ params, searchParams }: Props) {
  const { propertyId } = await params;
  const query = await searchParams;
  const { user, landlord } = await requireLandlord();
  const repo = getRepo();
  const property = await repo.getProperty(propertyId);
  if (!property || !ownsProperty(landlord, property, effectiveRole(user))) notFound();

  // Floor plans, photos and accessibility come through listings. A property with no floor plan has no listing,
  // so those sections stay empty until its first floor plan is saved (see groupPortfolio).
  const listings = await repo.listPropertyListings(propertyId);
  const floorPlans: FloorPlan[] = [];
  for (const l of listings) if (!floorPlans.some((f) => f.id === l.floorPlan.id)) floorPlans.push(l.floorPlan);
  floorPlans.sort((a, b) => a.name.localeCompare(b.name));
  const photoMap = new Map<string, Photo>();
  for (const l of listings) for (const p of l.photos) if (p.propertyId === propertyId) photoMap.set(p.id, p);
  const photos = [...photoMap.values()];
  const accessibility = listings.find((l) => l.accessibility)?.accessibility;

  return (
    <div className="grid gap-12">
      <PageHeader
        eyebrow="Edit property"
        title={property.name}
        subtitle={property.address}
        actions={
          <>
            <Button href="#new-floor-plan" variant="secondary">
              Add a floor plan
            </Button>
            <Button href="/landlord" variant="ghost">
              Back to dashboard
            </Button>
          </>
        }
      />

      {query.created === '1' && (
        <Alert tone="good">Property saved. Next, add its first floor plan below.</Alert>
      )}

      <section aria-labelledby="details-heading" className="grid gap-6">
        <div className="grid gap-2">
          <h2 id="details-heading" className="text-xl font-semibold text-ink">
            Property details
          </h2>
          <ListingStatusNote dataStatus={property.dataStatus} />
        </div>
        <Card>
          <CardBody>
            <PropertyForm property={property} />
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="floor-plans-heading" className="grid gap-6">
        <h2 id="floor-plans-heading" className="text-xl font-semibold text-ink">
          Floor plans
        </h2>
        {floorPlans.length === 0 ? (
          <p className="text-sm text-ink-2">No floor plans yet. Add one below. Students see a property only through its floor plans.</p>
        ) : (
          floorPlans.map((fp) => (
            <details key={fp.id} id={`floor-plan-${fp.id}`} className="group rounded-card border border-line bg-surface">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-4 font-semibold text-ink">
                <span>{fp.name}</span>
                <Badge tone="neutral">Edit</Badge>
              </summary>
              <div className="grid gap-8 border-t border-line px-5 py-6">
                <FloorPlanForm propertyId={propertyId} floorPlan={fp} />
                <DeleteFloorPlanForm propertyId={propertyId} floorPlanId={fp.id} name={fp.name} />
              </div>
            </details>
          ))
        )}

        <Card as="section" className="scroll-mt-24">
          <div id="new-floor-plan" className="scroll-mt-24" />
          <CardBody className="grid gap-4">
            <h3 className="text-lg font-semibold text-ink">Add a floor plan</h3>
            <FloorPlanForm propertyId={propertyId} />
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="photos-heading" className="grid gap-6">
        <h2 id="photos-heading" className="text-xl font-semibold text-ink">
          Photos
        </h2>
        <p className="text-sm text-ink-2">
          Add photos by link. Mark architectural drawings and renderings as renderings so students do not mistake them for real units.
        </p>
        {photos.length > 0 && (
          <ul className="grid gap-3">
            {photos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
                <div className="grid min-w-0 gap-1">
                  <p className="text-sm font-medium text-ink">{p.alt}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                    {p.isRendering && <Badge tone="warn">Rendering</Badge>}
                    {p.floorPlanId ? `Floor plan: ${floorPlans.find((f) => f.id === p.floorPlanId)?.name ?? 'unknown'}` : 'Whole property'}
                    {p.credit ? ` · ${p.credit}` : ''}
                  </p>
                  <a href={p.url} className="truncate text-xs text-accent underline-offset-4 hover:underline" rel="noopener noreferrer" target="_blank">
                    {p.url}
                  </a>
                </div>
                <PhotoDeleteForm propertyId={propertyId} photoId={p.id} alt={p.alt} />
              </li>
            ))}
          </ul>
        )}
        <Card>
          <CardBody>
            <PhotoAddForm propertyId={propertyId} floorPlans={floorPlans.map((f) => ({ id: f.id, name: f.name }))} />
          </CardBody>
        </Card>
      </section>

      <section aria-labelledby="a11y-heading" className="grid gap-6">
        <h2 id="a11y-heading" className="text-xl font-semibold text-ink">
          Accessibility and accommodations
        </h2>
        <Card>
          <CardBody>
            <AccessibilityForm propertyId={propertyId} info={accessibility} />
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
