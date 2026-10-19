'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { Button, Checkbox } from '@/components/ui';
import { removeSaveAction } from '@/lib/search/actions';
import { COMPARE_MAX, COMPARE_MIN, compareHref, selectionHint } from '@/lib/search/compare';
import { NoteEditor } from './note-editor';

export interface SavedItem {
  floorPlanId: string;
  name: string;
  note: string;
  /** Server-rendered ListingCard, or a "No longer listed" box. */
  content: ReactNode;
}

function RemoveButton({ floorPlanId, name }: { floorPlanId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  return (
    <span className="inline-flex flex-col items-end">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await removeSaveAction(floorPlanId);
            setError(r.ok ? '' : r.message);
          })
        }
      >
        Remove<span className="sr-only"> {name} from saved</span>
      </Button>
      {error && (
        <span role="alert" className="mt-1 text-xs text-bad">
          {error}
        </span>
      )}
    </span>
  );
}

/** Saved rows with a selection checkbox, note editor and remove. "Compare selected" needs 2 to 4. */
export function SavedList({ items }: { items: SavedItem[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const live = picked.filter((id) => items.some((i) => i.floorPlanId === id));
  const ok = live.length >= COMPARE_MIN && live.length <= COMPARE_MAX;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3 shadow-card">
        {ok ? (
          <Button href={compareHref(live)}>Compare selected ({live.length})</Button>
        ) : (
          <Button disabled aria-describedby="saved-hint">
            Compare selected ({live.length})
          </Button>
        )}
        <p id="saved-hint" role="status" className="text-sm text-ink-2">
          {selectionHint(live.length)}
        </p>
      </div>
      <ul className="grid gap-5">
        {items.map((item) => (
          <li key={item.floorPlanId} className="grid gap-2">
            <Checkbox
              id={`sel-${item.floorPlanId}`}
              checked={live.includes(item.floorPlanId)}
              onChange={(e) =>
                setPicked((p) => (e.target.checked ? [...p, item.floorPlanId] : p.filter((x) => x !== item.floorPlanId)))
              }
              label={
                <>
                  Select to compare<span className="sr-only">: {item.name}</span>
                </>
              }
            />
            {item.content}
            <div className="grid gap-2 rounded-card border border-line bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <NoteEditor floorPlanId={item.floorPlanId} name={item.name} initialNote={item.note} />
              <RemoveButton floorPlanId={item.floorPlanId} name={item.name} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
