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
    <nav aria-label={label} className={cx('inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface p-1 text-sm', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? 'page' : undefined}
          className={cx(
            'rounded-full px-3 py-1.5 font-medium transition-colors',
            item.active ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
