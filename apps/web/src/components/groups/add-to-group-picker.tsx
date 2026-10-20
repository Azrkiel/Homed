'use client';
import { useId, useState, useTransition } from 'react';
import { Button, Select } from '@/components/ui';
import { addToShortlistAction } from '@/lib/groups/actions';
import { addedToGroupMessage } from '@/lib/groups/browse';

/** Group picker for one listing: a select of the viewer's groups and an "Add to group" button. */
export function AddToGroupPicker({
  floorPlanId,
  groups,
}: {
  floorPlanId: string;
  groups: Array<{ id: string; name: string }>;
}) {
  const selectId = useId();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();

  function add() {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setMessage('');
    startTransition(async () => {
      try {
        const res = await addToShortlistAction(group.id, floorPlanId);
        setMessage(res.ok ? addedToGroupMessage(group.name) : res.message);
      } catch {
        setMessage('Could not add that place. Please try again.');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={selectId} className="sr-only">
        Group
      </label>
      <div className="w-40">
        <Select id={selectId} value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={pending}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </div>
      <Button size="sm" variant="secondary" onClick={add} disabled={pending || groupId === ''}>
        Add to group
      </Button>
      <span role="status" aria-live="polite" className="text-xs text-ink-2">
        {message}
      </span>
    </div>
  );
}
