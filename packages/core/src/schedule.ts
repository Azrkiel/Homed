import type { CommuteSummary, ID, Major, UserSchedule, Weekday, WalkLookup, WeeklyMeeting } from './types';

const DAY_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/**
 * Expand a schedule into weekly trips.
 * - schedule mode: one meeting per entry per day ({ buildingId, perWeek: 1, start, day }).
 * - major mode: major.meetingsPerWeek split across major.buildings by share.
 * - major mode with an unknown/absent majorId, or empty schedule: [].
 */
export function weeklyMeetings(schedule: UserSchedule | null, majors: Major[]): WeeklyMeeting[] {
  if (!schedule) return [];
  if (schedule.mode === 'schedule') {
    const out: WeeklyMeeting[] = [];
    for (const entry of schedule.entries) {
      for (const day of entry.days) {
        out.push({ buildingId: entry.buildingId, perWeek: 1, start: entry.start, day });
      }
    }
    return out;
  }
  const major = schedule.majorId ? majors.find((m) => m.id === schedule.majorId) : undefined;
  if (!major) return [];
  return major.buildings.map((b) => ({
    buildingId: b.buildingId,
    perWeek: major.meetingsPerWeek * b.share,
  }));
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
  const extraMinutes: CommuteSummary['extras'] = [];
  for (const landmarkId of extras) {
    const w = walk(propertyId, landmarkId);
    if (w) extraMinutes.push({ landmarkId, minutes: Math.min(w.walkMinutes, w.busMinutes ?? Infinity) });
  }

  const trips: { meeting: WeeklyMeeting; minutes: number }[] = [];
  let usesBus = false;
  for (const meeting of meetings) {
    const w = walk(propertyId, meeting.buildingId);
    if (!w) continue;
    const bus = w.busMinutes ?? Infinity;
    if (bus < w.walkMinutes) usesBus = true;
    trips.push({ meeting, minutes: Math.min(w.walkMinutes, bus) });
  }

  let weeklyMinutes = 0;
  let totalTrips = 0;
  for (const t of trips) {
    weeklyMinutes += t.minutes * t.meeting.perWeek;
    totalTrips += t.meeting.perWeek;
  }
  const averageMinutes = totalTrips > 0 ? weeklyMinutes / totalTrips : 0;

  let earliest: { meeting: WeeklyMeeting; minutes: number } | undefined;
  if (trips.some((t) => t.meeting.day !== undefined)) {
    const key = (t: { meeting: WeeklyMeeting }): [number, string] => [
      t.meeting.day ? DAY_ORDER.indexOf(t.meeting.day) : DAY_ORDER.length,
      t.meeting.start ?? '99:99',
    ];
    for (const t of trips) {
      if (!earliest) {
        earliest = t;
        continue;
      }
      const [d1, s1] = key(t);
      const [d2, s2] = key(earliest);
      if (d1 < d2 || (d1 === d2 && s1 < s2)) earliest = t;
    }
  } else {
    for (const t of trips) {
      if (!earliest || t.meeting.perWeek > earliest.meeting.perWeek) earliest = t;
    }
  }

  return {
    weeklyMinutes,
    averageMinutes,
    earliestClassMinutes: earliest ? earliest.minutes : null,
    usesBus,
    extras: extraMinutes,
  };
}

/** "2 h 10 min" / "45 min". */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
