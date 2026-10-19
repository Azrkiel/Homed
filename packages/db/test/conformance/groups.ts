import { beforeEach, describe, expect, it } from 'vitest';
import type { Group, User } from '@homed/core';
import type { Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

export function groupsConformance(makeRepo: MakeRepo): void {
  describe('groups', () => {
    let repo: Repository;
    let ann: User;
    let ben: User;
    let cat: User;
    let group: Group;

    beforeEach(async () => {
      repo = await makeRepo();
      ann = await makeStudent(repo, 'Ann');
      ben = await makeStudent(repo, 'Ben');
      cat = await makeStudent(repo, 'Cat');
      group = await repo.createGroup(ann.id, 'Lofts crew');
    });

    async function fill(n: number): Promise<User[]> {
      const users: User[] = [];
      for (let i = 0; i < n; i++) {
        const u = await makeStudent(repo, `Fill${i}`);
        await repo.joinGroup(group.inviteCode, u.id);
        users.push(u);
      }
      return users;
    }

    describe('createGroup', () => {
      it('creates a group owned by the creator', async () => {
        expect(group.name).toBe('Lofts crew');
        expect(group.ownerId).toBe(ann.id);
        expect(group.id).toBeTruthy();
        expect(Number.isNaN(Date.parse(group.createdAt))).toBe(false);
      });

      it('makes the creator the only member, as leader', async () => {
        const members = await repo.listMembers(group.id);
        expect(members).toHaveLength(1);
        expect(members[0]).toMatchObject({ groupId: group.id, userId: ann.id, role: 'leader' });
      });

      it('issues an unguessable base64url invite code', async () => {
        expect(group.inviteCode).toMatch(/^[A-Za-z0-9_-]{11,}$/);
      });

      it('gives every group a distinct invite code', async () => {
        const codes = new Set([group.inviteCode]);
        for (let i = 0; i < 10; i++) codes.add((await repo.createGroup(ann.id, `g${i}`)).inviteCode);
        expect(codes.size).toBe(11);
      });

      it('rejects a blank name', async () => {
        await expectRepoError(repo.createGroup(ann.id, ''), 'invalid');
        await expectRepoError(repo.createGroup(ann.id, '   '), 'invalid');
      });

      it('rejects an unknown owner', async () => {
        await expectRepoError(repo.createGroup('nobody', 'x'), 'not_found');
      });
    });

    describe('lookup', () => {
      it('getGroup returns the group, null when unknown', async () => {
        expect(await repo.getGroup(group.id)).toEqual(group);
        expect(await repo.getGroup('nope')).toBeNull();
      });

      it('getGroupByInviteCode returns the group, null when unknown', async () => {
        expect(await repo.getGroupByInviteCode(group.inviteCode)).toEqual(group);
        expect(await repo.getGroupByInviteCode('nope')).toBeNull();
      });

      it('listGroupsForUser lists only groups the user belongs to', async () => {
        const other = await repo.createGroup(ben.id, 'Other');
        await repo.joinGroup(group.inviteCode, cat.id);
        expect((await repo.listGroupsForUser(ann.id)).map((g) => g.id)).toEqual([group.id]);
        expect((await repo.listGroupsForUser(ben.id)).map((g) => g.id)).toEqual([other.id]);
        expect((await repo.listGroupsForUser(cat.id)).map((g) => g.id)).toEqual([group.id]);
        expect(await repo.listGroupsForUser('nobody')).toEqual([]);
      });

      it('listMembers is [] for an unknown group', async () => {
        expect(await repo.listMembers('nope')).toEqual([]);
      });

      it('returned groups are copies', async () => {
        group.name = 'mutated';
        const g = await repo.getGroup(group.id);
        expect(g?.name).toBe('Lofts crew');
      });
    });

    describe('joinGroup', () => {
      it('adds a member with role member', async () => {
        const m = await repo.joinGroup(group.inviteCode, ben.id);
        expect(m).toMatchObject({ groupId: group.id, userId: ben.id, role: 'member' });
        expect(Number.isNaN(Date.parse(m.joinedAt))).toBe(false);
      });

      it('listMembers returns members in join order', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        await repo.joinGroup(group.inviteCode, cat.id);
        expect((await repo.listMembers(group.id)).map((m) => m.userId)).toEqual([ann.id, ben.id, cat.id]);
      });

      it('is idempotent for existing members', async () => {
        const first = await repo.joinGroup(group.inviteCode, ben.id);
        const second = await repo.joinGroup(group.inviteCode, ben.id);
        expect(second).toEqual(first);
        expect(await repo.listMembers(group.id)).toHaveLength(2);
      });

      it('does not demote the leader who rejoins', async () => {
        const m = await repo.joinGroup(group.inviteCode, ann.id);
        expect(m.role).toBe('leader');
      });

      it('rejects an unknown invite code', async () => {
        await expectRepoError(repo.joinGroup('bogus', ben.id), 'not_found');
      });

      it('rejects an unknown user', async () => {
        await expectRepoError(repo.joinGroup(group.inviteCode, 'nobody'), 'not_found');
      });

      it('allows up to 8 members', async () => {
        await fill(7);
        expect(await repo.listMembers(group.id)).toHaveLength(8);
      });

      it('rejects a 9th member with conflict', async () => {
        await fill(7);
        await expectRepoError(repo.joinGroup(group.inviteCode, ben.id), 'conflict');
        expect(await repo.listMembers(group.id)).toHaveLength(8);
      });

      it('an existing member can rejoin a full group', async () => {
        const users = await fill(7);
        await expect(repo.joinGroup(group.inviteCode, users[0]!.id)).resolves.toMatchObject({ userId: users[0]!.id });
      });

      it('a freed seat can be taken again', async () => {
        const users = await fill(7);
        await repo.leaveGroup(group.id, users[0]!.id);
        await repo.joinGroup(group.inviteCode, ben.id);
        expect(await repo.listMembers(group.id)).toHaveLength(8);
      });
    });

    describe('leaveGroup', () => {
      it('removes a regular member', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        await repo.leaveGroup(group.id, ben.id);
        expect((await repo.listMembers(group.id)).map((m) => m.userId)).toEqual([ann.id]);
        expect(await repo.listGroupsForUser(ben.id)).toEqual([]);
      });

      it('is a no-op for a non-member', async () => {
        await expect(repo.leaveGroup(group.id, ben.id)).resolves.toBeUndefined();
        await expect(repo.leaveGroup('nope', ben.id)).resolves.toBeUndefined();
        expect(await repo.listMembers(group.id)).toHaveLength(1);
      });

      it('the last leader leaving promotes the earliest-joined member', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        await repo.joinGroup(group.inviteCode, cat.id);
        await repo.leaveGroup(group.id, ann.id);
        const members = await repo.listMembers(group.id);
        expect(members.map((m) => [m.userId, m.role])).toEqual([
          [ben.id, 'leader'],
          [cat.id, 'member'],
        ]);
        expect((await repo.getGroup(group.id))?.ownerId).toBe(ben.id);
      });

      it('a non-leader leaving keeps the leader and owner', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        await repo.leaveGroup(group.id, ben.id);
        expect((await repo.listMembers(group.id))[0]?.role).toBe('leader');
        expect((await repo.getGroup(group.id))?.ownerId).toBe(ann.id);
      });

      it('the last member leaving deletes the group', async () => {
        await repo.leaveGroup(group.id, ann.id);
        expect(await repo.getGroup(group.id)).toBeNull();
        expect(await repo.getGroupByInviteCode(group.inviteCode)).toBeNull();
        expect(await repo.listMembers(group.id)).toEqual([]);
        expect(await repo.listGroupsForUser(ann.id)).toEqual([]);
      });

      it('deleting a group deletes its shortlist, votes and group swipes only', async () => {
        const other = await repo.createGroup(ann.id, 'Other');
        for (const g of [group, other]) {
          await repo.addToShortlist(g.id, ann.id, FX.fp4x4);
          await repo.castVote(g.id, ann.id, FX.fp4x4, 1);
          await repo.recordSwipe({ userId: ann.id, floorPlanId: FX.fpStudio, direction: 'right', groupId: g.id });
        }
        await repo.leaveGroup(group.id, ann.id);
        expect(await repo.listShortlist(group.id)).toEqual([]);
        expect(await repo.listVotes(group.id)).toEqual([]);
        expect(await repo.listSwipes({ groupId: group.id })).toEqual([]);
        expect((await repo.listShortlist(other.id)).length).toBeGreaterThan(0);
        expect(await repo.listVotes(other.id)).toHaveLength(1);
        expect(await repo.listSwipes({ groupId: other.id })).toHaveLength(1);
      });

      it('a user can rejoin after leaving', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        await repo.leaveGroup(group.id, ben.id);
        const m = await repo.joinGroup(group.inviteCode, ben.id);
        expect(m.role).toBe('member');
      });
    });

    describe('updateMember', () => {
      it('sets and clears budgetMax', async () => {
        const set = await repo.updateMember(group.id, ann.id, { budgetMax: 1200 });
        expect(set.budgetMax).toBe(1200);
        expect((await repo.listMembers(group.id))[0]?.budgetMax).toBe(1200);
        const cleared = await repo.updateMember(group.id, ann.id, { budgetMax: null });
        expect(cleared.budgetMax).toBeUndefined();
        expect((await repo.listMembers(group.id))[0]?.budgetMax).toBeUndefined();
      });

      it('an empty patch changes nothing', async () => {
        await repo.updateMember(group.id, ann.id, { budgetMax: 900 });
        const m = await repo.updateMember(group.id, ann.id, {});
        expect(m.budgetMax).toBe(900);
      });

      it('only touches the targeted member', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        await repo.updateMember(group.id, ben.id, { budgetMax: 800 });
        const members = await repo.listMembers(group.id);
        expect(members.find((m) => m.userId === ann.id)?.budgetMax).toBeUndefined();
        expect(members.find((m) => m.userId === ben.id)?.budgetMax).toBe(800);
      });

      it('rejects a non-member with not_found', async () => {
        await expectRepoError(repo.updateMember(group.id, ben.id, { budgetMax: 1 }), 'not_found');
        await expectRepoError(repo.updateMember('nope', ann.id, { budgetMax: 1 }), 'not_found');
      });
    });

    describe('shortlist', () => {
      it('is empty for a new group', async () => {
        expect(await repo.listShortlist(group.id)).toEqual([]);
        expect(await repo.listShortlist('nope')).toEqual([]);
      });

      it('addToShortlist stores an item with note', async () => {
        const item = await repo.addToShortlist(group.id, ann.id, FX.fp4x4, 'big kitchen');
        expect(item).toMatchObject({ groupId: group.id, floorPlanId: FX.fp4x4, addedBy: ann.id, note: 'big kitchen' });
        expect(Number.isNaN(Date.parse(item.createdAt))).toBe(false);
        expect(await repo.listShortlist(group.id)).toEqual([item]);
      });

      it('is idempotent and keeps the original adder and createdAt', async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
        const first = await repo.addToShortlist(group.id, ann.id, FX.fp4x4);
        const second = await repo.addToShortlist(group.id, ben.id, FX.fp4x4);
        expect(second.addedBy).toBe(ann.id);
        expect(second.createdAt).toBe(first.createdAt);
        expect(await repo.listShortlist(group.id)).toHaveLength(1);
      });

      it('lists newest first', async () => {
        await repo.addToShortlist(group.id, ann.id, FX.fpStudio);
        await repo.addToShortlist(group.id, ann.id, FX.fp4x4);
        await repo.addToShortlist(group.id, ann.id, FX.fpRugby);
        expect((await repo.listShortlist(group.id)).map((i) => i.floorPlanId)).toEqual([
          FX.fpRugby,
          FX.fp4x4,
          FX.fpStudio,
        ]);
      });

      it('rejects a non-member with forbidden', async () => {
        await expectRepoError(repo.addToShortlist(group.id, ben.id, FX.fp4x4), 'forbidden');
        expect(await repo.listShortlist(group.id)).toEqual([]);
      });

      it('includes items created by group right swipes', async () => {
        await repo.recordSwipe({ userId: ann.id, floorPlanId: FX.fpOnGrounds, direction: 'right', groupId: group.id });
        const list = await repo.listShortlist(group.id);
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ floorPlanId: FX.fpOnGrounds, addedBy: ann.id });
      });

      it('does not include group left swipes or other groups', async () => {
        const other = await repo.createGroup(ben.id, 'Other');
        await repo.recordSwipe({ userId: ann.id, floorPlanId: FX.fpOnGrounds, direction: 'left', groupId: group.id });
        await repo.addToShortlist(other.id, ben.id, FX.fp4x4);
        expect(await repo.listShortlist(group.id)).toEqual([]);
      });

      it('removeFromShortlist removes only that plan', async () => {
        await repo.addToShortlist(group.id, ann.id, FX.fp4x4);
        await repo.addToShortlist(group.id, ann.id, FX.fpStudio);
        await repo.removeFromShortlist(group.id, FX.fp4x4);
        expect((await repo.listShortlist(group.id)).map((i) => i.floorPlanId)).toEqual([FX.fpStudio]);
      });

      it('removeFromShortlist of a missing item is a no-op', async () => {
        await expect(repo.removeFromShortlist(group.id, FX.fp4x4)).resolves.toBeUndefined();
      });

      it('returned items are copies', async () => {
        const item = await repo.addToShortlist(group.id, ann.id, FX.fp4x4, 'n');
        item.note = 'mutated';
        expect((await repo.listShortlist(group.id))[0]?.note).toBe('n');
      });
    });

    describe('votes', () => {
      beforeEach(async () => {
        await repo.joinGroup(group.inviteCode, ben.id);
      });

      it('castVote records a vote', async () => {
        const v = await repo.castVote(group.id, ann.id, FX.fp4x4, 1);
        expect(v).toMatchObject({ groupId: group.id, userId: ann.id, floorPlanId: FX.fp4x4, value: 1 });
        expect(Number.isNaN(Date.parse(v.createdAt))).toBe(false);
        expect(await repo.listVotes(group.id)).toEqual([v]);
      });

      it('listVotes is [] for a group without votes', async () => {
        expect(await repo.listVotes(group.id)).toEqual([]);
        expect(await repo.listVotes('nope')).toEqual([]);
      });

      it('replaces the same user\'s earlier vote on the same plan', async () => {
        await repo.castVote(group.id, ann.id, FX.fp4x4, 1);
        await repo.castVote(group.id, ann.id, FX.fp4x4, -1);
        const votes = await repo.listVotes(group.id);
        expect(votes).toHaveLength(1);
        expect(votes[0]?.value).toBe(-1);
      });

      it('keeps votes of different users and different plans apart', async () => {
        await repo.castVote(group.id, ann.id, FX.fp4x4, 1);
        await repo.castVote(group.id, ben.id, FX.fp4x4, -1);
        await repo.castVote(group.id, ann.id, FX.fpStudio, 1);
        const votes = await repo.listVotes(group.id);
        expect(votes).toHaveLength(3);
        expect(votes.find((v) => v.userId === ben.id)?.value).toBe(-1);
      });

      it('value 0 clears but keeps the record with value 0', async () => {
        await repo.castVote(group.id, ann.id, FX.fp4x4, 1);
        const cleared = await repo.castVote(group.id, ann.id, FX.fp4x4, 0);
        expect(cleared.value).toBe(0);
        const votes = await repo.listVotes(group.id);
        expect(votes).toHaveLength(1);
        expect(votes[0]?.value).toBe(0);
      });

      it('rejects a non-member with forbidden', async () => {
        await expectRepoError(repo.castVote(group.id, cat.id, FX.fp4x4, 1), 'forbidden');
        expect(await repo.listVotes(group.id)).toEqual([]);
      });

      it('a member who left can no longer vote', async () => {
        await repo.leaveGroup(group.id, ben.id);
        await expectRepoError(repo.castVote(group.id, ben.id, FX.fp4x4, 1), 'forbidden');
      });

      it('votes are scoped per group', async () => {
        const other = await repo.createGroup(ann.id, 'Other');
        await repo.castVote(group.id, ann.id, FX.fp4x4, 1);
        await repo.castVote(other.id, ann.id, FX.fp4x4, -1);
        expect((await repo.listVotes(group.id))[0]?.value).toBe(1);
        expect((await repo.listVotes(other.id))[0]?.value).toBe(-1);
      });
    });
  });
}
