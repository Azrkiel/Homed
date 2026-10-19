import type { Metadata } from 'next';
import { computeCost, type Listing } from '@homed/core';
import { RepoError } from '@homed/db';
import { Button } from '@/components/ui';
import { PropertyIllustration } from '@/components/listing/property-illustration';
import { getRepo } from '@/lib/repo';
import { getCurrentUser } from '@/lib/session';
import { money } from '@/lib/format';
import { computeCatalogStats } from '@/lib/search/stats';

export const metadata: Metadata = { title: 'Homed' };
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  let listings: Listing[] = [];
  let hasSchedule = true;
  try {
    const repo = getRepo();
    listings = await repo.listListings();
    if (user && user.role !== 'landlord') hasSchedule = (await repo.getSchedule(user.id)) !== null;
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
  }
  const stats = computeCatalogStats(listings);
  const cheapest = listings.length > 0 ? Math.min(...listings.map((l) => computeCost(l.floorPlan, l.property).totalMonthly)) : null;

  return (
    <section aria-labelledby="hero-h" className="grid items-center gap-10 py-12 sm:py-20 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="grid gap-6">
      <h1 id="hero-h" className="text-4xl font-semibold tracking-tight text-navy sm:text-5xl">
        Find next year&rsquo;s place.
      </h1>
      <p className="text-lg text-ink-2">On and off Grounds, ranked by price and your walk to class.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button href="/search" size="lg">
          Start searching
        </Button>
        {user && !hasSchedule && (
          <Button href="/classes" size="lg" variant="secondary">
            Add your classes
          </Button>
        )}
      </div>
      {stats.places > 0 && (
        <p className="text-sm text-ink-3">
          {stats.places} places{cheapest !== null && <> &middot; from {money(Math.round(cheapest))}/mo</>}
        </p>
      )}
      </div>
      <div className="hidden aspect-[4/3] overflow-hidden rounded-card md:block">
        <PropertyIllustration kind="on_grounds" seed="Homed" name="a hall on Grounds" showLabel={false} />
      </div>
    </section>
  );
}
