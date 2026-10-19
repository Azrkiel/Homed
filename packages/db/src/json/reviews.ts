import { isStudentEmail, type Review, type ReviewRatings } from '@homed/core';
import { RepoError, type ReviewRepo } from '../repository';
import type { Ctx } from './store';

const byCreated = (dir: 1 | -1) => (a: Review, b: Review) =>
  a.createdAt < b.createdAt ? -dir : a.createdAt > b.createdAt ? dir : 0;

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

export function reviewRepo(ctx: Ctx): ReviewRepo {
  return {
    listReviews: (propertyId, opts) =>
      ctx.read((s) => {
        // Reverse first so later insertions win ties; sort is stable.
        const rows = s.reviews
          .filter((r) => r.propertyId === propertyId && (opts?.includeAll || r.status === 'published'))
          .reverse();
        return structuredClone(rows.sort(byCreated(1)));
      }),
    createReview: (input) =>
      ctx.write((s) => {
        const user = s.users.find((u) => u.id === input.userId);
        if (!user) throw new RepoError('not_found', 'user not found');
        if (user.role !== 'student' || !isStudentEmail(user.email)) {
          throw new RepoError('forbidden', 'only students can write reviews');
        }
        if (!s.catalog.properties.some((p) => p.id === input.propertyId)) {
          throw new RepoError('not_found', 'property not found');
        }
        if (s.reviews.some((r) => r.userId === input.userId && r.propertyId === input.propertyId)) {
          throw new RepoError('conflict', 'already reviewed this property');
        }
        checkRatings(input.ratings);
        const text = typeof input.text === 'string' ? input.text.trim() : '';
        if (!text) throw new RepoError('invalid', 'review text required');
        const review: Review = {
          id: crypto.randomUUID(),
          propertyId: input.propertyId,
          userId: input.userId,
          ratings: { ...input.ratings },
          text,
          status: 'pending',
          createdAt: ctx.now(),
        };
        s.reviews.push(review);
        return structuredClone(review);
      }),
    listPendingReviews: () =>
      ctx.read((s) => structuredClone([...s.reviews].filter((r) => r.status === 'pending').sort(byCreated(-1)))),
    moderateReview: (reviewId, status) =>
      ctx.write((s) => {
        const r = s.reviews.find((x) => x.id === reviewId);
        if (!r) throw new RepoError('not_found', 'review not found');
        if (status !== 'published' && status !== 'rejected') throw new RepoError('invalid', 'bad status');
        r.status = status;
        return structuredClone(r);
      }),
    replyToReview: (reviewId, reply) =>
      ctx.write((s) => {
        const r = s.reviews.find((x) => x.id === reviewId);
        if (!r) throw new RepoError('not_found', 'review not found');
        const text = reply.trim();
        if (!text) throw new RepoError('invalid', 'reply required');
        r.landlordReply = text;
        return structuredClone(r);
      }),
  };
}
