'use server';
import { redirect } from 'next/navigation';
import { RepoError } from '@homed/db';
import { getAuth } from '@/lib/repo';
import { startSession } from '@/lib/session';
import { safeNext } from './next-path';

export interface SignInState {
  error?: string;
  /** Magic link sent (Supabase mode). */
  sent?: boolean;
  email?: string;
  name?: string;
  role?: 'student' | 'landlord';
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const role = formData.get('role') === 'landlord' ? 'landlord' : 'student';
  const next = safeNext(formData.get('next'));
  const echo = { email, name, role } as const;

  if (!email) return { ...echo, error: 'Enter your email address.' };

  let destination: string;
  try {
    const result = await getAuth().startSignIn({ email, name: name || undefined, role });
    if (result.status === 'rejected') return { ...echo, error: result.reason };
    if (result.status === 'link_sent') return { ...echo, sent: true };
    await startSession(result.user.id);
    destination = result.user.role === 'landlord' ? '/landlord' : next;
  } catch (e) {
    if (e instanceof RepoError) return { ...echo, error: e.message };
    return { ...echo, error: 'Something went wrong signing you in. Please try again.' };
  }
  redirect(destination);
}
