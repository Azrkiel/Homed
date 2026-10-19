// Placeholder landing page. Phase 5 replaces it.
import Link from 'next/link';

export default function Home() {
  return (
    <section className="py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Find next year&apos;s place, calmly.</h1>
      <p className="mt-3 max-w-xl text-ink-2">
        Every option on and off Grounds, ranked by price, walk time to your classes, and how nice it is.
      </p>
      <Link href="/search" className="mt-6 inline-block rounded-full bg-accent px-5 py-2.5 font-medium text-accent-ink">
        Start searching
      </Link>
    </section>
  );
}
