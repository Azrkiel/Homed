// CatalogRepo on Supabase. Mirrors packages/db/src/json/catalog.ts.
// Ordering: the JSON store returns seed-array order. The schema keeps no position column, so every
// list here is ordered by primary key (see report). Filtering and copies match the JSON store.
import type { AccessibilityInfo, FloorPlan, ID, Listing, Photo, Property } from '@homed/core';
import { RepoError, type CatalogRepo } from '../repository';
import {
  accessibilityFromRow,
  type AccessibilityRow,
  buildingFromRow,
  type BuildingRow,
  floorPlanFromRow,
  type FloorPlanRow,
  landmarkFromRow,
  type LandmarkRow,
  listingFrom,
  majorBuildingRows,
  majorFromRow,
  type MajorBuildingRow,
  type MajorRow,
  photoFromRow,
  type PhotoRatingRow,
  type PhotoRow,
  propertyFromRow,
  type PropertyRow,
  sectionFromRow,
  type SectionRow,
  walkTimeFromRow,
  type WalkTimeRow,
} from './mappers';
import { chunks, IN_CHUNK, selectAll, type SupabaseCtx, unwrap, unwrapOne } from './client';

function notNull<T>(x: T | null): x is T {
  return x !== null;
}

/** One user rating of one photo (the same shape as the JSON store's PhotoRating). */
interface PhotoRating {
  photoId: string;
  userId: string;
  rating: number;
}

/** Loads the property, photos and accessibility for these floor plans and joins them in memory. */
async function joinListings(ctx: SupabaseCtx, floorPlanRows: FloorPlanRow[]): Promise<Listing[]> {
  const floorPlans = floorPlanRows.map(floorPlanFromRow);
  const propertyIds = [...new Set(floorPlans.map((f) => f.propertyId))];
  const properties = new Map<ID, Property>();
  const photos: Photo[] = [];
  const accessibility = new Map<ID, AccessibilityInfo>();
  for (const ids of chunks(propertyIds, IN_CHUNK)) {
    const pRows = await selectAll<PropertyRow>((f, t) =>
      ctx.sb.from('properties').select('*').in('id', ids).order('id').range(f, t),
    );
    for (const r of pRows) properties.set(r.id, propertyFromRow(r));
    const phRows = await selectAll<PhotoRow>((f, t) =>
      ctx.sb.from('photos').select('*').in('property_id', ids).order('id').range(f, t),
    );
    photos.push(...phRows.map(photoFromRow));
    const aRows = await selectAll<AccessibilityRow>((f, t) =>
      ctx.sb.from('accessibility').select('*').in('property_id', ids).order('property_id').range(f, t),
    );
    for (const r of aRows) accessibility.set(r.property_id, accessibilityFromRow(r));
  }
  return floorPlans
    .map((f) => {
      const property = properties.get(f.propertyId);
      return property ? listingFrom(f, property, photos, accessibility.get(property.id)) : null;
    })
    .filter(notNull);
}

/** Single-property listing set: property, its photos and accessibility, then the join. */
async function listingsForProperty(ctx: SupabaseCtx, propertyId: ID, floorPlanRows: FloorPlanRow[]): Promise<Listing[]> {
  if (floorPlanRows.length === 0) return [];
  const property = unwrap(await ctx.sb.from('properties').select('*').eq('id', propertyId).maybeSingle());
  if (!property) return [];
  const photoRows = await selectAll<PhotoRow>((f, t) =>
    ctx.sb.from('photos').select('*').eq('property_id', propertyId).order('id').range(f, t),
  );
  const acc = unwrap(
    await ctx.sb.from('accessibility').select('*').eq('property_id', propertyId).maybeSingle(),
  ) as AccessibilityRow | null;
  const prop = propertyFromRow(property as PropertyRow);
  const photos = photoRows.map(photoFromRow);
  const accessibility = acc ? accessibilityFromRow(acc) : undefined;
  return floorPlanRows.map((f) => listingFrom(floorPlanFromRow(f), prop, photos, accessibility));
}

