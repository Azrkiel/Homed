// Pure input checks for group server actions. Client input is untrusted: every value is checked here first.
export type CheckResult<T> = { ok: true; value: T } | { ok: false; message: string };

export const GROUP_NAME_MAX = 60;
export const NOTE_MAX = 280;

/** Trimmed group name, 1 to 60 characters. */
export function checkGroupName(raw: unknown): CheckResult<string> {
  if (typeof raw !== 'string') return { ok: false, message: 'Group name must be text.' };
  const name = raw.trim();
  if (name === '') return { ok: false, message: 'Give the group a name.' };
  if (name.length > GROUP_NAME_MAX) return { ok: false, message: `Keep the group name under ${GROUP_NAME_MAX} characters.` };
  return { ok: true, value: name };
}

/** Invite code as typed or pasted: trimmed, case kept (stored codes are base64url), 6 to 32 of A-Z a-z 0-9 _ -. */
export function checkInviteCode(raw: unknown): CheckResult<string> {
  if (typeof raw !== 'string') return { ok: false, message: 'Invite code must be text.' };
  const code = raw.trim();
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(code)) return { ok: false, message: 'That invite link is not valid.' };
  return { ok: true, value: code };
}

/** Group, floor plan and user ids: letters, digits, `-`, `_`, `.`, `:`; up to 128 characters. */
export function checkId(raw: unknown, what: string): CheckResult<string> {
  if (typeof raw !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(raw)) {
    return { ok: false, message: `Unknown ${what}.` };
  }
  return { ok: true, value: raw };
}

/** Optional shortlist note: trimmed; blank becomes undefined; up to 280 characters. */
export function checkNote(raw: unknown): CheckResult<string | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== 'string') return { ok: false, message: 'Notes must be text.' };
  const note = raw.trim();
  if (note.length > NOTE_MAX) return { ok: false, message: `Keep notes under ${NOTE_MAX} characters (now ${note.length}).` };
  return { ok: true, value: note === '' ? undefined : note };
}

/** Vote value: 1 yes, -1 no, 0 clears. */
export function checkVote(raw: unknown): CheckResult<1 | 0 | -1> {
  if (raw === 1 || raw === 0 || raw === -1) return { ok: true, value: raw };
  return { ok: false, message: 'Vote must be yes, no, or cleared.' };
}

/** Match swipe direction. */
export function checkSwipeDirection(raw: unknown): CheckResult<'left' | 'right'> {
  if (raw === 'left' || raw === 'right') return { ok: true, value: raw };
  return { ok: false, message: 'Unknown swipe.' };
}
