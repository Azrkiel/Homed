// ApplicationRepo on Supabase. Mirrors packages/db/src/json/applications.ts.
//
// Encryption: ApplicantProfile.sensitive -> applicant_profiles.sensitive_ciphertext (encryptJson),
// document bytes -> application_documents.ciphertext (encryptBytes). Plaintext never reaches the DB.
//
// Known divergences from the JSON store:
// - The JSON store orders "newest first" by createdAt with later insertions winning ties (the tests use a
//   fixed clock). The schema has no insertion sequence, so a new batch's createdAt is kept strictly after
//   the newest existing application (newest + 1 ms when the clock has not moved past it). Reads order by
//   created_at desc, then batch_rank desc (within a batch the JSON store lists later ranks first), then id.
// - Status moves are guarded with `eq('status', <status read>)`, so two concurrent moves cannot both apply;
//   the loser is re-evaluated and gets 'invalid'.
// - createApplicationBatch is not transactional: if inserting members fails, the new applications are
//   deleted again (members cascade).
import { randomBytes } from 'node:crypto';
import {
  canTransition,
  isEmail,
  MAX_BATCH_SIZE,
  transitionActor,
  type ApplicantSensitive,
  type ApplicationStatus,
} from '@homed/core';
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from '../crypto';
import { RepoError, type ApplicationRepo, type NewApplicationBatch, type StoredDocumentInput } from '../repository';
import { chunks, IN_CHUNK, selectAll, unwrap, unwrapOne, WRITE_CHUNK, type SupabaseCtx } from './client';
import {
  applicantProfileFromRow,
  applicantProfileToRow,
  applicationDocumentFromRow,
  applicationFromRow,
  applicationMemberFromRow,
  applicationMemberToRow,
  applicationToRow,
  isoTs,
  type ApplicantProfileRow,
  type ApplicationDocumentRow,
  type ApplicationMemberRow,
  type ApplicationRow,
} from './mappers';

const DECIDED: ApplicationStatus[] = ['approved', 'waitlisted', 'denied'];
/** Document columns without the ciphertext. */
const DOC_META = 'id,member_id,filename,mime,storage_key,delete_after,created_at';

/** 192 bits of randomness, base64url. */
function token(): string {
  return randomBytes(24).toString('base64url');
}

