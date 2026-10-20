// Pure swipe helpers for the Match deck: the commit decision and drag interpolation ranges. No React Native imports.

export type SwipeDirection = 'right' | 'left';

/** Release past this fraction of the screen width commits the swipe. */
export const DISTANCE_RATIO = 0.25;
/** Release faster than this (px/ms) commits the swipe, in the drag direction. */
export const FLICK_VELOCITY = 0.6;
/** A flick only counts after this much drag, so a quick tap never swipes. */
export const FLICK_MIN_DISTANCE = 16;
/** Top card rotation at the screen edge, in degrees. */
export const MAX_ROTATION_DEG = 12;

/** Drag distance (px) that commits a swipe for a given screen width. Never zero. */
export function commitDistance(width: number): number {
  return Math.max(1, width * DISTANCE_RATIO);
}

/**
 * Decide the outcome of a released drag.
 * dx: total horizontal drag (px, + is right). vx: release velocity (px/ms). width: screen width (px).
 * Returns 'right' (Save), 'left' (Pass), or null (spring back).
 */
export function decideSwipe(dx: number, vx: number, width: number): SwipeDirection | null {
  if (!Number.isFinite(dx) || !Number.isFinite(vx) || !(width > 0)) return null;
  const distance = commitDistance(width);
  if (dx >= distance) return 'right';
  if (dx <= -distance) return 'left';
  if (Math.abs(dx) >= FLICK_MIN_DISTANCE) {
    if (dx > 0 && vx >= FLICK_VELOCITY) return 'right';
    if (dx < 0 && vx <= -FLICK_VELOCITY) return 'left';
  }
  return null;
}

/** x value the card flies to after a committed swipe (fully off screen). */
export function flickTarget(direction: SwipeDirection, width: number): number {
  const off = Math.max(1, width) * 1.5;
  return direction === 'right' ? off : -off;
}

/** Input/output ranges for mapping drag x to rotation: -MAX at -width, 0 at rest, +MAX at +width. */
export function rotationRange(width: number): { inputRange: number[]; outputRange: string[] } {
  const w = Math.max(1, width);
  return {
    inputRange: [-w, 0, w],
    outputRange: [`-${MAX_ROTATION_DEG}deg`, '0deg', `${MAX_ROTATION_DEG}deg`],
  };
}
