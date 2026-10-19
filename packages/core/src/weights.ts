import type { ScoreWeights, WeightPreset } from './types';
import { notImplemented } from './not-implemented';

/** Default 40 / 40 / 20. */
export const DEFAULT_WEIGHTS: ScoreWeights = { price: 0.4, location: 0.4, looks: 0.2 };

/** "Budget first", "Close to class", "Nicest place", plus the balanced default. Each sums to 1. */
export const WEIGHT_PRESETS: Record<WeightPreset, { label: string; weights: ScoreWeights }> = {
  balanced: { label: 'Balanced', weights: DEFAULT_WEIGHTS },
  budget_first: { label: 'Budget first', weights: { price: 0.6, location: 0.3, looks: 0.1 } },
  close_to_class: { label: 'Close to class', weights: { price: 0.25, location: 0.6, looks: 0.15 } },
  nicest_place: { label: 'Nicest place', weights: { price: 0.25, location: 0.25, looks: 0.5 } },
};

/** Scale non-negative weights so they sum to 1. All zero -> DEFAULT_WEIGHTS. */
export function normalizeWeights(w: ScoreWeights): ScoreWeights {
  return notImplemented('normalizeWeights');
}
