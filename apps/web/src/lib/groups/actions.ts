'use server';
// Server actions for the group pages. Every action validates input, requires sign-in, and requires
// membership of the group it touches. The userId always comes from the session, never from the client.
import { revalidatePath } from 'next/cache';
import { groupMatches } from '@homed/core';
import { RepoError } from '@homed/db';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import type { ActionResult } from '@/lib/search/actions';
import { checkGroupName, checkId, checkInviteCode, checkNote, checkSwipeDirection, checkVote } from './input';
import { parseBudgetInput } from './view';

const NOT_MEMBER = { ok: false as const, message: 'You are not in this group.' };

function fail(e: unknown, fallback: string): { ok: false; message: string } {
  if (e instanceof RepoError) return { ok: false, message: e.message || fallback };
  throw e;
}

/** Group pages whose data changes with membership, shortlist, votes, budgets or swipes. */
function revalidateGroup(groupId: string): void {
  for (const p of ['/groups', `/groups/${groupId}`, `/groups/${groupId}/browse`, `/groups/${groupId}/match`]) {
    revalidatePath(p);
  }
}

async function isMember(groupId: string, userId: string): Promise<boolean> {
  return (await getRepo().listMembers(groupId)).some((m) => m.userId === userId);
}

/** Creates a group with the caller as leader. Returns the new group id. */
export async function createGroupAction(name: string): Promise<ActionResult<{ groupId: string }>> {
  const check = checkGroupName(name);
  if (!check.ok) return check;
  const user = await requireUser(undefined, '/groups');
  try {
    const group = await getRepo().createGroup(user.id, check.value);
    revalidatePath('/groups');
    return { ok: true, groupId: group.id };
  } catch (e) {
    return fail(e, 'Could not create the group. Please try again.');
  }
}

/** Joins by invite code. Signed-out -> /signin, then back to the join page. */
export async function joinGroupAction(code: string): Promise<ActionResult<{ groupId: string }>> {
  const check = checkInviteCode(code);
  if (!check.ok) return check;
  const user = await requireUser(undefined, `/groups/join/${check.value}`);
  try {
    const member = await getRepo().joinGroup(check.value, user.id);
    revalidateGroup(member.groupId);
    return { ok: true, groupId: member.groupId };
  } catch (e) {
    if (e instanceof RepoError && e.code === 'not_found') return { ok: false, message: 'That invite link is not valid.' };
    return fail(e, 'Could not join the group. Please try again.');
  }
}

/** Leaves the group. The repo handles leader succession and deleting an empty group. */
export async function leaveGroupAction(groupId: string): Promise<ActionResult> {
  const gid = checkId(groupId, 'group');
  if (!gid.ok) return gid;
  const user = await requireUser(undefined, `/groups/${gid.value}`);
  if (!(await isMember(gid.value, user.id))) return NOT_MEMBER;
  try {
    await getRepo().leaveGroup(gid.value, user.id);
    revalidateGroup(gid.value);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not leave the group. Please try again.');
  }
}

/** Sets the caller's own per-person budget. Blank clears it. Other members' budgets are never touched. */
export async function setMyBudgetAction(groupId: string, raw: string): Promise<ActionResult> {
  const gid = checkId(groupId, 'group');
  if (!gid.ok) return gid;
  const parsed = parseBudgetInput(typeof raw === 'string' ? raw : '');
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const user = await requireUser(undefined, `/groups/${gid.value}`);
  if (!(await isMember(gid.value, user.id))) return NOT_MEMBER;
  try {
    await getRepo().updateMember(gid.value, user.id, { budgetMax: parsed.value });
    revalidateGroup(gid.value);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not save your budget. Please try again.');
  }
}

