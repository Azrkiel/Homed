import Link from 'next/link';
import { cx } from './cx';

export interface SegmentedItem {
  href: string;
  label: string;
  /** Set by the caller from the URL (e.g. searchParams). */
  active?: boolean;
}

/** URL-driven toggle built from links. Server-friendly: the caller decides `active` from the URL. */
export function SegmentedControl({ label, items, className }: { label: string; items: SegmentedItem[]; className?: string }) {
  return (
    <nav aria-label={label} className={cx('inline-flex flex-wrap gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-sm', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cx(
            'rounded-md px-3 py-1 font-medium transition-colors',
            item.active ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