export function applicationRepo(ctx: SupabaseCtx): ApplicationRepo {
  const { sb } = ctx;

  const userExists = async (id: string): Promise<boolean> =>
    unwrap(await sb.from('users').select('id').eq('id', id).maybeSingle()) !== null;

  const getAppRow = async (id: string): Promise<ApplicationRow | null> =>
    unwrap(await sb.from('applications').select('*').eq('id', id).maybeSingle()) as ApplicationRow | null;

  /** The landlord may act on the property if they own its Landlord record, or are an admin. */
  const landlordMayActOn = async (byUserId: string, floorPlanId: string): Promise<boolean> => {
    const user = unwrap(await sb.from('users').select('role').eq('id', byUserId).maybeSingle()) as
      | { role: string }
      | null;
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'landlord') return false;
    const fp = unwrap(await sb.from('floor_plans').select('property_id').eq('id', floorPlanId).maybeSingle()) as
      | { property_id: string }
      | null;
    if (!fp) return false;
    const prop = unwrap(await sb.from('properties').select('landlord_id').eq('id', fp.property_id).maybeSingle()) as
      | { landlord_id: string | null }
      | null;
    if (!prop || !prop.landlord_id) return false;
    const ll = unwrap(await sb.from('landlords').select('id').eq('user_id', byUserId).maybeSingle()) as
      | { id: string }
      | null;
    return Boolean(ll && ll.id === prop.landlord_id);
  };

  const appsByIds = async (ids: string[]): Promise<ApplicationRow[]> => {
    const out: ApplicationRow[] = [];
    for (const part of chunks(ids, IN_CHUNK)) {
      const rows = unwrap(await sb.from('applications').select('*').in('id', part)) as ApplicationRow[] | null;
      out.push(...(rows ?? []));
    }
    return out;
  };

  /** Newest first; later insertions (higher rank within a batch) win ties. */
  const sortNewest = (rows: ApplicationRow[]): ApplicationRow[] =>
    [...rows].sort((a, b) => {
      const ta = Date.parse(isoTs(a.created_at));
      const tb = Date.parse(isoTs(b.created_at));
      if (ta !== tb) return tb - ta;
      if (a.batch_rank !== b.batch_rank) return b.batch_rank - a.batch_rank;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  return {
    getApplicantProfile: async (userId) => {
      const row = unwrap(
        await sb.from('applicant_profiles').select('*').eq('user_id', userId).maybeSingle(),
      ) as ApplicantProfileRow | null;
      if (!row) return null;
      return applicantProfileFromRow(row, decryptJson<ApplicantSensitive>(row.sensitive_ciphertext, ctx.encryptionKey));
    },

    saveApplicantProfile: async (profile) => {
      if (!(await userExists(profile.userId))) throw new RepoError('not_found', 'user not found');
      const copy = structuredClone(profile);
      const { sensitive, ...rest } = copy;
      const ciphertext = encryptJson(sensitive, ctx.encryptionKey);
      const row = applicantProfileToRow(rest, ciphertext, ctx.now());
      const saved = unwrapOne(
        await sb.from('applicant_profiles').upsert(row, { onConflict: 'user_id' }).select('*').single(),
        { fk: { code: 'not_found', message: 'user not found' } },
      ) as ApplicantProfileRow;
      return applicantProfileFromRow(saved, sensitive);
    },

    createApplicationBatch: async (input: NewApplicationBatch) => {
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

      const leader = unwrap(
        await sb.from('users').select('id,email,name').eq('id', input.leaderId).maybeSingle(),
      ) as { id: string; email: string; name: string } | null;
      if (!leader) throw new RepoError('not_found', 'user not found');
      if (cleanInvitees.some((inv) => inv.email === leader.email)) {
        throw new RepoError('invalid', 'the leader cannot be invited');
      }
      const fpRows = (unwrap(await sb.from('floor_plans').select('id').in('id', floorPlanIds)) ?? []) as { id: string }[];
      for (const fpId of floorPlanIds) {
        if (!fpRows.some((f) => f.id === fpId)) throw new RepoError('not_found', `floor plan ${fpId} not found`);
      }
      if (input.groupId !== undefined) {
        const group = unwrap(await sb.from('groups').select('id').eq('id', input.groupId).maybeSingle());
        if (!group) throw new RepoError('not_found', 'group not found');
        const gm = unwrap(
          await sb
            .from('group_members')
            .select('user_id')
            .eq('group_id', input.groupId)
            .eq('user_id', input.leaderId)
            .maybeSingle(),
        );
        if (!gm) throw new RepoError('forbidden', 'leader is not a member of this group');
      }

      // Existing accounts for invitee emails.
      const userByEmail = new Map<string, string>();
      if (emails.length > 0) {
        const found = (unwrap(await sb.from('users').select('id,email').in('email', emails)) ?? []) as {
          id: string;
          email: string;
        }[];
        for (const u of found) userByEmail.set(u.email, u.id);
      }

      // Validate guarantor targets before writing anything.
      for (const inv of cleanInvitees) {
        if (inv.kind !== 'guarantor' || inv.guarantorForEmail === undefined) continue;
        const target = inv.guarantorForEmail.trim().toLowerCase();
        const ok = target === leader.email || cleanInvitees.some((m) => m.kind !== 'guarantor' && m.email === target);
        if (!ok) {
          throw new RepoError('invalid', `guarantorForEmail ${inv.guarantorForEmail} is not a member of this application`);
        }
      }

      // createdAt strictly after the newest existing application (see header).
      const newest = unwrap(
        await sb.from('applications').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ) as { created_at: string } | null;
      const now = ctx.now();
      const newestMs = newest ? Date.parse(isoTs(newest.created_at)) : Number.NEGATIVE_INFINITY;
      const createdAt = newestMs >= Date.parse(now) ? new Date(newestMs + 1).toISOString() : now;
      const batchId = crypto.randomUUID();

      const appRows: ApplicationRow[] = [];
      const memberRows: ApplicationMemberRow[] = [];
      floorPlanIds.forEach((floorPlanId, i) => {
        const applicationId = crypto.randomUUID();
        const appMembers: ApplicationMemberRow[] = [
          applicationMemberToRow({
            id: crypto.randomUUID(),
            applicationId,
            kind: 'leader',
            userId: leader.id,
            email: leader.email,
            name: leader.name,
            inviteToken: token(),
            inviteStatus: 'accepted',
            done: false,
            updatedAt: now,
          }),
        ];
        for (const inv of cleanInvitees) {
          const row = applicationMemberToRow({
            id: crypto.randomUUID(),
            applicationId,
            kind: inv.kind,
            email: inv.email,
            inviteToken: token(),
            inviteStatus: 'pending',
            done: false,
            updatedAt: now,
          });
          if (inv.name !== undefined) row.name = inv.name;
          const uid = userByEmail.get(inv.email);
          if (uid !== undefined) row.user_id = uid;
          appMembers.push(row);
        }
        // Guarantors point at the roommate or leader they guarantee, matched by email on this application.
        for (const inv of cleanInvitees) {
          if (inv.kind !== 'guarantor' || inv.guarantorForEmail === undefined) continue;
          const target = inv.guarantorForEmail.trim().toLowerCase();
          const guaranteed = appMembers.find((m) => m.kind !== 'guarantor' && m.email === target);
          const guarantor = appMembers.find((m) => m.kind === 'guarantor' && m.email === inv.email);
          if (guaranteed && guarantor) guarantor.guarantor_for = guaranteed.id;
        }
        appRows.push(
          applicationToRow({
            id: applicationId,
            userId: leader.id,
            ...(input.groupId !== undefined ? { groupId: input.groupId } : {}),
            floorPlanId,
            batchId,
            batchRank: i + 1,
            status: 'draft',
            statusHistory: [{ status: 'draft', at: now, by: leader.id }],
            fees: structuredClone(fees[i]!),
            createdAt,
          }),
        );
        memberRows.push(...appMembers);
      });

      const saved = unwrap(await sb.from('applications').insert(appRows).select('*')) as ApplicationRow[] | null;
      try {
        for (const part of chunks(memberRows, WRITE_CHUNK)) {
          unwrap(await sb.from('application_members').insert(part));
        }
      } catch (e) {
        await sb.from('applications').delete().eq('batch_id', batchId);
        throw e;
      }
      return (saved ?? []).sort((a, b) => a.batch_rank - b.batch_rank).map(applicationFromRow);
    },

    getApplication: async (id) => {
      const row = await getAppRow(id);
      return row ? applicationFromRow(row) : null;
    },

    listBatch: async (batchId) => {
      const rows = unwrap(
        await sb.from('applications').select('*').eq('batch_id', batchId).order('batch_rank', { ascending: true }),
      ) as ApplicationRow[] | null;
      return (rows ?? []).map(applicationFromRow);
    },

    listApplicationsForUser: async (userId) => {
      const led = (unwrap(await sb.from('applications').select('id').eq('user_id', userId)) ?? []) as { id: string }[];
      const member = (unwrap(await sb.from('application_members').select('application_id').eq('user_id', userId)) ??
        []) as { application_id: string }[];
      const ids = [...new Set([...led.map((r) => r.id), ...member.map((r) => r.application_id)])];
      return sortNewest(await appsByIds(ids)).map(applicationFromRow);
    },

    listApplicationsForLandlord: async (landlordId) => {
      const props = (unwrap(await sb.from('properties').select('id').eq('landlord_id', landlordId)) ?? []) as {
        id: string;
      }[];
      const fpIds: string[] = [];
      for (const part of chunks(props.map((p) => p.id), IN_CHUNK)) {
        const fps = (unwrap(await sb.from('floor_plans').select('id').in('property_id', part)) ?? []) as {
          id: string;
        }[];
        fpIds.push(...fps.map((f) => f.id));
      }
      const rows: ApplicationRow[] = [];
      for (const part of chunks(fpIds, IN_CHUNK)) {
        const got = await selectAll<ApplicationRow>((f, t) =>
          sb.from('applications').select('*').in('floor_plan_id', part).neq('status', 'draft').order('id').range(f, t),
        );
        rows.push(...got);
      }
      return sortNewest(rows).map(applicationFromRow);
    },

    updateApplicationStatus: async (applicationId, to, byUserId) => {
      const app = await getAppRow(applicationId);
      if (!app) throw new RepoError('not_found', 'application not found');
      if (!canTransition(app.status, to)) {
        throw new RepoError('invalid', `cannot move application from ${app.status} to ${to}`);
      }
      const actor = transitionActor(app.status, to);
      if (actor === 'applicant') {
        if (byUserId !== app.user_id) throw new RepoError('forbidden', 'only the applicant may make this move');
      } else if (!(await landlordMayActOn(byUserId, app.floor_plan_id))) {
        throw new RepoError('forbidden', 'only the property landlord or an admin may make this move');
      }
      const now = ctx.now();
      const patch: Partial<ApplicationRow> = {
        status: to,
        status_history: [...app.status_history, { status: to, at: now, by: byUserId }],
      };
      if (to === 'submitted') patch.submitted_at = now;
      if (DECIDED.includes(to)) patch.decided_at = now;
      const updated = unwrap(
        await sb
          .from('applications')
          .update(patch)
          .eq('id', applicationId)
          .eq('status', app.status)
          .select('*')
          .maybeSingle(),
      ) as ApplicationRow | null;
      if (!updated) {
        const cur = await getAppRow(applicationId);
        if (!cur) throw new RepoError('not_found', 'application not found');
        throw new RepoError('invalid', `cannot move application from ${cur.status} to ${to}`);
      }
      return applicationFromRow(updated);
    },

    listApplicationMembers: async (applicationId) => {
      const rows = await selectAll<ApplicationMemberRow>((f, t) =>
        sb
          .from('application_members')
          .select('*')
          .eq('application_id', applicationId)
          .order('id', { ascending: true })
          .range(f, t),
      );
      // JSON order is creation order: leader, then invitees as given. Invitee order is not recoverable
      // from the schema, so members sort leader, roommates, guarantors (then email) for a stable order.
      const rank = { leader: 0, roommate: 1, guarantor: 2 } as const;
      return rows
        .sort((a, b) => rank[a.kind] - rank[b.kind] || (a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
        .map(applicationMemberFromRow);
    },

    getMemberByInviteToken: async (tok) => {
      if (!tok) return null;
      const row = unwrap(
        await sb.from('application_members').select('*').eq('invite_token', tok).maybeSingle(),
      ) as ApplicationMemberRow | null;
      return row ? applicationMemberFromRow(row) : null;
    },

    updateApplicationMember: async (memberId, patch) => {
      const fields: Partial<ApplicationMemberRow> = { updated_at: ctx.now() };
      if (patch.userId !== undefined) fields.user_id = patch.userId;
      if (patch.name !== undefined) fields.name = patch.name;
      if (patch.inviteStatus !== undefined) fields.invite_status = patch.inviteStatus;
      if (patch.done !== undefined) fields.done = patch.done;
      const row = unwrap(
        await sb.from('application_members').update(fields).eq('id', memberId).select('*').maybeSingle(),
      ) as ApplicationMemberRow | null;
      if (!row) throw new RepoError('not_found', 'application member not found');
      return applicationMemberFromRow(row);
    },

    putDocument: async (input: StoredDocumentInput) => {
      const filename = input.filename.trim();
      if (!filename) throw new RepoError('invalid', 'filename required');
      const member = unwrap(await sb.from('application_members').select('id').eq('id', input.memberId).maybeSingle());
      if (!member) throw new RepoError('not_found', 'application member not found');
      const row = {
        id: crypto.randomUUID(),
        member_id: input.memberId,
        filename,
        mime: input.mime,
        storage_key: token(),
        delete_after: input.deleteAfter,
        ciphertext: encryptBytes(input.bytes, ctx.encryptionKey),
        created_at: ctx.now(),
      };
      const saved = unwrapOne(await sb.from('application_documents').insert(row).select(DOC_META).single(), {
        fk: { code: 'not_found', message: 'application member not found' },
      }) as unknown as ApplicationDocumentRow;
      return applicationDocumentFromRow(saved);
    },

    listDocuments: async (memberId) => {
      const rows = await selectAll<ApplicationDocumentRow>(
        (f, t) =>
          sb
            .from('application_documents')
            .select(DOC_META)
            .eq('member_id', memberId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true })
            .range(f, t) as unknown as PromiseLike<{
            data: ApplicationDocumentRow[] | null;
            error: { message: string } | null;
          }>,
      );
      return rows.map(applicationDocumentFromRow);
    },

    getDocumentBytes: async (documentId) => {
      const row = unwrap(
        await sb.from('application_documents').select('ciphertext').eq('id', documentId).maybeSingle(),
      ) as { ciphertext: string } | null;
      return row ? decryptBytes(row.ciphertext, ctx.encryptionKey) : null;
    },

    purgeExpiredDocuments: async (today) => {
      const gone = unwrap(await sb.from('application_documents').delete().lte('delete_after', today).select('id')) as
        | { id: string }[]
        | null;
      return (gone ?? []).length;
    },
  };
}
