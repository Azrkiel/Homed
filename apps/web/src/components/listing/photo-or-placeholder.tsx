import type { Listing, PropertyKind } from '@homed/core';
import { Badge, cx } from '@/components/ui';
import { isPlaceholderPhoto, PropertyIllustration } from './property-illustration';

/** First real photo, else the first rendering (badged), else null. Placeholder images don't count. */
export function pickPhoto(photos: Listing['photos']) {
  const usable = photos.filter((p) => !isPlaceholderPhoto(p.url));
  const real = usable.find((p) => !p.isRendering);
  if (real) return { url: real.url, alt: real.alt, rendering: false };
  const rendering = usable.find((p) => p.isRendering);
  if (rendering) return { url: rendering.url, alt: rendering.alt, rendering: true };
  return null;
}

/** Photo, rendering (with a badge) or a drawn illustration of the kind of place. */
export function PhotoOrPlaceholder({
  photos,
  name,
  kind,
  dimmed,
  className,
}: {
  photos: Listing['photos'];
  name: string;
  kind: PropertyKind;
  dimmed?: boolean;
  className?: string;
}) {
  const photo = pickPhoto(photos);
  return (
    <div className={cx('relative aspect-[4/3] overflow-hidden bg-surface-2', className)}>
      {photo ? (
        <>
          {/* Remote photo hosts are not known at build time, so a plain img is used. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.alt || name}
            loading="lazy"
            className={cx('size-full object-cover', dimmed && 'opacity-60 grayscale')}
          />
          {photo.rendering && (
            <Badge tone="neutral" className="absolute left-2 top-2 bg-surface/90 shadow-card">
              Rendering
            </Badge>
          )}
        </>
      ) : (
        <PropertyIllustration kind={kind} seed={name} name={name} showLabel={false} className={cx('absolute inset-0', dimmed && 'opacity-60 grayscale')} />
      )}
    </div>
  );
}
