// Supabase store. Phase 4 owns this folder.
// Done: catalog, users, saves, groups, alerts, reviews, landlords, applications.
import type { Repository, StoreClock } from '../repository';
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
  /** Postgres schema holding Homed's tables (default 'public'). See packages/db/scripts/render-migrations.ts. */
  schema?: string;
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

export type { SupabaseAuthOptions } from './auth';
export { createSupabaseAuth } from './auth';
