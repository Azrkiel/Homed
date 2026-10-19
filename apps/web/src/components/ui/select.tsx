import type { SelectHTMLAttributes } from 'react';
import { cx } from './cx';

/** Native select, styled. Put <option>s as children. */
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select
        {...rest}
        className={cx(
          'h-11 w-full appearance-none rounded-sm border border-line bg-surface pl-3 pr-10 text-ink aria-invalid:border-bad disabled:opacity-50',
          className,
        )}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-2"
      >
        <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
