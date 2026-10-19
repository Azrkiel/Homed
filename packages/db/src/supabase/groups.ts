// GroupRepo on Supabase. Mirrors packages/db/src/json/groups.ts.
//
// Known divergences from the JSON store:
// - The schema has no insertion sequence and the JSON store's orders rely on insertion order when
//   timestamps tie (fixed test clock). Like saves.ts, a new member's joinedAt and a new shortlist item's
//   createdAt are kept strictly increasing per group: when the clock has not moved past the group's
//   newest row, the new row gets newest + 1 ms. Reads then order by timestamp, then a stable key.
// - The 8-member cap is checked before and after the insert (the schema has no constraint), so two
//   concurrent joins cannot both exceed it; the loser is removed and gets 'conflict'.
import { randomBytes } from 'node:crypto';
import type { ShortlistItem, Vote } from '@homed/core';
import { RepoError, type GroupRepo } from '../repository';
import { chunks, IN_CHUNK, selectAll, unwrap, unwrapOne, type SupabaseCtx } from './client';
import {
  groupFromRow,
  groupMemberFromRow,
  isoTs,
  shortlistFromRow,
  voteFromRow,
  type GroupMemberRow,
  type GroupRow,
  type ShortlistItemRow,
  type VoteRow,
} from './mappers';

const MAX_MEMBERS = 8;
const FLOOR_PLAN_FK = { code: 'not_found' as const, message: 'floor plan not found' };

/** `now`, or one ms past `latest` when the clock has not moved past it. */
function bump(now: string, latest: string | null | undefined): string {
  if (!latest) return now;
  const last = Date.parse(isoTs(latest));
  return last < Date.parse(now) ? now : new Date(last + 1).toISOString();
}

async function latestOf(ctx: SupabaseCtx, table: string, col: string, groupId: string): Promise<string | null> {
  const row = unwrap(
    await ctx.sb.from(table).select(col).eq('group_id', groupId).order(col, { ascending: false }).limit(1).maybeSingle(),
  ) as Record<string, string> | null;
  return row ? (row[col] ?? null) : null;
}

async function membersOf(ctx: SupabaseCtx, groupId: string): Promise<GroupMemberRow[]> {
  return selectAll<GroupMemberRow>((f, t) =>
    ctx.sb
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true })
      .order('user_id', { ascending: true })
      .range(f, t),
  );
}

async function findMember(ctx: SupabaseCtx, groupId: string, userId: string): Promise<GroupMemberRow | null> {
  return unwrap(
    await ctx.sb.from('group_members').select('*').eq('group_id', groupId).eq('user_id', userId).maybeSingle(),
  ) as GroupMemberRow | null;
}

async function requireMember(ctx: SupabaseCtx, groupId: string, userId: string): Promise<GroupMemberRow> {
  const m = await findMember(ctx, groupId, userId);
  if (!m) throw new RepoError('forbidden', 'not a member of this group');
  return m;
}

async function userExists(ctx: SupabaseCtx, userId: string): Promise<boolean> {
  return unwrap(await ctx.sb.from('users').select('id').eq('id', userId).maybeSingle()) !== null;
}

