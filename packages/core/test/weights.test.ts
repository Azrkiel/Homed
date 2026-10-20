import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS, WEIGHT_PRESETS, normalizeWeights } from '../src/weights';

const sum = (w: { price: number; location: number; looks: number }) => w.price + w.location + w.looks;

describe('normalizeWeights', () => {
  it('scales to sum 1', () => {
    const w = normalizeWeights({ price: 2, location: 1, looks: 1 });
    expect(w.price).toBeCloseTo(0.5);
    expect(w.location).toBeCloseTo(0.25);
    expect(w.looks).toBeCloseTo(0.25);
    expect(sum(w)).toBeCloseTo(1);
  });
  it('keeps already-normalized weights', () => {
    const w = normalizeWeights({ price: 0.4, location: 0.4, looks: 0.2 });
    expect(w.price).toBeCloseTo(0.4);
    expect(w.looks).toBeCloseTo(0.2);
  });
  it('treats negatives as 0', () => {
    const w = normalizeWeights({ price: -5, location: 1, looks: 3 });
    expect(w.price).toBe(0);
    expect(w.location).toBeCloseTo(0.25);
    expect(w.looks).toBeCloseTo(0.75);
  });
  it('all zero -> defaults', () => {
    expect(normalizeWeights({ price: 0, location: 0, looks: 0 })).toEqual(DEFAULT_WEIGHTS);
  });
  it('all negative -> defaults', () => {
    expect(normalizeWeights({ price: -1, location: -2, looks: -3 })).toEqual(DEFAULT_WEIGHTS);
  });
  it('single nonzero weight becomes 1', () => {
    expect(normalizeWeights({ price: 0, location: 7, looks: 0 })).toEqual({ price: 0, location: 1, looks: 0 });
  });
  it('does not mutate input', () => {
    const input = { price: 2, location: 2, looks: 4 };
    normalizeWeights(input);
    expect(input).toEqual({ price: 2, location: 2, looks: 4 });
  });
  it('returns a copy of defaults, not the shared object', () => {
    const w = normalizeWeights({ price: 0, location: 0, looks: 0 });
    expect(w).not.toBe(DEFAULT_WEIGHTS);
  });
  it('every preset sums to 1', () => {
    for (const p of Object.values(WEIGHT_PRESETS)) expect(sum(p.weights)).toBeCloseTo(1);
  });
});
