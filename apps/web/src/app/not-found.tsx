import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <section className="mx-auto grid max-w-lg justify-items-center gap-4 py-16 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">We couldn&apos;t find that page.</h1>
      <p className="text-ink-2">
        The link may be old, or the listing may be gone. Try a new search from here.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button href="/search">Search listings</Button>
        <Button href="/" variant="secondary">
          Back to home
        </Button>
      </div>
    </section>
  );
}
