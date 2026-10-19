import type { FloorPlan, Listing, Photo } from '@homed/core';
import { RepoError, type CatalogRepo } from '../repository';
import type { Ctx } from './store';
import type { State } from './state';

function listingFor(s: State, floorPlan: FloorPlan): Listing | null {
  const property = s.catalog.properties.find((p) => p.id === floorPlan.propertyId);
  if (!property) return null;
  const photos = s.catalog.photos.filter(
    (ph) => ph.propertyId === property.id && (ph.floorPlanId === undefined || ph.floorPlanId === floorPlan.id),
  );
  const accessibility = s.catalog.accessibility.find((a) => a.propertyId === property.id);
  const listing: Listing = { property, floorPlan, photos };
  if (accessibility) listing.accessibility = accessibility;
  return structuredClone(listing);
}

function nonNull<T>(x: T | null): x is T {
  return x !== null;
}

export function catalogRepo(ctx: Ctx): CatalogRepo {
  return {
    listListings: () => ctx.read((s) => s.catalog.floorPlans.map((f) => listingFor(s, f)).filter(nonNull)),
    getListing: (floorPlanId) =>
      ctx.read((s) => {
        const f = s.catalog.floorPlans.find((x) => x.id === floorPlanId);
        return f ? listingFor(s, f) : null;
      }),
    getProperty: (id) =>
      ctx.read((s) => {
        const p = s.catalog.properties.find((x) => x.id === id);
        return p ? structuredClone(p) : null;
      }),
    getPropertyBySlug: (slug) =>
      ctx.read((s) => {
        const p = s.catalog.properties.find((x) => x.slug === slug);
        return p ? structuredClone(p) : null;
      }),
    listPropertyListings: (propertyId) =>
      ctx.read((s) =>
        s.catalog.floorPlans
          .filter((f) => f.propertyId === propertyId)
          .map((f) => listingFor(s, f))
          .filter(nonNull),
      ),
    listBuildings: () => ctx.read((s) => structuredClone(s.catalog.buildings)),
    listLandmarks: () => ctx.read((s) => structuredClone(s.catalog.landmarks)),
    listMajors: () => ctx.read((s) => structuredClone(s.catalog.majors)),
    listSections: (term) =>
      ctx.read((s) =>
        structuredClone(term === undefined ? s.catalog.sections : s.catalog.sections.filter((x) => x.term === term)),
      ),
    listWalkTimes: (propertyIds) =>
      ctx.read((s) => {
        const set = propertyIds ? new Set(propertyIds) : null;
        return structuredClone(set ? s.catalog.walkTimes.filter((w) => set.has(w.propertyId)) : s.catalog.walkTimes);
      }),
    ratePhoto: (userId, photoId, rating) =>
      ctx.write((s): Photo => {
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          throw new RepoError('invalid', 'rating must be an integer from 1 to 5');
        }
        const photo = s.catalog.photos.find((p) => p.id === photoId);
        if (!photo) throw new RepoError('not_found', `photo ${photoId} not found`);
        const mine = s.photoRatings.filter((r) => r.photoId === photoId);
        const userSum = mine.reduce((a, r) => a + r.rating, 0);
        // Seed rating (if any) counts as prior ratings; recover it from the current aggregate.
        const baseCount = photo.ratingCount - mine.length;
        const baseSum = Math.round(((photo.looksRating ?? 0) * photo.ratingCount - userSum) * 1e6) / 1e6;
        const existing = mine.find((r) => r.userId === userId);
        const newUserSum = existing ? userSum - existing.rating + rating : userSum + rating;
        const newUserCount = existing ? mine.length : mine.length + 1;
        if (existing) existing.rating = rating;
        else s.photoRatings.push({ photoId, userId, rating });
        photo.ratingCount = baseCount + newUserCount;
        photo.looksRating = (baseSum + newUserSum) / photo.ratingCount;
        return structuredClone(photo);
      }),
  };
}