export function catalogRepo(ctx: SupabaseCtx): CatalogRepo {
  const { sb } = ctx;
  return {
    listListings: async () => {
      const fps = await selectAll<FloorPlanRow>((f, t) => sb.from('floor_plans').select('*').order('id').range(f, t));
      return joinListings(ctx, fps);
    },

    getListing: async (floorPlanId) => {
      const fp = unwrap(await sb.from('floor_plans').select('*').eq('id', floorPlanId).maybeSingle()) as FloorPlanRow | null;
      if (!fp) return null;
      const [listing] = await listingsForProperty(ctx, fp.property_id, [fp]);
      return listing ?? null;
    },

    getProperty: async (id) => {
      const row = unwrap(await sb.from('properties').select('*').eq('id', id).maybeSingle()) as PropertyRow | null;
      return row ? propertyFromRow(row) : null;
    },

    getPropertyBySlug: async (slug) => {
      const row = unwrap(await sb.from('properties').select('*').eq('slug', slug).maybeSingle()) as PropertyRow | null;
      return row ? propertyFromRow(row) : null;
    },

    listPropertyListings: async (propertyId) => {
      const fps = await selectAll<FloorPlanRow>((f, t) =>
        sb.from('floor_plans').select('*').eq('property_id', propertyId).order('id').range(f, t),
      );
      return listingsForProperty(ctx, propertyId, fps);
    },

    listBuildings: async () => {
      const rows = await selectAll<BuildingRow>((f, t) => sb.from('buildings').select('*').order('id').range(f, t));
      return rows.map(buildingFromRow);
    },

    listLandmarks: async () => {
      const rows = await selectAll<LandmarkRow>((f, t) => sb.from('landmarks').select('*').order('id').range(f, t));
      return rows.map(landmarkFromRow);
    },

    listMajors: async () => {
      const rows = await selectAll<MajorRow>((f, t) => sb.from('majors').select('*').order('id').range(f, t));
      const links = await selectAll<MajorBuildingRow>((f, t) =>
        sb.from('major_buildings').select('*').order('major_id').order('building_id').range(f, t),
      );
      return rows.map((r) => majorFromRow(r, links));
    },

    listSections: async (term) => {
      const rows =
        term === undefined
          ? await selectAll<SectionRow>((f, t) => sb.from('sections').select('*').order('id').range(f, t))
          : await selectAll<SectionRow>((f, t) =>
              sb.from('sections').select('*').eq('term', term).order('id').range(f, t),
            );
      return rows.map(sectionFromRow);
    },

    listWalkTimes: async (propertyIds) => {
      if (propertyIds === undefined) {
        const rows = await selectAll<WalkTimeRow>((f, t) =>
          sb.from('walk_times').select('*').order('property_id').order('target_id').range(f, t),
        );
        return rows.map(walkTimeFromRow);
      }
      const out: WalkTimeRow[] = [];
      for (const ids of chunks([...new Set(propertyIds)], IN_CHUNK)) {
        out.push(
          ...(await selectAll<WalkTimeRow>((f, t) =>
            sb.from('walk_times').select('*').in('property_id', ids).order('property_id').order('target_id').range(f, t),
          )),
        );
      }
      return out.map(walkTimeFromRow);
    },

    ratePhoto: async (userId, photoId, rating) => {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new RepoError('invalid', 'rating must be an integer from 1 to 5');
      }
      const photoRow = unwrap(await sb.from('photos').select('*').eq('id', photoId).maybeSingle()) as PhotoRow | null;
      if (!photoRow) throw new RepoError('not_found', `photo ${photoId} not found`);
      const mineRows = await selectAll<PhotoRatingRow>((f, t) =>
        sb.from('photo_ratings').select('*').eq('photo_id', photoId).order('user_id').range(f, t),
      );
      const mine: PhotoRating[] = mineRows.map((r) => ({ photoId: r.photo_id, userId: r.user_id, rating: r.rating }));

      // Same arithmetic as the JSON store: the seed aggregate minus the per-user ratings is the base.
      const userSum = mine.reduce((a, r) => a + r.rating, 0);
      const looks = photoRow.looks_rating === null ? 0 : Number(photoRow.looks_rating);
      const baseCount = Number(photoRow.rating_count) - mine.length;
      const baseSum = Math.round((looks * Number(photoRow.rating_count) - userSum) * 1e6) / 1e6;
      const existing = mine.find((r) => r.userId === userId);
      const newUserSum = existing ? userSum - existing.rating + rating : userSum + rating;
      const newUserCount = existing ? mine.length : mine.length + 1;
      const ratingCount = baseCount + newUserCount;
      const looksRating = (baseSum + newUserSum) / ratingCount;

      const ratingRow: PhotoRatingRow = { photo_id: photoId, user_id: userId, rating };
      unwrap(await sb.from('photo_ratings').upsert(ratingRow, { onConflict: 'photo_id,user_id' }));
      const updated = unwrapOne(
        await sb.from('photos').update({ looks_rating: looksRating, rating_count: ratingCount }).eq('id', photoId).select('*').single(),
      ) as PhotoRow;
      return photoFromRow(updated);
    },
  };
}
