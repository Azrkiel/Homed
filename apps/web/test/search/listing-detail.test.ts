import { describe, expect, it } from 'vitest';
import type { Building, Landmark, WalkTime } from '@homed/core';
import {
  busNote,
  classWalkRows,
  landmarkWalkRows,
  parkingFromParam,
  parseRating,
  termExplanation,
  weightPercents,
} from '../../src/lib/search/listing-detail';

describe('parkingFromParam', () => {
  it('reads 1/true, ignores the rest', () => {
    expect(parkingFromParam('1')).toBe(true);
    expect(parkingFromParam(['true', '0'])).toBe(true);
    expect(parkingFromParam('0')).toBe(false);
    expect(parkingFromParam(undefined)).toBe(false);
  });
});

describe('parseRating', () => {
  it('accepts integers 1-5 as numbers or strings', () => {
    expect(parseRating(3)).toBe(3);
    expect(parseRating('5')).toBe(5);
  });
  it('rejects everything else', () => {
    for (const v of [0, 6, 2.5, '', 'x', NaN, null, undefined, '3.2']) expect(parseRating(v)).toBeNull();
  });
});

describe('weightPercents', () => {
  it('sums to 100', () => {
    const rows = weightPercents({ price: 1 / 3, location: 1 / 3, looks: 1 / 3 });
    expect(rows.reduce((s, r) => s + r.percent, 0)).toBe(100);
  });
  it('maps a preset', () => {
    expect(weightPercents({ price: 0.5, location: 0.3, looks: 0.2 }).map((r) => r.percent)).toEqual([50, 30, 20]);
  });
  it('zero weights fall back to even', () => {
    expect(weightPercents({ price: 0, location: 0, looks: 0 }).reduce((s, r) => s + r.percent, 0)).toBe(100);
  });
});

describe('termExplanation', () => {
  it('differs by kind and mentions total lease cost', () => {
    const a = termExplanation('12_month', 12);
    const b = termExplanation('academic_year', 10);
    expect(a.title).not.toBe(b.title);
    expect(a.body).toContain('summer');
    expect(b.body).toContain('total lease cost');
  });
});

const walk = (targetId: string, kind: 'building' | 'landmark', m: number, source: WalkTime['source'] = 'estimate'): WalkTime => ({
  propertyId: 'p1',
  targetId,
  targetKind: kind,
  walkMinutes: m,
  busMinutes: null,
  source,
});

describe('landmarkWalkRows', () => {
  const landmarks: Landmark[] = [
    { id: 'gym2', name: 'Some Gym', location: { lat: 0, lng: 0 }, kind: 'gym' },
    { id: 'shop', name: 'Harris Teeter', location: { lat: 0, lng: 0 }, kind: 'grocery' },
    { id: 'lawn', name: 'The Lawn (Rotunda)', location: { lat: 0, lng: 0 }, kind: 'other' },
    { id: 'corner', name: 'The Corner', location: { lat: 0, lng: 0 }, kind: 'social' },
    { id: 'nodata', name: 'Clemons Library', location: { lat: 0, lng: 0 }, kind: 'library' },
  ];
  it('puts highlights first in order and skips landmarks without walk data', () => {
    const rows = landmarkWalkRows(
      landmarks,
      [walk('gym2', 'landmark', 3), walk('shop', 'landmark', 9), walk('lawn', 'landmark', 12), walk('corner', 'landmark', 10)],
      'p1',
    );
    expect(rows.map((r) => r.id)).toEqual(['corner', 'lawn', 'shop', 'gym2']);
    expect(rows[3]?.highlight).toBe(false);
    expect(rows[0]?.estimated).toBe(true);
  });
  it('empty with no data', () => {
    expect(landmarkWalkRows(landmarks, [], 'p1')).toEqual([]);
  });
});

describe('classWalkRows', () => {
  const buildings: Building[] = [{ id: 'b1', code: 'THN', name: 'Thornton Hall', entrance: { lat: 0, lng: 0 }, kind: 'academic' }];
  it('dedupes buildings and skips missing walks', () => {
    const rows = classWalkRows(
      [
        { buildingId: 'b1', perWeek: 1 },
        { buildingId: 'b1', perWeek: 1 },
        { buildingId: 'zzz', perWeek: 1 },
      ],
      buildings,
      [walk('b1', 'building', 7, 'osrm')],
      'p1',
    );
    expect(rows).toEqual([{ id: 'b1', name: 'Thornton Hall', walkMinutes: 7, busMinutes: null, estimated: false }]);
  });
});

describe('busNote', () => {
  it('names routes', () => {
    expect(busNote(true, ['CAT 7'])).toContain('CAT 7');
    expect(busNote(false, [])).toBe('Not on a bus route.');
  });
});
