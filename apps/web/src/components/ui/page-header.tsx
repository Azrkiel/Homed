import type { ReactNode } from 'react';
import { cx } from './cx';

/** Page title block: optional eyebrow, h1, subtitle and action buttons. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('flex flex-wrap items-end justify-between gap-4 pb-6', className)}>
      <div className="grid min-w-0 gap-1.5">
        {eyebrow && <p className="text-sm font-medium text-accent">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold tracking-tight text-balance text-ink">{title}</h1>
        {subtitle && <p className="max-w-2xl text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
