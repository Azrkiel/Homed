'use client';
import { useState, type ReactNode } from 'react';
import { cx } from '@/components/ui';

/** List left / map right from md up. Below md: one pane at a time with a List/Map toggle (default List). */
export function ResultsLayout({ list, map }: { list: ReactNode; map: ReactNode }) {
  const [view, setView] = useState<'list' | 'map'>('list');
  return (
    <div className="grid gap-4">
      <div role="group" aria-label="Show list or map" className="inline-flex w-fit gap-1 rounded-lg border border-line bg-surface p-1 text-sm md:hidden">
        {(['list', 'map'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cx(
              'rounded-md px-4 py-1.5 font-medium transition-colors',
              view === v ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )}
          >
            {v === 'list' ? 'List' : 'Map'}
          </button>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]">
        <div className={cx('min-w-0', view === 'map' && 'hidden md:block')}>{list}</div>
        <div className={cx('md:sticky md:top-24 md:h-[calc(100dvh-8rem)]', view === 'list' ? 'hidden md:block' : 'h-[70dvh]')}>
          {map}
        </div>
      </div>
    </div>
  );
}
