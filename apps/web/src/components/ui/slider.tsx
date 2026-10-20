'use client';
import { useState } from 'react';
import { cx } from './cx';

/** Range input with label and live value output. Uncontrolled; use `name` for form submit. */
export function Slider({
  id,
  name,
  label,
  min,
  max,
  step = 1,
  defaultValue,
  unit = '',
  hint,
  className,
}: {
  id: string;
  name?: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  /** Appended to the shown value, e.g. " min" or "%". */
  unit?: string;
  hint?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cx('grid gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <output htmlFor={id} className="text-sm font-semibold tabular-nums text-ink">
          {value}
          {unit}
        </output>
      </div>
      <input
        id={id}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        aria-describedby={hintId}
        className="h-2 w-full cursor-pointer accent-accent"
      />
      {hint && (
        <p id={hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      )}
    </div>
  );
}
