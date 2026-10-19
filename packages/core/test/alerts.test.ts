import { describe, expect, it } from 'vitest';
import { diffForAlerts, FEW_LEFT_THRESHOLD } from '../src/alerts';
import type { Alert, AlertTrigger, FloorPlan, Listing, ListingFilters, Property } from '../src/types';

function L(id: string, f: Partial<FloorPlan> = {}, p: Partial<Property> = {}): Listing {
  return {
    property: {
      id: 'p1', slug: 'p1', name: 'Gather', address: '1 Main', location: { lat: 38, lng: -78 },
      kind: 'apartment_complex', onGrounds: false, neighborhood: 'Corner',
      amenities: {
        gym: false, studyRooms: false, rooftop: false, pool: false, elevator: false,
        parkingAvailable: false, petsAllowed: false,
      },
      onBusRoute: false, busRoutes: [], studyAbroadFriendly: false, noGuarantorOption: false,
      source: 'test', dataStatus: 'verified', lastVerified: '2026-10-19', ...p,
    } as Property,
    floorPlan: {
      id, propertyId: p.id ?? 'p1', name: '4BR', beds: 4, baths: 4, rentAmount: 5600, rentBasis: 'per_unit',
      leaseStart: '2027-08-15', leaseEnd: '2028-08-14', termKind: '12_month', leaseType: 'individual',
      furnished: true, utilitiesIncluded: true, internetIncluded: true, inUnitLaundry: true,
      dishwasher: true, ac: true, unitsAvailable: 10, lastVerified: '2026-10-19', ...f,
    },
    photos: [],
  };
}

const ALL: AlertTrigger[] = ['new_listing', 'price_drop', 'few_left'];
function propAlert(triggers: AlertTrigger[] = ALL, propertyId = 'p1', id = 'a1'): Alert {
  return { id, userId: 'u1', triggers, target: { kind: 'property', propertyId }, createdAt: '2026-10-01T00:00:00Z' };
}
function searchAlert(filters: ListingFilters, triggers: AlertTrigger[] = ALL, id = 's1'): Alert {
  return { id, userId: 'u2', triggers, target: { kind: 'search', filters }, createdAt: '2026-10-01T00:00:00Z' };
}

describe('FEW_LEFT_THRESHOLD', () => {
  it('is 3', () => expect(FEW_LEFT_THRESHOLD).toBe(3));
});

describe('no-op cases', () => {
  it('no alerts -> no events', () => expect(diffForAlerts([L('f1')], [L('f1', { rentAmount: 1 })], [])).toEqual([]));
  it('identical snapshots -> no events', () =>
    expect(diffForAlerts([L('f1')], [L('f1')], [propAlert()])).toEqual([]));
  it('empty snapshots -> no events', () => expect(diffForAlerts([], [], [propAlert()])).toEqual([]));
  it('removed floor plan -> no events', () => expect(diffForAlerts([L('f1')], [], [propAlert()])).toEqual([]));
});

describe('new_listing', () => {
  it('property alert fires for a new floor plan at the watched property', () => {
    expect(diffForAlerts([], [L('f1')], [propAlert()])).toEqual([
      {
        alertId: 'a1', userId: 'u1', trigger: 'new_listing', propertyId: 'p1', floorPlanId: 'f1',
        message: 'New listing: Gather 4BR',
      },
    ]);
  });
  it('property alert ignores other properties', () =>
    expect(diffForAlerts([], [L('f1', {}, { id: 'p2' })], [propAlert()])).toEqual([]));
  it('search alert fires when the new listing passes filters', () => {
    const ev = diffForAlerts([], [L('f1')], [searchAlert({ groupSize: 4 })]);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ alertId: 's1', userId: 'u2', trigger: 'new_listing', floorPlanId: 'f1', propertyId: 'p1' });
  });
  it('search alert skips a new listing that fails filters', () =>
    expect(diffForAlerts([], [L('f1')], [searchAlert({ groupSize: 2 })])).toEqual([]));
  it('search alert with empty filters matches everything', () =>
    expect(diffForAlerts([], [L('f1'), L('f2')], [searchAlert({})]).map((e) => e.floorPlanId)).toEqual(['f1', 'f2']));
  it('does not fire for floor plans already in prev', () =>
    expect(diffForAlerts([L('f1')], [L('f1')], [propAlert(['new_listing'])])).toEqual([]));
  it('fires per new floor plan', () =>
    expect(diffForAlerts([L('f1')], [L('f1'), L('f2'), L('f3')], [propAlert(['new_listing'])]).map((e) => e.floorPlanId))
      .toEqual(['f2', 'f3']));
});

