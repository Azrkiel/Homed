'use client';

import { Button } from '@/components/ui';

/** Route error boundary. Never shows error.message or the stack; the digest is a reference code for support. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto grid max-w-lg justify-items-center gap-4 py-16 text-center">
      <p className="text-sm font-medium text-bad">Something went wrong</p>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">This page didn&apos;t load.</h1>
      <p className="text-ink-2">Nothing you entered is lost. Try again, or head back and start over.</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button href="/" variant="secondary">
          Go home
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-ink-3">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </section>
  );
}
