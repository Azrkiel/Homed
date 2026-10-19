import type { Landlord, Photo } from '@homed/core';
import { RepoError, type LandlordRepo } from '../repository';
import type { Ctx } from './store';

/** Applications in these states no longer need their floor plan. */
const CLOSED_STATUSES = new Set(['denied', 'withdrawn', 'signed']);

export function landlordRepo(ctx: Ctx): LandlordRepo {
  return {
    getLandlord: (id) => ctx.read((s) => structuredClone(s.catalog.landlords.find((l) => l.id === id) ?? null)),
    getLandlordByUser: (userId) =>
      ctx.read((s) => structuredClone(s.catalog.landlords.find((l) => l.userId === userId) ?? null)),
    listLandlords: () => ctx.read((s) => structuredClone(s.catalog.landlords)),
    createLandlord: (input) =>
      ctx.write((s) => {
        const name = typeof input.name === 'string' ? input.name.trim() : '';
        if (!name) throw new RepoError('invalid', 'landlord name required');
        if (input.userId !== undefined) {
          if (!s.users.some((u) => u.id === input.userId)) throw new RepoError('not_found', 'user not found');
          if (s.catalog.landlords.some((l) => l.userId === input.userId)) {
            throw new RepoError('conflict', 'user already has a landlord record');
          }
        }
        const landlord: Landlord = {
          ...structuredClone(input),
          name,
          id: crypto.randomUUID(),
          verified: false,
          createdAt: ctx.now(),
        };
        s.catalog.landlords.push(landlord);
        return structuredClone(landlord);
      }),
    upsertProperty: (input) =>
      ctx.write((s) => {
        if (input.landlordId !== undefined && !s.catalog.landlords.some((l) => l.id === input.landlordId)) {
          throw new RepoError('not_found', 'landlord not found');
        }
        const props = s.catalog.properties;
        if (props.some((p) => p.slug === input.slug && p.id !== input.id)) {
          throw new RepoError('conflict', 'slug already in use');
        }
        const idx = input.id === undefined ? -1 : props.findIndex((p) => p.id === input.id);
        const row = { ...structuredClone(input), id: input.id ?? crypto.randomUUID() };
        if (idx === -1) {
          const inserted = { ...row, dataStatus: 'unverified_seed' as const };
          props.push(inserted);
          return structuredClone(inserted);
        }
        props[idx] = row;
        return structuredClone(row);
      }),
    upsertFloorPlan: (input) =>
      ctx.write((s) => {
        if (!s.catalog.properties.some((p) => p.id === input.propertyId)) {
          throw new RepoError('not_found', 'property not found');
        }
        const fps = s.catalog.floorPlans;
        const idx = input.id === undefined ? -1 : fps.findIndex((f) => f.id === input.id);
        const row = { ...structuredClone(input), id: input.id ?? crypto.randomUUID() };
        if (idx === -1) fps.push(row);
        else fps[idx] = row;
        return structuredClone(row);
      }),
    deleteFloorPlan: (id) =>
      ctx.write((s) => {
        if (s.applications.some((a) => a.floorPlanId === id && !CLOSED_STATUSES.has(a.status))) {
          throw new RepoError('conflict', 'this floor plan has open applications; decide or wait for them to be withdrawn first');
        }
        s.catalog.floorPlans = s.catalog.floorPlans.filter((f) => f.id !== id);
        const photoIds = new Set(s.catalog.photos.filter((p) => p.floorPlanId === id).map((p) => p.id));
        s.catalog.photos = s.catalog.photos.filter((p) => !photoIds.has(p.id));
        s.photoRatings = s.photoRatings.filter((r) => !photoIds.has(r.photoId));
        s.saves = s.saves.filter((x) => x.floorPlanId !== id);
        s.shortlist = s.shortlist.filter((x) => x.floorPlanId !== id);
        s.votes = s.votes.filter((x) => x.floorPlanId !== id);
      }),
    upsertPhoto: (input) =>
      ctx.write((s) => {
        if (!s.catalog.properties.some((p) => p.id === input.propertyId)) {
          throw new RepoError('not_found', 'property not found');
        }
        const photos = s.catalog.photos;
        const idx = input.id === undefined ? -1 : photos.findIndex((p) => p.id === input.id);
        const existing = idx === -1 ? undefined : photos[idx];
        const row: Photo = {
          ...structuredClone(input),
          id: input.id ?? crypto.randomUUID(),
          ratingCount: existing?.ratingCount ?? 0,
        };
        if (existing?.looksRating !== undefined) row.looksRating = existing.looksRating;
        if (idx === -1) photos.push(row);
        else photos[idx] = row;
        return structuredClone(row);
      }),
    deletePhoto: (id) =>
      ctx.write((s) => {
        s.catalog.photos = s.catalog.photos.filter((p) => p.id !== id);
        s.photoRatings = s.photoRatings.filter((r) => r.photoId !== id);
      }),
    upsertAccessibility: (info) =>
      ctx.write((s) => {
        if (!s.catalog.properties.some((p) => p.id === info.propertyId)) {
          throw new RepoError('not_found', 'property not found');
        }
        const row = structuredClone(info);
        const idx = s.catalog.accessibility.findIndex((a) => a.propertyId === info.propertyId);
        if (idx === -1) s.catalog.accessibility.push(row);
        else s.catalog.accessibility[idx] = row;
        return structuredClone(row);
      }),
    confirmAvailability: (floorPlanId, unitsAvailable, on) =>
      ctx.write((s) => {
        if (unitsAvailable !== null && (!Number.isFinite(unitsAvailable) || unitsAvailable < 0)) {
          throw new RepoError('invalid', 'unitsAvailable must be >= 0');
        }
        const fp = s.catalog.floorPlans.find((f) => f.id === floorPlanId);
        if (!fp) throw new RepoError('not_found', 'floor plan not found');
        fp.unitsAvailable = unitsAvailable;
        fp.lastVerified = on;
        const prop = s.catalog.properties.find((p) => p.id === fp.propertyId);
        if (prop) prop.lastVerified = on;
        return structuredClone(fp);
      }),
  };
}
