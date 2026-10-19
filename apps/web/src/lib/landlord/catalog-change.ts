// Every landlord catalog write goes through withCatalogChange so search alerts and price/availability
// watchers see the change. The diff runs only after the write succeeds: a thrown write emits no events.
import { diffForAlerts, type AccessibilityInfo, type FloorPlan, type ID, type ISODate, type Property } from '@homed/core';
import type { LandlordRepo, Repository } from '@homed/db';

type PropertyInput = Parameters<LandlordRepo['upsertProperty']>[0];
type FloorPlanInput = Parameters<LandlordRepo['upsertFloorPlan']>[0];
type PhotoInput = Parameters<LandlordRepo['upsertPhoto']>[0];

export async function withCatalogChange<T>(repo: Repository, write: () => Promise<T>): Promise<T> {
  const before = await repo.listListings();
  const result = await write();
  const after = await repo.listListings();
  const drafts = diffForAlerts(before, after, await repo.listAllAlerts());
  if (drafts.length > 0) await repo.addAlertEvents(drafts);
  return result;
}

export function saveProperty(repo: Repository, input: PropertyInput): Promise<Property> {
  return withCatalogChange(repo, () => repo.upsertProperty(input));
}

export function saveFloorPlan(repo: Repository, input: FloorPlanInput): Promise<FloorPlan> {
  return withCatalogChange(repo, () => repo.upsertFloorPlan(input));
}

export function removeFloorPlan(repo: Repository, floorPlanId: ID): Promise<void> {
  return withCatalogChange(repo, () => repo.deleteFloorPlan(floorPlanId));
}

export function savePhoto(repo: Repository, input: PhotoInput) {
  return withCatalogChange(repo, () => repo.upsertPhoto(input));
}

export function removePhoto(repo: Repository, photoId: ID): Promise<void> {
  return withCatalogChange(repo, () => repo.deletePhoto(photoId));
}

export function saveAccessibility(repo: Repository, info: AccessibilityInfo): Promise<AccessibilityInfo> {
  return withCatalogChange(repo, () => repo.upsertAccessibility(info));
}

export function confirmAvailabilityChange(
  repo: Repository,
  floorPlanId: ID,
  units: number | null,
  on: ISODate,
): Promise<FloorPlan> {
  return withCatalogChange(repo, () => repo.confirmAvailability(floorPlanId, units, on));
}
