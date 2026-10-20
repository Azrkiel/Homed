// SaveRepo on Supabase. Mirrors packages/db/src/json/saves.ts.
//
// Known divergences from the JSON store (see the report):
// - Save createdAt is kept strictly increasing per user: when the clock has not moved past the user's
//   newest save, the new save gets newest + 1 ms. The schema has no insertion sequence, and the JSON
//   store's "newest first" order relies on insertion order when timestamps tie (fixed test clock).
// - A right group swipe whose group row does not exist writes no shortlist item (the JSON store
//   would write an orphan item). shortlist_items has an FK to groups.
import type { Save, Swipe } from '@homed/core';
import type { SaveRepo } from '../repository';
import { selectAll, unwrap, unwrapOne, type SupabaseCtx } from './client';
import { isoTs, saveFromRow, saveToRow, swipeFromRow, swipeToRow, type SaveRow, type SwipeRow } from './mappers';

const FLOOR_PLAN_FK = { code: 'not_found' as const, message: 'floor plan not found' };

/** The save's createdAt: the clock's now, or one ms past the user's newest save if the clock has not moved. */
async function nextSaveTimestamp(ctx: SupabaseCtx, userId: string): Promise<string> {
  const now = ctx.now();
  const latest = unwrap(
    await ctx.sb
      .from('saves')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ) as { created_at: string } | null;
  if (!latest) return now;
  const last = Date.parse(isoTs(latest.created_at));
  return last < Date.parse(now) ? now : new Date(last + 1).toISOString();
}

async function findSave(ctx: SupabaseCtx, userId: string, floorPlanId: string): Promise<SaveRow | null> {
  return unwrap(
    await ctx.sb.from('saves').select('*').eq('user_id', userId).eq('floor_plan_id', floorPlanId).maybeSingle(),
  ) as SaveRow | null;
}

/** Idempotent. Same rules as the JSON store's ensureSave: a given note overwrites, none keeps the old one. */
async function ensureSave(ctx: SupabaseCtx, userId: string, floorPlanId: string, note?: string): Promise<Save> {
  const existing = await findSave(ctx, userId, floorPlanId);
  if (existing) {
    if (note === undefined) return saveFromRow(existing);
    const updated = unwrapOne(
      await ctx.sb
        .from('saves')
        .update({ note })
        .eq('user_id', userId)
        .eq('floor_plan_id', floorPlanId)
        .select('*')
        .single(),
    ) as SaveRow;
    return saveFromRow(updated);
  }
  const save: Save = { userId, floorPlanId, createdAt: await nextSaveTimestamp(ctx, userId) };
  if (note !== undefined) save.note = note;
  const res = await ctx.sb.from('saves').insert(saveToRow(save)).select('*').single();
  if (res.error?.code === '23505') {
    // Lost a race with a concurrent insert of the same save: return the winner.
    const winner = await findSave(ctx, userId, floorPlanId);
    if (winner) return saveFromRow(winner);
  }
  return saveFromRow(unwrapOne(res, { fk: FLOOR_PLAN_FK }) as SaveRow);
}

export function saveRepo(ctx: SupabaseCtx): SaveRepo {
  const { sb } = ctx;
  return {
    listSaves: async (userId) => {
      const rows = await selectAll<SaveRow>((f, t) =>
        sb
          .from('saves')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('floor_plan_id', { ascending: false })
          .range(f, t),
      );
      return rows.map(saveFromRow);
    },

    addSave: (userId, floorPlanId, note) => ensureSave(ctx, userId, floorPlanId, note),

    removeSave: async (userId, floorPlanId) => {
      unwrap(await sb.from('saves').delete().eq('user_id', userId).eq('floor_plan_id', floorPlanId));
    },

    recordSwipe: async (input) => {
      const now = ctx.now();
      const swipe: Swipe = { userId: input.userId, floorPlanId: input.floorPlanId, direction: input.direction, createdAt: now };
      if (input.groupId !== undefined) swipe.groupId = input.groupId;

      // Re-swiping replaces the earlier swipe with the same (user, plan, group).
      let del = sb.from('swipes').delete().eq('user_id', swipe.userId).eq('floor_plan_id', swipe.floorPlanId);
      del = swipe.groupId === undefined ? del.is('group_id', null) : del.eq('group_id', swipe.groupId);
      unwrap(await del);
      const row = unwrapOne(await sb.from('swipes').insert(swipeToRow(swipe)).select('*').single()) as SwipeRow;

      if (swipe.direction === 'right') {
        if (swipe.groupId === undefined) {
          await ensureSave(ctx, swipe.userId, swipe.floorPlanId);
        } else {
          const group = unwrap(await sb.from('groups').select('id').eq('id', swipe.groupId).maybeSingle());
          if (group) {
            unwrap(
              await sb.from('shortlist_items').upsert(
                {
                  group_id: swipe.groupId,
                  floor_plan_id: swipe.floorPlanId,
                  added_by: swipe.userId,
                  note: null,
                  created_at: now,
                },
                { onConflict: 'group_id,floor_plan_id', ignoreDuplicates: true },
              ),
              { fk: FLOOR_PLAN_FK },
            );
          }
        }
      }
      return swipeFromRow(row);
    },

    listSwipes: async (filter) => {
      const build = () => {
        let q = sb.from('swipes').select('*');
        if (filter.userId !== undefined) q = q.eq('user_id', filter.userId);
        if (filter.groupId !== undefined) q = q.eq('group_id', filter.groupId);
        return q;
      };
      // Order is total (the unique key per row) so pages never skip or repeat.
      const rows = await selectAll<SwipeRow>((f, t) =>
        build()
          .order('created_at', { ascending: true })
          .order('user_id')
          .order('floor_plan_id')
          .order('group_id')
          .range(f, t),
      );
      return rows.map(swipeFromRow);
    },
  };
}
