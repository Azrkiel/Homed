// Supabase magic-link sign-in, stateless token-hash flow.
//
// startSignIn sends the email through signInWithOtp. The email templates (supabase/templates/*.html,
// and the same text in a hosted project's dashboard) link to
//   <redirectTo>?token_hash={{ .TokenHash }}&type=email
// and the web callback passes that hash to completeSignIn, which calls verifyOtp. Nothing is kept in
// server memory between the two requests, so links survive restarts and work on any instance.
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

const EXPIRED = 'Sign-in link expired or already used. Request a new one.';

export function createSupabaseAuth(opts: SupabaseAuthOptions): AuthProvider {
  const { url, anonKey, redirectTo, repo } = opts;

  // A fresh client per call: the server never keeps a Supabase session; Homed's own cookie is the session.
  const client = (): SupabaseClient =>
    createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
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
      const { error } = await client().auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true, data: { role, name: name?.trim() || undefined } },
      });
      if (error) return { status: 'rejected', reason: error.message };
      return { status: 'link_sent' };
    },

    async completeSignIn({ tokenHash }): Promise<SignInResult> {
      if (!tokenHash) return { status: 'rejected', reason: EXPIRED };
      const { data, error } = await client().auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      const authUser = data.user ?? data.session?.user;
      const email = authUser?.email?.trim().toLowerCase();
      if (error || !authUser || !email) return { status: 'rejected', reason: EXPIRED };

      const meta = authUser.user_metadata ?? {};
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
