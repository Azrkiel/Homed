'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { Button, Field, TextInput } from '@/components/ui';
import { createGroupAction } from '@/lib/groups/actions';

/** Plain name input. Success -> the new group page. Errors are announced in the status region. */
export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    startTransition(async () => {
      try {
        const result = await createGroupAction(name);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.push(`/groups/${result.groupId}`);
      } catch {
        setError('Could not create the group. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" aria-describedby="create-group-status">
      <Field id="group-name" label="Group name" required hint="Up to 60 characters. You become the leader.">
        {(a) => (
          <TextInput
            {...a}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder="Fontaine roommates"
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? 'Creating' : 'Create group'}
        </Button>
      </div>
      <p id="create-group-status" role="status" aria-live="polite" className={error ? 'text-sm font-medium text-bad' : 'sr-only'}>
        {error}
      </p>
    </form>
  );
}
