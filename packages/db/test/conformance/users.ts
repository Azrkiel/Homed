import { DEFAULT_WEIGHTS, type UserSchedule } from '@homed/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

export function usersConformance(makeRepo: MakeRepo): void {
  describe('users', () => {
    let repo: Repository;
    beforeEach(async () => {
      repo = await makeRepo();
    });

    it('createUser stores a student with default weights and no extras', async () => {
      const u = await repo.createUser({ email: 'amy@virginia.edu', name: 'Amy', role: 'student' });
      expect(u.id).toBeTruthy();
      expect(u.email).toBe('amy@virginia.edu');
      expect(u.name).toBe('Amy');
      expect(u.role).toBe('student');
      expect(u.weights).toEqual(DEFAULT_WEIGHTS);
      expect(u.extras).toEqual([]);
      expect(Number.isNaN(Date.parse(u.createdAt))).toBe(false);
    });

    it('createUser lowercases and trims the email', async () => {
      const u = await repo.createUser({ email: '  Amy.Q@Virginia.EDU ', name: 'Amy', role: 'student' });
      expect(u.email).toBe('amy.q@virginia.edu');
    });

    it('createUser gives each user a distinct id', async () => {
      const a = await makeStudent(repo, 'Ann');
      const b = await makeStudent(repo, 'Ben');
      expect(a.id).not.toBe(b.id);
    });

    it('student email must be @virginia.edu', async () => {
      await expectRepoError(repo.createUser({ email: 'amy@gmail.com', name: 'A', role: 'student' }), 'invalid');
      await expectRepoError(repo.createUser({ email: 'amy@alumni.virginia.edu', name: 'A', role: 'student' }), 'invalid');
      await expectRepoError(repo.createUser({ email: 'not-an-email', name: 'A', role: 'student' }), 'invalid');
    });

    it('landlord needs a valid email but any domain', async () => {
      const l = await repo.createUser({ email: 'Owner@Example.com', name: 'Owner', role: 'landlord' });
      expect(l.email).toBe('owner@example.com');
      expect(l.role).toBe('landlord');
      await expectRepoError(repo.createUser({ email: 'bad', name: 'x', role: 'landlord' }), 'invalid');
      await expectRepoError(repo.createUser({ email: 'a b@example.com', name: 'x', role: 'landlord' }), 'invalid');
    });

    it('duplicate email conflicts, case-insensitively', async () => {
      await repo.createUser({ email: 'amy@virginia.edu', name: 'Amy', role: 'student' });
      await expectRepoError(repo.createUser({ email: 'AMY@virginia.edu', name: 'Amy 2', role: 'student' }), 'conflict');
    });

    it('failed createUser leaves no user behind', async () => {
      await expectRepoError(repo.createUser({ email: 'amy@gmail.com', name: 'A', role: 'student' }), 'invalid');
      expect(await repo.getUserByEmail('amy@gmail.com')).toBeNull();
    });

    it('getUser and getUserByEmail find the user, null otherwise', async () => {
      const u = await makeStudent(repo, 'Amy');
      expect(await repo.getUser(u.id)).toEqual(u);
      expect(await repo.getUserByEmail('amy@virginia.edu')).toEqual(u);
      expect(await repo.getUserByEmail('  AMY@Virginia.Edu ')).toEqual(u);
      expect(await repo.getUser('nope')).toBeNull();
      expect(await repo.getUserByEmail('nobody@virginia.edu')).toBeNull();
    });

    it('updateUser patches fields and keeps id, email, role, createdAt', async () => {
      const u = await makeStudent(repo, 'Amy');
      const updated = await repo.updateUser(u.id, {
        name: 'Amy Q',
        budgetMax: 1200,
        majorId: FX.majorEngineering,
        weights: { price: 0.6, location: 0.3, looks: 0.1 },
        extras: ['afc'],
        classYear: 'third',
      });
      expect(updated.name).toBe('Amy Q');
      expect(updated.budgetMax).toBe(1200);
      expect(updated.majorId).toBe(FX.majorEngineering);
      expect(updated.weights).toEqual({ price: 0.6, location: 0.3, looks: 0.1 });
      expect(updated.extras).toEqual(['afc']);
      expect(updated.id).toBe(u.id);
      expect(updated.email).toBe(u.email);
      expect(updated.role).toBe('student');
      expect(updated.createdAt).toBe(u.createdAt);
      expect(await repo.getUser(u.id)).toEqual(updated);
    });

    it('updateUser leaves unspecified fields alone', async () => {
      const u = await makeStudent(repo, 'Amy');
      await repo.updateUser(u.id, { budgetMax: 900 });
      const after = await repo.updateUser(u.id, { name: 'Amy Z' });
      expect(after.budgetMax).toBe(900);
      expect(after.weights).toEqual(DEFAULT_WEIGHTS);
    });

    it('updateUser on an unknown user is not_found', async () => {
      await expectRepoError(repo.updateUser('nope', { name: 'x' }), 'not_found');
    });

    it('returned users are copies', async () => {
      const u = await makeStudent(repo, 'Amy');
      u.name = 'mutated';
      u.weights.price = 0.99;
      u.extras.push('afc');
      const again = await repo.getUser(u.id);
      expect(again?.name).toBe('Amy');
      expect(again?.weights).toEqual(DEFAULT_WEIGHTS);
      expect(again?.extras).toEqual([]);
    });

    it('new users do not share the default weights object', async () => {
      const a = await makeStudent(repo, 'Ann');
      await repo.updateUser(a.id, { weights: { price: 1, location: 0, looks: 0 } });
      const b = await makeStudent(repo, 'Ben');
      expect(b.weights).toEqual(DEFAULT_WEIGHTS);
    });

    describe('schedules', () => {
      const entry = {
        id: 'e1',
        courseNumber: 'APMA 2120',
        days: ['mon', 'wed'] as UserSchedule['entries'][number]['days'],
        start: '09:00',
        end: '09:50',
        buildingId: FX.buildingThornton,
      };

      it('getSchedule returns null before any save', async () => {
        const u = await makeStudent(repo);
        expect(await repo.getSchedule(u.id)).toBeNull();
      });

      it('saveSchedule stores it and stamps updatedAt', async () => {
        const u = await makeStudent(repo);
        const saved = await repo.saveSchedule({ userId: u.id, mode: 'schedule', entries: [entry] });
        expect(saved.userId).toBe(u.id);
        expect(saved.entries).toEqual([entry]);
        expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);
        expect(await repo.getSchedule(u.id)).toEqual(saved);
      });

      it('saveSchedule replaces the earlier schedule', async () => {
        const u = await makeStudent(repo);
        await repo.saveSchedule({ userId: u.id, mode: 'schedule', entries: [entry] });
        const second = await repo.saveSchedule({ userId: u.id, mode: 'major', majorId: FX.majorEngineering, entries: [] });
        const got = await repo.getSchedule(u.id);
        expect(got).toEqual(second);
        expect(got?.mode).toBe('major');
        expect(got?.entries).toEqual([]);
      });

      it('schedules are per user', async () => {
        const a = await makeStudent(repo, 'Ann');
        const b = await makeStudent(repo, 'Ben');
        await repo.saveSchedule({ userId: a.id, mode: 'schedule', entries: [entry] });
        expect(await repo.getSchedule(b.id)).toBeNull();
      });

      it('returned schedules are copies', async () => {
        const u = await makeStudent(repo);
        const saved = await repo.saveSchedule({ userId: u.id, mode: 'schedule', entries: [entry] });
        saved.entries.length = 0;
        const got = await repo.getSchedule(u.id);
        expect(got?.entries.length).toBe(1);
        got?.entries.pop();
        expect((await repo.getSchedule(u.id))?.entries.length).toBe(1);
      });

      it('saveSchedule does not keep a reference to the input', async () => {
        const u = await makeStudent(repo);
        const input = { userId: u.id, mode: 'schedule' as const, entries: [{ ...entry }] };
        await repo.saveSchedule(input);
        input.entries.length = 0;
        expect((await repo.getSchedule(u.id))?.entries.length).toBe(1);
      });
    });
  });
}
