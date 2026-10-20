import { money } from '@/lib/format';
import { cx } from '@/components/ui';

/** All-in monthly cost per person. The title and sr text say what "all-in" covers. */
export function CostLine({ total, className }: { total: number; className?: string }) {
  return (
    <p
      className={cx('flex flex-wrap items-baseline gap-x-1.5', className)}
      title="All-in: rent plus utilities, internet, parking and furniture, per person"
    >
      <span className="text-lg font-semibold tabular-nums text-ink">{money(total)}</span>
      <span className="text-sm text-ink-2">/person/mo all-in</span>
      <span className="sr-only">(rent plus utilities, internet, parking and furniture)</span>
    </p>
  );
}
