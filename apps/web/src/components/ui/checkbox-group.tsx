import type { ReactNode } from 'react';
import { cx } from './cx';

/** Fieldset for multi-select checkboxes. Pass <Checkbox> children. */
export function CheckboxGroup({
  id,
  legend,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset id={id} aria-describedby={describedBy} className={cx('grid gap-3', className)}>
      <legend className="mb-1 text-sm font-medium text-ink">{legend}</legend>
      {hint && (
        <p id={`${id}-hint`} className="-mt-2 text-sm text-ink-2">
          {hint}
        </p>
      )}
      <div className="grid gap-3">{children}</div>
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </fieldset>
  );
}
