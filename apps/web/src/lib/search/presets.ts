// Weight preset helpers. Pure.
import { WEIGHT_PRESETS, normalizeWeights, type ScoreWeights, type WeightPreset } from '@homed/core';

export const PRESET_KEYS = Object.keys(WEIGHT_PRESETS) as WeightPreset[];

/** Validates a `preset` query value. Unknown values give undefined. */
export function presetFromParam(raw: string | string[] | undefined): WeightPreset | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PRESET_KEYS.find((k) => k === value);
}

/** The preset whose normalized weights equal `weights` (within half a percent), else 'custom'. */
export function matchPreset(weights: ScoreWeights): WeightPreset | 'custom' {
  const w = normalizeWeights(weights);
  for (const key of PRESET_KEYS) {
    const p = normalizeWeights(WEIGHT_PRESETS[key].weights);
    if (
      Math.abs(p.price - w.price) < 0.005 &&
      Math.abs(p.location - w.location) < 0.005 &&
      Math.abs(p.looks - w.looks) < 0.005
    ) {
      return key;
    }
  }
  return 'custom';
}
