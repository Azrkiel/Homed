// Local (dev/demo) sign-in: no email is sent. CONTRACT (Phase 0, lead-owned).
import { isEmail, isStudentEmail } from '@homed/core';
import type { AuthProvider, SignInResult } from './auth';
import type { Repository } from './repository';

/**
 * Demo sign-in proves nothing about who you are, so it's off in production builds unless the operator
 * opts in with HOMED_ALLOW_DEMO_SIGNIN=1 (demos, smoke and e2e runs against `next start`).
 */
export function demoSignInAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.HOMED_ALLOW_DEMO_SIGNIN === '1';
}

export function createLocalAuth(repo: Repository, opts: { enabled?: boolean } = {}): AuthProvider {
  const enabled = opts.enabled ?? true;
  return {
    mode: 'local',
    async startSignIn({ email, name, role }): Promise<SignInResult> {
      if (!enabled) {
        return {
          status: 'rejected',
          reason: 'Demo sign-in is turned off on this server. Set up Supabase sign-in, or set HOMED_ALLOW_DEMO_SIGNIN=1 for a demo.',
        };
      }
      const clean = email.trim().toLowerCase();
      if (role === 'student' && !isStudentEmail(clean)) {
        return { status: 'rejected', reason: 'Use your @virginia.edu email.' };
      }
      if (role === 'landlord' && !isEmail(clean)) {
        return { status: 'rejected', reason: 'Enter a valid email address.' };
      }
      const existing = await repo.getUserByEmail(clean);
      if (existing) {
        if (existing.role !== role && existing.role !== 'admin') {
          return { status: 'rejected', reason: `This email is registered as a ${existing.role}.` };
        }
        return { status: 'signed_in', user: existing };
      }
      const user = await repo.createUser({ email: clean, name: name?.trim() || clean.split('@')[0]!, role });
      return { status: 'signed_in', user };
    },
  };
}
