'use client';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { cx } from '@/components/ui';
import { filterBuildings } from '@/lib/search/schedule-form';

export interface BuildingOption {
  id: string;
  name: string;
  code: string;
  kind: string;
}

/** Search-as-you-type combobox over buildings. Reports the chosen building id ('' while nothing valid is picked). */
export function BuildingPicker({
  id,
  label,
  buildings,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  buildings: BuildingOption[];
  value: string;
  onChange: (buildingId: string) => void;
  error?: string;
}) {
  const listId = useId();
  const byId = useMemo(() => new Map(buildings.map((b) => [b.id, b])), [buildings]);
  const selected = byId.get(value);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => filterBuildings(buildings, query === selected?.name ? '' : query), [buildings, query, selected]);
  const optionId = (i: number) => `${listId}-opt-${i}`;

  function choose(b: BuildingOption) {
    setQuery(b.name);
    onChange(b.id);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && matches[active]) {
        e.preventDefault();
        choose(matches[active]);
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  function onBlur() {
    setOpen(false);
    const exact = buildings.find((b) => b.name.toLowerCase() === query.trim().toLowerCase());
    if (exact) {
      setQuery(exact.name);
      if (exact.id !== value) onChange(exact.id);
    } else if (selected) {
      setQuery(selected.name);
    }
  }

  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(' ');

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && matches[active] ? optionId(active) : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          value={query}
          placeholder="Search buildings"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (value) onChange('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-sm border border-line bg-surface px-3 text-ink placeholder:text-ink-3 aria-invalid:border-bad"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          hidden={!open}
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-card border border-line bg-surface py-1 shadow-card"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-ink-2">No buildings match.</li>}
          {matches.map((b, i) => (
            <li
              key={b.id}
              id={optionId(i)}
              role="option"
              aria-selected={b.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(b)}
              onMouseEnter={() => setActive(i)}
              className={cx(
                'flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm text-ink',
                i === active && 'bg-surface-2',
              )}
            >
              <span>{b.name}</span>
              <span className="text-ink-2">{b.code}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-hint`} className="text-sm text-ink-2">
        {selected ? `${selected.name} (${selected.code}) selected.` : 'Type to search, then pick a building from the list.'}
      </p>
      {error && (
        <p id={`${id}-error`} className="text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
