// Supabase magic-link sign-in. Phase 4.
//
// PKCE across two requests: startSignIn runs signInWithOtp on a throwaway anon client with a
// Map-backed `storage`; after it returns, the PKCE code verifier the library stored is copied into
// a process-wide pending list (per auth instance). The emailed link ends at the web callback with
// only `?code=...`, so completeSignIn tries each pending verifier (newest first) with
// exchangeCodeForSession; GoTrue rejects a wrong verifier without consuming the code, so the
// matching one succeeds and is removed.
// LIMITATION: the pending verifiers live in this server process's memory. A restart, or a link
// opened against a different instance, fails with "Sign-in link expired. Request a new one."
// Pending entries expire after 1 hour (GoTrue's default OTP lifetime) and are capped at 500.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isEmail, isStudentEmail } from '@homed/core';
import type { AuthProvider, SignInResult } from '../auth';
import type { Repository } from '../repository';

export interface SupabaseAuthOptions {
  url: string;
  anonKey: string;
  /** Absolute URL of the web app's magic-link callback, e.g. https://homed.app/auth/callback. */
  redirectTo: string;
  repo: Repository;
}

const PENDING_TTL_MS = 60 * 60 * 1000;
const PENDING_MAX = 500;
const EXPIRED = 'Sign-in link expired. Request a new one.';

interface Pending {
  entries: [string, string][];
  expires: number;
}

function memoryStorage(initial: [string, string][] = []) {
  const map = new Map<string, string>(initial);
  return {
    map,
    storage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  };
}

export function createSupabaseAuth(opts: SupabaseAuthOptions): AuthProvider {
  const { url, anonKey, redirectTo, repo } = opts;
  const pending: Pending[] = [];

  const client = (storage: ReturnType<typeof memoryStorage>['storage']): SupabaseClient =>
    createClient(url, anonKey, {
      // persistSession must be true or supabase-js ignores `storage` and keeps the verifier in the client's
      // own memory. The session this writes goes to a throwaway Map and is never used.
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce', storage },
    });

  return {
    mode: 'supabase',

    async startSignIn({ email, name, role }): Promise<SignInResult> {
      const clean = email.trim().toLowerCase();
      if (role === 'student' && !isStudentEmail(clean)) {
        return { status: 'rejected', reason: 'Use your @virginia.edu email.' };
      }
      if (role === 'landlord' && !isEmail(clean)) {
        return { status: 'rejected', reason: 'Enter a valid email address.' };
      }
      const existing = await repo.getUserByEmail(clean);
      if (existing && existing.role !== role && existing.role !== 'admin') {
        return { status: 'rejected', reason: `This email is registered as a ${existing.role}.` };
      }
      const mem = memoryStorage();
      const { error } = await client(mem.storage).auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true, data: { role, name: name?.trim() || undefined } },
      });
      if (error) return { status: 'rejected', reason: error.message };
      const now = Date.now();
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.expires <= now) pending.splice(i, 1);
      pending.push({ entries: [...mem.map.entries()], expires: now + PENDING_TTL_MS });
      if (pending.length > PENDING_MAX) pending.splice(0, pending.length - PENDING_MAX);
      return { status: 'link_sent' };
    },

    async completeSignIn({ code }): Promise<SignInResult> {
      if (!code) return { status: 'rejected', reason: EXPIRED };
      const now = Date.now();
      let session: { user: { email?: string; user_metadata?: Record<string, unknown> } } | null = null;
      let lastError = EXPIRED;
      for (let i = pending.length - 1; i >= 0 && !session; i--) {
        const p = pending[i]!;
        if (p.expires <= now) continue;
        const { data, error } = await client(memoryStorage(p.entries).storage).auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          session = data.session;
          pending.splice(i, 1);
        } else if (error && !/verifier|invalid|not found|expired/i.test(error.message)) {
          lastError = error.message;
        }
      }
      const email = session?.user.email?.trim().toLowerCase();
      if (!session || !email) return { status: 'rejected', reason: lastError };

      const meta = session.user.user_metadata ?? {};
      const role = meta.role === 'landlord' ? 'landlord' : 'student';
      if (role === 'student' && !isStudentEmail(email)) {
        return { status: 'rejected', reason: 'Use your @virginia.edu email.' };
      }
      const existing = await repo.getUserByEmail(email);
      if (existing) return { status: 'signed_in', user: existing };
      const metaName = typeof meta.name === 'string' ? meta.name.trim() : '';
      const user = await repo.createUser({ email, name: metaName || email.split('@')[0]!, role });
      return { status: 'signed_in', user };
    },
  };
}
