import type { ApplicantProfile, FeeQuote, Property, User } from '@homed/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { NewApplicationBatch, Repository } from '../../src/repository';
import { expectRepoError, FX, makeStudent, type MakeRepo } from './helpers';

const TOKEN_SHAPE = /^[A-Za-z0-9_-]+$/;

function fee(people: number): FeeQuote {
  return {
    perPerson: [{ label: 'Application fee', amount: 50, refundable: false }],
    perPersonTotal: 50,
    people,
    applicationTotal: 50 * people,
    complianceIssues: [],
  };
}

function profileFor(userId: string): Omit<ApplicantProfile, 'updatedAt'> {
  return {
    userId,
    legalName: 'Amy Q. Student',
    phone: '434-555-0100',
    currentAddress: '1 Main St, Charlottesville, VA',
    studentStatus: 'undergraduate',
    expectedGraduation: '2028',
    idVerified: false,
    sensitive: {
      monthlyIncome: 4200,
      incomeSource: 'guarantor',
      guarantor: { name: 'Pat Q.', email: 'pat@example.com', relationship: 'parent', phone: '555-0199' },
      rentalHistory: [{ address: '2 Oak Ave', landlordName: 'Oak LLC', from: '2024-08-01', to: '2026-05-31' }],
      references: [{ name: 'Lee', contact: 'lee@example.com', relationship: 'former landlord' }],
      dateOfBirth: '2004-03-02',
    },
  };
}

function batchInput(leaderId: string, over: Partial<NewApplicationBatch> = {}): NewApplicationBatch {
  return {
    leaderId,
    floorPlanIds: [FX.fp4x4],
    invitees: [],
    fees: [fee(1)],
    ...over,
  };
}

