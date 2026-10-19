import { NextResponse } from 'next/server';
import { endSession } from '@/lib/session';

// POST only: a GET sign-out would let any cross-site link or image end the session (logout CSRF).
export async function POST(request: Request) {
  await endSession();
  // 303 so the POST becomes a GET on the landing page.
  return NextResponse.redirect(new URL('/', request.url), 303);
}
