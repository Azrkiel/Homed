import type { Metadata } from 'next';
import { EmptyState, PageHeader } from '@/components/ui';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { ModerationList, type PendingReviewRow } from './moderation-list';

export const metadata: Metadata = { title: 'Review moderation | Homed' };

export default async function AdminReviewsPage() {
  const user = await requireUser('admin', '/admin/reviews');
  if (effectiveRole(user) !== 'admin') return null;

  const repo = getRepo();
  const pending = await repo.listPendingReviews();
  const names = new Map<string, string>();
  for (const id of new Set(pending.map((r) => r.propertyId))) {
    names.set(id, (await repo.getProperty(id))?.name ?? 'Unknown property');
  }
  const rows: PendingReviewRow[] = pending.map((r) => ({
    id: r.id,
    propertyName: names.get(r.propertyId) ?? 'Unknown property',
    createdAt: r.createdAt,
    noise: r.ratings.noise,
    maintenance: r.ratings.maintenance,
    landlordResponsiveness: r.ratings.landlordResponsiveness,
    value: r.ratings.value,
    accommodation: r.ratings.accommodation,
    text: r.text,
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Admin"
        title="Review moderation"
        subtitle="Publish or reject student reviews. Only published reviews show on listings."
      />
      {rows.length === 0 ? (
        <EmptyState title="No reviews waiting" body="New student reviews appear here for a decision." />
      ) : (
        <ModerationList rows={rows} />
      )}
    </div>
  );
}
