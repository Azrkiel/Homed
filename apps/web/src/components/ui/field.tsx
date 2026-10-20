import type { ReactNode } from 'react';
import { cx } from './cx';

/** Attributes Field hands to its control through the render-prop form of `children`. */
export interface FieldControlProps {
  id: string;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
}

/**
 * Label + control + hint + error. `id` names the control; hint and error get `${id}-hint` / `${id}-error`
 * and are wired into aria-describedby. Pass a function as children to receive the control props:
 *   <Field id="name" label="Name" error={e}>{(a) => <TextInput {...a} />}</Field>
 */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode | ((control: FieldControlProps) => ReactNode);
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const control: FieldControlProps = {
    id,
    required: required || undefined,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };
  return (
    <div className={cx('grid gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden="true" className="text-bad">
            {' '}*
          </span>
        )}
      </label>
      {typeof children === 'function' ? children(control) : children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
