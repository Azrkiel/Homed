import { describe, expect, it } from 'vitest';
import { loadFixture } from '@homed/data';
import { createSupabaseAuth, createSupabaseRepository } from '../src/supabase/index';
import type { Repository } from '../src/repository';
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

// ---- auth ----
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const mailpit = process.env.SUPABASE_TEST_MAILPIT_URL?.replace(/\/$/, '');
const REDIRECT = 'http://127.0.0.1:3010/auth/callback';

describe('supabase auth: validation (no network)', () => {
  // A dead address: any network call would fail or hang, so a rejection proves none was made.
  const fakeRepo = {
    getUserByEmail: async () => null,
    createUser: async () => {
      throw new Error('createUser must not be called');
    },
  } as unknown as Repository;
  const auth = createSupabaseAuth({ url: 'http://127.0.0.1:1', anonKey: 'fake', redirectTo: REDIRECT, repo: fakeRepo });

  it('is supabase mode with completeSignIn', () => {
    expect(auth.mode).toBe('supabase');
    expect(typeof auth.completeSignIn).toBe('function');
  });

  it('rejects a student email outside virginia.edu', async () => {
    expect(await auth.startSignIn({ email: 'kid@gmail.com', role: 'student' })).toEqual({
      status: 'rejected',
      reason: 'Use your @virginia.edu email.',
    });
  });

  it('rejects an invalid landlord email', async () => {
    expect(await auth.startSignIn({ email: 'not-an-email', role: 'landlord' })).toEqual({
      status: 'rejected',
      reason: 'Enter a valid email address.',
    });
  });

  it('rejects an email registered under another role', async () => {
    const repo = {
      getUserByEmail: async () => ({ id: 'u1', email: 'x@virginia.edu', role: 'landlord', name: 'X' }),
    } as unknown as Repository;
    const a = createSupabaseAuth({ url: 'http://127.0.0.1:1', anonKey: 'fake', redirectTo: REDIRECT, repo });
    expect(await a.startSignIn({ email: ' X@Virginia.edu ', role: 'student' })).toEqual({
      status: 'rejected',
      reason: 'This email is registered as a landlord.',
    });
  });

  it('rejects an unknown code without a matching pending sign-in', async () => {
    const r = await auth.completeSignIn!({ code: 'nope' });
    expect(r.status).toBe('rejected');
  });
});

const liveAuth = enabled && anonKey ? describe : describe.skip;

liveAuth('supabase auth: live', { timeout: 60_000 }, () => {
  async function mailLink(to: string): Promise<string> {
    for (let i = 0; i < 40; i++) {
      const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
      const list = (await res.json()) as { messages?: { ID: string }[] };
      const id = list.messages?.[0]?.ID;
      if (id) {
        const msg = (await (await fetch(`${mailpit}/api/v1/message/${id}`)).json()) as { HTML?: string; Text?: string };
        const m = /href="([^"]*\/auth\/v1\/verify[^"]*)"/.exec(msg.HTML ?? '') ?? /(https?:\/\/\S*\/auth\/v1\/verify\S*)/.exec(msg.Text ?? '');
        if (m) return m[1]!.replace(/&amp;/g, '&');
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('magic-link email did not arrive');
  }

  async function codeFromLink(link: string): Promise<string> {
    const res = await fetch(link, { redirect: 'manual' });
    const loc = res.headers.get('location') ?? '';
    const code = new URL(loc).searchParams.get('code');
    if (!code) throw new Error(`no code in redirect: ${loc}`);
    return code;
  }

  it('startSignIn sends a link and completeSignIn creates the Homed user', async () => {
    if (!mailpit) return; // needs SUPABASE_TEST_MAILPIT_URL to read the email
    const repo = createSupabaseRepository({ url: url!, serviceRoleKey: serviceRoleKey!, encryptionKey: KEY, clock });
    const auth = createSupabaseAuth({ url: url!, anonKey: anonKey!, redirectTo: REDIRECT, repo });
    const stamp = Date.now();
    const a = `auth-a-${stamp}@virginia.edu`;
    const b = `auth-b-${stamp}@virginia.edu`;

    // Two concurrent pending sign-ins; the older one (A) is exchanged first, so its verifier is tried after B's and B's fails.
    expect(await auth.startSignIn({ email: a, name: 'Ann Auth', role: 'student' })).toEqual({ status: 'link_sent' });
    expect(await auth.startSignIn({ email: b.toUpperCase(), role: 'student' })).toEqual({ status: 'link_sent' });
    const codeA = await codeFromLink(await mailLink(a));
    const codeB = await codeFromLink(await mailLink(b));

    const ra = await auth.completeSignIn!({ code: codeA });
    expect(ra.status).toBe('signed_in');
    if (ra.status === 'signed_in') {
      expect(ra.user.name).toBe('Ann Auth');
      expect((await repo.getUserByEmail(a))?.id).toBe(ra.user.id);
    }
    const rb = await auth.completeSignIn!({ code: codeB });
    expect(rb.status).toBe('signed_in');
    if (rb.status === 'signed_in') {
      expect(rb.user.email).toBe(b);
      expect(rb.user.role).toBe('student');
      expect(rb.user.name).toBe(b.split('@')[0]);
    }
    // A used code cannot be replayed.
    expect((await auth.completeSignIn!({ code: codeA })).status).toBe('rejected');
  });
});
