import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export function Checkbox({
  id,
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input
        type="checkbox"
        {...rest}
        id={id}
        aria-describedby={hint ? `${id}-hint` : rest['aria-describedby']}
        className="mt-0.5 size-5 shrink-0 accent-accent"
      />
      <div className="grid gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-ink-2">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
