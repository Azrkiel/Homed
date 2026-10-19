import type { Metadata } from 'next';
import type { Listing } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, Button, Card, CardBody, Stat } from '@/components/ui';
import { getRepo } from '@/lib/repo';
import { getCurrentUser } from '@/lib/session';
import { money, plural, shortDate } from '@/lib/format';
import { computeCatalogStats, waitingSignal } from '@/lib/search/stats';

export const metadata: Metadata = { title: 'Homed: find next year’s place, calmly' };
export const dynamic = 'force-dynamic';

const STEPS = [
  { title: 'Add your classes', body: 'Enter your schedule or pick your major. We work out how far you walk each week.' },
  { title: 'Set what matters', body: 'Price, location and looks. Move the sliders or pick a preset; hard filters never get overridden.' },
  { title: 'Swipe, compare, save', body: 'Swipe through matches, compare up to four side by side, and save the ones you like.' },
];

export default async function Home() {
  const user = await getCurrentUser();
  let listings: Listing[] = [];
  let catalogError = false;
  let hasSchedule = true;
  try {
    const repo = getRepo();
    listings = await repo.listListings();
    if (user && user.role !== 'landlord') hasSchedule = (await repo.getSchedule(user.id)) !== null;
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    catalogError = true;
  }
  const stats = computeCatalogStats(listings);
  const signal = waitingSignal(stats);
  const firstName = user?.name.trim().split(/\s+/)[0];

  return (
    <div className="grid gap-12 py-6 sm:py-10">
      <section aria-labelledby="hero-h" className="grid gap-5">
        {firstName && <p className="text-sm font-medium text-accent">Welcome back, {firstName}</p>}
        <h1 id="hero-h" className="max-w-3xl text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
          Every option on and off Grounds, ranked by all-in price, walk time to your classes, and how nice it is.
        </h1>
        <p className="max-w-2xl text-lg text-ink-2">
          Second-years are pushed to sign leases early. Homed shows you the whole market, honestly, so you can take your time.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button href="/search" size="lg">
            Start searching
          </Button>
          <Button href="/classes" size="lg" variant="secondary">
            Add your classes
          </Button>
          {user && hasSchedule && (
            <Button href="/match" size="lg" variant="ghost">
              Continue to your matches
            </Button>
          )}
        </div>
        {user && !hasSchedule && (
          <Alert tone="info" title="Add your classes for better matches">
            We rank by walk time to your classes. Add them in <a className="underline" href="/classes">My Classes</a> and your results update.
          </Alert>
        )}
      </section>

      <section aria-labelledby="steps-h" className="grid gap-4">
        <h2 id="steps-h" className="text-2xl font-semibold text-ink">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <CardBody className="grid gap-2">
                  <span
                    aria-hidden="true"
                    className="grid size-8 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                  >
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="text-sm text-ink-2">{s.body}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="stats-h" className="grid gap-4">
        <h2 id="stats-h" className="text-2xl font-semibold text-ink">
          Is waiting safe?
        </h2>
        {catalogError ? (
          <Alert tone="warn" title="Catalog numbers are unavailable">
            We could not load the catalog right now. Search should work again shortly.
          </Alert>
        ) : (
          <Card>
            <CardBody className="grid gap-5">
              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                <Stat label="Places" value={stats.places} hint={plural(stats.floorPlans, 'floor plan')} />
                <Stat
                  label="Still list open units"
                  value={stats.placesOpen}
                  hint={stats.placesUnknown > 0 ? `${stats.placesUnknown} did not say` : 'of the places above'}
                  tone={signal.tone === 'good' ? 'good' : signal.tone === 'warn' ? 'warn' : 'default'}
                />
                <Stat
                  label="Median all-in cost"
                  value={stats.medianMonthly === null ? 'n/a' : money(stats.medianMonthly)}
                  hint="per person, per month"
                />
                <Stat
                  label="Data last verified"
                  value={stats.lastVerified ? shortDate(stats.lastVerified) : 'n/a'}
                  hint="most recent check"
                />
              </div>
              <p className="text-ink">{signal.text}</p>
            </CardBody>
          </Card>
        )}
      </section>

      <section aria-label="Our commitments">
        <ul className="grid gap-3 rounded-card border border-line bg-surface-2 p-5 text-sm text-ink-2 md:grid-cols-3">
          <li>Paid placement never changes the Best Match score.</li>
          <li>No filters on protected classes. Fair housing applies to everyone.</li>
          <li>
            Free lease review before you sign: <a className="underline" href="/about">see About</a>.
          </li>
        </ul>
      </section>
    </div>
  );
}
