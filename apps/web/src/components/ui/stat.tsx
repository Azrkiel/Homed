import type { ReactNode } from 'react';
import { cx } from './cx';

const TONE = {
  default: 'text-ink',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
} as const;

/** Label / value pair. Use a few per row inside a card or grid. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <dl className={cx('grid gap-1', className)}>
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd className={cx('text-2xl font-semibold tabular-nums', TONE[tone])}>{value}</dd>
      {hint && <dd className="text-sm text-ink-2">{hint}</dd>}
    </dl>
  );
}
