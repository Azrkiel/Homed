import { randomBytes } from 'node:crypto';
import {
  canTransition,
  isEmail,
  MAX_BATCH_SIZE,
  transitionActor,
  type Application,
  type ApplicationMember,
  type ApplicantProfile,
  type ApplicantSensitive,
  type ApplicationStatus,
  type ID,
  type ISODate,
} from '@homed/core';
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from '../crypto';
import { RepoError, type ApplicationRepo, type NewApplicationBatch, type StoredDocumentInput } from '../repository';
import type { State, StoredProfile } from './state';
import type { Ctx } from './store';

const DECIDED: ApplicationStatus[] = ['approved', 'waitlisted', 'denied'];

/** Newest first; later insertions win ties. */
function newestFirst<T extends { createdAt: string }>(rows: T[]): T[] {
  const out = [...rows].reverse();
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return out;
}

/** 192 bits of randomness, base64url. */
function uniqueToken(taken: Set<string>): string {
  for (;;) {
    const t = randomBytes(24).toString('base64url');
    if (!taken.has(t)) return t;
  }
}

function allTokens(s: State): Set<string> {
  return new Set(s.applicationMembers.map((m) => m.inviteToken));
}

function uniqueStorageKey(s: State): string {
  return uniqueToken(new Set(s.documents.map((d) => d.storageKey)));
}

function membersOfApp(s: State, applicationId: ID): ApplicationMember[] {
  return s.applicationMembers.filter((m) => m.applicationId === applicationId);
}

/** Applications where the user is the leader or a member. */
function applicationIdsForUser(s: State, userId: ID): Set<ID> {
  const ids = new Set<ID>();
  for (const a of s.applications) if (a.userId === userId) ids.add(a.id);
  for (const m of s.applicationMembers) if (m.userId === userId) ids.add(m.applicationId);
  return ids;
}

/** The landlord may act on the property if they own its Landlord record, or are an admin. */
function landlordMayActOn(s: State, byUserId: ID, propertyId: ID | undefined): boolean {
  const user = s.users.find((u) => u.id === byUserId);
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'landlord') return false;
  const property = s.catalog.properties.find((p) => p.id === propertyId);
  const landlord = s.catalog.landlords.find((l) => l.userId === byUserId);
  return Boolean(property && landlord && property.landlordId === landlord.id);
}

function requireUser(s: State, userId: ID) {
  const user = s.users.find((u) => u.id === userId);
  if (!user) throw new RepoError('not_found', 'user not found');
  return user;
}