export function groupRepo(ctx: SupabaseCtx): GroupRepo {
  const { sb } = ctx;
  return {
    createGroup: async (ownerId, name) => {
      const trimmed = name.trim();
      if (!trimmed) throw new RepoError('invalid', 'group name required');
      if (!(await userExists(ctx, ownerId))) throw new RepoError('not_found', 'user not found');
      const now = ctx.now();
      for (let attempt = 0; ; attempt++) {
        const row = {
          id: crypto.randomUUID(),
          name: trimmed,
          owner_id: ownerId,
          invite_code: randomBytes(12).toString('base64url'), // 96 bits
          created_at: now,
        };
        const res = await sb.from('groups').insert(row).select('*').single();
        // Invite code collision (astronomically unlikely): draw another.
        if (res.error?.code === '23505' && attempt < 5) continue;
        const group = unwrapOne(res) as GroupRow;
        const m = await sb
          .from('group_members')
          .insert({ group_id: group.id, user_id: ownerId, role: 'leader', joined_at: now });
        if (m.error) {
          await sb.from('groups').delete().eq('id', group.id);
          throw new Error(m.error.message);
        }
        return groupFromRow(group);
      }
    },

    getGroup: async (groupId) => {
      const row = unwrap(await sb.from('groups').select('*').eq('id', groupId).maybeSingle()) as GroupRow | null;
      return row ? groupFromRow(row) : null;
    },

    getGroupByInviteCode: async (code) => {
      const row = unwrap(await sb.from('groups').select('*').eq('invite_code', code).maybeSingle()) as GroupRow | null;
      return row ? groupFromRow(row) : null;
    },

    listGroupsForUser: async (userId) => {
      const mem = await selectAll<{ group_id: string }>((f, t) =>
        sb.from('group_members').select('group_id').eq('user_id', userId).order('group_id').range(f, t),
      );
      const rows: GroupRow[] = [];
      for (const ids of chunks(
        mem.map((m) => m.group_id),
        IN_CHUNK,
      )) {
        rows.push(...((unwrap(await sb.from('groups').select('*').in('id', ids)) as GroupRow[] | null) ?? []));
      }
      const groups = rows.map(groupFromRow);
      groups.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
      return groups;
    },

    listMembers: async (groupId) => (await membersOf(ctx, groupId)).map(groupMemberFromRow),

    joinGroup: async (inviteCode, userId) => {
      const group = unwrap(
        await sb.from('groups').select('*').eq('invite_code', inviteCode).maybeSingle(),
      ) as GroupRow | null;
      if (!group) throw new RepoError('not_found', 'invite code not found');
      if (!(await userExists(ctx, userId))) throw new RepoError('not_found', 'user not found');
      const existing = await findMember(ctx, group.id, userId);
      if (existing) return groupMemberFromRow(existing);
      const full = () => new RepoError('conflict', 'group is full');
      if ((await membersOf(ctx, group.id)).length >= MAX_MEMBERS) throw full();
      const joinedAt = bump(ctx.now(), await latestOf(ctx, 'group_members', 'joined_at', group.id));
      const res = await sb
        .from('group_members')
        .insert({ group_id: group.id, user_id: userId, role: 'member', joined_at: joinedAt })
        .select('*')
        .single();
      if (res.error?.code === '23505') {
        // Lost a race with a concurrent join of the same user: return the winner.
        const winner = await findMember(ctx, group.id, userId);
        if (winner) return groupMemberFromRow(winner);
      }
      const row = unwrapOne(res, { fk: { code: 'not_found', message: 'group or user not found' } }) as GroupMemberRow;
      const rows = await membersOf(ctx, group.id);
      if (rows.length > MAX_MEMBERS && rows.findIndex((r) => r.user_id === userId) >= MAX_MEMBERS) {
        // Concurrent joins overshot the cap: the latest joiner backs out.
        unwrap(await sb.from('group_members').delete().eq('group_id', group.id).eq('user_id', userId));
        throw full();
      }
      return groupMemberFromRow(row);
    },

    leaveGroup: async (groupId, userId) => {
      const me = await findMember(ctx, groupId, userId);
      if (!me) return;
      unwrap(await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId));
      const rest = await membersOf(ctx, groupId);
      if (rest.length === 0) {
        // shortlist and votes cascade with the group; swipes have no FK.
        unwrap(await sb.from('swipes').delete().eq('group_id', groupId));
        unwrap(await sb.from('groups').delete().eq('id', groupId));
        return;
      }
      if (me.role !== 'leader') return;
      let leader = rest.find((m) => m.role === 'leader');
      if (!leader) {
        leader = rest[0] as GroupMemberRow;
        unwrap(
          await sb.from('group_members').update({ role: 'leader' }).eq('group_id', groupId).eq('user_id', leader.user_id),
        );
      }
      unwrap(await sb.from('groups').update({ owner_id: leader.user_id }).eq('id', groupId).eq('owner_id', userId));
    },

    updateMember: async (groupId, userId, patch) => {
      const m = await findMember(ctx, groupId, userId);
      if (!m) throw new RepoError('not_found', 'member not found');
      if (patch.budgetMax === undefined) return groupMemberFromRow(m);
      const row = unwrapOne(
        await sb
          .from('group_members')
          .update({ budget_max: patch.budgetMax })
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .select('*')
          .single(),
        { invalid: 'budgetMax must be >= 0' },
      ) as GroupMemberRow;
      return groupMemberFromRow(row);
    },

    listShortlist: async (groupId) => {
      const rows = await selectAll<ShortlistItemRow>((f, t) =>
        sb
          .from('shortlist_items')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
          .order('floor_plan_id', { ascending: false })
          .range(f, t),
      );
      return rows.map(shortlistFromRow);
    },

    addToShortlist: async (groupId, userId, floorPlanId, note) => {
      await requireMember(ctx, groupId, userId);
      const find = async () =>
        unwrap(
          await sb
            .from('shortlist_items')
            .select('*')
            .eq('group_id', groupId)
            .eq('floor_plan_id', floorPlanId)
            .maybeSingle(),
        ) as ShortlistItemRow | null;
      const keep = async (row: ShortlistItemRow): Promise<ShortlistItem> => {
        if (note === undefined) return shortlistFromRow(row);
        const updated = unwrapOne(
          await sb
            .from('shortlist_items')
            .update({ note })
            .eq('group_id', groupId)
            .eq('floor_plan_id', floorPlanId)
            .select('*')
            .single(),
        ) as ShortlistItemRow;
        return shortlistFromRow(updated);
      };
      const existing = await find();
      if (existing) return keep(existing);
      const createdAt = bump(ctx.now(), await latestOf(ctx, 'shortlist_items', 'created_at', groupId));
      const res = await sb
        .from('shortlist_items')
        .insert({
          group_id: groupId,
          floor_plan_id: floorPlanId,
          added_by: userId,
          note: note ?? null,
          created_at: createdAt,
        })
        .select('*')
        .single();
      if (res.error?.code === '23505') {
        const winner = await find();
        if (winner) return keep(winner);
      }
      return shortlistFromRow(unwrapOne(res, { fk: FLOOR_PLAN_FK }) as ShortlistItemRow);
    },

    removeFromShortlist: async (groupId, floorPlanId) => {
      unwrap(await sb.from('shortlist_items').delete().eq('group_id', groupId).eq('floor_plan_id', floorPlanId));
    },

    castVote: async (groupId, userId, floorPlanId, value) => {
      await requireMember(ctx, groupId, userId);
      if (value !== 1 && value !== 0 && value !== -1) throw new RepoError('invalid', 'vote must be 1, 0 or -1');
      const vote: Pick<Vote, 'createdAt'> = { createdAt: ctx.now() };
      const row = unwrapOne(
        await sb
          .from('votes')
          .upsert(
            { group_id: groupId, user_id: userId, floor_plan_id: floorPlanId, value, created_at: vote.createdAt },
            { onConflict: 'group_id,user_id,floor_plan_id' },
          )
          .select('*')
          .single(),
        { fk: FLOOR_PLAN_FK },
      ) as VoteRow;
      return voteFromRow(row);
    },

    listVotes: async (groupId) => {
      const rows = await selectAll<VoteRow>((f, t) =>
        sb
          .from('votes')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .order('user_id')
          .order('floor_plan_id')
          .range(f, t),
      );
      return rows.map(voteFromRow);
    },
  };
}
