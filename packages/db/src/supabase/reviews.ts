// ReviewRepo on Supabase. Mirrors packages/db/src/json/reviews.ts.
//
// Known divergences from the JSON store:
// - Review createdAt is kept strictly increasing (clock value, or newest + 1 ms when the clock has not
//   moved past the newest review) so ordering is deterministic without an insertion sequence.
// - listPendingReviews is oldest first (what the conformance suite expects for the moderation queue).
//   The JSON store only gets that order from insertion-order ties; with distinct timestamps it is newest first.
import { isStudentEmail, type ReviewRatings } from '@homed/core';
import { RepoError, type ReviewRepo } from '../repository';
import { selectAll, unwrap, unwrapOne, type SupabaseCtx } from './client';
import { isoTs, reviewFromRow, reviewToRow, type ReviewRow, type UserRow } from './mappers';

function validRating(n: unknown): boolean {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;
}

function checkRatings(r: ReviewRatings): void {
  for (const k of ['noise', 'maintenance', 'landlordResponsiveness', 'value'] as const) {
    if (!validRating(r[k])) throw new RepoError('invalid', `${k} rating must be an integer from 1 to 5`);
  }
  if (r.accommodation !== undefined && !validRating(r.accommodation)) {
    throw new RepoError('invalid', 'accommodation rating must be an integer from 1 to 5');
  }
}

async function nextTimestamp(ctx: SupabaseCtx): Promise<string> {
  const now = ctx.now();
  const latest = unwrap(
    await ctx.sb.from('reviews').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ) as { created_at: string } | null;
  if (!latest) return now;
  const last = Date.parse(isoTs(latest.created_at));
  return last < Date.parse(now) ? now : new Date(last + 1).toISOString();
}

async function requireReview(ctx: SupabaseCtx, reviewId: string): Promise<void> {
  const row = unwrap(await ctx.sb.from('reviews').select('id').eq('id', reviewId).maybeSingle());
  if (!row) throw new RepoError('not_found', 'review not found');
}

export function reviewRepo(ctx: SupabaseCtx): ReviewRepo {
  const { sb } = ctx;
  return {
    listReviews: async (propertyId, opts) => {
      const rows = await selectAll<ReviewRow>((f, t) => {
        let q = sb.from('reviews').select('*').eq('property_id', propertyId);
        if (!opts?.includeAll) q = q.eq('status', 'published');
        return q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(f, t);
      });
      return rows.map(reviewFromRow);
    },

    createReview: async (input) => {
      const user = unwrap(await sb.from('users').select('*').eq('id', input.userId).maybeSingle()) as UserRow | null;
      if (!user) throw new RepoError('not_found', 'user not found');
      if (user.role !== 'student' || !isStudentEmail(user.email)) {
        throw new RepoError('forbidden', 'only students can write reviews');
      }
      if (!unwrap(await sb.from('properties').select('id').eq('id', input.propertyId).maybeSingle())) {
        throw new RepoError('not_found', 'property not found');
      }
      const dup = unwrap(
        await sb.from('reviews').select('id').eq('user_id', input.userId).eq('property_id', input.propertyId).maybeSingle(),
      );
      if (dup) throw new RepoError('conflict', 'already reviewed this property');
      checkRatings(input.ratings);
      const text = typeof input.text === 'string' ? input.text.trim() : '';
      if (!text) throw new RepoError('invalid', 'review text required');
      const row = reviewToRow({
        id: crypto.randomUUID(),
        propertyId: input.propertyId,
        userId: input.userId,
        ratings: { ...input.ratings },
        text,
        status: 'pending',
        createdAt: await nextTimestamp(ctx),
      });
      const saved = unwrapOne(await sb.from('reviews').insert(row).select('*').single(), {
        conflict: 'already reviewed this property',
        fk: { code: 'not_found', message: 'user or property not found' },
      }) as ReviewRow;
      return reviewFromRow(saved);
    },

    listPendingReviews: async () => {
      const rows = await selectAll<ReviewRow>((f, t) =>
        sb.from('reviews').select('*').eq('status', 'pending').order('created_at').order('id').range(f, t),
      );
      return rows.map(reviewFromRow);
    },

    moderateReview: async (reviewId, status) => {
      await requireReview(ctx, reviewId);
      if (status !== 'published' && status !== 'rejected') throw new RepoError('invalid', 'bad status');
      const row = unwrapOne(
        await sb.from('reviews').update({ status }).eq('id', reviewId).select('*').single(),
      ) as ReviewRow;
      return reviewFromRow(row);
    },

    replyToReview: async (reviewId, reply) => {
      await requireReview(ctx, reviewId);
      const text = reply.trim();
      if (!text) throw new RepoError('invalid', 'reply required');
      const row = unwrapOne(
        await sb.from('reviews').update({ landlord_reply: text }).eq('id', reviewId).select('*').single(),
      ) as ReviewRow;
      return reviewFromRow(row);
    },
  };
}
