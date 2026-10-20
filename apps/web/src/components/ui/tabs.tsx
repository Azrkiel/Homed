'use client';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/** Tabs with roving tabindex and arrow / Home / End keys. For in-page panels; use SegmentedControl for URL-driven toggles. */
export function Tabs({
  label,
  items,
  defaultValue,
  className,
}: {
  label: string;
  items: TabItem[];
  defaultValue?: string;
  className?: string;
}) {
  const baseId = useId();
  const [selected, setSelected] = useState(defaultValue ?? items[0]?.id);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function activate(index: number) {
    const item = items[index];
    if (!item) return;
    setSelected(item.id);
    buttons.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = items.length;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    activate(next);
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {items.map((item, index) => {
          const active = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(el) => {
                buttons.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cx(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selected}
          tabIndex={0}
          className="pt-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
