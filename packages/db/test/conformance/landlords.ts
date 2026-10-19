import type { AccessibilityInfo, FloorPlan, Property, User } from '@homed/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

export function landlordsConformance(makeRepo: MakeRepo): void {
  describe('landlords', () => {
    let repo: Repository;
    let lee: User;

    beforeEach(async () => {
      repo = await makeRepo();
      lee = await repo.createUser({ email: 'lee@example.com', name: 'Lee', role: 'landlord' });
    });

    async function baseProperty(): Promise<Omit<Property, 'id'>> {
      const { id: _id, ...rest } = (await repo.getProperty(FX.propertyLofts)) as Property;
      return { ...rest, slug: 'new-place', name: 'New Place', dataStatus: 'verified' };
    }

    async function baseFloorPlan(propertyId: string = FX.propertyLofts): Promise<Omit<FloorPlan, 'id'>> {
      const { id: _id, ...rest } = (await repo.getListing(FX.fp4x4))!.floorPlan;
      return { ...rest, propertyId, name: 'Brand new plan' };
    }

    describe('landlord records', () => {
      it('lists the seeded landlords', async () => {
        const all = await repo.listLandlords();
        expect(all.map((l) => l.id)).toContain('ll-fixture');
      });

      it('getLandlord finds seed landlords and returns null for unknown ids', async () => {
        expect((await repo.getLandlord('ll-fixture'))?.name).toBe('Fixture Property Management');
        expect(await repo.getLandlord('nope')).toBeNull();
      });

      it('createLandlord generates id and createdAt and is unverified', async () => {
        const l = await repo.createLandlord({ name: 'Acme Rentals', email: 'hi@acme.example', userId: lee.id });
        expect(l.id).toBeTruthy();
        expect(l.verified).toBe(false);
        expect(l.name).toBe('Acme Rentals');
        expect(l.email).toBe('hi@acme.example');
        expect(l.userId).toBe(lee.id);
        expect(Number.isNaN(Date.parse(l.createdAt))).toBe(false);
        expect(await repo.getLandlord(l.id)).toEqual(l);
        expect((await repo.listLandlords()).map((x) => x.id)).toContain(l.id);
      });

      it('createLandlord without a user works', async () => {
        const l = await repo.createLandlord({ name: 'No Login LLC' });
        expect(l.userId).toBeUndefined();
      });

      it('createLandlord trims the name and rejects a blank one', async () => {
        expect((await repo.createLandlord({ name: '  Acme  ' })).name).toBe('Acme');
        await expectRepoError(repo.createLandlord({ name: '   ' }), 'invalid');
      });

      it('createLandlord rejects an unknown user', async () => {
        await expectRepoError(repo.createLandlord({ name: 'Acme', userId: 'nobody' }), 'not_found');
      });

      it('a user may have only one landlord record', async () => {
        await repo.createLandlord({ name: 'Acme', userId: lee.id });
        await expectRepoError(repo.createLandlord({ name: 'Acme 2', userId: lee.id }), 'conflict');
      });

      it('getLandlordByUser finds the record or null', async () => {
        expect(await repo.getLandlordByUser(lee.id)).toBeNull();
        const l = await repo.createLandlord({ name: 'Acme', userId: lee.id });
        expect(await repo.getLandlordByUser(lee.id)).toEqual(l);
        const stu = await makeStudent(repo, 'Sam');
        expect(await repo.getLandlordByUser(stu.id)).toBeNull();
      });

      it('returned landlords are copies', async () => {
        const l = await repo.createLandlord({ name: 'Acme' });
        l.name = 'mutated';
        expect((await repo.getLandlord(l.id))?.name).toBe('Acme');
      });
    });

    describe('upsertProperty', () => {
      it('inserts with a generated id and forces unverified_seed', async () => {
        const p = await repo.upsertProperty(await baseProperty());
        expect(p.id).toBeTruthy();
        expect(p.id).not.toBe(FX.propertyLofts);
        expect(p.dataStatus).toBe('unverified_seed');
        expect(await repo.getProperty(p.id)).toEqual(p);
        expect(await repo.getPropertyBySlug('new-place')).toEqual(p);
      });

      it('links to an existing landlord', async () => {
        const l = await repo.createLandlord({ name: 'Acme', userId: lee.id });
        const p = await repo.upsertProperty({ ...(await baseProperty()), landlordId: l.id });
        expect(p.landlordId).toBe(l.id);
      });

      it('rejects an unknown landlord', async () => {
        await expectRepoError(repo.upsertProperty({ ...(await baseProperty()), landlordId: 'nope' }), 'not_found');
      });

      it('rejects a slug used by another property', async () => {
        await expectRepoError(repo.upsertProperty({ ...(await baseProperty()), slug: FX.slugLofts }), 'conflict');
      });

      it('updates an existing property in place, keeping the dataStatus the caller passes', async () => {
        const current = (await repo.getProperty(FX.propertyLofts)) as Property;
        const updated = await repo.upsertProperty({ ...current, name: 'Renamed Lofts', dataStatus: 'verified' });
        expect(updated.id).toBe(FX.propertyLofts);
        expect(updated.name).toBe('Renamed Lofts');
        expect(updated.dataStatus).toBe('verified');
        expect(await repo.getProperty(FX.propertyLofts)).toEqual(updated);
      });

      it('an update may keep its own slug', async () => {
        const current = (await repo.getProperty(FX.propertyLofts)) as Property;
        await expect(repo.upsertProperty({ ...current, neighborhood: 'Downtown' })).resolves.toBeTruthy();
      });

      it('an update may not take another property slug', async () => {
        const current = (await repo.getProperty(FX.propertyLofts)) as Property;
        await expectRepoError(repo.upsertProperty({ ...current, slug: 'fixture-rugby-house' }), 'conflict');
      });

      it('an update does not touch other properties or floor plans', async () => {
        const before = await repo.listListings();
        const current = (await repo.getProperty(FX.propertyLofts)) as Property;
        await repo.upsertProperty({ ...current, name: 'Renamed Lofts' });
        const after = await repo.listListings();
        expect(after).toHaveLength(before.length);
        expect(await repo.getListing(FX.fpRugby)).toEqual(before.find((l) => l.floorPlan.id === FX.fpRugby));
        expect((await repo.getListing(FX.fp4x4))?.property.name).toBe('Renamed Lofts');
      });

      it('a new property has no listings until it gets floor plans', async () => {
        const p = await repo.upsertProperty(await baseProperty());
        expect(await repo.listPropertyListings(p.id)).toEqual([]);
      });
    });

    describe('upsertFloorPlan', () => {
      it('inserts and shows up in listings immediately', async () => {
        const before = (await repo.listListings()).length;
        const fp = await repo.upsertFloorPlan(await baseFloorPlan());
        expect(fp.id).toBeTruthy();
        expect(fp.name).toBe('Brand new plan');
        expect(await repo.listListings()).toHaveLength(before + 1);
        expect((await repo.getListing(fp.id))?.floorPlan).toEqual(fp);
        expect((await repo.listPropertyListings(FX.propertyLofts)).map((l) => l.floorPlan.id)).toContain(fp.id);
      });

      it('rejects an unknown property', async () => {
        await expectRepoError(repo.upsertFloorPlan(await baseFloorPlan('p-nope')), 'not_found');
      });

      it('updates an existing floor plan by id', async () => {
        const before = (await repo.listListings()).length;
        const current = (await repo.getListing(FX.fp4x4))!.floorPlan;
        const fp = await repo.upsertFloorPlan({ ...current, rentAmount: 1111 });
        expect(fp.id).toBe(FX.fp4x4);
        expect(fp.rentAmount).toBe(1111);
        expect((await repo.getListing(FX.fp4x4))?.floorPlan.rentAmount).toBe(1111);
        expect(await repo.listListings()).toHaveLength(before);
      });

      it('returns a copy', async () => {
        const fp = await repo.upsertFloorPlan(await baseFloorPlan());
        fp.rentAmount = 1;
        expect((await repo.getListing(fp.id))?.floorPlan.rentAmount).not.toBe(1);
      });
    });

    describe('deleteFloorPlan', () => {
      it('removes the floor plan from listings', async () => {
        const before = (await repo.listListings()).length;
        await repo.deleteFloorPlan(FX.fp4x4);
        expect(await repo.getListing(FX.fp4x4)).toBeNull();
        expect(await repo.listListings()).toHaveLength(before - 1);
        expect(await repo.getListing(FX.fpStudio)).not.toBeNull();
      });

      it('unknown id is a no-op', async () => {
        await expect(repo.deleteFloorPlan('nope')).resolves.toBeUndefined();
      });

      it('removes saves, shortlist items and votes for that floor plan only', async () => {
        const stu = await makeStudent(repo, 'Sam');
        const g = await repo.createGroup(stu.id, 'Crew');
        await repo.addSave(stu.id, FX.fp4x4);
        await repo.addSave(stu.id, FX.fpStudio);
        await repo.addToShortlist(g.id, stu.id, FX.fp4x4);
        await repo.addToShortlist(g.id, stu.id, FX.fpStudio);
        await repo.castVote(g.id, stu.id, FX.fp4x4, 1);
        await repo.castVote(g.id, stu.id, FX.fpStudio, 1);
        await repo.deleteFloorPlan(FX.fp4x4);
        expect((await repo.listSaves(stu.id)).map((x) => x.floorPlanId)).toEqual([FX.fpStudio]);
        expect((await repo.listShortlist(g.id)).map((x) => x.floorPlanId)).toEqual([FX.fpStudio]);
        expect((await repo.listVotes(g.id)).map((x) => x.floorPlanId)).toEqual([FX.fpStudio]);
      });

      it('removes photos tied to the floor plan and keeps property photos', async () => {
        await repo.deleteFloorPlan(FX.fp4x4);
        const listing = await repo.getListing(FX.fpStudio);
        const ids = listing?.photos.map((p) => p.id) ?? [];
        expect(ids).toContain(FX.photoProperty);
        expect(ids).not.toContain(FX.photoFloorPlan);
      });

      it('a re-added floor plan does not resurrect old photos', async () => {
        const base = await baseFloorPlan();
        await repo.deleteFloorPlan(FX.fp4x4);
        const fp = await repo.upsertFloorPlan({ ...base, id: FX.fp4x4 });
        const photos = (await repo.getListing(fp.id))?.photos.map((p) => p.id) ?? [];
        expect(photos).not.toContain(FX.photoFloorPlan);
      });
    });

    describe('photos', () => {
      const newPhoto = { propertyId: FX.propertyLofts, url: 'https://img.example/x.jpg', alt: 'x', isRendering: false };

      it('insert generates an id, no looksRating and ratingCount 0', async () => {
        const ph = await repo.upsertPhoto(newPhoto);
        expect(ph.id).toBeTruthy();
        expect(ph.looksRating).toBeUndefined();
        expect(ph.ratingCount).toBe(0);
        const listing = await repo.getListing(FX.fpStudio);
        expect(listing?.photos.map((p) => p.id)).toContain(ph.id);
      });

      it('a floor-plan photo shows only on that floor plan', async () => {
        const ph = await repo.upsertPhoto({ ...newPhoto, floorPlanId: FX.fp4x4 });
        expect((await repo.getListing(FX.fp4x4))?.photos.map((p) => p.id)).toContain(ph.id);
        expect((await repo.getListing(FX.fpStudio))?.photos.map((p) => p.id)).not.toContain(ph.id);
      });

      it('rejects an unknown property', async () => {
        await expectRepoError(repo.upsertPhoto({ ...newPhoto, propertyId: 'p-nope' }), 'not_found');
      });

      it('update replaces fields but keeps looksRating and ratingCount', async () => {
        const stu = await makeStudent(repo, 'Sam');
        const rated = await repo.ratePhoto(stu.id, FX.photoProperty, 5);
        const updated = await repo.upsertPhoto({
          id: FX.photoProperty,
          propertyId: FX.propertyLofts,
          url: 'https://img.example/new.jpg',
          alt: 'new alt',
          isRendering: false,
        });
        expect(updated.id).toBe(FX.photoProperty);
        expect(updated.url).toBe('https://img.example/new.jpg');
        expect(updated.alt).toBe('new alt');
        expect(updated.looksRating).toBe(rated.looksRating);
        expect(updated.ratingCount).toBe(rated.ratingCount);
      });

      it('deletePhoto removes it from listings', async () => {
        await repo.deletePhoto(FX.photoProperty);
        expect((await repo.getListing(FX.fpStudio))?.photos.map((p) => p.id)).not.toContain(FX.photoProperty);
      });

      it('deletePhoto of an unknown id is a no-op', async () => {
        await expect(repo.deletePhoto('nope')).resolves.toBeUndefined();
      });

      it('deleting a photo drops its ratings so a recreated photo starts fresh', async () => {
        const stu = await makeStudent(repo, 'Sam');
        await repo.ratePhoto(stu.id, FX.photoProperty, 5);
        await repo.deletePhoto(FX.photoProperty);
        const ph = await repo.upsertPhoto({
          id: FX.photoProperty,
          propertyId: FX.propertyLofts,
          url: 'https://img.example/again.jpg',
          alt: 'again',
          isRendering: false,
        });
        expect(ph.ratingCount).toBe(0);
        expect(ph.looksRating).toBeUndefined();
        const next = await repo.ratePhoto(stu.id, FX.photoProperty, 3);
        expect(next.ratingCount).toBe(1);
        expect(next.looksRating).toBe(3);
      });
    });

    describe('accessibility', () => {
      const info = (propertyId: string): AccessibilityInfo => ({
        propertyId,
        features: ['elevator'],
        photoConfirmed: [],
        assistanceAnimals: { serviceAnimalsAllowed: true, esaAllowed: true, noFees: true },
        updatedAt: '2026-10-19',
      });

      it('inserts info for a property that had none', async () => {
        expect((await repo.getListing(FX.fpOnGrounds))?.accessibility).toBeUndefined();
        const saved = await repo.upsertAccessibility(info(FX.propertyOnGrounds));
        expect(saved).toEqual(info(FX.propertyOnGrounds));
        expect((await repo.getListing(FX.fpOnGrounds))?.accessibility).toEqual(saved);
      });

      it('replaces existing info keyed by propertyId', async () => {
        const saved = await repo.upsertAccessibility(info(FX.propertyLofts));
        expect(saved.features).toEqual(['elevator']);
        const listing = await repo.getListing(FX.fp4x4);
        expect(listing?.accessibility).toEqual(saved);
        expect(listing?.accessibility?.accommodationContact).toBeUndefined();
      });

      it('rejects an unknown property', async () => {
        await expectRepoError(repo.upsertAccessibility(info('p-nope')), 'not_found');
      });
    });

    describe('confirmAvailability', () => {
      it('sets unitsAvailable and lastVerified on the floor plan and its property', async () => {
        const fp = await repo.confirmAvailability(FX.fp4x4, 3, '2026-10-25');
        expect(fp.unitsAvailable).toBe(3);
        expect(fp.lastVerified).toBe('2026-10-25');
        const listing = await repo.getListing(FX.fp4x4);
        expect(listing?.floorPlan.unitsAvailable).toBe(3);
        expect(listing?.floorPlan.lastVerified).toBe('2026-10-25');
        expect(listing?.property.lastVerified).toBe('2026-10-25');
      });

      it('accepts zero and null', async () => {
        expect((await repo.confirmAvailability(FX.fp4x4, 0, '2026-10-25')).unitsAvailable).toBe(0);
        expect((await repo.confirmAvailability(FX.fp4x4, null, '2026-10-26')).unitsAvailable).toBeNull();
      });

      it('rejects negative units and leaves the floor plan unchanged', async () => {
        const before = (await repo.getListing(FX.fp4x4))!.floorPlan;
        await expectRepoError(repo.confirmAvailability(FX.fp4x4, -1, '2026-10-25'), 'invalid');
        expect((await repo.getListing(FX.fp4x4))?.floorPlan).toEqual(before);
      });

      it('unknown floor plan is not_found', async () => {
        await expectRepoError(repo.confirmAvailability('nope', 1, '2026-10-25'), 'not_found');
      });

      it('leaves other floor plans alone', async () => {
        const before = (await repo.getListing(FX.fpRugby))!;
        await repo.confirmAvailability(FX.fp4x4, 1, '2026-10-25');
        expect(await repo.getListing(FX.fpRugby)).toEqual(before);
      });
    });
  });
}
