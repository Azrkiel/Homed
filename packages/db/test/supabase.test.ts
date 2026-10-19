import { describe } from 'vitest';
import { loadFixture } from '@homed/data';
import { createSupabaseRepository } from '../src/supabase/index';
import { createCtx } from '../src/supabase/client';
import { loadCatalog, resetDatabase } from '../src/supabase/seed';
import { runRepositoryConformance } from './conformance/index';

const url = process.env.SUPABASE_TEST_URL;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
const enabled = Boolean(url && serviceRoleKey);

const KEY = Buffer.alloc(32, 7).toString('base64');
const clock = { now: () => new Date('2026-10-19T12:00:00.000Z') };

/** Fresh database with the fixture catalog and no user data, for every test. */
async function makeRepo() {
  if (!url || !serviceRoleKey) throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY are required');
  const { sb } = createCtx({ url, serviceRoleKey, encryptionKey: KEY, clock });
  await resetDatabase(sb);
  await loadCatalog(sb, loadFixture());
  return createSupabaseRepository({ url, serviceRoleKey, encryptionKey: KEY, clock });
}

// Skipped (not failed, no network) unless both env vars are set. Tests in one file run serially.
const suite = enabled ? describe : describe.skip;

suite('supabase store', { timeout: 60_000 }, () => {
  runRepositoryConformance('supabase', makeRepo);
});
