import { Skeleton, VisuallyHidden } from '@/components/ui';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="grid gap-6">
      <VisuallyHidden>Loading listing</VisuallyHidden>
      <div className="grid gap-3">
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-4">
          <Skeleton className="aspect-[16/9] w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-72 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
