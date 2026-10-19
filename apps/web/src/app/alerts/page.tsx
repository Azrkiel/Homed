import type { Metadata } from 'next';
import type { Alert, AlertEvent, Listing } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert as Notice, Badge, Button, Card, CardBody, EmptyState, PageHeader } from '@/components/ui';
import { DeleteAlertButton, MarkAllReadButton, MarkReadButton } from '@/components/alerts/alert-buttons';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { activeFilterEntries } from '@/lib/search/describe';
import { searchHref } from '@/lib/search/href';
import { eventDate, eventListingHref, sortEventsNewestFirst, triggerLabel } from '@/lib/search/alerts';
import { localDate, shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Alerts | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

const HOW =
  'Create alerts from Search ("Alert me about new matches") or from a listing ("Watch this building"). Updates show up here in the app; we do not send email.';

export default async function AlertsPage() {
  const user = await requireUser(undefined, '/alerts');
  const repo = getRepo();

  let events: AlertEvent[] = [];
  let alerts: Alert[] = [];
  let listings: Listing[] = [];
  const names = new Map<string, string>();
  let loadError: string | null = null;
  try {
    events = sortEventsNewestFirst(await repo.listAlertEvents(user.id));
    alerts = await repo.listAlerts(user.id);
    listings = await repo.listListings();
    for (const a of alerts) {
      if (a.target.kind === 'property' && !names.has(a.target.propertyId)) {
        const p = await repo.getProperty(a.target.propertyId);
        if (p) names.set(p.id, p.name);
      }
    }
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load your alerts right now.';
  }

  const unread = events.filter((e) => !e.readAt).length;

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Alerts"
        subtitle="Updates on places and searches you are watching. They show up here in the app; we do not send email."
        className="pb-0"
      />

      {loadError && (
        <Notice tone="bad" title="Could not load your alerts">
          {loadError} Please refresh the page in a moment.
        </Notice>
      )}

      <section aria-labelledby="updates-h" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="updates-h" className="text-xl font-semibold text-ink">
            Updates{unread > 0 ? ` (${unread} unread)` : ''}
          </h2>
          {unread > 0 && <MarkAllReadButton />}
        </div>
        {events.length === 0 ? (
          <EmptyState title="No updates yet" body={HOW} action={<Button href="/search">Search places</Button>} />
        ) : (
          <ul className="grid gap-3">
            {events.map((e) => {
              const href = eventListingHref(e, listings);
              const isNew = !e.readAt;
              return (
                <li key={e.id}>
                  <Card className={isNew ? 'border-accent' : undefined}>
                    <CardBody className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isNew && <Badge tone="accent">New</Badge>}
                        <Badge tone={e.trigger === 'price_drop' ? 'good' : e.trigger === 'few_left' ? 'warn' : 'neutral'}>
                          {triggerLabel(e.trigger)}
                        </Badge>
                        <span className="text-sm text-ink-2">{eventDate(e.createdAt)}</span>
                      </div>
                      <p className={isNew ? 'font-semibold text-ink' : 'text-ink'}>{e.message}</p>
                      <div className="flex flex-wrap items-center gap-3">
                        {href && (
                          <Button href={href} size="sm" variant="ghost">
                            View listing
                          </Button>
                        )}
                        {isNew && <MarkReadButton eventId={e.id} />}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="yours-h" className="grid gap-4">
        <h2 id="yours-h" className="text-xl font-semibold text-ink">
          Your alerts
        </h2>
        {alerts.length === 0 ? (
          <EmptyState title="No alerts yet" body={HOW} action={<Button href="/search">Search places</Button>} />
        ) : (
          <ul className="grid gap-3">
            {alerts.map((a) => {
              const t = a.target;
              const name =
                t.kind === 'property'
                  ? (names.get(t.propertyId) ??
                    listings.find((l) => l.property.id === t.propertyId)?.property.name ??
                    'a building that is no longer listed')
                  : '';
              const entries = t.kind === 'search' ? activeFilterEntries(t.filters) : [];
              return (
                <li key={a.id}>
                  <Card>
                    <CardBody className="grid gap-2">
                      {t.kind === 'property' ? (
                        <p className="font-semibold text-ink">Building: {name}</p>
                      ) : (
                        <>
                          <p className="font-semibold text-ink">Search</p>
                          <p className="text-sm text-ink-2">
                            {entries.length > 0 ? entries.map((x) => x.label).join(' · ') : 'All places (no filters)'}
                          </p>
                          <div>
                            <Button href={searchHref(t.filters)} size="sm" variant="ghost">
                              Open this search
                            </Button>
                          </div>
                        </>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-ink-2">Tells you about:</span>
                        {a.triggers.map((tr) => (
                          <Badge key={tr}>{triggerLabel(tr)}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-ink-2">Created {shortDate(localDate(a.createdAt))}</p>
                      <DeleteAlertButton alertId={a.id} label={t.kind === 'property' ? name : `search alert, ${entries.length > 0 ? entries.map((x) => x.label).join(', ') : 'all places'}`} />
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
