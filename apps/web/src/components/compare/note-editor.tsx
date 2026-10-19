'use client';
import { useState, useTransition } from 'react';
import { Button, Field, Textarea } from '@/components/ui';
import { updateSaveNote } from '@/lib/search/actions';
import { NOTE_MAX } from '@/lib/search/compare';

/** Shows the note with an Edit button; editing is an inline form that calls updateSaveNote. */
export function NoteEditor({ floorPlanId, name, initialNote }: { floorPlanId: string; name: string; initialNote: string }) {
  const [note, setNote] = useState(initialNote);
  const [draft, setDraft] = useState(initialNote);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();
  const id = `note-${floorPlanId}`;

  function save() {
    setError('');
    startTransition(async () => {
      const result = await updateSaveNote(floorPlanId, draft);
      if (result.ok) {
        setNote(result.note);
        setDraft(result.note);
        setEditing(false);
      } else {
        setError(result.message);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-sm text-ink-2 [overflow-wrap:anywhere]">
          {note ? (
            <>
              Note: <span className="whitespace-pre-wrap text-ink">{note}</span>
            </>
          ) : (
            'No note yet.'
          )}
        </p>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {note ? 'Edit note' : 'Add note'}
          <span className="sr-only"> for {name}</span>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field
        id={id}
        label={
          <>
            Note<span className="sr-only"> for {name}</span>
          </>
        }
        error={error}
        hint={`${draft.trim().length}/${NOTE_MAX} characters`}
      >
        {(a) => <Textarea {...a} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>
          Save note
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setDraft(note);
            setError('');
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
