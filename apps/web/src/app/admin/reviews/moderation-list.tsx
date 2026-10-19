'use client';
import { useState, useTransition } from 'react';
import { Alert, Badge, Button, Card, CardBody } from '@/components/ui';
import { moderateReviewAction } from '@/lib/reviews/actions';

export interface PendingReviewRow {
  id: string;
  propertyName: string;
  createdAt: string;
  noise: number;
  maintenance: number;
  landlordResponsiveness: number;
  value: number;
  accommodation?: number;
  text: string;
}

/** One pending review with Publish / Reject. The server action revalidates the page, so the row drops out on success. */
export function ModerationList({ rows }: { rows: PendingReviewRow[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function decide(id: string, status: 'published' | 'rejected') {
    setMessage(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await moderateReviewAction(id, status);
      setPendingId(null);
      if (!result.ok) setMessage(result.message);
    });
  }

  return (
    <div className="grid gap-4">
      {message && <Alert tone="bad">{message}</Alert>}
      <ul className="grid gap-4">
        {rows.map((r) => (
          <li key={r.id}>
            <Card as="article">
              <CardBody className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-ink">{r.propertyName}</h2>
                  <Badge tone="warn">Pending</Badge>
                </div>
                <p className="text-sm text-ink-2">
                  Noise {r.noise}/5 · Maintenance {r.maintenance}/5 · Responsiveness {r.landlordResponsiveness}/5 · Value {r.value}/5
                  {r.accommodation !== undefined ? ` · Accommodation ${r.accommodation}/5` : ''}
                </p>
                <p className="whitespace-pre-line text-ink">{r.text}</p>
                <p className="text-xs text-ink-2">Submitted {r.createdAt.slice(0, 10)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    loading={pendingId === r.id}
                    disabled={pendingId !== null}
                    onClick={() => decide(r.id, 'published')}
                  >
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pendingId !== null}
                    onClick={() => decide(r.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
