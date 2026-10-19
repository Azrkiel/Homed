import type { ReactNode } from 'react';
import { cx } from './cx';

/** Placeholder for no results / nothing yet. Say why it is empty and offer the next step in `action`. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'grid justify-items-center gap-3 rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2">
          {icon}
        </div>
      )}
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {body && <div className="max-w-md text-sm text-ink-2">{body}</div>}
      {action && <div className="mt-2 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
