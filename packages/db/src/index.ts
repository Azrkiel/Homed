// @homed/db public API. CONTRACT (Phase 0).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { Repository } from './repository';
import { createJsonRepository } from './json/index';
import { createSupabaseRepository } from './supabase/index';

export * from './repository';
export * from './auth';
export { createLocalAuth, demoSignInAllowed } from './local-auth';
export * from './crypto';
export { createJsonRepository, type JsonStoreOptions } from './json/index';
export { createSupabaseRepository, createSupabaseAuth, type SupabaseStoreOptions, type SupabaseAuthOptions } from './supabase/index';

export type Env = Record<string, string | undefined>;

/** Directory for the local JSON database and its dev encryption key. */
export function dataDir(env: Env = process.env): string {
  return env.HOMED_DATA_DIR ?? join(process.cwd(), '.data');
}

/**
 * HOMED_ENCRYPTION_KEY when set. Otherwise, in json mode only, a dev key generated once and kept in
 * <dataDir>/encryption.key so local data stays readable across restarts.
 */
export function encryptionKeyFromEnv(env: Env = process.env): string {
  if (env.HOMED_ENCRYPTION_KEY) return env.HOMED_ENCRYPTION_KEY;
  if (env.HOMED_BACKEND === 'supabase') {
    throw new Error('HOMED_ENCRYPTION_KEY is required when HOMED_BACKEND=supabase');
  }
  const keyPath = join(dataDir(env), 'encryption.key');
  if (existsSync(keyPath)) return readFileSync(keyPath, 'utf8').trim();
  mkdirSync(dirname(keyPath), { recursive: true });
  const key = randomBytes(32).toString('base64');
  writeFileSync(keyPath, key + '\n', { mode: 0o600 });
  return key;
}

/** HOMED_BACKEND=supabase (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), else the JSON store in dataDir(). */
export function repositoryFromEnv(env: Env = process.env): Repository {
  const encryptionKey = encryptionKeyFromEnv(env);
  if (env.HOMED_BACKEND === 'supabase') {
    const url = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
      throw new Error('HOMED_BACKEND=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    return createSupabaseRepository({ url, serviceRoleKey, encryptionKey });
  }
  return createJsonRepository({ filePath: join(dataDir(env), 'homed-db.json'), encryptionKey });
}
