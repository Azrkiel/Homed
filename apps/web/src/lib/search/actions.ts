'use server';
// Shared server actions for search, saved and listing pages. RepoError becomes { ok: false, message }.
import { revalidatePath } from 'next/cache';
import { WEIGHT_PRESETS, normalizeWeights, type ListingFilters, type WeightPreset } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { filtersFromParams, filtersToParams } from './params';
import { parseRating } from './listing-detail';

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; message: string };

function fail(e: unknown, fallback: string): { ok: false; message: string } {
  if (e instanceof RepoError) return { ok: false, message: e.message || fallback };
  throw e;
}

/** Only same-site absolute paths are revalidated. */
function safePath(path: string | undefined): string | null {
  return path && path.startsWith('/') && !path.startsWith('//') ? (path.split('?')[0] ?? null) : null;
}

/** Saves the floor plan, or removes the save when it already exists. Signed-out -> /signin?next=<path>. */
export async function toggleSave(floorPlanId: string, path?: string): Promise<ActionResult<{ saved: boolean }>> {
  const user = await requireUser(undefined, path ?? '/search');
  const repo = getRepo();
  try {
    const existing = (await repo.listSaves(user.id)).some((s) => s.floorPlanId === floorPlanId);
    if (existing) await repo.removeSave(user.id, floorPlanId);
    else await repo.addSave(user.id, floorPlanId);
    for (const p of ['/search', '/saved', `/listings/${floorPlanId}`, safePath(path)]) {
      if (p) revalidatePath(p);
    }
    return { ok: true, saved: !existing };
  } catch (e) {
    return fail(e, 'Could not update your saved places. Please try again.');
  }
}

/** Alert for new listings, price drops and few-left on a search. Filters are round-tripped through the URL codec to drop junk. */
export async function createSearchAlert(filters: ListingFilters): Promise<ActionResult> {
  const user = await requireUser(undefined, '/search');
  const clean = filtersFromParams(filtersToParams(filters ?? {}));
  try {
    await getRepo().createAlert({
      userId: user.id,
      triggers: ['new_listing', 'price_drop', 'few_left'],
      target: { kind: 'search', filters: clean },
    });
    revalidatePath('/alerts');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not create the alert. Please try again.');
  }
}

/** Alert on one building ("Watch this building"). */
export async function createPropertyAlert(propertyId: string, path?: string): Promise<ActionResult> {
  const user = await requireUser(undefined, path ?? '/search');
  try {
    await getRepo().createAlert({
      userId: user.id,
      triggers: ['new_listing', 'price_drop', 'few_left'],
      target: { kind: 'property', propertyId },
    });
    revalidatePath('/alerts');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not create the alert. Please try again.');
  }
}

/** Stores a weights preset on the signed-in user and refreshes rankings. */
export async function setWeightsPreset(preset: string): Promise<ActionResult> {
  const user = await requireUser(undefined, '/search');
  if (!Object.hasOwn(WEIGHT_PRESETS, preset)) return { ok: false, message: 'Unknown preset.' };
  try {
    await getRepo().updateUser(user.id, { weights: normalizeWeights(WEIGHT_PRESETS[preset as WeightPreset].weights) });
    revalidatePath('/search');
    revalidatePath('/settings');
    revalidatePath('/saved');
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not change your weights. Please try again.');
  }
}

/**
 * Match swipe (solo). Right also adds a save inside the repo; `addedSave` reports whether that save was new,
 * so undo only removes saves the swipe created. Signed-out -> /signin?next=/match.
 */
export async function recordSwipeAction(
  floorPlanId: string,
  direction: 'left' | 'right',
): Promise<ActionResult<{ addedSave: boolean }>> {
  const user = await requireUser(undefined, '/match');
  if (direction !== 'left' && direction !== 'right') return { ok: false, message: 'Unknown swipe.' };
  if (typeof floorPlanId !== 'string' || floorPlanId === '') return { ok: false, message: 'Unknown listing.' };
  const repo = getRepo();
  try {
    const wasSaved = direction === 'right' && (await repo.listSaves(user.id)).some((s) => s.floorPlanId === floorPlanId);
    await repo.recordSwipe({ userId: user.id, floorPlanId, direction });
    for (const p of ['/match', '/saved', '/search']) revalidatePath(p);
    return { ok: true, addedSave: direction === 'right' && !wasSaved };
  } catch (e) {
    return fail(e, 'Could not record your swipe. Please try again.');
  }
}

/**
 * Undo of the last Match swipe. There is no delete-swipe in the Repository, so the stored swipe stays:
 * after a reload the card stays out of the Match queue. Only the save is reverted, and only when the
 * swipe created it (`addedSave`, default: any right swipe).
 */
export async function undoSwipeAction(
  floorPlanId: string,
  previousDirection: 'left' | 'right',
  addedSave: boolean = previousDirection === 'right',
): Promise<ActionResult> {
  const user = await requireUser(undefined, '/match');
  if (typeof floorPlanId !== 'string' || floorPlanId === '') return { ok: false, message: 'Unknown listing.' };
  try {
    if (previousDirection === 'right' && addedSave) await getRepo().removeSave(user.id, floorPlanId);
    for (const p of ['/match', '/saved', '/search']) revalidatePath(p);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not undo that swipe. Please try again.');
  }
}

/** Student swipe rating (1-5) of a real photo. Signed-out -> /signin?next=<path>. Re-rating replaces. */
export async function ratePhotoAction(
  photoId: string,
  rating: number,
  floorPlanId: string,
): Promise<ActionResult<{ looksRating?: number; ratingCount: number }>> {
  const path = `/listings/${floorPlanId}`;
  const user = await requireUser(undefined, path);
  const value = parseRating(rating);
  if (value === null) return { ok: false, message: 'Pick a rating from 1 to 5.' };
  if (typeof photoId !== 'string' || photoId === '') return { ok: false, message: 'Unknown photo.' };
  try {
    const photo = await getRepo().ratePhoto(user.id, photoId, value);
    revalidatePath(path);
    revalidatePath('/search');
    return { ok: true, looksRating: photo.looksRating, ratingCount: photo.ratingCount };
  } catch (e) {
    return fail(e, 'Could not save your rating. Please try again.');
  }
}
