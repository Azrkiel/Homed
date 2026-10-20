import type { MatchScore, ScoreWeights } from '@homed/core';
import { Card, CardBody, ScoreRing, scoreTone } from '@/components/ui';
import { weightPercents } from '@/lib/search/listing-detail';

const BAR: Record<ReturnType<typeof scoreTone>, string> = {
  good: 'bg-navy',
  warn: 'bg-navy',
  bad: 'bg-navy',
  unknown: 'bg-ink-3',
};

/** Best Match: total ring, three sub-score bars with their weights, the why line and the notes. */
export function ScoreBreakdown({
  score,
  weights,
  renderingsOnly,
  personal,
}: {
  score: MatchScore;
  weights: ScoreWeights;
  renderingsOnly: boolean;
  /** False when signed out: default weights and no class schedule. */
  personal: boolean;
}) {
  const rows = weightPercents(weights);
  const values = { price: score.price, location: score.location, looks: score.looks };

  return (
    <Card as="section">
      <CardBody className="grid gap-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={score.total} size="lg" />
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold text-ink">Best match</h2>
            <p className="text-sm text-ink">{score.why}</p>
          </div>
        </div>

        <ul className="grid gap-3" aria-label="Best Match breakdown">
          {rows.map((r) => {
            const v = Math.round(values[r.key]);
            return (
              <li key={r.key} className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-ink">
                    {r.label} <span className="font-normal text-ink-2">({r.percent}% of your score)</span>
                  </span>
                  <span className="tabular-nums text-ink">{v}/100</span>
                </div>
                <div
                  role="meter"
                  aria-label={`${r.label} sub-score`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={v}
                  className="h-2 overflow-hidden rounded-full bg-surface-2"
                >
                  <div className={`h-full rounded-full ${BAR[scoreTone(v)]}`} style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                </div>
              </li>
            );
          })}
        </ul>

        {!personal && <p className="text-sm text-ink-3">Default weights. Sign in to personalize.</p>}
      </CardBody>
    </Card>
  );
}
