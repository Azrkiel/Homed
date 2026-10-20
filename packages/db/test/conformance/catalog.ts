import { beforeEach, describe, expect, it } from 'vitest';
import type { Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

export function catalogConformance(makeRepo: MakeRepo): void {
  describe('catalog', () => {
    let repo: Repository;
    beforeEach(async () => {
      repo = await makeRepo();
    });

    it('listListings returns one listing per floor plan', async () => {
      const listings = await repo.listListings();
      expect(listings.map((l) => l.floorPlan.id).sort()).toEqual(
        [FX.fp4x4, FX.fpOnGrounds, FX.fpRugby, FX.fpStudio].sort(),
      );
      for (const l of listings) expect(l.property.id).toBe(l.floorPlan.propertyId);
    });

    it('getListing joins property, floor plan, photos and accessibility', async () => {
      const l = await repo.getListing(FX.fp4x4);
      expect(l).not.toBeNull();
      expect(l?.property.id).toBe(FX.propertyLofts);
      expect(l?.floorPlan.id).toBe(FX.fp4x4);
      expect(l?.accessibility?.propertyId).toBe(FX.propertyLofts);
    });

    it('listing photos are property photos without a floor plan plus that floor plan photos', async () => {
      const four = await repo.getListing(FX.fp4x4);
      expect(four?.photos.map((p) => p.id).sort()).toEqual([FX.photoProperty, FX.photoFloorPlan].sort());
      const studio = await repo.getListing(FX.fpStudio);
      expect(studio?.photos.map((p) => p.id)).toEqual([FX.photoProperty]);
    });

    it('getListing returns null for an unknown floor plan', async () => {
      expect(await repo.getListing('nope')).toBeNull();
    });

    it('listPropertyListings returns only that property floor plans', async () => {
      const ls = await repo.listPropertyListings(FX.propertyLofts);
      expect(ls.map((l) => l.floorPlan.id).sort()).toEqual([FX.fp4x4, FX.fpStudio].sort());
      expect(await repo.listPropertyListings('nope')).toEqual([]);
    });

    it('getProperty and getPropertyBySlug find a property or return null', async () => {
      expect((await repo.getProperty(FX.propertyRugby))?.id).toBe(FX.propertyRugby);
      expect((await repo.getPropertyBySlug(FX.slugLofts))?.id).toBe(FX.propertyLofts);
      expect(await repo.getProperty('nope')).toBeNull();
      expect(await repo.getPropertyBySlug('nope')).toBeNull();
    });

    it('lists buildings, landmarks and majors', async () => {
      expect((await repo.listBuildings()).map((b) => b.id)).toContain(FX.buildingThornton);
      expect((await repo.listLandmarks()).map((b) => b.id).sort()).toEqual(['afc', 'corner', 'lawn']);
      expect((await repo.listMajors()).map((m) => m.id)).toContain(FX.majorEngineering);
    });

    it('listSections filters by term and returns [] for an unknown term', async () => {
      const all = await repo.listSections();
      expect(Array.isArray(all)).toBe(true);
      expect(await repo.listSections('no-such-term')).toEqual([]);
      for (const s of await repo.listSections(all[0]?.term ?? 'x')) expect(s.term).toBe(all[0]?.term ?? 'x');
    });

    it('listWalkTimes returns all rows or only the requested properties', async () => {
      const all = await repo.listWalkTimes();
      expect(all.length).toBe(18);
      const some = await repo.listWalkTimes([FX.propertyLofts]);
      expect(some.length).toBe(6);
      expect(some.every((w) => w.propertyId === FX.propertyLofts)).toBe(true);
      expect(await repo.listWalkTimes(['nope'])).toEqual([]);
      expect(await repo.listWalkTimes([])).toEqual([]);
    });

    it('returned catalog objects are copies', async () => {
      const l = await repo.getListing(FX.fp4x4);
      if (!l) throw new Error('missing listing');
      l.property.name = 'mutated';
      l.floorPlan.rentAmount = 1;
      l.photos.length = 0;
      const p = await repo.getProperty(FX.propertyLofts);
      if (!p) throw new Error('missing property');
      p.name = 'mutated';
      const again = await repo.getListing(FX.fp4x4);
      expect(again?.property.name).not.toBe('mutated');
      expect(again?.floorPlan.rentAmount).not.toBe(1);
      expect(again?.photos.length).toBe(2);
      (await repo.listBuildings()).length = 0;
      expect((await repo.listBuildings()).length).toBeGreaterThan(0);
      (await repo.listWalkTimes()).length = 0;
      expect((await repo.listWalkTimes()).length).toBe(18);
    });

    describe('ratePhoto', () => {
      it('rejects ratings outside 1-5 or non-integer', async () => {
        const u = await makeStudent(repo);
        for (const bad of [0, 6, -1, 2.5, Number.NaN]) {
          await expectRepoError(repo.ratePhoto(u.id, FX.photoFloorPlan, bad), 'invalid');
        }
      });

      it('rejects an unknown photo with not_found', async () => {
        const u = await makeStudent(repo);
        await expectRepoError(repo.ratePhoto(u.id, 'nope', 3), 'not_found');
      });

      it('first rating of an unrated photo sets the mean and count', async () => {
        const u = await makeStudent(repo);
        const p = await repo.ratePhoto(u.id, FX.photoFloorPlan, 4);
        expect(p.id).toBe(FX.photoFloorPlan);
        expect(p.looksRating).toBe(4);
        expect(p.ratingCount).toBe(1);
      });

      it('averages ratings from several users', async () => {
        const a = await makeStudent(repo, 'Ann');
        const b = await makeStudent(repo, 'Ben');
        await repo.ratePhoto(a.id, FX.photoFloorPlan, 5);
        const p = await repo.ratePhoto(b.id, FX.photoFloorPlan, 2);
        expect(p.looksRating).toBeCloseTo(3.5, 9);
        expect(p.ratingCount).toBe(2);
      });

      it('re-rating by the same user replaces the earlier rating', async () => {
        const a = await makeStudent(repo, 'Ann');
        await repo.ratePhoto(a.id, FX.photoFloorPlan, 1);
        const p = await repo.ratePhoto(a.id, FX.photoFloorPlan, 5);
        expect(p.looksRating).toBe(5);
        expect(p.ratingCount).toBe(1);
      });

      it('seeded rating counts as prior ratings', async () => {
        const before = (await repo.getListing(FX.fp4x4))?.photos.find((p) => p.id === FX.photoProperty);
        const seedMean = before?.looksRating ?? 0;
        const seedCount = before?.ratingCount ?? 0;
        expect(seedCount).toBeGreaterThan(0);
        const a = await makeStudent(repo, 'Ann');
        const b = await makeStudent(repo, 'Ben');
        const p1 = await repo.ratePhoto(a.id, FX.photoProperty, 5);
        expect(p1.ratingCount).toBe(seedCount + 1);
        expect(p1.looksRating).toBeCloseTo((seedMean * seedCount + 5) / (seedCount + 1), 9);
        const p2 = await repo.ratePhoto(b.id, FX.photoProperty, 1);
        expect(p2.looksRating).toBeCloseTo((seedMean * seedCount + 6) / (seedCount + 2), 9);
        // replacing keeps the seed contribution intact
        const p3 = await repo.ratePhoto(a.id, FX.photoProperty, 3);
        expect(p3.ratingCount).toBe(seedCount + 2);
        expect(p3.looksRating).toBeCloseTo((seedMean * seedCount + 4) / (seedCount + 2), 9);
      });

      it('updated rating is visible through listings', async () => {
        const a = await makeStudent(repo, 'Ann');
        await repo.ratePhoto(a.id, FX.photoFloorPlan, 3);
        const l = await repo.getListing(FX.fp4x4);
        const photo = l?.photos.find((p) => p.id === FX.photoFloorPlan);
        expect(photo?.looksRating).toBe(3);
        expect(photo?.ratingCount).toBe(1);
      });

      it('returned photo is a copy', async () => {
        const a = await makeStudent(repo, 'Ann');
        const p = await repo.ratePhoto(a.id, FX.photoFloorPlan, 3);
        p.looksRating = 1;
        p.ratingCount = 99;
        const l = await repo.getListing(FX.fp4x4);
        const photo = l?.photos.find((x) => x.id === FX.photoFloorPlan);
        expect(photo?.looksRating).toBe(3);
        expect(photo?.ratingCount).toBe(1);
      });
    });
  });
}
