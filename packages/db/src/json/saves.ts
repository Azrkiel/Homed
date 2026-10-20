import type { Save, Swipe } from '@homed/core';
import type { SaveRepo } from '../repository';
import type { Ctx } from './store';
import type { State } from './state';

function ensureSave(s: State, userId: string, floorPlanId: string, now: string, note?: string): Save {
  const existing = s.saves.find((x) => x.userId === userId && x.floorPlanId === floorPlanId);
  if (existing) {
    if (note !== undefined) existing.note = note;
    return existing;
  }
  const save: Save = { userId, floorPlanId, createdAt: now };
  if (note !== undefined) save.note = note;
  s.saves.push(save);
  return save;
}

export function saveRepo(ctx: Ctx): SaveRepo {
  return {
    listSaves: (userId) =>
      ctx.read((s) => {
        const mine = s.saves.filter((x) => x.userId === userId).reverse();
        // Stable sort keeps later insertions first when timestamps tie.
        mine.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
        return structuredClone(mine);
      }),
    addSave: (userId, floorPlanId, note) =>
      ctx.write((s) => structuredClone(ensureSave(s, userId, floorPlanId, ctx.now(), note))),
    removeSave: (userId, floorPlanId) =>
      ctx.write((s) => {
        s.saves = s.saves.filter((x) => !(x.userId === userId && x.floorPlanId === floorPlanId));
      }),
    recordSwipe: (input) =>
      ctx.write((s) => {
        const now = ctx.now();
        const swipe: Swipe = {
          userId: input.userId,
          floorPlanId: input.floorPlanId,
          direction: input.direction,
          createdAt: now,
        };
        if (input.groupId !== undefined) swipe.groupId = input.groupId;
        s.swipes = s.swipes.filter(
          (x) => !(x.userId === swipe.userId && x.floorPlanId === swipe.floorPlanId && x.groupId === swipe.groupId),
        );
        s.swipes.push(swipe);
        if (swipe.direction === 'right') {
          if (swipe.groupId === undefined) {
            ensureSave(s, swipe.userId, swipe.floorPlanId, now);
          } else if (!s.shortlist.some((x) => x.groupId === swipe.groupId && x.floorPlanId === swipe.floorPlanId)) {
            s.shortlist.push({
              groupId: swipe.groupId,
              floorPlanId: swipe.floorPlanId,
              addedBy: swipe.userId,
              createdAt: now,
            });
          }
        }
        return structuredClone(swipe);
      }),
    listSwipes: (filter) =>
      ctx.read((s) =>
        structuredClone(
          s.swipes.filter(
            (x) =>
              (filter.userId === undefined || x.userId === filter.userId) &&
              (filter.groupId === undefined || x.groupId === filter.groupId),
          ),
        ),
      ),
  };
}
