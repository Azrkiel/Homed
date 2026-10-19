// Sign-in contract. CONTRACT (Phase 0).
import type { User } from '@homed/core';

export type SignInResult =
  | { status: 'signed_in'; user: User }
  | { status: 'link_sent' }
  | { status: 'rejected'; reason: string };

export interface AuthProvider {
  readonly mode: 'local' | 'supabase';
  /**
   * Students must use an @virginia.edu address; landlords may use any address.
   * local: no email is sent. The user is found or created and signed in at once (dev and demo only).
   * supabase: sends a magic link to <redirectTo>?code=...; the web callback route calls completeSignIn.
   */
  startSignIn(input: { email: string; name?: string; role: 'student' | 'landlord' }): Promise<SignInResult>;
  /** supabase only: exchange the magic-link code, then find or create the Homed user. */
  completeSignIn?(input: { code: string }): Promise<SignInResult>;
}
