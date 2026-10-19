import { beforeEach, describe, expect, it } from 'vitest';
import type { AlertEventDraft, User } from '@homed/core';
import type { Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

export function alertsConformance(makeRepo: MakeRepo): void {
  describe('alerts', () => {
    let repo: Repository;
    let ann: User;
    let ben: User;

    beforeEach(async () => {
      repo = await makeRepo();
      ann = await makeStudent(repo, 'Ann');
      ben = await makeStudent(repo, 'Ben');
    });

    const propertyTarget = { kind: 'property', propertyId: FX.propertyLofts } as const;

    function draft(userId: string, alertId: string, message: string): AlertEventDraft {
      return {
        alertId,
        userId,
        trigger: 'price_drop',
        propertyId: FX.propertyLofts,
        floorPlanId: FX.fp4x4,
        message,
      };
    }

    describe('alert CRUD', () => {
      it('createAlert stores an alert with id and createdAt', async () => {
        const a = await repo.createAlert({ userId: ann.id, triggers: ['price_drop', 'few_left'], target: propertyTarget });
        expect(a.id).toBeTruthy();
        expect(a.userId).toBe(ann.id);
        expect(a.triggers).toEqual(['price_drop', 'few_left']);
        expect(a.target).toEqual(propertyTarget);
        expect(Number.isNaN(Date.parse(a.createdAt))).toBe(false);
      });

      it('createAlert supports search targets', async () => {
        const target = { kind: 'search', filters: {} } as const;
        const a = await repo.createAlert({ userId: ann.id, triggers: ['new_listing'], target });
        expect(a.target).toEqual(target);
      });

      it('createAlert rejects empty triggers', async () => {
        await expectRepoError(repo.createAlert({ userId: ann.id, triggers: [], target: propertyTarget }), 'invalid');
        expect(await repo.listAlerts(ann.id)).toEqual([]);
      });

      it('listAlerts is per user', async () => {
        const a = await repo.createAlert({ userId: ann.id, triggers: ['new_listing'], target: propertyTarget });
        await repo.createAlert({ userId: ben.id, triggers: ['few_left'], target: propertyTarget });
        expect(await repo.listAlerts(ann.id)).toEqual([a]);
        expect(await repo.listAlerts('nobody')).toEqual([]);
      });

      it('listAllAlerts returns every user\'s alerts', async () => {
        await repo.createAlert({ userId: ann.id, triggers: ['new_listing'], target: propertyTarget });
        await repo.createAlert({ userId: ben.id, triggers: ['few_left'], target: propertyTarget });
        const all = await repo.listAllAlerts();
        expect(all.map((a) => a.userId).sort()).toEqual([ann.id, ben.id].sort());
      });

      it('deleteAlert removes an owned alert', async () => {
        const a = await repo.createAlert({ userId: ann.id, triggers: ['new_listing'], target: propertyTarget });
        const keep = await repo.createAlert({ userId: ann.id, triggers: ['few_left'], target: propertyTarget });
        await repo.deleteAlert(ann.id, a.id);
        expect(await repo.listAlerts(ann.id)).toEqual([keep]);
      });

      it('deleteAlert by another user is a no-op', async () => {
        const a = await repo.createAlert({ userId: ann.id, triggers: ['new_listing'], target: propertyTarget });
        await expect(repo.deleteAlert(ben.id, a.id)).resolves.toBeUndefined();
        expect(await repo.listAlerts(ann.id)).toEqual([a]);
      });

      it('deleteAlert of an unknown alert is a no-op', async () => {
        await expect(repo.deleteAlert(ann.id, 'nope')).resolves.toBeUndefined();
      });

      it('returned alerts are copies', async () => {
        const a = await repo.createAlert({ userId: ann.id, triggers: ['new_listing'], target: propertyTarget });
        a.triggers.push('few_left');
        expect((await repo.listAlerts(ann.id))[0]?.triggers).toEqual(['new_listing']);
      });
    });

    describe('alert events', () => {
      let alertId: string;
      beforeEach(async () => {
        alertId = (await repo.createAlert({ userId: ann.id, triggers: ['price_drop'], target: propertyTarget })).id;
      });

      it('addAlertEvents assigns id and createdAt and leaves them unread', async () => {
        const [e] = await repo.addAlertEvents([draft(ann.id, alertId, 'dropped')]);
        expect(e).toBeDefined();
        expect(e?.id).toBeTruthy();
        expect(Number.isNaN(Date.parse(e!.createdAt))).toBe(false);
        expect(e?.readAt).toBeUndefined();
        expect(e).toMatchObject({ alertId, userId: ann.id, trigger: 'price_drop', message: 'dropped' });
      });

      it('addAlertEvents returns one event per draft with distinct ids', async () => {
        const out = await repo.addAlertEvents([draft(ann.id, alertId, 'a'), draft(ann.id, alertId, 'b')]);
        expect(out).toHaveLength(2);
        expect(out[0]?.id).not.toBe(out[1]?.id);
        expect(out.map((e) => e.message)).toEqual(['a', 'b']);
      });

      it('addAlertEvents with no drafts returns []', async () => {
        expect(await repo.addAlertEvents([])).toEqual([]);
      });

      it('listAlertEvents is empty for a new user', async () => {
        expect(await repo.listAlertEvents(ann.id)).toEqual([]);
      });

      it('listAlertEvents is per user', async () => {
        await repo.addAlertEvents([draft(ann.id, alertId, 'mine')]);
        expect(await repo.listAlertEvents(ben.id)).toEqual([]);
      });

      it('lists newest first (later insertions first)', async () => {
        await repo.addAlertEvents([draft(ann.id, alertId, 'one'), draft(ann.id, alertId, 'two')]);
        await repo.addAlertEvents([draft(ann.id, alertId, 'three')]);
        expect((await repo.listAlertEvents(ann.id)).map((e) => e.message)).toEqual(['three', 'two', 'one']);
      });

      it('unreadOnly hides read events', async () => {
        const [a, b, c] = await repo.addAlertEvents([
          draft(ann.id, alertId, 'a'),
          draft(ann.id, alertId, 'b'),
          draft(ann.id, alertId, 'c'),
        ]);
        await repo.markAlertEventsRead(ann.id, [a!.id, c!.id]);
        const unread = await repo.listAlertEvents(ann.id, { unreadOnly: true });
        expect(unread.map((e) => e.id)).toEqual([b!.id]);
        expect(await repo.listAlertEvents(ann.id)).toHaveLength(3);
        expect(await repo.listAlertEvents(ann.id, { unreadOnly: false })).toHaveLength(3);
      });

      it('markAlertEventsRead sets readAt', async () => {
        const [e] = await repo.addAlertEvents([draft(ann.id, alertId, 'a')]);
        await repo.markAlertEventsRead(ann.id, [e!.id]);
        const [after] = await repo.listAlertEvents(ann.id);
        expect(after?.readAt).toBeDefined();
        expect(Number.isNaN(Date.parse(after!.readAt!))).toBe(false);
      });

      it('markAlertEventsRead only affects the given user\'s events', async () => {
        const [mine, theirs] = await repo.addAlertEvents([draft(ann.id, alertId, 'mine'), draft(ben.id, alertId, 'theirs')]);
        await repo.markAlertEventsRead(ann.id, [mine!.id, theirs!.id]);
        expect((await repo.listAlertEvents(ann.id))[0]?.readAt).toBeDefined();
        expect((await repo.listAlertEvents(ben.id))[0]?.readAt).toBeUndefined();
      });

      it('markAlertEventsRead is idempotent', async () => {
        const [e] = await repo.addAlertEvents([draft(ann.id, alertId, 'a')]);
        await repo.markAlertEventsRead(ann.id, [e!.id]);
        const first = (await repo.listAlertEvents(ann.id))[0]?.readAt;
        await repo.markAlertEventsRead(ann.id, [e!.id]);
        expect((await repo.listAlertEvents(ann.id))[0]?.readAt).toBe(first);
      });

      it('markAlertEventsRead ignores unknown ids and empty lists', async () => {
        await repo.addAlertEvents([draft(ann.id, alertId, 'a')]);
        await expect(repo.markAlertEventsRead(ann.id, ['nope'])).resolves.toBeUndefined();
        await expect(repo.markAlertEventsRead(ann.id, [])).resolves.toBeUndefined();
        expect(await repo.listAlertEvents(ann.id, { unreadOnly: true })).toHaveLength(1);
      });

      it('returned events are copies', async () => {
        const [e] = await repo.addAlertEvents([draft(ann.id, alertId, 'a')]);
        e!.message = 'mutated';
        (await repo.listAlertEvents(ann.id))[0]!.message = 'mutated';
        expect((await repo.listAlertEvents(ann.id))[0]?.message).toBe('a');
      });
    });
  });
}