export function applicationRepo(ctx: Ctx): ApplicationRepo {
  return {
    getApplicantProfile: (userId) =>
      ctx.read((s) => {
        const row = s.profiles.find((p) => p.userId === userId);
        if (!row) return null;
        const { sensitive, ...rest } = row;
        const profile: ApplicantProfile = {
          ...structuredClone(rest),
          sensitive: decryptJson<ApplicantSensitive>(sensitive, ctx.encryptionKey),
        };
        return profile;
      }),

    saveApplicantProfile: (profile) =>
      ctx.write((s) => {
        requireUser(s, profile.userId);
        const copy = structuredClone(profile);
        const { sensitive, ...rest } = copy;
        const stored: StoredProfile = {
          ...rest,
          sensitive: encryptJson(sensitive, ctx.encryptionKey),
          updatedAt: ctx.now(),
        };
        const i = s.profiles.findIndex((p) => p.userId === profile.userId);
        if (i >= 0) s.profiles[i] = stored;
        else s.profiles.push(stored);
        return { ...copy, updatedAt: stored.updatedAt };
      }),

    createApplicationBatch: (input: NewApplicationBatch) =>
      ctx.write((s) => {
        const { floorPlanIds, fees, invitees } = input;
        if (floorPlanIds.length === 0 || floorPlanIds.length > MAX_BATCH_SIZE) {
          throw new RepoError('invalid', `a batch needs 1-${MAX_BATCH_SIZE} floor plans`);
        }
        if (new Set(floorPlanIds).size !== floorPlanIds.length) {
          throw new RepoError('invalid', 'duplicate floor plan in batch');
        }
        if (fees.length !== floorPlanIds.length) {
          throw new RepoError('invalid', 'one fee quote per floor plan is required');
        }
        const cleanInvitees = invitees.map((inv) => {
          const email = inv.email.trim().toLowerCase();
          if (!isEmail(email)) throw new RepoError('invalid', `invalid invitee email: ${inv.email}`);
          return { ...inv, email, name: inv.name?.trim() || undefined };
        });
        const emails = cleanInvitees.map((inv) => inv.email);
        if (new Set(emails).size !== emails.length) throw new RepoError('invalid', 'duplicate invitee email');

        const leader = requireUser(s, input.leaderId);
        if (cleanInvitees.some((inv) => inv.email === leader.email)) {
          throw new RepoError('invalid', 'the leader cannot be invited');
        }
        for (const fpId of floorPlanIds) {
          if (!s.catalog.floorPlans.some((f) => f.id === fpId)) throw new RepoError('not_found', `floor plan ${fpId} not found`);
        }
        if (input.groupId !== undefined) {
          const group = s.groups.find((g) => g.id === input.groupId);
          if (!group) throw new RepoError('not_found', 'group not found');
          const isMember = s.groupMembers.some((m) => m.groupId === group.id && m.userId === input.leaderId);
          if (!isMember) throw new RepoError('forbidden', 'leader is not a member of this group');
        }

        const now = ctx.now();
        const batchId = crypto.randomUUID();
        const tokens = allTokens(s);
        const newApps: Application[] = [];
        const newMembers: ApplicationMember[] = [];

        floorPlanIds.forEach((floorPlanId, i) => {
          const applicationId = crypto.randomUUID();
          const appMembers: ApplicationMember[] = [];
          const leaderMember: ApplicationMember = {
            id: crypto.randomUUID(),
            applicationId,
            kind: 'leader',
            userId: leader.id,
            email: leader.email,
            name: leader.name,
            inviteToken: uniqueToken(tokens),
            inviteStatus: 'accepted',
            done: false,
            updatedAt: now,
          };
          tokens.add(leaderMember.inviteToken);
          appMembers.push(leaderMember);

          for (const inv of cleanInvitees) {
            const member: ApplicationMember = {
              id: crypto.randomUUID(),
              applicationId,
              kind: inv.kind,
              email: inv.email,
              inviteToken: uniqueToken(tokens),
              inviteStatus: 'pending',
              done: false,
              updatedAt: now,
            };
            if (inv.name !== undefined) member.name = inv.name;
            const existingUser = s.users.find((u) => u.email === inv.email);
            if (existingUser) member.userId = existingUser.id;
            tokens.add(member.inviteToken);
            appMembers.push(member);
          }

          // Guarantors point at the roommate or leader they guarantee, matched by email on this application.
          for (const inv of cleanInvitees) {
            if (inv.kind !== 'guarantor' || inv.guarantorForEmail === undefined) continue;
            const target = inv.guarantorForEmail.trim().toLowerCase();
            const guaranteed = appMembers.find((m) => m.kind !== 'guarantor' && m.email === target);
            if (!guaranteed) {
              throw new RepoError('invalid', `guarantorForEmail ${inv.guarantorForEmail} is not a member of this application`);
            }
            const guarantor = appMembers.find((m) => m.kind === 'guarantor' && m.email === inv.email);
            if (guarantor) guarantor.guarantorFor = guaranteed.id;
          }

          const app: Application = {
            id: applicationId,
            userId: leader.id,
            floorPlanId,
            batchId,
            batchRank: i + 1,
            status: 'draft',
            statusHistory: [{ status: 'draft', at: now, by: leader.id }],
            fees: structuredClone(fees[i]!),
            createdAt: now,
          };
          if (input.groupId !== undefined) app.groupId = input.groupId;
          newApps.push(app);
          newMembers.push(...appMembers);
        });

        s.applications.push(...newApps);
        s.applicationMembers.push(...newMembers);
        return structuredClone(newApps);
      }),

    getApplication: (applicationId) =>
      ctx.read((s) => structuredClone(s.applications.find((a) => a.id === applicationId) ?? null)),

    listBatch: (batchId) =>
      ctx.read((s) =>
        structuredClone(
          s.applications.filter((a) => a.batchId === batchId).sort((a, b) => a.batchRank - b.batchRank),
        ),
      ),

    listApplicationsForUser: (userId) =>
      ctx.read((s) => {
        const ids = applicationIdsForUser(s, userId);
        return structuredClone(newestFirst(s.applications.filter((a) => ids.has(a.id))));
      }),

    listApplicationsForLandlord: (landlordId) =>
      ctx.read((s) => {
        const propertyIds = new Set(
          s.catalog.properties.filter((p) => p.landlordId === landlordId).map((p) => p.id),
        );
        const floorPlanIds = new Set(
          s.catalog.floorPlans.filter((f) => propertyIds.has(f.propertyId)).map((f) => f.id),
        );
        const rows = s.applications.filter((a) => floorPlanIds.has(a.floorPlanId) && a.status !== 'draft');
        return structuredClone(newestFirst(rows));
      }),

    updateApplicationStatus: (applicationId, to, byUserId) =>
      ctx.write((s) => {
        const app = s.applications.find((a) => a.id === applicationId);
        if (!app) throw new RepoError('not_found', 'application not found');
        if (!canTransition(app.status, to)) {
          throw new RepoError('invalid', `cannot move application from ${app.status} to ${to}`);
        }
        const actor = transitionActor(app.status, to);
        if (actor === 'applicant') {
          if (byUserId !== app.userId) throw new RepoError('forbidden', 'only the applicant may make this move');
        } else if (!landlordMayActOn(s, byUserId, s.catalog.floorPlans.find((f) => f.id === app.floorPlanId)?.propertyId)) {
          throw new RepoError('forbidden', 'only the property landlord or an admin may make this move');
        }

        const now = ctx.now();
        app.status = to;
        app.statusHistory.push({ status: to, at: now, by: byUserId });
        if (to === 'submitted') app.submittedAt = now;
        if (DECIDED.includes(to)) app.decidedAt = now;
        return structuredClone(app);
      }),

    listApplicationMembers: (applicationId) =>
      ctx.read((s) => structuredClone(membersOfApp(s, applicationId))),

    getMemberByInviteToken: (token) =>
      ctx.read((s) => {
        if (!token) return null;
        return structuredClone(s.applicationMembers.find((m) => m.inviteToken === token) ?? null);
      }),

    updateApplicationMember: (memberId, patch) =>
      ctx.write((s) => {
        const member = s.applicationMembers.find((m) => m.id === memberId);
        if (!member) throw new RepoError('not_found', 'application member not found');
        if (patch.userId !== undefined) member.userId = patch.userId;
        if (patch.name !== undefined) member.name = patch.name;
        if (patch.inviteStatus !== undefined) member.inviteStatus = patch.inviteStatus;
        if (patch.done !== undefined) member.done = patch.done;
        member.updatedAt = ctx.now();
        return structuredClone(member);
      }),

    putDocument: (input: StoredDocumentInput) =>
      ctx.write((s) => {
        const filename = input.filename.trim();
        if (!filename) throw new RepoError('invalid', 'filename required');
        if (!s.applicationMembers.some((m) => m.id === input.memberId)) {
          throw new RepoError('not_found', 'application member not found');
        }
        const doc = {
          id: crypto.randomUUID(),
          memberId: input.memberId,
          filename,
          mime: input.mime,
          storageKey: uniqueStorageKey(s),
          deleteAfter: input.deleteAfter as ISODate,
          createdAt: ctx.now(),
        };
        s.documents.push(doc);
        s.documentBlobs[doc.id] = encryptBytes(input.bytes, ctx.encryptionKey);
        return structuredClone(doc);
      }),

    listDocuments: (memberId) =>
      ctx.read((s) => structuredClone(s.documents.filter((d) => d.memberId === memberId))),

    getDocumentBytes: (documentId) =>
      ctx.read((s) => {
        const blob = s.documentBlobs[documentId];
        if (blob === undefined) return null;
        return decryptBytes(blob, ctx.encryptionKey);
      }),

    deleteDocumentsForApplication: (applicationId) =>
      ctx.write((s) => {
        const memberIds = new Set(s.applicationMembers.filter((m) => m.applicationId === applicationId).map((m) => m.id));
        const doomed = new Set(s.documents.filter((d) => memberIds.has(d.memberId)).map((d) => d.id));
        s.documents = s.documents.filter((d) => !doomed.has(d.id));
        for (const id of doomed) delete s.documentBlobs[id];
        return doomed.size;
      }),

    purgeExpiredDocuments: (today) =>
      ctx.write((s) => {
        const expired = new Set(s.documents.filter((d) => d.deleteAfter <= today).map((d) => d.id));
        s.documents = s.documents.filter((d) => !expired.has(d.id));
        for (const id of expired) delete s.documentBlobs[id];
        return expired.size;
      }),
  };
}