describe('price_drop', () => {
  it('fires with the drop in the message', () => {
    const ev = diffForAlerts([L('f1', { rentAmount: 1450 })], [L('f1', { rentAmount: 1395 })], [propAlert(['price_drop'])]);
    expect(ev).toHaveLength(1);
    expect(ev[0]?.trigger).toBe('price_drop');
    expect(ev[0]?.message).toContain('$1,450 -> $1,395');
    expect(ev[0]?.floorPlanId).toBe('f1');
  });
  it('formats thousands in the message', () => {
    const ev = diffForAlerts([L('f1', { rentAmount: 5600 })], [L('f1', { rentAmount: 5400 })], [propAlert()]);
    expect(ev[0]?.message).toContain('$5,600 -> $5,400');
  });
  it('a one-dollar drop fires', () =>
    expect(diffForAlerts([L('f1', { rentAmount: 1000 })], [L('f1', { rentAmount: 999 })], [propAlert()])).toHaveLength(1));
  it('no event on a price increase', () =>
    expect(diffForAlerts([L('f1', { rentAmount: 1395 })], [L('f1', { rentAmount: 1450 })], [propAlert()])).toEqual([]));
  it('no event when price is unchanged', () =>
    expect(diffForAlerts([L('f1', { rentAmount: 1395 })], [L('f1', { rentAmount: 1395 })], [propAlert()])).toEqual([]));
  it('search alert fires only when the listing still passes filters in next', () => {
    const prev = [L('f1', { rentAmount: 5600 })];
    const next = [L('f1', { rentAmount: 5200 })]; // $1,300 per person
    expect(diffForAlerts(prev, next, [searchAlert({ maxCostPerPerson: 1500 })])).toHaveLength(1);
    expect(diffForAlerts(prev, next, [searchAlert({ maxCostPerPerson: 1000 })])).toEqual([]);
  });
  it('a drop into the filter range still fires for a search alert', () => {
    const prev = [L('f1', { rentAmount: 8000 })];
    const next = [L('f1', { rentAmount: 5600 })];
    expect(diffForAlerts(prev, next, [searchAlert({ maxCostPerPerson: 1500 })]).map((e) => e.trigger)).toEqual(['price_drop']);
  });
});

describe('few_left', () => {
  const run = (was: number | null, now: number | null, triggers: AlertTrigger[] = ['few_left']) =>
    diffForAlerts([L('f1', { unitsAvailable: was })], [L('f1', { unitsAvailable: now })], [propAlert(triggers)]);

  it('fires crossing from above the threshold', () => {
    const ev = run(10, 2);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ trigger: 'few_left', floorPlanId: 'f1', propertyId: 'p1' });
    expect(ev[0]?.message).toContain('2');
  });
  it('fires crossing from null', () => expect(run(null, 1)).toHaveLength(1));
  it('fires exactly at the threshold', () => expect(run(FEW_LEFT_THRESHOLD + 1, FEW_LEFT_THRESHOLD)).toHaveLength(1));
  it('no event just above the threshold', () => expect(run(10, FEW_LEFT_THRESHOLD + 1)).toEqual([]));
  it('no event when already few left', () => expect(run(3, 2)).toEqual([]));
  it('no event when unchanged and few left', () => expect(run(2, 2)).toEqual([]));
  it('no event when units drop to 0', () => expect(run(10, 0)).toEqual([]));
  it('no event when units become unknown', () => expect(run(10, null)).toEqual([]));
  it('no event when units go up', () => expect(run(2, 10)).toEqual([]));
  it('search alert requires the listing to pass filters', () => {
    const prev = [L('f1', { unitsAvailable: 10 })];
    const next = [L('f1', { unitsAvailable: 1 })];
    expect(diffForAlerts(prev, next, [searchAlert({ groupSize: 4 }, ['few_left'])])).toHaveLength(1);
    expect(diffForAlerts(prev, next, [searchAlert({ groupSize: 3 }, ['few_left'])])).toEqual([]);
  });
});

