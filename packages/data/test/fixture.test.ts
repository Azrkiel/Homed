import { describe, expect, it } from 'vitest';
import { loadFixture, loadSeed } from '../src/index';

describe('fixture dataset (contract)', () => {
  it('loads and every floor plan points at a property', () => {
    const fx = loadFixture();
    const ids = new Set(fx.properties.map((p) => p.id));
    expect(fx.properties.length).toBe(3);
    for (const fp of fx.floorPlans) expect(ids.has(fp.propertyId)).toBe(true);
  });
  it('seed loads', () => {
    expect(loadSeed().properties.length).toBeGreaterThan(0);
  });
});
