// Supabase store. Phase 4 owns this folder.
import type { Repository, StoreClock } from '../repository';
import type { AuthProvider } from '../auth';
import { notImplemented } from '@homed/core';

export interface SupabaseStoreOptions {
  url: string;
  /** Server-side only. Never ship to a browser or the mobile app. */
  serviceRoleKey: string;
  /** 32-byte key, base64, for application-level encryption of sensitive fields and documents. */
  encryptionKey: string;
  clock?: StoreClock;
}

export function createSupabaseRepository(opts: SupabaseStoreOptions): Repository {
  return notImplemented('createSupabaseRepository');
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
