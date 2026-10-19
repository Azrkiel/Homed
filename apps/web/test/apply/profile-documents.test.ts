import { describe, expect, it } from 'vitest';
import type { Application, ApplicationDocument, ApplicationMember } from '@homed/core';
import {
  groupDocumentsByApplication,
  loadApplicantDocuments,
  pickUploadMember,
  type ApplicationDocuments,
  type ProfileDocumentRepo,
} from '../../src/lib/apply/profile-documents';

const ME = 'u-me';
const OTHER = 'u-other';

function app(id: string, createdAt: string): Application {
  return {
    id,
    userId: ME,
    floorPlanId: 'fp-1',
    batchId: `b-${id}`,
    batchRank: 1,
    status: 'draft',
    statusHistory: [],
    fees: {} as Application['fees'],
    createdAt,
  };
}

function member(id: string, applicationId: string, userId?: string): ApplicationMember {
  return {
    id,
    applicationId,
    kind: 'leader',
    userId,
    email: `${id}@virginia.edu`,
    inviteToken: `tok-${id}`,
    inviteStatus: 'accepted',
    done: false,
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

function doc(id: string, memberId: string, createdAt: string): ApplicationDocument {
  return {
    id,
    memberId,
    filename: `${id}.pdf`,
    mime: 'application/pdf',
    storageKey: `k-${id}`,
    deleteAfter: '2027-01-01',
    createdAt,
  };
}

describe('pickUploadMember', () => {
  it('uses the user row on the newest application that has one', () => {
    const apps = [app('old', '2026-09-01T00:00:00.000Z'), app('new', '2026-10-05T00:00:00.000Z')];
    const byApp = new Map([
      ['old', [member('m-old', 'old', ME)]],
      ['new', [member('m-new', 'new', ME)]],
    ]);
    expect(pickUploadMember(apps, byApp, ME)?.id).toBe('m-new');
  });

  it('skips a newer application where the user has no row', () => {
    const apps = [app('old', '2026-09-01T00:00:00.000Z'), app('new', '2026-10-05T00:00:00.000Z')];
    const byApp = new Map([
      ['old', [member('m-old', 'old', ME)]],
      ['new', [member('m-other', 'new', OTHER)]],
    ]);
    expect(pickUploadMember(apps, byApp, ME)?.id).toBe('m-old');
  });

  it('is undefined with no application rows for the user', () => {
    const apps = [app('a', '2026-09-01T00:00:00.000Z')];
    expect(pickUploadMember(apps, new Map([['a', [member('m', 'a', OTHER)]]]), ME)).toBeUndefined();
    expect(pickUploadMember([], new Map(), ME)).toBeUndefined();
  });
});

describe('groupDocumentsByApplication', () => {
  it('drops empty groups and orders apps and documents newest first', () => {
    const older: ApplicationDocuments = {
      application: app('old', '2026-09-01T00:00:00.000Z'),
      member: member('m-old', 'old', ME),
      documents: [doc('d1', 'm-old', '2026-09-02T00:00:00.000Z'), doc('d2', 'm-old', '2026-09-03T00:00:00.000Z')],
    };
    const empty: ApplicationDocuments = {
      application: app('mid', '2026-09-15T00:00:00.000Z'),
      member: member('m-mid', 'mid', ME),
      documents: [],
    };
    const newer: ApplicationDocuments = {
      application: app('new', '2026-10-05T00:00:00.000Z'),
      member: member('m-new', 'new', ME),
      documents: [doc('d3', 'm-new', '2026-10-06T00:00:00.000Z')],
    };
    const out = groupDocumentsByApplication([older, empty, newer]);
    expect(out.map((g) => g.application.id)).toEqual(['new', 'old']);
    expect(out[1]?.documents.map((d) => d.id)).toEqual(['d2', 'd1']);
  });
});

describe('loadApplicantDocuments', () => {
  it('collects documents from the user member rows only and picks the upload row', async () => {
    const apps = [app('a1', '2026-09-01T00:00:00.000Z'), app('a2', '2026-10-05T00:00:00.000Z')];
    const members: Record<string, ApplicationMember[]> = {
      a1: [member('m-a1', 'a1', ME), member('m-friend', 'a1', OTHER)],
      a2: [member('m-a2', 'a2', ME), member('m-g', 'a2')],
    };
    const docsByMember: Record<string, ApplicationDocument[]> = {
      'm-a1': [doc('d1', 'm-a1', '2026-09-02T00:00:00.000Z')],
      'm-a2': [],
      'm-friend': [doc('dx', 'm-friend', '2026-09-02T00:00:00.000Z')],
    };
    const repo: ProfileDocumentRepo = {
      listApplicationsForUser: async () => apps,
      listApplicationMembers: async (id) => members[id] ?? [],
      listDocuments: async (memberId) => docsByMember[memberId] ?? [],
    };
    const out = await loadApplicantDocuments(repo, ME);
    expect(out.uploadMember?.id).toBe('m-a2');
    expect(out.groups.map((g) => g.member.id)).toEqual(['m-a1']);
    expect(out.groups[0]?.documents.map((d) => d.id)).toEqual(['d1']);
  });

  it('has no upload row when the user has no applications', async () => {
    const repo: ProfileDocumentRepo = {
      listApplicationsForUser: async () => [],
      listApplicationMembers: async () => [],
      listDocuments: async () => [],
    };
    expect(await loadApplicantDocuments(repo, ME)).toEqual({ uploadMember: undefined, groups: [] });
  });
});
