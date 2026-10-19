import { cx } from './cx';

/** Loading placeholder block. Decorative: wrap a group in role="status" with VisuallyHidden text. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none', className)} />;
}
