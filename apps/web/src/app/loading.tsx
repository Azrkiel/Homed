import { Card, CardBody, Skeleton, VisuallyHidden } from '@/components/ui';

export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="grid gap-8">
      <VisuallyHidden>Loading</VisuallyHidden>
      <div className="grid gap-3 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardBody className="grid gap-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
