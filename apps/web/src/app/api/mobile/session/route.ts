// POST /api/mobile/session: student sign-in for the mobile app. Returns a bearer token.
import { getAuth } from '../../../../lib/repo';
import { createSessionToken } from '../../../../lib/session';
import { badRequest, json, preflight, readJson, requireObject, withApi } from '../_lib';

export const dynamic = 'force-dynamic';

const NOT_AVAILABLE = 'Mobile sign-in is not available with Supabase auth yet.';

export async function POST(req: Request) {
  return withApi(req, async () => {
    const body = requireObject(await readJson(req));
    const { email, name } = body;
    if (typeof email !== 'string' || email.trim() === '') throw badRequest('email is required');
    if (name !== undefined && typeof name !== 'string') throw badRequest('name must be a string');

    const auth = getAuth();
    // Supabase sends a magic link instead of signing in, so the mobile app cannot finish sign-in here.
    if (auth.mode === 'supabase') return json(req, { error: NOT_AVAILABLE }, 501);

    const result = await auth.startSignIn({
      email: email.trim(),
      role: 'student',
      ...(name !== undefined ? { name } : {}),
    });
    if (result.status === 'signed_in') {
      const { id, email: userEmail, name: userName } = result.user;
      return json(req, { token: createSessionToken(id), user: { id, email: userEmail, name: userName } });
    }
    if (result.status === 'rejected') return json(req, { error: result.reason }, 400);
    return json(req, { error: NOT_AVAILABLE }, 501);
  });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
