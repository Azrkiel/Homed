'use client';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui';
import type { PropertyMarker } from '@/lib/search/results';

const SearchMap = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => <Skeleton className="size-full min-h-80" />,
});

/** Client-only Leaflet map. Region is labelled; the list beside it stays the accessible primary view. */
export function MapWrapper({ markers }: { markers: PropertyMarker[] }) {
  return (
    <div role="region" aria-label="Map of matching places" className="size-full overflow-hidden rounded-card border border-line">
      <SearchMap markers={markers} />
    </div>
  );
}
