import { Skeleton, VisuallyHidden } from '@/components/ui';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="grid gap-5">
      <VisuallyHidden>Loading places</VisuallyHidden>
      <div className="grid gap-3">
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className="grid gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-card border border-line bg-surface sm:flex-row">
              <Skeleton className="aspect-[4/3] w-full rounded-none sm:w-44" />
              <div className="grid flex-1 content-start gap-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="hidden h-[60dvh] rounded-card md:block" />
      </div>
    </div>
  );
}
