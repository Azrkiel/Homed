// Magic-link landing: verifies ?token_hash=...&type=email and starts a Homed session. Supabase mode only.
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/repo';
import { startSession } from '@/lib/session';

/** Only same-origin relative paths: one leading '/', not '//' or a backslash. */
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const next = safeNext(url.searchParams.get('next'));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(reason)}`, url));

  const auth = getAuth();
  if (!auth.completeSignIn) return fail('Magic-link sign-in is not enabled.');
  if (!tokenHash) return fail('Sign-in link is missing its token.');

  let result;
  try {
    result = await auth.completeSignIn({ tokenHash });
  } catch {
    return fail('Could not complete sign-in. Try again.');
  }
  if (result.status !== 'signed_in') {
    return fail(result.status === 'rejected' ? result.reason : 'Could not complete sign-in.');
  }
  await startSession(result.user.id);
  return NextResponse.redirect(new URL(next ?? (result.user.role === 'landlord' ? '/landlord' : '/search'), url));
}
