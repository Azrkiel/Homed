import { isEmail, MAX_BATCH_SIZE } from '@homed/core';
import type { NewApplicationBatch } from '@homed/db';
import { formKeys, readAll, readField, type FormSource } from './form-input';

export type BatchInvitee = NewApplicationBatch['invitees'][number];

export type BatchFormResult =
  | { ok: true; floorPlanIds: string[]; groupId?: string; invitees: BatchInvitee[] }
  | { ok: false; message: string };

export interface BatchFormOptions {
  leaderEmail: string;
}

const MAX_NAME = 120;
const GUARANTOR_KEY = /^guarantor(?:Email|Name|For)_(\d+)$/;

/** Indexes N of guarantorEmail_N / guarantorName_N / guarantorFor_N present in the form, ascending. */
function guarantorIndexes(fd: FormSource): number[] {
  const found = new Set<number>();
  for (const key of formKeys(fd)) {
    const m = GUARANTOR_KEY.exec(key);
    if (m) found.add(Number(m[1]));
  }
  return [...found].sort((a, b) => a - b);
}

/**
 * Parses the batch builder form. Returns the first problem as a message.
 * Emails are lowercased. Duplicates and the leader's own email are rejected, matching
 * createApplicationBatch in packages/db/src/json/applications.ts.
 */
export function parseBatchForm(fd: FormSource, opts: BatchFormOptions): BatchFormResult {
  const fail = (message: string): BatchFormResult => ({ ok: false, message });
  const leader = opts.leaderEmail.trim().toLowerCase();

  const floorPlanIds: string[] = [];
  for (const id of readAll(fd, 'fp')) {
    if (id !== '' && !floorPlanIds.includes(id)) floorPlanIds.push(id);
  }
  if (floorPlanIds.length === 0) return fail('Pick at least one place to apply to.');
  if (floorPlanIds.length > MAX_BATCH_SIZE) return fail(`You can apply to at most ${MAX_BATCH_SIZE} places at once.`);

  const groupRaw = readField(fd, 'groupId');
  const groupId = groupRaw === '' ? undefined : groupRaw;

  const invitees: BatchInvitee[] = [];
  const seen = new Set<string>([leader]);
  const people = new Set<string>([leader]);

  for (const raw of readAll(fd, 'roommate')) {
    const email = raw.toLowerCase();
    if (email === '') continue;
    if (!isEmail(email)) return fail(`"${email}" is not a valid email address.`);
    if (email === leader) return fail('You cannot invite yourself as a roommate.');
    if (seen.has(email)) return fail(`${email} is already in this batch.`);
    seen.add(email);
    people.add(email);
    invitees.push({ kind: 'roommate', email });
  }

  for (const n of guarantorIndexes(fd)) {
    const email = readField(fd, `guarantorEmail_${n}`).toLowerCase();
    const name = readField(fd, `guarantorName_${n}`);
    const forEmail = readField(fd, `guarantorFor_${n}`).toLowerCase();
    if (!email && !name && !forEmail) continue;

    if (!email) return fail('Each guarantor needs an email address.');
    if (!isEmail(email)) return fail(`"${email}" is not a valid email address.`);
    if (email === leader) return fail('You cannot be your own guarantor.');
    if (seen.has(email)) return fail(`${email} is already in this batch.`);
    if (name.length > MAX_NAME) return fail(`Keep guarantor names under ${MAX_NAME} characters.`);
    if (forEmail !== '' && !people.has(forEmail)) {
      return fail(`${email} must guarantee the leader or a roommate in this batch.`);
    }
    seen.add(email);

    const invitee: BatchInvitee = { kind: 'guarantor', email };
    if (name !== '') invitee.name = name;
    if (forEmail !== '') invitee.guarantorForEmail = forEmail;
    invitees.push(invitee);
  }

  const out: BatchFormResult = { ok: true, floorPlanIds, invitees };
  if (groupId !== undefined) out.groupId = groupId;
  return out;
}

function isIndex(i: number, length: number): boolean {
  return Number.isInteger(i) && i >= 0 && i < length;
}

/** New array with the item at `from` moved to index `to`. Out-of-range indexes -> unchanged copy. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (!isIndex(from, out.length) || !isIndex(to, out.length) || from === to) return out;
  out.splice(to, 0, ...out.splice(from, 1));
  return out;
}

/** Appends a floor plan id. Blank, duplicate, or over MAX_BATCH_SIZE -> unchanged copy. */
export function addFloorPlan(list: readonly string[], id: string): string[] {
  const trimmed = id.trim();
  if (trimmed === '' || list.includes(trimmed) || list.length >= MAX_BATCH_SIZE) return [...list];
  return [...list, trimmed];
}
