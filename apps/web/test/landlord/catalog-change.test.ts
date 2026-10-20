import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Property, FloorPlan, ID, User } from '@homed/core';
import { createJsonRepository, type Repository } from '@homed/db';
import { loadFixture } from '@homed/data';
import {
  confirmAvailabilityChange,
  removeFloorPlan,
  saveFloorPlan,
  saveProperty,
  withCatalogChange,
} from '../../src/lib/landlord/catalog-change';

const KEY = Buffer.alloc(32, 7).toString('base64');

let dir: string;
let repo: Repository;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'homed-landlord-'));
  repo = createJsonRepository({
    filePath: join(dir, 'db.json'),
    seed: loadFixture(),
    encryptionKey: KEY,
    clock: { now: () => new Date('2026-10-19T12:00:00.000Z') },
  });
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function propertyInput(landlordId: ID, slug = 'landlord-test-lofts'): Omit<Property, 'id'> {
  return {
    slug,
    name: 'Landlord Test Lofts',
    address: '1 Test Way',
    location: { lat: 38.03, lng: -78.5 },
    kind: 'apartment_complex',
    onGrounds: false,
    neighborhood: 'Rugby Road',
    landlordId,
    amenities: {
      gym: false,
      studyRooms: false,
      rooftop: false,
      pool: false,
      elevator: false,
      parkingAvailable: false,
      petsAllowed: false,
    },
    onBusRoute: false,
    busRoutes: [],
    studyAbroadFriendly: false,
    noGuarantorOption: false,
    source: 'landlord portal',
    dataStatus: 'unverified_seed',
    lastVerified: '2026-10-19',
  };
}

function floorPlanInput(propertyId: ID, rentAmount = 1450, unitsAvailable: number | null = 5): Omit<FloorPlan, 'id'> {
  return {
    propertyId,
    name: '4BR / 4BA',
    beds: 4,
    baths: 4,
    rentAmount,
    rentBasis: 'per_bed',
    leaseStart: '2026-08-15',
    leaseEnd: '2027-05-15',
    termKind: 'academic_year',
    leaseType: 'individual',
    furnished: false,
    utilitiesIncluded: true,
    internetIncluded: true,
    inUnitLaundry: true,
    dishwasher: true,
    ac: true,
    unitsAvailable,
    lastVerified: '2026-10-19',
  };
}

async function student(): Promise<User> {
  return repo.createUser({ email: 'amy@virginia.edu', name: 'Amy', role: 'student' });
}

async function landlordId(): Promise<ID> {
  return (await repo.createLandlord({ name: 'Hoo Rentals' })).id;
}

describe('withCatalogChange', () => {
  it('returns the write result', async () => {
    expect(await withCatalogChange(repo, async () => 42)).toBe(42);
  });

  it('a new listing fires new_listing for a user with a search alert (no filters)', async () => {
    const u = await student();
    await repo.createAlert({ userId: u.id, triggers: ['new_listing'], target: { kind: 'search', filters: {} } });
    const lid = await landlordId();

    const p = await saveProperty(repo, propertyInput(lid));
    expect(await repo.listAlertEvents(u.id)).toEqual([]); // a property alone is not a listing yet
    const fp = await saveFloorPlan(repo, floorPlanInput(p.id));

    const events = await repo.listAlertEvents(u.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      userId: u.id,
      trigger: 'new_listing',
      propertyId: p.id,
      floorPlanId: fp.id,
      message: 'New listing: Landlord Test Lofts 4BR / 4BA',
    });
  });

  it('a floor plan price drop fires price_drop', async () => {
    const lid = await landlordId();
    const p = await saveProperty(repo, propertyInput(lid));
    const fp = await saveFloorPlan(repo, floorPlanInput(p.id, 1450));

    const u = await student();
    await repo.createAlert({ userId: u.id, triggers: ['price_drop'], target: { kind: 'search', filters: {} } });
    await saveFloorPlan(repo, { ...floorPlanInput(p.id, 1395), id: fp.id });

    const events = await repo.listAlertEvents(u.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ trigger: 'price_drop', floorPlanId: fp.id });
    expect(events[0]?.message).toBe('Price drop at Landlord Test Lofts 4BR / 4BA: $1,450 -> $1,395');
  });

  it('few_left fires when availability confirmation drops to 3 or fewer units', async () => {
    const lid = await landlordId();
    const p = await saveProperty(repo, propertyInput(lid));
    const fp = await saveFloorPlan(repo, floorPlanInput(p.id, 1450, 10));

    const u = await student();
    await repo.createAlert({ userId: u.id, triggers: ['few_left'], target: { kind: 'search', filters: {} } });
    await confirmAvailabilityChange(repo, fp.id, 2, '2026-10-19');

    const events = await repo.listAlertEvents(u.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ trigger: 'few_left', floorPlanId: fp.id, message: 'Only 2 left at Landlord Test Lofts 4BR / 4BA' });
  });

  it('removing a floor plan emits no events for a user with no matching alert', async () => {
    const lid = await landlordId();
    const p = await saveProperty(repo, propertyInput(lid));
    const fp = await saveFloorPlan(repo, floorPlanInput(p.id));
    const u = await student();
    await repo.createAlert({ userId: u.id, triggers: ['new_listing'], target: { kind: 'search', filters: {} } });

    await removeFloorPlan(repo, fp.id);
    expect(await repo.listAlertEvents(u.id)).toEqual([]);
  });

  it('no alert -> no events', async () => {
    const u = await student();
    const lid = await landlordId();
    const p = await saveProperty(repo, propertyInput(lid));
    const fp = await saveFloorPlan(repo, floorPlanInput(p.id, 1450));
    await saveFloorPlan(repo, { ...floorPlanInput(p.id, 1000), id: fp.id });

    expect(await repo.listAlertEvents(u.id)).toEqual([]);
    expect(await repo.listAllAlerts()).toEqual([]);
  });

  it('a throwing write propagates the error and emits no events; a later no-op does not duplicate them', async () => {
    const u = await student();
    await repo.createAlert({ userId: u.id, triggers: ['new_listing'], target: { kind: 'search', filters: {} } });
    const lid = await landlordId();
    const boom = new Error('disk full');

    await expect(
      withCatalogChange(repo, async () => {
        const p = await repo.upsertProperty(propertyInput(lid, 'thrown-lofts'));
        await repo.upsertFloorPlan(floorPlanInput(p.id));
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(await repo.listAlertEvents(u.id)).toEqual([]);

    await withCatalogChange(repo, async () => undefined);
    expect(await repo.listAlertEvents(u.id)).toEqual([]);
  });
});
