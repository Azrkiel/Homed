'use server';
// Review server actions. RepoError becomes { ok: false, message }. Only async functions are exported.
import { revalidatePath } from 'next/cache';
import type { Review } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { ownsProperty } from '@/lib/landlord/access';
import { parseReplyForm, parseReviewForm } from './summary';

export type ReviewActionResult = { ok: true } | { ok: false; message: string };

const LISTING_PATH = '/listings/[floorPlanId]';

/** The ReviewRepo has no get-by-id, so scan the reviews of each listed property (the JSON store is small). */
async function findReview(reviewId: string): Promise<Review | null> {
  const repo = getRepo();
  const propertyIds = [...new Set((await repo.listListings()).map((l) => l.property.id))];
  for (const propertyId of propertyIds) {
    const hit = (await repo.listReviews(propertyId, { includeAll: true })).find((r) => r.id === reviewId);
    if (hit) return hit;
  }
  return null;
}

function fail(e: unknown, fallback: string): { ok: false; message: string } {
  if (e instanceof RepoError) return { ok: false, message: e.message || fallback };
  throw e;
}

/** Student review of a property. Lands as pending until an admin publishes it. */
export async function submitReview(formData: FormData): Promise<ReviewActionResult> {
  const user = await requireUser('student', '/');
  if (effectiveRole(user) !== 'student') return { ok: false, message: 'Only students can write reviews.' };
  const propertyId = formData.get('propertyId');
  if (typeof propertyId !== 'string' || propertyId === '') return { ok: false, message: 'Unknown property.' };
  const parsed = parseReviewForm(formData);
  if (!parsed.ok) return parsed;
  try {
    await getRepo().createReview({ propertyId, userId: user.id, ratings: parsed.value.ratings, text: parsed.value.text });
    revalidatePath(LISTING_PATH, 'page');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not post your review. Please try again.');
  }
}

/** Admin publish or reject of a pending review. */
export async function moderateReviewAction(
  reviewId: string,
  status: 'published' | 'rejected',
): Promise<ReviewActionResult> {
  const user = await requireUser('admin', '/admin/reviews');
  if (effectiveRole(user) !== 'admin') return { ok: false, message: 'Not allowed' };
  if (typeof reviewId !== 'string' || reviewId === '') return { ok: false, message: 'Unknown review.' };
  if (status !== 'published' && status !== 'rejected') return { ok: false, message: 'Unknown decision.' };
  try {
    await getRepo().moderateReview(reviewId, status);
    revalidatePath('/admin/reviews');
    revalidatePath(LISTING_PATH, 'page');
    revalidatePath('/landlord');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not update that review. Please try again.');
  }
}

/** Landlord reply to a published review of their own property (admins may reply to any). */
export async function replyToReviewAction(reviewId: string, formData: FormData): Promise<ReviewActionResult> {
  const user = await requireUser('landlord', '/landlord');
  if (typeof reviewId !== 'string' || reviewId === '') return { ok: false, message: 'Unknown review.' };
  const parsed = parseReplyForm(formData);
  if (!parsed.ok) return parsed;
  const repo = getRepo();
  try {
    const review = await findReview(reviewId);
    if (!review) return { ok: false, message: 'Review not found.' };
    if (review.status !== 'published') return { ok: false, message: 'Only published reviews can be answered.' };
    const property = await repo.getProperty(review.propertyId);
    const landlord = await repo.getLandlordByUser(user.id);
    if (!ownsProperty(landlord, property, effectiveRole(user))) return { ok: false, message: 'Not allowed' };
    await repo.replyToReview(reviewId, parsed.value);
    revalidatePath('/landlord');
    revalidatePath('/admin/reviews');
    revalidatePath(LISTING_PATH, 'page');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not post your reply. Please try again.');
  }
}
