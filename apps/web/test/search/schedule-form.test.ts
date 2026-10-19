import { describe, expect, it } from 'vitest';
import {
  filterBuildings,
  looksLikeCourseNumber,
  normalizeCourseNumber,
  parseRowsJson,
  validateScheduleRows,
} from '../../src/lib/search/schedule-form';

const B = new Set(['b-thornton', 'b-clemons']);
const good = { id: 'r1', courseNumber: 'apma2120', days: ['wed', 'mon'], start: '09:30', end: '10:45', buildingId: 'b-thornton' };

describe('validateScheduleRows', () => {
  it('accepts a valid row, normalizes course and orders days', () => {
    const r = validateScheduleRows([good], B);
    expect(r).toEqual({
      ok: true,
      entries: [{ id: 'r1', courseNumber: 'APMA 2120', days: ['mon', 'wed'], start: '09:30', end: '10:45', buildingId: 'b-thornton' }],
    });
  });
  it('rejects empty and oversized lists', () => {
    expect(validateScheduleRows([], B).ok).toBe(false);
    expect(validateScheduleRows(Array.from({ length: 21 }, () => good), B).ok).toBe(false);
  });
  it('reports field errors per row index', () => {
    const r = validateScheduleRows([good, { courseNumber: '', days: [], start: '9am', end: '', buildingId: 'nope' }], B);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.rowErrors[0]).toBeUndefined();
      expect(Object.keys(r.rowErrors[1] ?? {}).sort()).toEqual(['buildingId', 'courseNumber', 'days', 'end', 'start']);
    }
  });
  it('requires end after start and a known building', () => {
    const r = validateScheduleRows([{ ...good, end: '09:30', buildingId: 'b-missing' }], B);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.rowErrors[0]?.end).toMatch(/after/);
      expect(r.rowErrors[0]?.buildingId).toBeDefined();
    }
  });
  it('rejects unknown days and keeps ids unique', () => {
    expect(validateScheduleRows([{ ...good, days: ['mon', 'xyz'] }], B).ok).toBe(false);
    const dup = validateScheduleRows([good, good], B);
    expect(dup.ok && new Set(dup.entries.map((e) => e.id)).size).toBe(2);
  });
  it('accepts unusual course codes', () => {
    expect(validateScheduleRows([{ ...good, courseNumber: 'Lab 1' }], B).ok).toBe(true);
  });
});

describe('course helpers', () => {
  it('detects the usual pattern', () => {
    expect(looksLikeCourseNumber('APMA 2120')).toBe(true);
    expect(looksLikeCourseNumber('Lab 1')).toBe(false);
    expect(normalizeCourseNumber('  cs   2100 ')).toBe('CS 2100');
  });
});

describe('parseRowsJson', () => {
  it('handles empty, invalid and non-array input', () => {
    expect(parseRowsJson('')).toEqual([]);
    expect(parseRowsJson('{')).toBeNull();
    expect(parseRowsJson('{"a":1}')).toBeNull();
    expect(parseRowsJson('[1,{"id":"x"}]')).toEqual([{ id: 'x' }]);
  });
});

describe('filterBuildings', () => {
  const items = [
    { name: 'Thornton Hall', code: 'THN', kind: 'academic' },
    { name: 'Clemons Library', code: 'CLEM', kind: 'library' },
    { name: 'Old Cabell Hall', code: 'OCH', kind: 'academic' },
  ];
  it('matches name, code and kind', () => {
    expect(filterBuildings(items, 'clem').map((b) => b.code)).toEqual(['CLEM']);
    expect(filterBuildings(items, 'library').map((b) => b.code)).toEqual(['CLEM']);
    expect(filterBuildings(items, 'academic')).toHaveLength(2);
    expect(filterBuildings(items, '')).toHaveLength(3);
    expect(filterBuildings(items, 'zzz')).toEqual([]);
  });
});