describe('trigger filtering', () => {
  const prev = [L('f1', { rentAmount: 5600, unitsAvailable: 10 })];
  const next = [L('f1', { rentAmount: 5200, unitsAvailable: 1 }), L('f2')];
  const triggersFor = (t: AlertTrigger[]) => diffForAlerts(prev, next, [propAlert(t)]).map((e) => e.trigger);

  it('all triggers fire all events', () => expect(triggersFor(ALL).sort()).toEqual(['few_left', 'new_listing', 'price_drop']));
  it('only new_listing', () => expect(triggersFor(['new_listing'])).toEqual(['new_listing']));
  it('only price_drop', () => expect(triggersFor(['price_drop'])).toEqual(['price_drop']));
  it('only few_left', () => expect(triggersFor(['few_left'])).toEqual(['few_left']));
  it('empty trigger list fires nothing', () => expect(triggersFor([])).toEqual([]));
  it('price_drop and few_left on one floor plan produce two events', () =>
    expect(diffForAlerts(prev, next, [propAlert(['price_drop', 'few_left'])]).map((e) => e.trigger)).toEqual([
      'price_drop', 'few_left',
    ]));
});

describe('multiple alerts and dedupe', () => {
  it('each alert gets its own event with its own user', () => {
    const ev = diffForAlerts([], [L('f1')], [propAlert(ALL, 'p1', 'a1'), searchAlert({}, ALL, 's1')]);
    expect(ev.map((e) => [e.alertId, e.userId])).toEqual([['a1', 'u1'], ['s1', 'u2']]);
  });
  it('two alerts on different properties only fire for their own', () => {
    const next = [L('f1'), L('f2', {}, { id: 'p2', name: 'Other' })];
    const ev = diffForAlerts([], next, [propAlert(ALL, 'p1', 'a1'), propAlert(ALL, 'p2', 'a2')]);
    expect(ev.map((e) => [e.alertId, e.floorPlanId])).toEqual([['a1', 'f1'], ['a2', 'f2']]);
  });
  it('duplicate floor plan in next yields one event per (alert, floor plan, trigger)', () => {
    const ev = diffForAlerts([], [L('f1'), L('f1')], [propAlert(['new_listing'])]);
    expect(ev).toHaveLength(1);
  });
  it('duplicate trigger entries in an alert yield one event', () =>
    expect(diffForAlerts([], [L('f1')], [propAlert(['new_listing', 'new_listing'])])).toHaveLength(1));
  it('events have only draft fields', () => {
    const ev = diffForAlerts([], [L('f1')], [propAlert()]);
    expect(Object.keys(ev[0] ?? {}).sort()).toEqual(
      ['alertId', 'floorPlanId', 'message', 'propertyId', 'trigger', 'userId'],
    );
  });
  it('does not mutate inputs', () => {
    const prev = [L('f1', { rentAmount: 2000 })];
    const next = [L('f1', { rentAmount: 1000 })];
    const alerts = [propAlert()];
    const snap = JSON.stringify([prev, next, alerts]);
    diffForAlerts(prev, next, alerts);
    expect(JSON.stringify([prev, next, alerts])).toBe(snap);
  });
});
