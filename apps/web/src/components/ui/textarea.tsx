import type { TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

export function Textarea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      {...rest}
      className={cx(
        'w-full rounded-sm border border-line bg-surface px-3 py-2 text-ink placeholder:text-ink-3 aria-invalid:border-bad disabled:opacity-50',
        className,
      )}
    />
  );
}
