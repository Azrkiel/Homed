'use client';
import { useState } from 'react';
import { Button, Checkbox } from '@/components/ui';
import { COMPARE_MAX, COMPARE_MIN, selectionHint } from '@/lib/search/compare';

export interface PickerItem {
  floorPlanId: string;
  label: string;
  detail: string;
}

/**
 * GET form: each checkbox is name="id", so /compare?id=a&id=b works without JS. With JS the button is
 * disabled until 2-4 are picked and the count is announced.
 */
export function ComparePicker({ items, initial = [] }: { items: PickerItem[]; initial?: string[] }) {
  const [picked, setPicked] = useState<string[]>(initial.filter((id) => items.some((i) => i.floorPlanId === id)));
  const ok = picked.length >= COMPARE_MIN && picked.length <= COMPARE_MAX;

  function toggle(id: string, on: boolean) {
    setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  }

  return (
    <form action="/compare" method="get" className="grid gap-4">
      <fieldset className="grid gap-3 rounded-card border border-line bg-surface p-4">
        <legend className="px-1 text-base font-semibold text-ink">Pick from your saved places</legend>
        {items.map((item) => (
          <Checkbox
            key={item.floorPlanId}
            id={`pick-${item.floorPlanId}`}
            name="id"
            value={item.floorPlanId}
            checked={picked.includes(item.floorPlanId)}
            onChange={(e) => toggle(item.floorPlanId, e.target.checked)}
            label={item.label}
            hint={item.detail}
          />
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!ok} aria-describedby="pick-hint">
          Compare
        </Button>
        <p id="pick-hint" role="status" className="text-sm text-ink-2">
          {selectionHint(picked.length)}
        </p>
      </div>
    </form>
  );
}
