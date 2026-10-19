// Pure helpers for the three linked weight sliders (whole percent, always summing to 100).
import type { ScoreWeights } from '@homed/core';

export type WeightKey = 'price' | 'location' | 'looks';
export type PercentWeights = Record<WeightKey, number>;

const KEYS: WeightKey[] = ['price', 'location', 'looks'];

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Set `changed` to `value` and spread the remainder over the other two in proportion to their current
 * share (evenly when both are 0). Result: integers in 0..100 that sum to exactly 100.
 */
export function rebalance(weights: PercentWeights, changed: WeightKey, value: number): PercentWeights {
  const v = clampInt(value);
  const rest = 100 - v;
  const [a, b] = KEYS.filter((k) => k !== changed) as [WeightKey, WeightKey];
  const wa = clampInt(weights[a]);
  const wb = clampInt(weights[b]);
  const total = wa + wb;
  const na = total > 0 ? Math.round((wa / total) * rest) : Math.floor(rest / 2);
  const out = { price: 0, location: 0, looks: 0 };
  out[changed] = v;
  out[a] = na;
  out[b] = rest - na;
  return out;
}

/** Fractions (sum ~1) -> whole percents summing to exactly 100 (largest remainder). All zero -> 40/40/20. */
export function toPercent(w: ScoreWeights): PercentWeights {
  const raw = KEYS.map((k) => Math.max(0, Number.isFinite(w[k]) ? w[k] : 0));
  const sum = raw.reduce((s, x) => s + x, 0);
  if (!(sum > 0)) return { price: 40, location: 40, looks: 20 };
  const exact = raw.map((x) => (x / sum) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((p, q) => q.r - p.r || p.i - q.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    left--;
  }
  return { price: floors[0] ?? 0, location: floors[1] ?? 0, looks: floors[2] ?? 0 };
}

/** Whole percents -> fractions. Callers still run core `normalizeWeights` before saving. */
export function fromPercent(p: PercentWeights): ScoreWeights {
  return { price: p.price / 100, location: p.location / 100, looks: p.looks / 100 };
}
