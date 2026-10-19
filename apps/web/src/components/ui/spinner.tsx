import { cx } from './cx';
import { VisuallyHidden } from './visually-hidden';

const SIZE = { sm: 'size-4', md: 'size-5', lg: 'size-8' } as const;

/** Loading indicator. Pass `label` for a standalone status (announced); omit it inside buttons (decorative). */
export function Spinner({ label, size = 'md', className }: { label?: string; size?: keyof typeof SIZE; className?: string }) {
  const svg = (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={cx('motion-safe:animate-spin', SIZE[size])}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
  if (!label) return <span className={cx('inline-flex shrink-0', className)}>{svg}</span>;
  return (
    <span role="status" className={cx('inline-flex shrink-0', className)}>
      {svg}
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  );
}
