import { randomBytes } from 'node:crypto';
import type { Group, GroupMember, ShortlistItem, Vote } from '@homed/core';
import { RepoError, type GroupRepo } from '../repository';
import type { State } from './state';
import type { Ctx } from './store';

const MAX_MEMBERS = 8;

function newestFirst<T extends { createdAt: string }>(rows: T[]): T[] {
  // Reverse first so later insertions win ties; sort is stable.
  const out = [...rows].reverse();
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out;
}

/** Members in joinedAt order; insertion order breaks ties. Returns the stored objects. */
function membersOf(s: State, groupId: string): GroupMember[] {
  const rows = s.groupMembers.filter((m) => m.groupId === groupId);
  return rows.sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0));
}

function uniqueCode(s: State): string {
  for (;;) {
    const code = randomBytes(12).toString('base64url'); // 96 bits
    if (!s.groups.some((g) => g.inviteCode === code)) return code;
  }
}

function requireMember(s: State, groupId: string, userId: string): GroupMember {
  const m = s.groupMembers.find((x) => x.groupId === groupId && x.userId === userId);
  if (!m) throw new RepoError('forbidden', 'not a member of this group');
  return m;
}

export function groupRepo(ctx: Ctx): GroupRepo {
  return {
    createGroup: (ownerId, name) =>
      ctx.write((s) => {
        const trimmed = name.trim();
        if (!trimmed) throw new RepoError('invalid', 'group name required');
        if (!s.users.some((u) => u.id === ownerId)) throw new RepoError('not_found', 'user not found');
        const now = ctx.now();
        const group: Group = {
          id: crypto.randomUUID(),
          name: trimmed,
          ownerId,
          inviteCode: uniqueCode(s),
          createdAt: now,
        };
        s.groups.push(group);
        s.groupMembers.push({ groupId: group.id, userId: ownerId, role: 'leader', joinedAt: now });
        return structuredClone(group);
      }),
    getGroup: (groupId) => ctx.read((s) => structuredClone(s.groups.find((g) => g.id === groupId) ?? null)),
    getGroupByInviteCode: (code) =>
      ctx.read((s) => structuredClone(s.groups.find((g) => g.inviteCode === code) ?? null)),
    listGroupsForUser: (userId) =>
      ctx.read((s) => {
        const ids = new Set(s.groupMembers.filter((m) => m.userId === userId).map((m) => m.groupId));
        return structuredClone(s.groups.filter((g) => ids.has(g.id)));
      }),
    listMembers: (groupId) => ctx.read((s) => structuredClone(membersOf(s, groupId))),
    joinGroup: (inviteCode, userId) =>
      ctx.write((s) => {
        const group = s.groups.find((g) => g.inviteCode === inviteCode);
        if (!group) throw new RepoError('not_found', 'invite code not found');
        if (!s.users.some((u) => u.id === userId)) throw new RepoError('not_found', 'user not found');
        const existing = s.groupMembers.find((m) => m.groupId === group.id && m.userId === userId);
        if (existing) return structuredClone(existing);
        if (s.groupMembers.filter((m) => m.groupId === group.id).length >= MAX_MEMBERS) {
          throw new RepoError('conflict', 'group is full');
        }
        const member: GroupMember = { groupId: group.id, userId, role: 'member', joinedAt: ctx.now() };
        s.groupMembers.push(member);
        return structuredClone(member);
      }),
    leaveGroup: (groupId, userId) =>
      ctx.write((s) => {
        const me = s.groupMembers.find((m) => m.groupId === groupId && m.userId === userId);
        if (!me) return;
        s.groupMembers = s.groupMembers.filter((m) => m !== me);
        const rest = membersOf(s, groupId);
        if (rest.length === 0) {
          s.groups = s.groups.filter((g) => g.id !== groupId);
          s.shortlist = s.shortlist.filter((x) => x.groupId !== groupId);
          s.votes = s.votes.filter((x) => x.groupId !== groupId);
          s.swipes = s.swipes.filter((x) => x.groupId !== groupId);
          return;
        }
        if (me.role !== 'leader') return;
        let leader = rest.find((m) => m.role === 'leader');
        if (!leader) {
          leader = rest[0] as GroupMember;
          leader.role = 'leader';
        }
        const g = s.groups.find((x) => x.id === groupId);
        if (g && g.ownerId === userId) g.ownerId = leader.userId;
      }),
    updateMember: (groupId, userId, patch) =>
      ctx.write((s) => {
        const m = s.groupMembers.find((x) => x.groupId === groupId && x.userId === userId);
        if (!m) throw new RepoError('not_found', 'member not found');
        if (patch.budgetMax !== undefined) {
          if (patch.budgetMax === null) delete m.budgetMax;
          else m.budgetMax = patch.budgetMax;
        }
        return structuredClone(m);
      }),
    listShortlist: (groupId) =>
      ctx.read((s) => structuredClone(newestFirst(s.shortlist.filter((x) => x.groupId === groupId)))),
    addToShortlist: (groupId, userId, floorPlanId, note) =>
      ctx.write((s) => {
        requireMember(s, groupId, userId);
        const existing = s.shortlist.find((x) => x.groupId === groupId && x.floorPlanId === floorPlanId);
        if (existing) {
          if (note !== undefined) existing.note = note;
          return structuredClone(existing);
        }
        const item: ShortlistItem = { groupId, floorPlanId, addedBy: userId, createdAt: ctx.now() };
        if (note !== undefined) item.note = note;
        s.shortlist.push(item);
        return structuredClone(item);
      }),
    removeFromShortlist: (groupId, floorPlanId) =>
      ctx.write((s) => {
        s.shortlist = s.shortlist.filter((x) => !(x.groupId === groupId && x.floorPlanId === floorPlanId));
      }),
    castVote: (groupId, userId, floorPlanId, value) =>
      ctx.write((s) => {
        requireMember(s, groupId, userId);
        if (value !== 1 && value !== 0 && value !== -1) throw new RepoError('invalid', 'vote must be 1, 0 or -1');
        s.votes = s.votes.filter(
          (v) => !(v.groupId === groupId && v.userId === userId && v.floorPlanId === floorPlanId),
        );
        const vote: Vote = { groupId, userId, floorPlanId, value, createdAt: ctx.now() };
        s.votes.push(vote);
        return structuredClone(vote);
      }),
    listVotes: (groupId) => ctx.read((s) => structuredClone(s.votes.filter((v) => v.groupId === groupId))),
  };
}
