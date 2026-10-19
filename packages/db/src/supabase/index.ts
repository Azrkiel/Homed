// Supabase store. Phase 4 owns this folder.
// Done: catalog, users, saves, groups, alerts, reviews, landlords, applications.
import type { Repository, StoreClock } from '../repository';
import type { AuthProvider } from '../auth';
import { notImplemented } from '@homed/core';
import { createCtx } from './client';
import { catalogRepo } from './catalog';
import { saveRepo } from './saves';
import { groupRepo } from './groups';
import { alertRepo } from './alerts';
import { reviewRepo } from './reviews';
import { landlordRepo } from './landlords';
import { userRepo } from './users';
import { applicationRepo } from './applications';

export interface SupabaseStoreOptions {
  url: string;
  /** Server-side only. Never ship to a browser or the mobile app. */
  serviceRoleKey: string;
  /** 32-byte key, base64, for application-level encryption of sensitive fields and documents. */
  encryptionKey: string;
  clock?: StoreClock;
}

export function createSupabaseRepository(opts: SupabaseStoreOptions): Repository {
  const ctx = createCtx(opts);
  return {
    backend: 'supabase',
    ...catalogRepo(ctx),
    ...userRepo(ctx),
    ...saveRepo(ctx),
    ...groupRepo(ctx),
    ...alertRepo(ctx),
    ...reviewRepo(ctx),
    ...landlordRepo(ctx),
    ...applicationRepo(ctx),
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
