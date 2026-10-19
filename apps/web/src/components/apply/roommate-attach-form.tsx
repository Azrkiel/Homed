'use client';
// Roommate's "attach my profile" button. The server action re-checks the token, email, profile and draft status.
import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, ScrollIntoView } from '@/components/ui';
import { attachRoommateProfile, type InviteActionState } from '@/lib/apply/invite-actions';

export function RoommateAttachForm({ token, profileReady }: { token: string; profileReady: boolean }) {
  const [state, formAction, pending] = useActionState<InviteActionState, FormData>(attachRoommateProfile, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <Button type="submit" disabled={!profileReady} loading={pending}>
          Attach my profile and mark my part done
        </Button>
      </div>
      {!pending && state.ok && state.message && (
        <ScrollIntoView>
          <Alert tone="good">{state.message}</Alert>
        </ScrollIntoView>
      )}
      {!pending && state.error && (
        <ScrollIntoView>
          <Alert tone="bad">
            {state.error}
            {state.needsProfile && (
              <>
                {' '}
                <Link href="/profile/applicant" className="font-medium text-accent underline">
                  Go to your applicant profile
                </Link>
              </>
            )}
          </Alert>
        </ScrollIntoView>
      )}
    </form>
  );
}
