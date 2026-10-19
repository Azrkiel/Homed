import { isStale, verifiedLabel, type ISODate } from '@homed/core';
import { cx } from '@/components/ui';

/** "Verified 3 days ago", or in the warn tone "Not verified in 20 days" when stale. */
export function StaleNotice({ lastVerified, today, className }: { lastVerified: ISODate; today: ISODate; className?: string }) {
  const stale = isStale(lastVerified, today);
  return (
    <p className={cx('text-xs', stale ? 'font-medium text-warn' : 'text-ink-2', className)}>
      {stale && <span aria-hidden="true">&#9888; </span>}
      {verifiedLabel(lastVerified, today)}
    </p>
  );
}
