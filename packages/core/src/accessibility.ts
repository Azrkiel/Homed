import type { AccessibilityFeature, AccessibilityInfo } from './types';
import { notImplemented } from './not-implemented';

export const ACCESSIBILITY_FEATURE_LABELS: Record<AccessibilityFeature, string> = {
  step_free_entrance: 'Step-free entrance',
  elevator: 'Elevator',
  ground_floor_units: 'Ground-floor units',
  wide_doorways: 'Wide doorways',
  roll_in_shower: 'Roll-in shower',
  grab_bars: 'Grab bars',
  flashing_alarms: 'Flashing door and smoke alarms',
  quiet_units: 'Quiet units away from noise',
  private_bathroom: 'Private bathroom',
  kitchen_access: 'Kitchen access',
  gender_inclusive_units: 'Gender-inclusive units',
  kosher_halal_kitchen: 'Kosher or halal kitchen setup',
};

export interface AccommodationBadge {
  friendly: boolean;
  /** Checkable facts that earned (or would earn) the badge. */
  reasons: string[];
  /** What is missing for the badge. */
  missing: string[];
}

/**
 * "Accommodation-friendly" badge, built only from checkable facts:
 * friendly = step-free entrance AND (elevator OR ground-floor units)
 *            AND a named accommodation contact AND a written process
 *            AND service animals allowed with no fees.
 */
export function accommodationBadge(info: AccessibilityInfo | undefined): AccommodationBadge {
  return notImplemented('accommodationBadge');
}
