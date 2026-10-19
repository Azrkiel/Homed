import { NextResponse } from 'next/server';
import { endSession } from '@/lib/session';

async function signOut(request: Request) {
  await endSession();
  // 303 so a POST becomes a GET on the landing page.
  return NextResponse.redirect(new URL('/', request.url), 303);
}

export const GET = signOut;
export const POST = signOut;
