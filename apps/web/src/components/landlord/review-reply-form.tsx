'use client';
import { useActionState } from 'react';
import { Button, Field, Textarea } from '@/components/ui';
import { replyToReviewAction } from '@/lib/reviews/actions';
import type { LandlordActionState } from '@/lib/landlord/result';
import { FormAlert } from './form-alert';

/** Public reply to a published review. Form name: reply (max 1000 characters, checked by the action). */
export function ReviewReplyForm({ reviewId }: { reviewId: string }) {
  const [state, action, pending] = useActionState<LandlordActionState, FormData>(async (_prev, fd) => {
    const r = await replyToReviewAction(reviewId, fd);
    return r.ok ? { ok: true, message: 'Reply posted.' } : r;
  }, null);
  return (
    <form action={action} className="grid gap-3">
      <Field id={`reply-${reviewId}`} label="Reply to this review" hint="Replies are public. Keep them factual.">
        {(c) => <Textarea {...c} name="reply" rows={3} maxLength={1000} required />}
      </Field>
      <FormAlert state={state} />
      <div>
        <Button type="submit" size="sm" variant="secondary" loading={pending}>
          Post reply
        </Button>
      </div>
    </form>
  );
}
