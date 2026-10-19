'use server';
// Landlord portal server actions. Every catalog write goes through catalog-change.ts and re-checks ownership.
// RepoError becomes { ok: false, message }; other errors propagate. redirect() runs outside try blocks.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FloorPlan, Property } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo, today } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { ownsProperty } from './access';
import { parseUnitsInput } from './availability';
import {
  confirmAvailabilityChange,
  removeFloorPlan,
  removePhoto,
  saveAccessibility,
  saveFloorPlan,
  savePhoto,
  saveProperty,
} from './catalog-change';
import { parseAccessibilityForm, parseFloorPlanForm, parsePhotoForm, parsePropertyForm } from './forms';
import { requireLandlord } from './server';
import type { LandlordActionState } from './result';

type Repo = ReturnType<typeof getRepo>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}

function repoFail(e: unknown): { ok: false; message: string } {
  if (e instanceof RepoError) return fail(e.message || 'Could not save. Please try again.');
  throw e;
}

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function refresh(propertyId: string): void {
  revalidatePath('/landlord');
  revalidatePath(`/landlord/properties/${propertyId}`);
}

/** Ownership gate for property-scoped writes. Returns null when the property is missing or not the user's (admins pass). */
async function gateProperty(propertyId: string): Promise<{ repo: Repo; property: Property } | null> {
  if (!propertyId) return null;
  const { user, landlord } = await requireLandlord();
  const repo = getRepo();
  const property = await repo.getProperty(propertyId);
  if (!property || !ownsProperty(landlord, property, effectiveRole(user))) return null;
  return { repo, property };
}

/** Onboarding: links a landlord record to the signed-in user. */
export async function createLandlordAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const user = await requireUser('landlord', '/landlord');
  const repo = getRepo();
  if (await repo.getLandlordByUser(user.id)) return fail('You already have a landlord profile.');

  const name = str(fd, 'name');
  if (!name) return fail('Name is required.');
  if (name.length > 120) return fail('Name must be 120 characters or fewer.');
  const email = str(fd, 'email');
  if (email && (email.length > 200 || !EMAIL.test(email))) return fail('Email must look like name@example.com.');
  const phone = str(fd, 'phone');
  if (phone.length > 40) return fail('Phone must be 40 characters or fewer.');
  const website = str(fd, 'website');
  if (website) {
    let ok = website.length <= 2000;
    try {
      const u = new URL(website);
      ok = ok && (u.protocol === 'http:' || u.protocol === 'https:');
    } catch {
      ok = false;
    }
    if (!ok) return fail('Website must start with http:// or https://.');
  }

  try {
    await repo.createLandlord({
      userId: user.id,
      name,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(website ? { website } : {}),
    });
  } catch (e) {
    return repoFail(e);
  }
  revalidatePath('/landlord');
  redirect('/landlord');
}

/** Create (no propertyId) or update a property. New properties get the landlord's id and redirect to their editor. */
export async function savePropertyAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const { user, landlord } = await requireLandlord();
  const repo = getRepo();
  let existing: Property | undefined;
  if (propertyId) {
    const found = await repo.getProperty(propertyId);
    if (!found || !ownsProperty(landlord, found, effectiveRole(user))) return fail('Property not found.');
    existing = found;
  } else if (!landlord) {
    return fail('Create your landlord profile first.');
  }
  const ownerId = existing?.landlordId ?? landlord?.id;
  if (!ownerId) return fail('Create your landlord profile first.');

  const parsed = parsePropertyForm(fd, ownerId, today(), existing);
  if (!parsed.ok) return fail(parsed.message);

  let saved: Property;
  try {
    saved = await saveProperty(repo, parsed.value);
  } catch (e) {
    return repoFail(e);
  }
  refresh(saved.id);
  if (!existing) redirect(`/landlord/properties/${saved.id}?created=1`);
  return { ok: true, message: 'Property saved.' };
}

