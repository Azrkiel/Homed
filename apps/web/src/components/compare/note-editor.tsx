'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
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
  const [justSaved, setJustSaved] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const id = `note-${floorPlanId}`;

  // Editing form unmounts on save/cancel; hand focus back to the Edit button.
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editRef.current?.focus();
    }
  }, [editing]);

  function save() {
    setError('');
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof updateSaveNote>>;
      try {
        result = await updateSaveNote(floorPlanId, draft);
      } catch {
        setError('Could not save the note. Try again.');
        return;
      }
      if (result.ok) {
        setNote(result.note);
        setDraft(result.note);
        returnFocus.current = true;
        setJustSaved(true);
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
        <p role="status" className="sr-only">
          {justSaved ? 'Note saved.' : ''}
        </p>
        <Button ref={editRef} size="sm" variant="ghost" onClick={() => { setJustSaved(false); setEditing(true); }}>
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
            returnFocus.current = true;
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
