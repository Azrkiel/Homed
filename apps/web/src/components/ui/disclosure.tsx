import type { ReactNode } from 'react';
import { cx } from './cx';

/** Collapsed section for secondary detail. Native <details>: keyboard and screen-reader friendly, no JS. */
export function Disclosure({
  title,
  meta,
  defaultOpen,
  className,
  children,
}: {
  title: string;
  /** Short hint shown next to the title, e.g. a count. */
  meta?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className={cx('group border-t border-line', className)}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-ink">
          {title}
          {meta && <span className="ml-2 text-sm font-normal text-ink-3">{meta}</span>}
        </span>
        <span aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-180">
          &#9662;
        </span>
      </summary>
      <div className="pb-5">{children}</div>
    </details>
  );
}