export async function saveFloorPlanAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const floorPlanId = str(fd, 'floorPlanId');
  const gate = await gateProperty(propertyId);
  if (!gate) return fail('Property not found.');

  let existing: FloorPlan | undefined;
  if (floorPlanId) {
    const listing = await gate.repo.getListing(floorPlanId);
    if (!listing || listing.property.id !== propertyId) return fail('Floor plan not found.');
    existing = listing.floorPlan;
  }
  const parsed = parseFloorPlanForm(fd, propertyId, today(), existing);
  if (!parsed.ok) return fail(parsed.message);

  try {
    await saveFloorPlan(gate.repo, parsed.value);
  } catch (e) {
    return repoFail(e);
  }
  refresh(propertyId);
  return { ok: true, message: existing ? 'Floor plan saved.' : 'Floor plan added.' };
}

export async function deleteFloorPlanAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const floorPlanId = str(fd, 'floorPlanId');
  const gate = await gateProperty(propertyId);
  if (!gate) return fail('Property not found.');
  const listing = floorPlanId ? await gate.repo.getListing(floorPlanId) : null;
  if (!listing || listing.property.id !== propertyId) return fail('Floor plan not found.');

  try {
    await removeFloorPlan(gate.repo, floorPlanId);
  } catch (e) {
    return repoFail(e);
  }
  refresh(propertyId);
  return { ok: true, message: 'Floor plan deleted.' };
}

export async function savePhotoAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const gate = await gateProperty(propertyId);
  if (!gate) return fail('Property not found.');
  const parsed = parsePhotoForm(fd, propertyId);
  if (!parsed.ok) return fail(parsed.message);

  if (parsed.value.floorPlanId !== undefined) {
    const floorPlanId = parsed.value.floorPlanId;
    const plans = await gate.repo.listPropertyListings(propertyId);
    if (!plans.some((l) => l.floorPlan.id === floorPlanId)) return fail('That floor plan does not belong to this property.');
  }

  try {
    await savePhoto(gate.repo, parsed.value);
  } catch (e) {
    return repoFail(e);
  }
  refresh(propertyId);
  return { ok: true, message: 'Photo added.' };
}

export async function deletePhotoAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const photoId = str(fd, 'photoId');
  const gate = await gateProperty(propertyId);
  if (!gate) return fail('Property not found.');
  const listings = await gate.repo.listPropertyListings(propertyId);
  const owned = listings.some((l) => l.photos.some((p) => p.id === photoId && p.propertyId === propertyId));
  if (!owned) return fail('Photo not found.');

  try {
    await removePhoto(gate.repo, photoId);
  } catch (e) {
    return repoFail(e);
  }
  refresh(propertyId);
  return { ok: true, message: 'Photo removed.' };
}

export async function saveAccessibilityAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const gate = await gateProperty(propertyId);
  if (!gate) return fail('Property not found.');
  // Existing info is read through a listing (the repo has no accessibility getter). Without a floor plan there is
  // no listing, so photoConfirmed is rebuilt empty; that field is only set by photo review.
  const existing = (await gate.repo.listPropertyListings(propertyId)).find((l) => l.accessibility)?.accessibility;
  const parsed = parseAccessibilityForm(fd, propertyId, today(), existing);
  if (!parsed.ok) return fail(parsed.message);

  try {
    await saveAccessibility(gate.repo, parsed.value);
  } catch (e) {
    return repoFail(e);
  }
  refresh(propertyId);
  return { ok: true, message: 'Accessibility details saved.' };
}

/** Weekly availability check: sets units and lastVerified (floor plan and property) to today. */
export async function confirmAvailabilityAction(_prev: LandlordActionState, fd: FormData): Promise<LandlordActionState> {
  const propertyId = str(fd, 'propertyId');
  const floorPlanId = str(fd, 'floorPlanId');
  const gate = await gateProperty(propertyId);
  if (!gate) return fail('Property not found.');
  const listing = floorPlanId ? await gate.repo.getListing(floorPlanId) : null;
  if (!listing || listing.property.id !== propertyId) return fail('Floor plan not found.');
  const units = parseUnitsInput(str(fd, 'unitsAvailable'));
  if (!units.ok) return fail(units.message);

  const on = today();
  try {
    await confirmAvailabilityChange(gate.repo, floorPlanId, units.value, on);
  } catch (e) {
    return repoFail(e);
  }
  refresh(propertyId);
  return { ok: true, message: `Availability confirmed for ${on}.` };
}
