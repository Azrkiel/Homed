import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  accent: 'bg-orange-soft text-orange-ink',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
};

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', TONE[tone], className)}>
      {children}
    </span>
  );
}