export function applicationsConformance(makeRepo: MakeRepo): void {
  describe('applications', () => {
    let repo: Repository;
    let amy: User;

    beforeEach(async () => {
      repo = await makeRepo();
      amy = await makeStudent(repo, 'Amy', 'amy');
    });

    /** A landlord login that owns the given property (its Landlord record is linked). */
    async function landlordOwning(propertyId: string = FX.propertyLofts): Promise<{ user: User; landlordId: string }> {
      const user = await repo.createUser({ email: `owner-${propertyId}@example.com`, name: 'Owner', role: 'landlord' });
      const landlord = await repo.createLandlord({ name: `Owner of ${propertyId}`, userId: user.id });
      const { id, ...rest } = (await repo.getProperty(propertyId)) as Property;
      await repo.upsertProperty({ ...rest, id, landlordId: landlord.id });
      return { user, landlordId: landlord.id };
    }

    /** A draft application for Amy on the 4x4 floor plan, submitted by her. */
    async function submittedApp(): Promise<string> {
      const [app] = await repo.createApplicationBatch(batchInput(amy.id));
      await repo.updateApplicationStatus(app!.id, 'submitted', amy.id);
      return app!.id;
    }

    describe('applicant profile', () => {
      it('returns null when the user has no profile', async () => {
        expect(await repo.getApplicantProfile(amy.id)).toBeNull();
      });

      it('round-trips the profile with sensitive fields decrypted', async () => {
        const input = profileFor(amy.id);
        const saved = await repo.saveApplicantProfile(input);
        expect(saved).toEqual({ ...input, updatedAt: saved.updatedAt });
        expect(await repo.getApplicantProfile(amy.id)).toEqual(saved);
      });

      it('sets updatedAt to a valid timestamp', async () => {
        const saved = await repo.saveApplicantProfile(profileFor(amy.id));
        expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);
      });

      it('saving again replaces the earlier profile', async () => {
        await repo.saveApplicantProfile(profileFor(amy.id));
        const next = { ...profileFor(amy.id), phone: '434-555-0222', sensitive: { rentalHistory: [], references: [] } };
        await repo.saveApplicantProfile(next);
        const got = await repo.getApplicantProfile(amy.id);
        expect(got?.phone).toBe('434-555-0222');
        expect(got?.sensitive).toEqual({ rentalHistory: [], references: [] });
      });

      it('rejects a profile for an unknown user', async () => {
        await expectRepoError(repo.saveApplicantProfile(profileFor('no-such-user')), 'not_found');
      });

      it('returned profiles are copies', async () => {
        await repo.saveApplicantProfile(profileFor(amy.id));
        const got = (await repo.getApplicantProfile(amy.id))!;
        got.sensitive.rentalHistory.push({ address: 'Mutated', from: '2020-01-01' });
        got.legalName = 'Mutated';
        const again = await repo.getApplicantProfile(amy.id);
        expect(again?.legalName).toBe('Amy Q. Student');
        expect(again?.sensitive.rentalHistory).toHaveLength(1);
      });
    });

    describe('createApplicationBatch', () => {
      it('creates one draft application per floor plan sharing a batchId, ranked 1..n', async () => {
        const apps = await repo.createApplicationBatch(
          batchInput(amy.id, {
            floorPlanIds: [FX.fp4x4, FX.fpStudio, FX.fpRugby],
            fees: [fee(1), fee(1), fee(1)],
          }),
        );
        expect(apps).toHaveLength(3);
        expect(new Set(apps.map((a) => a.batchId)).size).toBe(1);
        expect(apps.map((a) => a.batchRank)).toEqual([1, 2, 3]);
        expect(apps.map((a) => a.floorPlanId)).toEqual([FX.fp4x4, FX.fpStudio, FX.fpRugby]);
        expect(apps.every((a) => a.status === 'draft' && a.userId === amy.id)).toBe(true);
      });

      it('a batch of one floor plan works', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        expect(app?.batchRank).toBe(1);
        expect(await repo.listBatch(app!.batchId)).toEqual([app]);
      });

      it('two batches get different batchIds', async () => {
        const [a] = await repo.createApplicationBatch(batchInput(amy.id));
        const [b] = await repo.createApplicationBatch(batchInput(amy.id));
        expect(a!.batchId).not.toBe(b!.batchId);
      });

      it('rejects an empty batch', async () => {
        await expectRepoError(repo.createApplicationBatch(batchInput(amy.id, { floorPlanIds: [], fees: [] })), 'invalid');
      });

      it('rejects more than MAX_BATCH_SIZE (3) floor plans', async () => {
        const ids = [FX.fp4x4, FX.fpStudio, FX.fpRugby, FX.fpOnGrounds];
        await expectRepoError(
          repo.createApplicationBatch(batchInput(amy.id, { floorPlanIds: ids, fees: ids.map(() => fee(1)) })),
          'invalid',
        );
      });

      it('rejects a floor plan listed twice', async () => {
        await expectRepoError(
          repo.createApplicationBatch(batchInput(amy.id, { floorPlanIds: [FX.fp4x4, FX.fp4x4], fees: [fee(1), fee(1)] })),
          'invalid',
        );
      });

      it('rejects a fee count that does not match the floor plan count', async () => {
        await expectRepoError(
          repo.createApplicationBatch(batchInput(amy.id, { floorPlanIds: [FX.fp4x4, FX.fpStudio], fees: [fee(1)] })),
          'invalid',
        );
      });

      it('stores each fee quote on its own application, in order', async () => {
        const f1 = { ...fee(2), applicationTotal: 100 };
        const f2 = { ...fee(2), applicationTotal: 150, complianceIssues: ['example issue'] };
        const apps = await repo.createApplicationBatch(
          batchInput(amy.id, { floorPlanIds: [FX.fp4x4, FX.fpStudio], fees: [f1, f2] }),
        );
        expect(apps[0]?.fees).toEqual(f1);
        expect(apps[1]?.fees).toEqual(f2);
      });

      it('starts each application with a draft history entry by the leader', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        expect(app?.statusHistory).toHaveLength(1);
        expect(app?.statusHistory[0]).toMatchObject({ status: 'draft', by: amy.id });
        expect(Number.isNaN(Date.parse(app!.statusHistory[0]!.at))).toBe(false);
        expect(app?.submittedAt).toBeUndefined();
        expect(app?.decidedAt).toBeUndefined();
      });

      it('rejects an unknown leader', async () => {
        await expectRepoError(repo.createApplicationBatch(batchInput('nobody')), 'not_found');
      });

      it('rejects an unknown floor plan', async () => {
        await expectRepoError(repo.createApplicationBatch(batchInput(amy.id, { floorPlanIds: ['fp-nope'] })), 'not_found');
      });

      it('records the group when the leader is a group member', async () => {
        const group = await repo.createGroup(amy.id, 'Crew');
        const [app] = await repo.createApplicationBatch(batchInput(amy.id, { groupId: group.id }));
        expect(app?.groupId).toBe(group.id);
      });

      it('rejects a group the leader is not in', async () => {
        const ben = await makeStudent(repo, 'Ben', 'ben');
        const group = await repo.createGroup(ben.id, 'Other crew');
        await expectRepoError(repo.createApplicationBatch(batchInput(amy.id, { groupId: group.id })), 'forbidden');
      });

      it('rejects an unknown group', async () => {
        await expectRepoError(repo.createApplicationBatch(batchInput(amy.id, { groupId: 'no-group' })), 'not_found');
      });

      it('rejects an invalid invitee email', async () => {
        await expectRepoError(
          repo.createApplicationBatch(batchInput(amy.id, { invitees: [{ kind: 'roommate', email: 'not-an-email' }] })),
          'invalid',
        );
      });
    });

    describe('members and invite tokens', () => {
      it('creates a leader member who has accepted and is not done', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        const members = await repo.listApplicationMembers(app!.id);
        const leader = members.find((m) => m.kind === 'leader');
        expect(leader).toMatchObject({
          applicationId: app!.id,
          userId: amy.id,
          email: amy.email,
          name: amy.name,
          inviteStatus: 'accepted',
          done: false,
        });
      });

      it('creates pending invitee members with lowercased emails and done = false', async () => {
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, {
            invitees: [
              { kind: 'roommate', email: '  Rory@Virginia.EDU ', name: 'Rory' },
              { kind: 'guarantor', email: 'Pat@Example.com' },
            ],
          }),
        );
        const members = await repo.listApplicationMembers(app!.id);
        expect(members.map((m) => m.kind)).toEqual(['leader', 'roommate', 'guarantor']);
        const rory = members.find((m) => m.kind === 'roommate');
        const pat = members.find((m) => m.kind === 'guarantor');
        expect(rory).toMatchObject({ email: 'rory@virginia.edu', name: 'Rory', inviteStatus: 'pending', done: false });
        expect(pat).toMatchObject({ email: 'pat@example.com', inviteStatus: 'pending', done: false });
        expect(pat?.name).toBeUndefined();
      });

      it('links an invitee to an existing user with that email', async () => {
        const rory = await makeStudent(repo, 'Rory', 'rory');
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: 'RORY@virginia.edu' }] }),
        );
        const rorys = (await repo.listApplicationMembers(app!.id)).find((m) => m.kind === 'roommate');
        expect(rorys?.userId).toBe(rory.id);
      });

      it('leaves userId unset for an invitee with no account', async () => {
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: 'nobody@virginia.edu' }] }),
        );
        const m = (await repo.listApplicationMembers(app!.id)).find((x) => x.kind === 'roommate');
        expect(m?.userId).toBeUndefined();
      });

      it('points a guarantor at the roommate they guarantee on the same application', async () => {
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, {
            invitees: [
              { kind: 'roommate', email: 'rory@virginia.edu' },
              { kind: 'guarantor', email: 'pat@example.com', guarantorForEmail: 'rory@virginia.edu' },
            ],
          }),
        );
        const members = await repo.listApplicationMembers(app!.id);
        const rory = members.find((m) => m.kind === 'roommate');
        const pat = members.find((m) => m.kind === 'guarantor');
        expect(rory).toBeDefined();
        expect(pat?.guarantorFor).toBe(rory?.id);
      });

      it('a guarantor can guarantee the leader', async () => {
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'guarantor', email: 'pat@example.com', guarantorForEmail: amy.email }] }),
        );
        const members = await repo.listApplicationMembers(app!.id);
        const leader = members.find((m) => m.kind === 'leader');
        expect(members.find((m) => m.kind === 'guarantor')?.guarantorFor).toBe(leader?.id);
      });

      it('rejects a guarantorForEmail that is not on the application', async () => {
        await expectRepoError(
          repo.createApplicationBatch(
            batchInput(amy.id, { invitees: [{ kind: 'guarantor', email: 'pat@example.com', guarantorForEmail: 'x@virginia.edu' }] }),
          ),
          'invalid',
        );
      });

      it('every member on every application gets a unique 192-bit base64url invite token', async () => {
        const apps = await repo.createApplicationBatch(
          batchInput(amy.id, {
            floorPlanIds: [FX.fp4x4, FX.fpStudio, FX.fpRugby],
            fees: [fee(2), fee(2), fee(2)],
            invitees: [
              { kind: 'roommate', email: 'rory@virginia.edu' },
              { kind: 'guarantor', email: 'pat@example.com' },
            ],
          }),
        );
        const tokens: string[] = [];
        for (const app of apps) {
          for (const m of await repo.listApplicationMembers(app.id)) tokens.push(m.inviteToken);
        }
        expect(tokens).toHaveLength(9);
        expect(new Set(tokens).size).toBe(tokens.length);
        for (const t of tokens) {
          expect(t.length).toBeGreaterThanOrEqual(22);
          expect(t).toMatch(TOKEN_SHAPE);
        }
      });

      it('getMemberByInviteToken finds a member by token', async () => {
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: 'rory@virginia.edu' }] }),
        );
        const rory = (await repo.listApplicationMembers(app!.id)).find((m) => m.kind === 'roommate')!;
        expect(await repo.getMemberByInviteToken(rory.inviteToken)).toEqual(rory);
      });

      it('getMemberByInviteToken returns null for unknown or empty tokens', async () => {
        await repo.createApplicationBatch(batchInput(amy.id));
        expect(await repo.getMemberByInviteToken('definitely-not-a-token')).toBeNull();
        expect(await repo.getMemberByInviteToken('')).toBeNull();
      });

      it('listApplicationMembers only returns the members of that application', async () => {
        const [a, b] = await repo.createApplicationBatch(
          batchInput(amy.id, {
            floorPlanIds: [FX.fp4x4, FX.fpStudio],
            fees: [fee(2), fee(2)],
            invitees: [{ kind: 'roommate', email: 'rory@virginia.edu' }],
          }),
        );
        const am = await repo.listApplicationMembers(a!.id);
        const bm = await repo.listApplicationMembers(b!.id);
        expect(am).toHaveLength(2);
        expect(bm).toHaveLength(2);
        expect(am.every((m) => m.applicationId === a!.id)).toBe(true);
        expect(await repo.listApplicationMembers('no-such-app')).toEqual([]);
      });

      it('updateApplicationMember patches done, name, inviteStatus and userId, and sets updatedAt', async () => {
        const rory = await makeStudent(repo, 'Rory', 'rory');
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: 'newbie@virginia.edu' }] }),
        );
        const before = (await repo.listApplicationMembers(app!.id)).find((m) => m.kind === 'roommate')!;
        const after = await repo.updateApplicationMember(before.id, {
          userId: rory.id,
          name: 'Rory Q.',
          inviteStatus: 'accepted',
          done: true,
        });
        expect(after).toMatchObject({ id: before.id, userId: rory.id, name: 'Rory Q.', inviteStatus: 'accepted', done: true });
        expect(after.inviteToken).toBe(before.inviteToken);
        expect(Number.isNaN(Date.parse(after.updatedAt))).toBe(false);
        expect(await repo.listApplicationMembers(app!.id)).toContainEqual(after);
      });

      it('updateApplicationMember rejects an unknown member', async () => {
        await expectRepoError(repo.updateApplicationMember('no-member', { done: true }), 'not_found');
      });
    });

    describe('reads', () => {
      it('getApplication returns null for an unknown id and a copy for a known one', async () => {
        expect(await repo.getApplication('nope')).toBeNull();
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        expect(await repo.getApplication(app!.id)).toEqual(app);
      });

      it('listBatch returns the batch in rank order and nothing else', async () => {
        const [a, b] = await repo.createApplicationBatch(
          batchInput(amy.id, { floorPlanIds: [FX.fpStudio, FX.fp4x4], fees: [fee(1), fee(1)] }),
        );
        await repo.createApplicationBatch(batchInput(amy.id));
        const batch = await repo.listBatch(a!.batchId);
        expect(batch.map((x) => x.id)).toEqual([a!.id, b!.id]);
        expect(await repo.listBatch('no-batch')).toEqual([]);
      });

      it('listApplicationsForUser returns the leader applications newest first', async () => {
        const [first] = await repo.createApplicationBatch(batchInput(amy.id));
        const [second] = await repo.createApplicationBatch(batchInput(amy.id, { floorPlanIds: [FX.fpRugby], fees: [fee(1)] }));
        const mine = await repo.listApplicationsForUser(amy.id);
        expect(mine.map((a) => a.id)).toEqual([second!.id, first!.id]);
      });

      it('listApplicationsForUser includes applications where the user is an invited member', async () => {
        const rory = await makeStudent(repo, 'Rory', 'rory');
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: rory.email }] }),
        );
        expect((await repo.listApplicationsForUser(rory.id)).map((a) => a.id)).toEqual([app!.id]);
      });

      it('listApplicationsForUser excludes applications the user has no part in', async () => {
        const ben = await makeStudent(repo, 'Ben', 'ben');
        await repo.createApplicationBatch(batchInput(amy.id));
        expect(await repo.listApplicationsForUser(ben.id)).toEqual([]);
      });

      it('listApplicationsForLandlord lists submitted applications on the landlord property and skips drafts', async () => {
        const { landlordId } = await landlordOwning(FX.propertyLofts);
        const submittedId = await submittedApp();
        await repo.createApplicationBatch(batchInput(amy.id)); // stays draft
        const rows = await repo.listApplicationsForLandlord(landlordId);
        expect(rows.map((a) => a.id)).toEqual([submittedId]);
        expect(rows.every((a) => a.status !== 'draft')).toBe(true);
      });

      it('listApplicationsForLandlord excludes other landlords and other properties', async () => {
        await landlordOwning(FX.propertyLofts);
        const rugby = await landlordOwning(FX.propertyRugby);
        await submittedApp(); // lofts floor plan
        expect(await repo.listApplicationsForLandlord(rugby.landlordId)).toEqual([]);
        expect(await repo.listApplicationsForLandlord('ll-nobody')).toEqual([]);
      });
    });

    describe('status transitions', () => {
      it('applicant submits a draft: status, history and submittedAt', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        const sent = await repo.updateApplicationStatus(app!.id, 'submitted', amy.id);
        expect(sent.status).toBe('submitted');
        expect(sent.submittedAt).toBeDefined();
        expect(Number.isNaN(Date.parse(sent.submittedAt!))).toBe(false);
        expect(sent.statusHistory.map((h) => h.status)).toEqual(['draft', 'submitted']);
        expect(sent.statusHistory[1]).toMatchObject({ status: 'submitted', by: amy.id });
        expect(await repo.getApplication(app!.id)).toEqual(sent);
      });

      it('landlord moves submitted to under_review, then approved with decidedAt', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        const review = await repo.updateApplicationStatus(id, 'under_review', user.id);
        expect(review.status).toBe('under_review');
        expect(review.decidedAt).toBeUndefined();
        const approved = await repo.updateApplicationStatus(id, 'approved', user.id);
        expect(approved.status).toBe('approved');
        expect(approved.decidedAt).toBeDefined();
        expect(approved.statusHistory.map((h) => h.status)).toEqual(['draft', 'submitted', 'under_review', 'approved']);
        expect(approved.statusHistory.at(-1)).toMatchObject({ by: user.id });
      });

      it('waitlisted and denied set decidedAt', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        await repo.updateApplicationStatus(id, 'under_review', user.id);
        const waitlisted = await repo.updateApplicationStatus(id, 'waitlisted', user.id);
        expect(waitlisted.decidedAt).toBeDefined();
        const denied = await repo.updateApplicationStatus(id, 'denied', user.id);
        expect(denied.status).toBe('denied');
        expect(denied.decidedAt).toBeDefined();
      });

      it('a waitlisted application can be approved later', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        await repo.updateApplicationStatus(id, 'under_review', user.id);
        await repo.updateApplicationStatus(id, 'waitlisted', user.id);
        expect((await repo.updateApplicationStatus(id, 'approved', user.id)).status).toBe('approved');
      });

      it('approved leads to lease_sent (landlord) and then signed (applicant)', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        await repo.updateApplicationStatus(id, 'under_review', user.id);
        await repo.updateApplicationStatus(id, 'approved', user.id);
        expect((await repo.updateApplicationStatus(id, 'lease_sent', user.id)).status).toBe('lease_sent');
        expect((await repo.updateApplicationStatus(id, 'signed', amy.id)).status).toBe('signed');
      });

      it('applicant can withdraw a draft', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        expect((await repo.updateApplicationStatus(app!.id, 'withdrawn', amy.id)).status).toBe('withdrawn');
      });

      it('applicant can withdraw after submitting', async () => {
        const id = await submittedApp();
        expect((await repo.updateApplicationStatus(id, 'withdrawn', amy.id)).status).toBe('withdrawn');
      });

      it('an illegal move is invalid and leaves the status unchanged', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        await expectRepoError(repo.updateApplicationStatus(app!.id, 'approved', amy.id), 'invalid');
        expect((await repo.getApplication(app!.id))?.status).toBe('draft');
      });

      it('skipping under_review (submitted -> approved) is invalid', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        await expectRepoError(repo.updateApplicationStatus(id, 'approved', user.id), 'invalid');
      });

      it('terminal statuses cannot move (denied, signed, withdrawn)', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        await repo.updateApplicationStatus(id, 'under_review', user.id);
        await repo.updateApplicationStatus(id, 'denied', user.id);
        await expectRepoError(repo.updateApplicationStatus(id, 'approved', user.id), 'invalid');
        await expectRepoError(repo.updateApplicationStatus(id, 'withdrawn', amy.id), 'invalid');
      });

      it('moving an application that is already withdrawn is invalid', async () => {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        await repo.updateApplicationStatus(app!.id, 'withdrawn', amy.id);
        await expectRepoError(repo.updateApplicationStatus(app!.id, 'submitted', amy.id), 'invalid');
      });

      it('unknown application is not_found', async () => {
        await expectRepoError(repo.updateApplicationStatus('no-app', 'submitted', amy.id), 'not_found');
      });

      it('a non-leader cannot submit a draft', async () => {
        const rory = await makeStudent(repo, 'Rory', 'rory');
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: rory.email }] }),
        );
        await expectRepoError(repo.updateApplicationStatus(app!.id, 'submitted', rory.id), 'forbidden');
        expect((await repo.getApplication(app!.id))?.status).toBe('draft');
      });

      it('a non-leader cannot withdraw', async () => {
        const ben = await makeStudent(repo, 'Ben', 'ben');
        const id = await submittedApp();
        await expectRepoError(repo.updateApplicationStatus(id, 'withdrawn', ben.id), 'forbidden');
      });

      it('the applicant cannot make a landlord move (approve)', async () => {
        const { user } = await landlordOwning(FX.propertyLofts);
        const id = await submittedApp();
        await repo.updateApplicationStatus(id, 'under_review', user.id);
        await expectRepoError(repo.updateApplicationStatus(id, 'approved', amy.id), 'forbidden');
        expect((await repo.getApplication(id))?.status).toBe('under_review');
      });

      it('a landlord who does not own the property cannot make a landlord move', async () => {
        await landlordOwning(FX.propertyLofts);
        const rugbyOwner = await landlordOwning(FX.propertyRugby);
        const id = await submittedApp();
        await expectRepoError(repo.updateApplicationStatus(id, 'under_review', rugbyOwner.user.id), 'forbidden');
      });

      it('a student cannot make a landlord move', async () => {
        const ben = await makeStudent(repo, 'Ben', 'ben');
        const id = await submittedApp();
        await expectRepoError(repo.updateApplicationStatus(id, 'under_review', ben.id), 'forbidden');
      });

      it('an admin can make a landlord move on any property', async () => {
        const admin = await repo.createUser({ email: 'admin@example.com', name: 'Admin', role: 'admin' });
        const id = await submittedApp();
        expect((await repo.updateApplicationStatus(id, 'under_review', admin.id)).status).toBe('under_review');
      });

      it('a landlord with no Landlord record cannot make a landlord move', async () => {
        const orphan = await repo.createUser({ email: 'orphan@example.com', name: 'Orphan', role: 'landlord' });
        const id = await submittedApp();
        await expectRepoError(repo.updateApplicationStatus(id, 'under_review', orphan.id), 'forbidden');
      });

      it('an unknown acting user cannot make a landlord move', async () => {
        const id = await submittedApp();
        await expectRepoError(repo.updateApplicationStatus(id, 'under_review', 'no-user'), 'forbidden');
      });
    });

    describe('documents', () => {
      const BYTES = new TextEncoder().encode('%PDF-1.7 distinctive bytes 0xC0FFEE');
      const DELETE_LATER = '2030-01-01';

      async function memberId(): Promise<string> {
        const [app] = await repo.createApplicationBatch(batchInput(amy.id));
        return (await repo.listApplicationMembers(app!.id))[0]!.id;
      }

      it('round-trips document bytes', async () => {
        const id = await memberId();
        const doc = await repo.putDocument({ memberId: id, filename: 'paystub.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER });
        expect(Array.from((await repo.getDocumentBytes(doc.id))!)).toEqual(Array.from(BYTES));
      });

      it('putDocument returns metadata with an opaque storage key', async () => {
        const id = await memberId();
        const doc = await repo.putDocument({ memberId: id, filename: 'paystub.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER });
        expect(doc).toMatchObject({ memberId: id, filename: 'paystub.pdf', mime: 'application/pdf', deleteAfter: DELETE_LATER });
        expect(doc.storageKey).toBeTruthy();
        expect(doc.storageKey).not.toBe(doc.id);
        expect(doc.storageKey).toMatch(TOKEN_SHAPE);
        expect(Number.isNaN(Date.parse(doc.createdAt))).toBe(false);
      });

      it('listDocuments returns only that member documents', async () => {
        const [app] = await repo.createApplicationBatch(
          batchInput(amy.id, { invitees: [{ kind: 'roommate', email: 'rory@virginia.edu' }] }),
        );
        const [leader, rory] = await repo.listApplicationMembers(app!.id);
        const mine = await repo.putDocument({ memberId: leader!.id, filename: 'a.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER });
        await repo.putDocument({ memberId: rory!.id, filename: 'b.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER });
        expect(await repo.listDocuments(leader!.id)).toEqual([mine]);
        expect(await repo.listDocuments('no-member')).toEqual([]);
      });

      it('putDocument rejects an unknown member', async () => {
        await expectRepoError(
          repo.putDocument({ memberId: 'no-member', filename: 'a.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER }),
          'not_found',
        );
      });

      it('putDocument rejects an empty filename', async () => {
        const id = await memberId();
        await expectRepoError(
          repo.putDocument({ memberId: id, filename: '   ', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER }),
          'invalid',
        );
      });

      it('getDocumentBytes returns null for an unknown document', async () => {
        expect(await repo.getDocumentBytes('no-doc')).toBeNull();
      });

      it('getDocumentBytes returns a copy', async () => {
        const id = await memberId();
        const doc = await repo.putDocument({ memberId: id, filename: 'a.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER });
        const got = (await repo.getDocumentBytes(doc.id))!;
        got[0] = 0;
        expect(Array.from((await repo.getDocumentBytes(doc.id))!)).toEqual(Array.from(BYTES));
      });

      it('purgeExpiredDocuments deletes documents with deleteAfter on or before today and returns the count', async () => {
        const id = await memberId();
        const expiredOnDay = await repo.putDocument({ memberId: id, filename: 'old.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: '2026-10-19' });
        const expiredEarlier = await repo.putDocument({ memberId: id, filename: 'older.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: '2026-01-01' });
        const kept = await repo.putDocument({ memberId: id, filename: 'keep.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: '2026-10-20' });
        expect(await repo.purgeExpiredDocuments('2026-10-19')).toBe(2);
        expect(await repo.listDocuments(id)).toEqual([kept]);
        expect(await repo.getDocumentBytes(expiredOnDay.id)).toBeNull();
        expect(await repo.getDocumentBytes(expiredEarlier.id)).toBeNull();
        expect(Array.from((await repo.getDocumentBytes(kept.id))!)).toEqual(Array.from(BYTES));
      });

      it('purgeExpiredDocuments returns 0 when nothing has expired', async () => {
        const id = await memberId();
        await repo.putDocument({ memberId: id, filename: 'keep.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: DELETE_LATER });
        expect(await repo.purgeExpiredDocuments('2026-10-19')).toBe(0);
      });

      it('purgeExpiredDocuments is idempotent', async () => {
        const id = await memberId();
        await repo.putDocument({ memberId: id, filename: 'old.pdf', mime: 'application/pdf', bytes: BYTES, deleteAfter: '2026-01-01' });
        expect(await repo.purgeExpiredDocuments('2026-10-19')).toBe(1);
        expect(await repo.purgeExpiredDocuments('2026-10-19')).toBe(0);
      });
    });

    it('a status change can be read back by the landlord listing with the new status', async () => {
      const { user, landlordId } = await landlordOwning(FX.propertyLofts);
      const id = await submittedApp();
      await repo.updateApplicationStatus(id, 'under_review', user.id);
      const [row] = await repo.listApplicationsForLandlord(landlordId);
      expect(row?.status).toBe('under_review');
    });
  });
}
