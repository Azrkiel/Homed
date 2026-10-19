import { cx } from './cx';

const DIM = { sm: 44, md: 72, lg: 112 } as const;
const STROKE = { sm: 4, md: 6, lg: 8 } as const;
const NUMBER = { sm: 'text-sm', md: 'text-xl', lg: 'text-3xl' } as const;

export type ScoreTone = 'good' | 'warn' | 'bad' | 'unknown';

/** 0-100 -> tone. >= 75 good, 50-74 warn, < 50 bad. */
export function scoreTone(score: number): ScoreTone {
  if (!Number.isFinite(score)) return 'unknown';
  if (score >= 75) return 'good';
  if (score >= 50) return 'warn';
  return 'bad';
}

const TONE_TEXT: Record<ScoreTone, string> = {
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
  unknown: 'text-ink-3',
};

/** Circular 0-100 score. Announced as e.g. "Best Match 82 out of 100". */
export function ScoreRing({
  score,
  label = 'Best Match',
  size = 'md',
  className,
}: {
  score: number;
  label?: string;
  size?: keyof typeof DIM;
  className?: string;
}) {
  const value = Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : null;
  const dim = DIM[size];
  const stroke = STROKE[size];
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const ariaLabel = value === null ? `${label} unavailable` : `${label} ${value} out of 100`;

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={cx('relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: dim, height: dim }}
    >
      <svg aria-hidden="true" width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="absolute inset-0 -rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-3" />
        {value !== null && (
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            className="text-orange"
          />
        )}
      </svg>
      <span aria-hidden="true" className={cx('font-semibold tabular-nums text-navy', NUMBER[size])}>
        {value ?? '—'}
      </span>
    </span>
  );
}
