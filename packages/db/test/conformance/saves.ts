import { beforeEach, describe, expect, it } from 'vitest';
import type { Repository } from '../../src/repository';
import { FX, makeStudent, type MakeRepo } from './helpers';

export function savesConformance(makeRepo: MakeRepo): void {
  describe('saves and swipes', () => {
    let repo: Repository;
    beforeEach(async () => {
      repo = await makeRepo();
    });

    it('listSaves is empty for a new user', async () => {
      const u = await makeStudent(repo);
      expect(await repo.listSaves(u.id)).toEqual([]);
    });

    it('addSave stores a save with a note', async () => {
      const u = await makeStudent(repo);
      const s = await repo.addSave(u.id, FX.fp4x4, 'near campus');
      expect(s.userId).toBe(u.id);
      expect(s.floorPlanId).toBe(FX.fp4x4);
      expect(s.note).toBe('near campus');
      expect(Number.isNaN(Date.parse(s.createdAt))).toBe(false);
      expect(await repo.listSaves(u.id)).toEqual([s]);
    });

    it('addSave without a note has no note', async () => {
      const u = await makeStudent(repo);
      const s = await repo.addSave(u.id, FX.fp4x4);
      expect(s.note).toBeUndefined();
    });

    it('addSave is idempotent and keeps the original createdAt', async () => {
      const u = await makeStudent(repo);
      const first = await repo.addSave(u.id, FX.fp4x4);
      const second = await repo.addSave(u.id, FX.fp4x4);
      expect(second.createdAt).toBe(first.createdAt);
      expect(await repo.listSaves(u.id)).toHaveLength(1);
    });

    it('re-adding without a note keeps the existing note', async () => {
      const u = await makeStudent(repo);
      await repo.addSave(u.id, FX.fp4x4, 'keep me');
      const again = await repo.addSave(u.id, FX.fp4x4);
      expect(again.note).toBe('keep me');
    });

    it('listSaves lists newest first', async () => {
      const u = await makeStudent(repo);
      await repo.addSave(u.id, FX.fpStudio);
      await repo.addSave(u.id, FX.fp4x4);
      await repo.addSave(u.id, FX.fpRugby);
      expect((await repo.listSaves(u.id)).map((s) => s.floorPlanId)).toEqual([FX.fpRugby, FX.fp4x4, FX.fpStudio]);
    });

    it('saves are per user', async () => {
      const a = await makeStudent(repo, 'Ann');
      const b = await makeStudent(repo, 'Ben');
      await repo.addSave(a.id, FX.fp4x4);
      expect(await repo.listSaves(b.id)).toEqual([]);
    });

    it('removeSave removes only that save', async () => {
      const u = await makeStudent(repo);
      await repo.addSave(u.id, FX.fp4x4);
      await repo.addSave(u.id, FX.fpStudio);
      await repo.removeSave(u.id, FX.fp4x4);
      expect((await repo.listSaves(u.id)).map((s) => s.floorPlanId)).toEqual([FX.fpStudio]);
    });

    it('removeSave on a missing save is a no-op', async () => {
      const u = await makeStudent(repo);
      await expect(repo.removeSave(u.id, FX.fp4x4)).resolves.toBeUndefined();
    });

    it('returned saves are copies', async () => {
      const u = await makeStudent(repo);
      const s = await repo.addSave(u.id, FX.fp4x4, 'n');
      s.note = 'mutated';
      (await repo.listSaves(u.id)).pop();
      const list = await repo.listSaves(u.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.note).toBe('n');
    });

    describe('recordSwipe', () => {
      it('returns the swipe with createdAt', async () => {
        const u = await makeStudent(repo);
        const s = await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'left' });
        expect(s.userId).toBe(u.id);
        expect(s.floorPlanId).toBe(FX.fp4x4);
        expect(s.direction).toBe('left');
        expect(s.groupId).toBeUndefined();
        expect(Number.isNaN(Date.parse(s.createdAt))).toBe(false);
      });

      it('right swipe without a group adds a solo save', async () => {
        const u = await makeStudent(repo);
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'right' });
        expect((await repo.listSaves(u.id)).map((s) => s.floorPlanId)).toEqual([FX.fp4x4]);
      });

      it('left swipe does not add a save', async () => {
        const u = await makeStudent(repo);
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'left' });
        expect(await repo.listSaves(u.id)).toEqual([]);
      });

      it('right swipe on an already saved plan keeps one save with its original createdAt', async () => {
        const u = await makeStudent(repo);
        const saved = await repo.addSave(u.id, FX.fp4x4);
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'right' });
        const list = await repo.listSaves(u.id);
        expect(list).toHaveLength(1);
        expect(list[0]?.createdAt).toBe(saved.createdAt);
      });

      it('right swipe with a group adds a shortlist item, not a solo save', async () => {
        const u = await makeStudent(repo);
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'right', groupId: 'g-1' });
        expect(await repo.listSaves(u.id)).toEqual([]);
        const swipes = await repo.listSwipes({ groupId: 'g-1' });
        expect(swipes).toHaveLength(1);
        expect(swipes[0]?.groupId).toBe('g-1');
      });

      it('re-swiping replaces the earlier swipe', async () => {
        const u = await makeStudent(repo);
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'left' });
        const again = await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'right' });
        const swipes = await repo.listSwipes({ userId: u.id });
        expect(swipes).toHaveLength(1);
        expect(swipes[0]?.direction).toBe('right');
        expect(swipes[0]).toEqual(again);
        expect((await repo.listSaves(u.id)).map((s) => s.floorPlanId)).toEqual([FX.fp4x4]);
      });

      it('solo and group swipes on the same plan are separate', async () => {
        const u = await makeStudent(repo);
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'left' });
        await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'right', groupId: 'g-1' });
        expect(await repo.listSwipes({ userId: u.id })).toHaveLength(2);
      });

      it('repeated group right swipe does not duplicate', async () => {
        const a = await makeStudent(repo, 'Ann');
        const b = await makeStudent(repo, 'Ben');
        await repo.recordSwipe({ userId: a.id, floorPlanId: FX.fp4x4, direction: 'right', groupId: 'g-1' });
        await repo.recordSwipe({ userId: b.id, floorPlanId: FX.fp4x4, direction: 'right', groupId: 'g-1' });
        await repo.recordSwipe({ userId: a.id, floorPlanId: FX.fp4x4, direction: 'right', groupId: 'g-1' });
        expect(await repo.listSwipes({ groupId: 'g-1' })).toHaveLength(2);
      });
    });

    describe('listSwipes', () => {
      it('filters by user and by group', async () => {
        const a = await makeStudent(repo, 'Ann');
        const b = await makeStudent(repo, 'Ben');
        await repo.recordSwipe({ userId: a.id, floorPlanId: FX.fp4x4, direction: 'right' });
        await repo.recordSwipe({ userId: a.id, floorPlanId: FX.fpStudio, direction: 'left', groupId: 'g-1' });
        await repo.recordSwipe({ userId: b.id, floorPlanId: FX.fp4x4, direction: 'left', groupId: 'g-1' });
        expect(await repo.listSwipes({ userId: a.id })).toHaveLength(2);
        expect(await repo.listSwipes({ groupId: 'g-1' })).toHaveLength(2);
        expect(await repo.listSwipes({ userId: a.id, groupId: 'g-1' })).toHaveLength(1);
        expect(await repo.listSwipes({ userId: b.id })).toHaveLength(1);
      });

      it('returns [] when nothing matches', async () => {
        expect(await repo.listSwipes({ userId: 'nobody' })).toEqual([]);
        expect(await repo.listSwipes({ groupId: 'nope' })).toEqual([]);
      });

      it('returned swipes are copies', async () => {
        const u = await makeStudent(repo);
        const s = await repo.recordSwipe({ userId: u.id, floorPlanId: FX.fp4x4, direction: 'left' });
        s.direction = 'right';
        (await repo.listSwipes({ userId: u.id }))[0]!.direction = 'right';
        expect((await repo.listSwipes({ userId: u.id }))[0]?.direction).toBe('left');
      });
    });
  });
}
