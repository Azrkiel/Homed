// Supabase store. Phase 4 owns this folder.
// Done: catalog, users, saves (client.ts, mappers.ts, seed.ts, catalog.ts, users.ts, saves.ts).
// PLACEHOLDER: groups, alerts, reviews, landlords, applications. Each stub throws 'not implemented: <method>'
// until its owning engineer replaces the stub with a real implementation.
import type { Repository, StoreClock } from '../repository';
import type { AuthProvider } from '../auth';
import { notImplemented } from '@homed/core';
import { createCtx } from './client';
import { catalogRepo } from './catalog';
import { saveRepo } from './saves';
import { userRepo } from './users';

export interface SupabaseStoreOptions {
  url: string;
  /** Server-side only. Never ship to a browser or the mobile app. */
  serviceRoleKey: string;
  /** 32-byte key, base64, for application-level encryption of sensitive fields and documents. */
  encryptionKey: string;
  clock?: StoreClock;
}

/** PLACEHOLDER stub: an async method that rejects with 'not implemented: <name>'. */
function stub(name: string): () => Promise<never> {
  return async () => {
    throw new Error(`not implemented: ${name}`);
  };
}

// PLACEHOLDER: groups area (replace with groupRepo(ctx) from ./groups).
const groupStubs = {
  createGroup: stub('createGroup'),
  getGroup: stub('getGroup'),
  getGroupByInviteCode: stub('getGroupByInviteCode'),
  listGroupsForUser: stub('listGroupsForUser'),
  listMembers: stub('listMembers'),
  joinGroup: stub('joinGroup'),
  leaveGroup: stub('leaveGroup'),
  updateMember: stub('updateMember'),
  listShortlist: stub('listShortlist'),
  addToShortlist: stub('addToShortlist'),
  removeFromShortlist: stub('removeFromShortlist'),
  castVote: stub('castVote'),
  listVotes: stub('listVotes'),
};

// PLACEHOLDER: alerts area (replace with alertRepo(ctx) from ./alerts).
const alertStubs = {
  listAlerts: stub('listAlerts'),
  listAllAlerts: stub('listAllAlerts'),
  createAlert: stub('createAlert'),
  deleteAlert: stub('deleteAlert'),
  addAlertEvents: stub('addAlertEvents'),
  listAlertEvents: stub('listAlertEvents'),
  markAlertEventsRead: stub('markAlertEventsRead'),
};

// PLACEHOLDER: reviews area (replace with reviewRepo(ctx) from ./reviews).
const reviewStubs = {
  listReviews: stub('listReviews'),
  createReview: stub('createReview'),
  listPendingReviews: stub('listPendingReviews'),
  moderateReview: stub('moderateReview'),
  replyToReview: stub('replyToReview'),
};

// PLACEHOLDER: landlords area (replace with landlordRepo(ctx) from ./landlords).
const landlordStubs = {
  getLandlord: stub('getLandlord'),
  getLandlordByUser: stub('getLandlordByUser'),
  listLandlords: stub('listLandlords'),
  createLandlord: stub('createLandlord'),
  upsertProperty: stub('upsertProperty'),
  upsertFloorPlan: stub('upsertFloorPlan'),
  deleteFloorPlan: stub('deleteFloorPlan'),
  upsertPhoto: stub('upsertPhoto'),
  deletePhoto: stub('deletePhoto'),
  upsertAccessibility: stub('upsertAccessibility'),
  confirmAvailability: stub('confirmAvailability'),
};

// PLACEHOLDER: applications area (replace with applicationRepo(ctx) from ./applications).
const applicationStubs = {
  getApplicantProfile: stub('getApplicantProfile'),
  saveApplicantProfile: stub('saveApplicantProfile'),
  createApplicationBatch: stub('createApplicationBatch'),
  getApplication: stub('getApplication'),
  listBatch: stub('listBatch'),
  listApplicationsForUser: stub('listApplicationsForUser'),
  listApplicationsForLandlord: stub('listApplicationsForLandlord'),
  updateApplicationStatus: stub('updateApplicationStatus'),
  listApplicationMembers: stub('listApplicationMembers'),
  getMemberByInviteToken: stub('getMemberByInviteToken'),
  updateApplicationMember: stub('updateApplicationMember'),
  putDocument: stub('putDocument'),
  listDocuments: stub('listDocuments'),
  getDocumentBytes: stub('getDocumentBytes'),
  purgeExpiredDocuments: stub('purgeExpiredDocuments'),
};

export function createSupabaseRepository(opts: SupabaseStoreOptions): Repository {
  const ctx = createCtx(opts);
  return {
    backend: 'supabase',
    ...catalogRepo(ctx),
    ...userRepo(ctx),
    ...saveRepo(ctx),
    ...groupStubs,
    ...alertStubs,
    ...reviewStubs,
    ...landlordStubs,
    ...applicationStubs,
  };
}

export interface SupabaseAuthOptions {
  url: string;
  anonKey: string;
  /** Absolute URL of the web app's magic-link callback, e.g. https://homed.app/auth/callback. */
  redirectTo: string;
  repo: Repository;
}

export function createSupabaseAuth(opts: SupabaseAuthOptions): AuthProvider {
  return notImplemented('createSupabaseAuth');
}
