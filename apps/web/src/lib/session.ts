// Session cookie (local mode) and bearer token (mobile). CONTRACT (Phase 0, lead-owned).
// Token format: <userId>.<expiresAtMs>.<hmac-sha256 base64url>
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { dataDir } from '@homed/db';
import type { User, UserRole } from '@homed/core';
import { getRepo } from './repo';

export const SESSION_COOKIE = 'homed_session';
const SESSION_DAYS = 30;

let cachedSecret: string | undefined;

function secret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.HOMED_SESSION_SECRET) {
    cachedSecret = process.env.HOMED_SESSION_SECRET;
    return cachedSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('HOMED_SESSION_SECRET is required in production');
  }
  const path = join(dataDir(), 'session.secret');
  if (existsSync(path)) {
    cachedSecret = readFileSync(path, 'utf8').trim();
  } else {
    mkdirSync(dirname(path), { recursive: true });
    cachedSecret = randomBytes(32).toString('base64url');
    writeFileSync(path, cachedSecret + '\n', { mode: 0o600 });
  }
  return cachedSecret;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + SESSION_DAYS * 86_400_000}`;
  return `${payload}.${sign(payload)}`;
}

/** The user id in a valid, unexpired token, else null. */
export function verifySessionToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expires, mac] = parts as [string, string, string];
  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!(Number(expires) > now)) return null;
  return userId;
}

/** Signed-in user from the session cookie, or from `Authorization: Bearer <token>` (mobile). */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  let userId = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const auth = (await headers()).get('authorization');
    if (auth?.startsWith('Bearer ')) userId = verifySessionToken(auth.slice(7));
  }
  return userId ? getRepo().getUser(userId) : null;
}

/** Bearer-token user for the mobile API. Ignores the browser cookie, so cookie-authenticated cross-site requests can't use the API. */
export async function getBearerUser(request: Request): Promise<User | null> {
  const auth = request.headers.get('authorization');
  const userId = auth?.startsWith('Bearer ') ? verifySessionToken(auth.slice(7)) : null;
  return userId ? getRepo().getUser(userId) : null;
}

/** Admins are users with role 'admin' or an email listed in HOMED_ADMIN_EMAILS (comma-separated). */
export function effectiveRole(user: User): UserRole {
  const admins = (process.env.HOMED_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(user.email.toLowerCase()) ? 'admin' : user.role;
}

/** For pages and server actions: redirects to /signin when signed out, home on a role mismatch. Admins pass every role check. */
export async function requireUser(role?: UserRole, nextPath?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`);
  const actual = effectiveRole(user);
  if (role && actual !== role && actual !== 'admin') redirect('/');
  return user;
}

export async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
