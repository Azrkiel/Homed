// Compare / Saved page helpers. Pure, no React.
import { parseIdsParam } from './match';

export const COMPARE_MIN = 2;
export const COMPARE_MAX = 4;
export const NOTE_MAX = 500;

export type SearchParamValue = string | string[] | undefined;

/** Ids from `?ids=a,b` and repeated `?id=a&id=b` (the no-JS picker form). Unique, in order. */
export function parseCompareIds(params: { ids?: SearchParamValue; id?: SearchParamValue }): string[] {
  return [...new Set([...(parseIdsParam(params.ids) ?? []), ...(parseIdsParam(params.id) ?? [])])];
}

export type CompareMode = 'table' | 'picker' | 'too-few' | 'too-many';

/** What the page shows for `count` valid ids. */
export function compareMode(count: number): CompareMode {
  if (count === 0) return 'picker';
  if (count < COMPARE_MIN) return 'too-few';
  if (count > COMPARE_MAX) return 'too-many';
  return 'table';
}

/** "/compare?ids=a,b", or "/compare" with no ids. */
export function compareHref(ids: string[]): string {
  return ids.length === 0 ? '/compare' : `/compare?ids=${ids.map(encodeURIComponent).join(',')}`;
}

/** Same ids without `id`. */
export function withoutId(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

/** "/match?ids=a,b" for "Swipe these". */
export function swipeHref(ids: string[]): string {
  return ids.length === 0 ? '/match' : `/match?ids=${ids.map(encodeURIComponent).join(',')}`;
}

/** Trim and cap a note. Returns an error message when it is too long. */
export function normalizeNote(raw: unknown): { ok: true; note: string } | { ok: false; message: string } {
  if (typeof raw !== 'string') return { ok: false, message: 'Notes must be text.' };
  const note = raw.trim();
  if (note.length > NOTE_MAX) return { ok: false, message: `Keep notes under ${NOTE_MAX} characters (now ${note.length}).` };
  return { ok: true, note };
}

/** Selection hint for the Saved page / picker. */
export function selectionHint(count: number): string {
  if (count === 0) return `Pick ${COMPARE_MIN} to ${COMPARE_MAX} places to compare.`;
  if (count < COMPARE_MIN) return `${count} selected. Pick at least ${COMPARE_MIN} to compare.`;
  if (count > COMPARE_MAX) return `${count} selected. Pick at most ${COMPARE_MAX} to compare.`;
  return `${count} selected.`;
}
