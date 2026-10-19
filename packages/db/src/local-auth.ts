// Local (dev/demo) sign-in: no email is sent. CONTRACT (Phase 0, lead-owned).
import { isEmail, isStudentEmail } from '@homed/core';
import type { AuthProvider, SignInResult } from './auth';
import type { Repository } from './repository';

export function createLocalAuth(repo: Repository): AuthProvider {
  return {
    mode: 'local',
    async startSignIn({ email, name, role }): Promise<SignInResult> {
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
