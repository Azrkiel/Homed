import { describe, expect, it } from 'vitest';
import { commuteFor, formatMinutes, weeklyMeetings } from '../src/schedule';
import type { Major, UserSchedule, WalkLookup, WalkTime } from '../src/types';

const majors: Major[] = [
  {
    id: 'cs', name: 'CS', school: 'SEAS', meetingsPerWeek: 10,
    buildings: [{ buildingId: 'rice', share: 0.6 }, { buildingId: 'olsson', share: 0.4 }],
  },
];

function sched(over: Partial<UserSchedule>): UserSchedule {
  return { userId: 'u', mode: 'schedule', entries: [], updatedAt: '2026-10-19T00:00:00Z', ...over };
}

function lookup(table: Record<string, [number, number | null]>): WalkLookup {
  return (propertyId, targetId): WalkTime | undefined => {
    const row = table[targetId];
    if (!row) return undefined;
    return { propertyId, targetId, targetKind: 'building', walkMinutes: row[0], busMinutes: row[1], source: 'estimate' };
  };
}

describe('weeklyMeetings', () => {
  it('null schedule -> []', () => expect(weeklyMeetings(null, majors)).toEqual([]));
  it('empty schedule -> []', () => expect(weeklyMeetings(sched({}), majors)).toEqual([]));
  it('schedule mode expands one meeting per day', () => {
    const s = sched({
      entries: [{ id: 'e1', courseNumber: 'CS 2100', days: ['mon', 'wed'], start: '09:30', end: '10:45', buildingId: 'rice' }],
    });
    expect(weeklyMeetings(s, majors)).toEqual([
      { buildingId: 'rice', perWeek: 1, start: '09:30', day: 'mon' },
      { buildingId: 'rice', perWeek: 1, start: '09:30', day: 'wed' },
    ]);
  });
  it('major mode splits meetingsPerWeek by share', () => {
    const m = weeklyMeetings(sched({ mode: 'major', majorId: 'cs' }), majors);
    expect(m).toHaveLength(2);
    expect(m[0]).toMatchObject({ buildingId: 'rice' });
    expect(m[0]?.perWeek).toBeCloseTo(6);
    expect(m[1]?.perWeek).toBeCloseTo(4);
    expect(m[0]?.day).toBeUndefined();
  });
  it('major mode with unknown majorId -> []', () =>
    expect(weeklyMeetings(sched({ mode: 'major', majorId: 'nope' }), majors)).toEqual([]));
  it('major mode with absent majorId -> []', () =>
    expect(weeklyMeetings(sched({ mode: 'major' }), majors)).toEqual([]));
});

describe('commuteFor', () => {
  it('no meetings -> zeros and null earliest', () => {
    expect(commuteFor('p', [], [], lookup({}))).toEqual({
      weeklyMinutes: 0, averageMinutes: 0, earliestClassMinutes: null, usesBus: false, extras: [],
    });
  });
  it('weights by perWeek, takes min of walk and bus', () => {
    const w = lookup({ rice: [20, 8], olsson: [10, null] });
    const r = commuteFor('p', [
      { buildingId: 'rice', perWeek: 6 },
      { buildingId: 'olsson', perWeek: 4 },
    ], [], w);
    expect(r.weeklyMinutes).toBe(6 * 8 + 4 * 10);
    expect(r.averageMinutes).toBeCloseTo(8.8);
    expect(r.usesBus).toBe(true);
  });
  it('usesBus false when walking is faster or equal', () => {
    const r = commuteFor('p', [{ buildingId: 'a', perWeek: 1 }], [], lookup({ a: [5, 5] }));
    expect(r.usesBus).toBe(false);
  });
  it('skips trips with missing walk data', () => {
    const r = commuteFor('p', [
      { buildingId: 'a', perWeek: 2 },
      { buildingId: 'missing', perWeek: 5 },
    ], [], lookup({ a: [10, null] }));
    expect(r.weeklyMinutes).toBe(20);
    expect(r.averageMinutes).toBe(10);
  });
  it('all trips missing -> zeros, null earliest', () => {
    const r = commuteFor('p', [{ buildingId: 'x', perWeek: 3 }], [], lookup({}));
    expect(r.weeklyMinutes).toBe(0);
    expect(r.averageMinutes).toBe(0);
    expect(r.earliestClassMinutes).toBeNull();
  });
  it('schedule mode earliest: day order then start', () => {
    const w = lookup({ a: [10, null], b: [20, null], c: [30, null] });
    const r = commuteFor('p', [
      { buildingId: 'a', perWeek: 1, day: 'wed', start: '08:00' },
      { buildingId: 'b', perWeek: 1, day: 'tue', start: '13:00' },
      { buildingId: 'c', perWeek: 1, day: 'tue', start: '09:00' },
    ], [], w);
    expect(r.earliestClassMinutes).toBe(30);
  });
  it('schedule mode earliest skips trips lacking data', () => {
    const r = commuteFor('p', [
      { buildingId: 'x', perWeek: 1, day: 'mon', start: '08:00' },
      { buildingId: 'a', perWeek: 1, day: 'tue', start: '08:00' },
    ], [], lookup({ a: [12, null] }));
    expect(r.earliestClassMinutes).toBe(12);
  });
  it('major mode earliest is highest-share building', () => {
    const w = lookup({ a: [10, null], b: [25, null] });
    const r = commuteFor('p', [
      { buildingId: 'a', perWeek: 4 },
      { buildingId: 'b', perWeek: 6 },
    ], [], w);
    expect(r.earliestClassMinutes).toBe(25);
  });
  it('extras use min(walk, bus) and skip missing', () => {
    const r = commuteFor('p', [], ['gym', 'corner', 'ghost'], lookup({ gym: [15, 9], corner: [6, null] }));
    expect(r.extras).toEqual([
      { landmarkId: 'gym', minutes: 9 },
      { landmarkId: 'corner', minutes: 6 },
    ]);
  });
  it('extras do not affect usesBus', () => {
    const r = commuteFor('p', [], ['gym'], lookup({ gym: [15, 9] }));
    expect(r.usesBus).toBe(false);
  });
});

describe('formatMinutes', () => {
  it('45 min', () => expect(formatMinutes(45)).toBe('45 min'));
  it('0 min', () => expect(formatMinutes(0)).toBe('0 min'));
  it('59 min', () => expect(formatMinutes(59)).toBe('59 min'));
  it('exact hour', () => expect(formatMinutes(120)).toBe('2 h'));
  it('1 h', () => expect(formatMinutes(60)).toBe('1 h'));
  it('2 h 10 min', () => expect(formatMinutes(130)).toBe('2 h 10 min'));
  it('rounds to whole minutes', () => expect(formatMinutes(44.6)).toBe('45 min'));
  it('rounding up into an hour', () => expect(formatMinutes(59.6)).toBe('1 h'));
});
