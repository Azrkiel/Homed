import type { ReactNode } from 'react';
import { cx } from './cx';

export type AlertTone = 'info' | 'good' | 'warn' | 'bad';

const TONE: Record<AlertTone, { box: string; title: string }> = {
  info: { box: 'bg-info-soft', title: 'text-info' },
  good: { box: 'bg-good-soft', title: 'text-good' },
  warn: { box: 'bg-warn-soft', title: 'text-warn' },
  bad: { box: 'bg-bad-soft', title: 'text-bad' },
};

/** Inline message. `bad` is announced assertively (role="alert"); the others politely (role="status"). */
export function Alert({
  tone = 'info',
  title,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className={cx('grid gap-1 rounded-card p-4 text-ink', TONE[tone].box, className)}
    >
      {title && <p className={cx('font-semibold', TONE[tone].title)}>{title}</p>}
      <div className="text-sm">{children}</div>
    </div>
  );
}
