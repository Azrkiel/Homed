import { describe, expect, it } from 'vitest';
import {
  compareHref,
  compareMode,
  normalizeNote,
  parseCompareIds,
  selectionHint,
  swipeHref,
  withoutId,
} from '../../src/lib/search/compare';

describe('compare helpers', () => {
  it('parses ids and repeated id, deduped', () => {
    expect(parseCompareIds({ ids: 'a,b, a', id: ['b', 'c'] })).toEqual(['a', 'b', 'c']);
    expect(parseCompareIds({})).toEqual([]);
  });
  it('picks a mode by count', () => {
    expect([0, 1, 2, 4, 5].map(compareMode)).toEqual(['picker', 'too-few', 'table', 'table', 'too-many']);
  });
  it('builds hrefs', () => {
    expect(compareHref([])).toBe('/compare');
    expect(compareHref(['a', 'b'])).toBe('/compare?ids=a,b');
    expect(swipeHref(['a'])).toBe('/match?ids=a');
    expect(withoutId(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('normalizes notes', () => {
    expect(normalizeNote('  hi ')).toEqual({ ok: true, note: 'hi' });
    expect(normalizeNote('x'.repeat(501)).ok).toBe(false);
    expect(normalizeNote(3).ok).toBe(false);
  });
  it('hints', () => {
    expect(selectionHint(1)).toContain('at least 2');
    expect(selectionHint(5)).toContain('at most 4');
    expect(selectionHint(3)).toBe('3 selected.');
  });
});
