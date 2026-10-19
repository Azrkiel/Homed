import type { Listing } from '@homed/core';
import { Badge, cx } from '@/components/ui';

/** First real photo, else the first rendering (badged), else null. */
export function pickPhoto(photos: Listing['photos']) {
  const real = photos.find((p) => !p.isRendering);
  if (real) return { url: real.url, alt: real.alt, rendering: false };
  const rendering = photos.find((p) => p.isRendering);
  if (rendering) return { url: rendering.url, alt: rendering.alt, rendering: true };
  return null;
}

/** Photo, rendering (with a badge) or the building placeholder. */
export function PhotoOrPlaceholder({
  photos,
  name,
  dimmed,
  className,
}: {
  photos: Listing['photos'];
  name: string;
  dimmed?: boolean;
  className?: string;
}) {
  const photo = pickPhoto(photos);
  return (
    <div className={cx('relative aspect-[4/3] overflow-hidden bg-surface-2', className)}>
      {/* Remote photo hosts are not known at build time, so a plain img is used. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo?.url ?? '/placeholder/building.svg'}
        alt={photo ? photo.alt || name : `No photo yet for ${name}`}
        loading="lazy"
        className={cx('size-full object-cover', dimmed && 'opacity-60 grayscale')}
      />
      {photo?.rendering && (
        <Badge tone="neutral" className="absolute left-2 top-2 bg-surface/90 shadow-card">
          Rendering
        </Badge>
      )}
    </div>
  );
}
