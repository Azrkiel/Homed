import type { ReviewRatings, User } from '@homed/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

export function reviewsConformance(makeRepo: MakeRepo): void {
  describe('reviews', () => {
    let repo: Repository;
    let ann: User;
    let ben: User;

    beforeEach(async () => {
      repo = await makeRepo();
      ann = await makeStudent(repo, 'Ann');
      ben = await makeStudent(repo, 'Ben');
    });

    const ratings: ReviewRatings = { noise: 4, maintenance: 3, landlordResponsiveness: 5, value: 2 };

    function input(userId: string, propertyId: string = FX.propertyLofts, text = 'Quiet and clean.') {
      return { propertyId, userId, ratings: { ...ratings }, text };
    }

    describe('createReview', () => {
      it('creates a pending review with id and createdAt', async () => {
        const r = await repo.createReview(input(ann.id));
        expect(r.id).toBeTruthy();
        expect(r.status).toBe('pending');
        expect(r.propertyId).toBe(FX.propertyLofts);
        expect(r.userId).toBe(ann.id);
        expect(r.ratings).toEqual(ratings);
        expect(r.text).toBe('Quiet and clean.');
        expect(r.landlordReply).toBeUndefined();
        expect(Number.isNaN(Date.parse(r.createdAt))).toBe(false);
      });

      it('trims the text', async () => {
        const r = await repo.createReview(input(ann.id, FX.propertyLofts, '  nice place \n'));
        expect(r.text).toBe('nice place');
      });

      it('accepts the optional accommodation rating', async () => {
        const r = await repo.createReview({
          ...input(ann.id),
          ratings: { ...ratings, accommodation: 5 },
        });
        expect(r.ratings.accommodation).toBe(5);
      });

      it('rejects blank text', async () => {
        await expectRepoError(repo.createReview(input(ann.id, FX.propertyLofts, '   ')), 'invalid');
        expect(await repo.listReviews(FX.propertyLofts, { includeAll: true })).toEqual([]);
      });

      it.each([0, 6, 2.5, -1, Number.NaN])('rejects a noise rating of %s', async (bad) => {
        await expectRepoError(
          repo.createReview({ ...input(ann.id), ratings: { ...ratings, noise: bad } }),
          'invalid',
        );
      });

      it('rejects an out-of-range value rating', async () => {
        await expectRepoError(repo.createReview({ ...input(ann.id), ratings: { ...ratings, value: 9 } }), 'invalid');
      });

      it('rejects an out-of-range accommodation rating', async () => {
        await expectRepoError(
          repo.createReview({ ...input(ann.id), ratings: { ...ratings, accommodation: 0 } }),
          'invalid',
        );
      });

      it('rejects an unknown user', async () => {
        await expectRepoError(repo.createReview(input('nobody')), 'not_found');
      });

      it('rejects an unknown property', async () => {
        await expectRepoError(repo.createReview(input(ann.id, 'p-nope')), 'not_found');
      });

      it('rejects non-student users', async () => {
        const landlord = await repo.createUser({ email: 'lee@example.com', name: 'Lee', role: 'landlord' });
        await expectRepoError(repo.createReview(input(landlord.id)), 'forbidden');
      });

      it('allows one review per user per property', async () => {
        await repo.createReview(input(ann.id));
        await expectRepoError(repo.createReview(input(ann.id)), 'conflict');
      });

      it('lets a user review different properties and different users review the same one', async () => {
        await repo.createReview(input(ann.id, FX.propertyLofts));
        await repo.createReview(input(ann.id, FX.propertyRugby));
        await repo.createReview(input(ben.id, FX.propertyLofts));
        expect(await repo.listReviews(FX.propertyLofts, { includeAll: true })).toHaveLength(2);
      });

      it('returns a copy', async () => {
        const r = await repo.createReview(input(ann.id));
        r.text = 'mutated';
        r.ratings.noise = 1;
        const [stored] = await repo.listReviews(FX.propertyLofts, { includeAll: true });
        expect(stored?.text).toBe('Quiet and clean.');
        expect(stored?.ratings.noise).toBe(4);
      });
    });

    describe('listReviews', () => {
      it('is empty for a property with no reviews and for unknown properties', async () => {
        expect(await repo.listReviews(FX.propertyLofts)).toEqual([]);
        expect(await repo.listReviews('p-nope', { includeAll: true })).toEqual([]);
      });

      it('hides pending and rejected reviews by default', async () => {
        const a = await repo.createReview(input(ann.id));
        const b = await repo.createReview(input(ben.id));
        expect(await repo.listReviews(FX.propertyLofts)).toEqual([]);
        await repo.moderateReview(a.id, 'published');
        await repo.moderateReview(b.id, 'rejected');
        expect((await repo.listReviews(FX.propertyLofts)).map((r) => r.id)).toEqual([a.id]);
      });

      it('includeAll shows every status', async () => {
        const a = await repo.createReview(input(ann.id));
        const b = await repo.createReview(input(ben.id));
        await repo.moderateReview(b.id, 'rejected');
        const all = await repo.listReviews(FX.propertyLofts, { includeAll: true });
        expect(all.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
        expect(await repo.listReviews(FX.propertyLofts, { includeAll: false })).toEqual([]);
      });

      it('only lists the requested property', async () => {
        const a = await repo.createReview(input(ann.id, FX.propertyLofts));
        await repo.createReview(input(ann.id, FX.propertyRugby));
        const all = await repo.listReviews(FX.propertyLofts, { includeAll: true });
        expect(all.map((r) => r.id)).toEqual([a.id]);
      });

      it('lists newest first (later insertions first on ties)', async () => {
        const a = await repo.createReview(input(ann.id));
        const b = await repo.createReview(input(ben.id));
        expect((await repo.listReviews(FX.propertyLofts, { includeAll: true })).map((r) => r.id)).toEqual([b.id, a.id]);
      });
    });

    describe('moderation', () => {
      it('listPendingReviews returns pending reviews across properties, oldest first', async () => {
        const a = await repo.createReview(input(ann.id, FX.propertyLofts));
        const b = await repo.createReview(input(ann.id, FX.propertyRugby));
        const c = await repo.createReview(input(ben.id, FX.propertyLofts));
        expect((await repo.listPendingReviews()).map((r) => r.id)).toEqual([a.id, b.id, c.id]);
      });

      it('listPendingReviews drops moderated reviews', async () => {
        const a = await repo.createReview(input(ann.id));
        const b = await repo.createReview(input(ben.id));
        await repo.moderateReview(a.id, 'published');
        expect((await repo.listPendingReviews()).map((r) => r.id)).toEqual([b.id]);
      });

      it('listPendingReviews is empty on a fresh store', async () => {
        expect(await repo.listPendingReviews()).toEqual([]);
      });

      it('moderateReview publishes and rejects', async () => {
        const a = await repo.createReview(input(ann.id));
        expect((await repo.moderateReview(a.id, 'published')).status).toBe('published');
        expect((await repo.moderateReview(a.id, 'rejected')).status).toBe('rejected');
        const [stored] = await repo.listReviews(FX.propertyLofts, { includeAll: true });
        expect(stored?.status).toBe('rejected');
      });

      it('moderateReview of an unknown review is not_found', async () => {
        await expectRepoError(repo.moderateReview('nope', 'published'), 'not_found');
      });
    });

    describe('replyToReview', () => {
      it('sets the landlord reply', async () => {
        const a = await repo.createReview(input(ann.id));
        await repo.moderateReview(a.id, 'published');
        const r = await repo.replyToReview(a.id, 'Thanks for the feedback.');
        expect(r.landlordReply).toBe('Thanks for the feedback.');
        const [stored] = await repo.listReviews(FX.propertyLofts);
        expect(stored?.landlordReply).toBe('Thanks for the feedback.');
      });

      it('replaces an earlier reply', async () => {
        const a = await repo.createReview(input(ann.id));
        await repo.replyToReview(a.id, 'first');
        expect((await repo.replyToReview(a.id, 'second')).landlordReply).toBe('second');
      });

      it('rejects a blank reply and keeps the old one', async () => {
        const a = await repo.createReview(input(ann.id));
        await repo.replyToReview(a.id, 'first');
        await expectRepoError(repo.replyToReview(a.id, '   '), 'invalid');
        const [stored] = await repo.listReviews(FX.propertyLofts, { includeAll: true });
        expect(stored?.landlordReply).toBe('first');
      });

      it('unknown review is not_found', async () => {
        await expectRepoError(repo.replyToReview('nope', 'hi'), 'not_found');
      });

      it('does not change the review status', async () => {
        const a = await repo.createReview(input(ann.id));
        expect((await repo.replyToReview(a.id, 'hi')).status).toBe('pending');
      });
    });
  });
}
