// Pure parsing and validation for the My Classes form. Relative imports only (vitest has no alias).
import type { ScheduleEntry, Weekday } from '@homed/core';

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 'mon', label: 'Monday', short: 'Mon' },
  { value: 'tue', label: 'Tuesday', short: 'Tue' },
  { value: 'wed', label: 'Wednesday', short: 'Wed' },
  { value: 'thu', label: 'Thursday', short: 'Thu' },
  { value: 'fri', label: 'Friday', short: 'Fri' },
  { value: 'sat', label: 'Saturday', short: 'Sat' },
  { value: 'sun', label: 'Sunday', short: 'Sun' },
];

const DAY_SET = new Set<string>(WEEKDAYS.map((d) => d.value));
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const COURSE_RE = /^[A-Za-z]{2,6}\s?\d{4}[A-Za-z]?$/;
export const MAX_ROWS = 20;

/** Row as the client sends it. Everything is untrusted. */
export interface ScheduleRowInput {
  id?: string;
  courseNumber?: string;
  days?: string[];
  start?: string;
  end?: string;
  buildingId?: string;
}

export interface RowErrors {
  courseNumber?: string;
  days?: string;
  start?: string;
  end?: string;
  buildingId?: string;
}

export type ScheduleParse =
  | { ok: true; entries: ScheduleEntry[] }
  | { ok: false; message: string; rowErrors: Record<number, RowErrors> };

/** True for "APMA 2120"-style codes. Unusual codes are accepted by the parser; this only drives a hint. */
export function looksLikeCourseNumber(value: string): boolean {
  return COURSE_RE.test(value.trim());
}

/** "APMA2120" / "apma  2120" -> "APMA 2120". Anything else is trimmed and whitespace-collapsed. */
export function normalizeCourseNumber(value: string): string {
  const v = value.trim().replace(/\s+/g, ' ');
  const m = /^([A-Za-z]{2,6})\s?(\d{4}[A-Za-z]?)$/.exec(v);
  return m ? `${(m[1] ?? '').toUpperCase()} ${(m[2] ?? '').toUpperCase()}` : v;
}

/** Parses the JSON from the hidden `entries` input. Invalid JSON -> null. */
export function parseRowsJson(raw: string | null | undefined): ScheduleRowInput[] | null {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    return data.filter((r): r is ScheduleRowInput => typeof r === 'object' && r !== null && !Array.isArray(r));
  } catch {
    return null;
  }
}

/**
 * Validates rows against the known building ids. Returns a valid `entries` array (days in week order,
 * one stable id per row) or per-row field errors. Needs at least one row.
 */
export function validateScheduleRows(rows: ScheduleRowInput[], buildingIds: ReadonlySet<string>): ScheduleParse {
  const rowErrors: Record<number, RowErrors> = {};
  const entries: ScheduleEntry[] = [];
  const usedIds = new Set<string>();

  if (rows.length === 0) {
    return { ok: false, message: 'Add at least one class, or switch to major mode.', rowErrors };
  }
  if (rows.length > MAX_ROWS) {
    return { ok: false, message: `Keep it to ${MAX_ROWS} classes or fewer.`, rowErrors };
  }

  rows.forEach((row, i) => {
    const errs: RowErrors = {};
    const courseNumber = typeof row.courseNumber === 'string' ? normalizeCourseNumber(row.courseNumber) : '';
    if (!courseNumber) errs.courseNumber = 'Enter a course number, like APMA 2120.';
    else if (courseNumber.length > 20) errs.courseNumber = 'Keep the course number under 20 characters.';

    const dayList = Array.isArray(row.days) ? row.days.filter((d): d is string => typeof d === 'string') : [];
    const days = WEEKDAYS.map((d) => d.value).filter((d) => dayList.includes(d));
    if (dayList.some((d) => !DAY_SET.has(d))) errs.days = 'Pick days from the list.';
    else if (days.length === 0) errs.days = 'Pick at least one day.';

    const start = typeof row.start === 'string' ? row.start : '';
    const end = typeof row.end === 'string' ? row.end : '';
    if (!TIME_RE.test(start)) errs.start = 'Enter a start time.';
    if (!TIME_RE.test(end)) errs.end = 'Enter an end time.';
    else if (!errs.start && end <= start) errs.end = 'End time must be after the start time.';

    const buildingId = typeof row.buildingId === 'string' ? row.buildingId : '';
    if (!buildingId) errs.buildingId = 'Choose a building from the list.';
    else if (!buildingIds.has(buildingId)) errs.buildingId = 'That building is not in the list. Choose another.';

    if (Object.keys(errs).length) {
      rowErrors[i] = errs;
      return;
    }
    let id = typeof row.id === 'string' && /^[\w-]{1,40}$/.test(row.id) ? row.id : `e${i + 1}`;
    while (usedIds.has(id)) id = `${id}x`;
    usedIds.add(id);
    entries.push({ id, courseNumber, days, start, end, buildingId });
  });

  if (Object.keys(rowErrors).length) {
    return { ok: false, message: 'Fix the highlighted classes and save again.', rowErrors };
  }
  return { ok: true, entries };
}

/** Case-insensitive match on name, code or kind; name prefix matches first. Empty query -> everything. */
export function filterBuildings<T extends { name: string; code: string; kind: string }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const hits = items.filter((b) => `${b.name} ${b.code} ${b.kind}`.toLowerCase().includes(q));
  const rank = (b: T) => (b.name.toLowerCase().startsWith(q) || b.code.toLowerCase() === q ? 0 : 1);
  return [...hits].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
