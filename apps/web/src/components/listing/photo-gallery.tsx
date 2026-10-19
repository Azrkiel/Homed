import type { Listing } from '@homed/core';
import { Badge, Card, CardBody, cx } from '@/components/ui';
import { PhotoRating } from './photo-rating';

/** All photos. Renderings are badged and cannot be rated; real photos get a 1-5 rating group. */
export function PhotoGallery({
  photos,
  floorPlanId,
  name,
  signedIn,
  dimmed,
}: {
  photos: Listing['photos'];
  floorPlanId: string;
  name: string;
  signedIn: boolean;
  dimmed?: boolean;
}) {
  const realCount = photos.filter((p) => !p.isRendering).length;
  const renderingsOnly = photos.length > 0 && realCount === 0;

  return (
    <section aria-labelledby="gallery-heading" className="grid gap-3">
      <h2 id="gallery-heading" className="text-xl font-semibold text-ink">
        Photos
      </h2>
      {photos.length === 0 ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-[14rem_1fr] sm:items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/placeholder/building.svg" alt={`No photo yet for ${name}`} className="aspect-[4/3] size-full object-cover" />
            <CardBody>
              <p className="font-medium text-ink">No photos yet.</p>
              <p className="text-sm text-ink-2">Ask the landlord for photos of the actual unit before you apply.</p>
            </CardBody>
          </div>
        </Card>
      ) : (
        <>
          {renderingsOnly && (
            <p className="text-sm text-warn">
              These are renderings, not photos of the real unit. Students can rate real photos once they are added.
            </p>
          )}
          <ul className="grid gap-4 sm:grid-cols-2">
            {photos.map((p) => (
              <li key={p.id}>
                <figure className="grid h-full content-start overflow-hidden rounded-card border border-line bg-surface">
                  <div className="relative aspect-[4/3] bg-surface-2">
                    {/* Remote photo hosts are not known at build time, so a plain img is used. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.alt || `${name} photo`}
                      loading="lazy"
                      className={cx('size-full object-cover', dimmed && 'opacity-60 grayscale')}
                    />
                    {p.isRendering && (
                      <Badge tone="neutral" className="absolute left-2 top-2 bg-surface/90 shadow-card">
                        Rendering
                      </Badge>
                    )}
                  </div>
                  <figcaption className="grid gap-2 p-3">
                    {p.credit ? <p className="text-xs text-ink-2">{p.credit}</p> : null}
                    {p.isRendering ? (
                      <p className="text-sm text-ink-2">Architectural rendering. Not a photo of the real unit.</p>
                    ) : (
                      <PhotoRating
                        photoId={p.id}
                        floorPlanId={floorPlanId}
                        signedIn={signedIn}
                        looksRating={p.looksRating}
                        ratingCount={p.ratingCount}
                      />
                    )}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
