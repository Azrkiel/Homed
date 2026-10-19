import { describe, expect, it } from 'vitest';
import { WEIGHT_PRESETS } from '@homed/core';
import { fromPercent, rebalance, toPercent, type PercentWeights, type WeightKey } from '../../src/lib/search/weights';
import { safeNext, safeNextOrNull } from '../../src/app/signin/next-path';

const KEYS: WeightKey[] = ['price', 'location', 'looks'];
const sum = (p: PercentWeights) => p.price + p.location + p.looks;

describe('rebalance', () => {
  it('keeps the sum at 100 with integers in 0..100 for every start and move', () => {
    const starts: PercentWeights[] = [
      { price: 40, location: 40, looks: 20 },
      { price: 100, location: 0, looks: 0 },
      { price: 0, location: 0, looks: 100 },
      { price: 33, location: 33, looks: 34 },
      { price: 1, location: 2, looks: 97 },
    ];
    for (const s of starts) {
      for (const k of KEYS) {
        for (let v = -5; v <= 105; v++) {
          const r = rebalance(s, k, v);
          expect(sum(r)).toBe(100);
          for (const key of KEYS) {
            expect(Number.isInteger(r[key])).toBe(true);
            expect(r[key]).toBeGreaterThanOrEqual(0);
            expect(r[key]).toBeLessThanOrEqual(100);
          }
          expect(r[k]).toBe(Math.min(100, Math.max(0, v)));
        }
      }
    }
  });

  it('redistributes proportionally', () => {
    expect(rebalance({ price: 40, location: 40, looks: 20 }, 'price', 70)).toEqual({ price: 70, location: 20, looks: 10 });
    expect(rebalance({ price: 40, location: 30, looks: 30 }, 'price', 0)).toEqual({ price: 0, location: 50, looks: 50 });
  });

  it('splits evenly when both others are 0', () => {
    expect(rebalance({ price: 100, location: 0, looks: 0 }, 'price', 60)).toEqual({ price: 60, location: 20, looks: 20 });
    const odd = rebalance({ price: 100, location: 0, looks: 0 }, 'price', 99);
    expect(sum(odd)).toBe(100);
  });

  it('handles non-finite input', () => {
    expect(sum(rebalance({ price: 40, location: 40, looks: 20 }, 'looks', Number.NaN))).toBe(100);
  });
});

describe('toPercent / fromPercent', () => {
  it('converts every preset to whole percents summing to 100', () => {
    for (const p of Object.values(WEIGHT_PRESETS)) {
      const pct = toPercent(p.weights);
      expect(sum(pct)).toBe(100);
      const back = fromPercent(pct);
      expect(back.price).toBeCloseTo(p.weights.price, 5);
      expect(back.location).toBeCloseTo(p.weights.location, 5);
      expect(back.looks).toBeCloseTo(p.weights.looks, 5);
    }
  });

  it('rounds awkward fractions to 100 and falls back on all-zero', () => {
    expect(sum(toPercent({ price: 1 / 3, location: 1 / 3, looks: 1 / 3 }))).toBe(100);
    expect(toPercent({ price: 0, location: 0, looks: 0 })).toEqual({ price: 40, location: 40, looks: 20 });
  });
});

describe('safeNext', () => {
  it('accepts relative paths', () => {
    expect(safeNext('/settings')).toBe('/settings');
    expect(safeNext('/search?q=a&b=1')).toBe('/search?q=a&b=1');
  });
  it('rejects everything else', () => {
    for (const bad of ['//evil.com', '/' + String.fromCharCode(92) + 'evil.com', 'https://evil.com', 'evil', '', undefined, null, 5, '/a\nb']) {
      expect(safeNext(bad)).toBe('/search');
    }
  });
});

describe('safeNextOrNull (magic-link callback)', () => {
  it('rejects a tab-split protocol-relative redirect', () => {
    // URL parsing strips the tab, so "/\t/evil.example" would become "//evil.example".
    expect(safeNextOrNull('/\t/evil.example')).toBeNull();
  });
  it('keeps a same-site path and rejects missing or unsafe ones', () => {
    expect(safeNextOrNull('/groups/join/ABC')).toBe('/groups/join/ABC');
    expect(safeNextOrNull(null)).toBeNull();
    expect(safeNextOrNull('//evil.example')).toBeNull();
  });
});
