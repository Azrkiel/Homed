import type { CommuteSummary, ID, Major, UserSchedule, WalkLookup, WeeklyMeeting } from './types';
import { notImplemented } from './not-implemented';

/**
 * Expand a schedule into weekly trips.
 * - schedule mode: one meeting per entry per day ({ buildingId, perWeek: 1, start, day }).
 * - major mode: major.meetingsPerWeek split across major.buildings by share.
 * - major mode with an unknown/absent majorId, or empty schedule: [].
 */
export function weeklyMeetings(schedule: UserSchedule | null, majors: Major[]): WeeklyMeeting[] {
  return notImplemented('weeklyMeetings');
}

/**
 * Commute for one property. Each trip uses min(walkMinutes, busMinutes ?? Infinity).
 * Missing walk data for a building -> that trip is skipped. No meetings -> zeros and
 * earliestClassMinutes null. earliestClassMinutes = trip with the earliest (day order mon..sun, then start)
 * in schedule mode; in major mode the trip to the highest-share building.
 */
export function commuteFor(
  propertyId: ID,
  meetings: WeeklyMeeting[],
  extras: ID[],
  walk: WalkLookup,
): CommuteSummary {
  return notImplemented('commuteFor');
}

/** "2 h 10 min" / "45 min". */
export function formatMinutes(minutes: number): string {
  return notImplemented('formatMinutes');
}