/** Adds a listing to the group shortlist with an optional note. Idempotent in the repo. */
export async function addToShortlistAction(groupId: string, floorPlanId: string, note?: string): Promise<ActionResult> {
  const gid = checkId(groupId, 'group');
  if (!gid.ok) return gid;
  const fp = checkId(floorPlanId, 'listing');
  if (!fp.ok) return fp;
  const cleanNote = checkNote(note);
  if (!cleanNote.ok) return cleanNote;
  const user = await requireUser(undefined, `/groups/${gid.value}`);
  if (!(await isMember(gid.value, user.id))) return NOT_MEMBER;
  const repo = getRepo();
  try {
    if (!(await repo.getListing(fp.value))) return { ok: false, message: 'Unknown listing.' };
    await repo.addToShortlist(gid.value, user.id, fp.value, cleanNote.value);
    revalidateGroup(gid.value);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not add that place. Please try again.');
  }
}

/** Removes a listing from the group shortlist. Any member may remove. */
export async function removeFromShortlistAction(groupId: string, floorPlanId: string): Promise<ActionResult> {
  const gid = checkId(groupId, 'group');
  if (!gid.ok) return gid;
  const fp = checkId(floorPlanId, 'listing');
  if (!fp.ok) return fp;
  const user = await requireUser(undefined, `/groups/${gid.value}`);
  if (!(await isMember(gid.value, user.id))) return NOT_MEMBER;
  try {
    await getRepo().removeFromShortlist(gid.value, fp.value);
    revalidateGroup(gid.value);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not remove that place. Please try again.');
  }
}

/** The caller's vote on a shortlisted listing: 1 yes, -1 no, 0 clears. Replaces the earlier vote. */
export async function castVoteAction(groupId: string, floorPlanId: string, value: number): Promise<ActionResult> {
  const gid = checkId(groupId, 'group');
  if (!gid.ok) return gid;
  const fp = checkId(floorPlanId, 'listing');
  if (!fp.ok) return fp;
  const vote = checkVote(value);
  if (!vote.ok) return vote;
  const user = await requireUser(undefined, `/groups/${gid.value}`);
  if (!(await isMember(gid.value, user.id))) return NOT_MEMBER;
  const repo = getRepo();
  try {
    const onShortlist = (await repo.listShortlist(gid.value)).some((item) => item.floorPlanId === fp.value);
    if (!onShortlist) return { ok: false, message: 'That place is not on the shortlist.' };
    await repo.castVote(gid.value, user.id, fp.value, vote.value);
    revalidateGroup(gid.value);
    return { ok: true };
  } catch (e) {
    return fail(e, 'Could not record your vote. Please try again.');
  }
}

/**
 * Group Match swipe. A right swipe also adds the listing to the shortlist (repo). `matched` is true when
 * every member now has swiped right on this listing in this group.
 */
export async function groupSwipeAction(
  groupId: string,
  floorPlanId: string,
  direction: string,
): Promise<ActionResult<{ matched: boolean }>> {
  const gid = checkId(groupId, 'group');
  if (!gid.ok) return gid;
  const fp = checkId(floorPlanId, 'listing');
  if (!fp.ok) return fp;
  const dir = checkSwipeDirection(direction);
  if (!dir.ok) return dir;
  const user = await requireUser(undefined, `/groups/${gid.value}/match`);
  const members = await getRepo().listMembers(gid.value);
  if (!members.some((m) => m.userId === user.id)) return NOT_MEMBER;
  const repo = getRepo();
  try {
    if (!(await repo.getListing(fp.value))) return { ok: false, message: 'Unknown listing.' };
    await repo.recordSwipe({ userId: user.id, floorPlanId: fp.value, direction: dir.value, groupId: gid.value });
    const swipes = await repo.listSwipes({ groupId: gid.value });
    const matches = groupMatches(swipes, gid.value, members.map((m) => m.userId));
    revalidateGroup(gid.value);
    return { ok: true, matched: matches.includes(fp.value) };
  } catch (e) {
    return fail(e, 'Could not record your swipe. Please try again.');
  }
}
