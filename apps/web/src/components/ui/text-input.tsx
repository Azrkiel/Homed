import type { InputHTMLAttributes } from 'react';
import { cx } from './cx';

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        'h-11 w-full rounded-sm border border-line bg-surface px-3 text-ink placeholder:text-ink-3 aria-invalid:border-bad disabled:opacity-50',
        className,
      )}
    />
  );
}
