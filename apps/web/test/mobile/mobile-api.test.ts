// Mobile JSON API: route handlers called directly with Request objects.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The bearer token is read through next/headers. The test sets the headers of each request here.
const hdrState = vi.hoisted(() => ({ current: new Headers() as Headers }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => hdrState.current,
}));

type Handler = (req: Request) => Promise<Response>;
interface Result {
  status: number;
  headers: Headers;
  // Parsed JSON, or null for an empty body.
  body: any;
}

type SessionModule = typeof import('../../src/app/api/mobile/session/route');
type ListingsModule = typeof import('../../src/app/api/mobile/listings/route');
type DetailModule = typeof import('../../src/app/api/mobile/listings/[id]/route');
type SwipesModule = typeof import('../../src/app/api/mobile/swipes/route');
type SavesModule = typeof import('../../src/app/api/mobile/saves/route');
type AlertsModule = typeof import('../../src/app/api/mobile/alerts/route');
type LibModule = typeof import('../../src/app/api/mobile/_lib');
type SessionLib = typeof import('../../src/lib/session');
type RepoLib = typeof import('../../src/lib/repo');
type RankingLib = typeof import('../../src/lib/ranking');

const BASE = 'http://api.test';
const WEB_ORIGIN = 'http://localhost:3010';
const MOBILE_ORIGIN = 'http://localhost:8081';
const LAN_ORIGIN = 'http://192.168.1.20:8081';
const EVIL_ORIGIN = 'https://evil.example';
const DAY = 86_400_000;

let session: SessionModule;
let listings: ListingsModule;
let detail: DetailModule;
let swipes: SwipesModule;
let saves: SavesModule;
let alerts: AlertsModule;
let lib: LibModule;
let sessionLib: SessionLib;
let repoLib: RepoLib;
let ranking: RankingLib;

let dataDir: string;
const envBefore: Record<string, string | undefined> = {};
const ENV_KEYS = ['HOMED_DATA_DIR', 'HOMED_SESSION_SECRET', 'HOMED_TODAY', 'HOMED_BACKEND', 'HOMED_MOBILE_ORIGINS'];
let fpId: string;
let landmarkWithWalk: { id: string; name: string } | undefined;
let emailSeq = 0;

beforeAll(async () => {
  for (const k of ENV_KEYS) envBefore[k] = process.env[k];
  dataDir = mkdtempSync(join(tmpdir(), 'homed-mobile-api-'));
  // Set before the modules load: the store and the session secret read env lazily, but TODAY is fixed here.
  process.env.HOMED_DATA_DIR = dataDir;
  process.env.HOMED_SESSION_SECRET = 'mobile-api-test-secret';
  process.env.HOMED_TODAY = '2026-10-19';
  delete process.env.HOMED_BACKEND;
  delete process.env.HOMED_MOBILE_ORIGINS;

  session = await import('../../src/app/api/mobile/session/route');
  listings = await import('../../src/app/api/mobile/listings/route');
  detail = await import('../../src/app/api/mobile/listings/[id]/route');
  swipes = await import('../../src/app/api/mobile/swipes/route');
  saves = await import('../../src/app/api/mobile/saves/route');
  alerts = await import('../../src/app/api/mobile/alerts/route');
  lib = await import('../../src/app/api/mobile/_lib');
  sessionLib = await import('../../src/lib/session');
  repoLib = await import('../../src/lib/repo');
  ranking = await import('../../src/lib/ranking');

  const all = await repoLib.getRepo().listListings();
  fpId = all[0]!.floorPlan.id;
  const propertyId = all[0]!.property.id;
  const [walks, landmarks] = await Promise.all([repoLib.getRepo().listWalkTimes([propertyId]), repoLib.getRepo().listLandmarks()]);
  const walked = new Set(walks.map((w) => w.targetId));
  const pick = landmarks.find((l) => walked.has(l.id));
  landmarkWithWalk = pick ? { id: pick.id, name: pick.name } : undefined;
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (envBefore[k] === undefined) delete process.env[k];
    else process.env[k] = envBefore[k];
  }
  rmSync(dataDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RqOpts {
  method?: string;
  body?: unknown;
  raw?: string;
  token?: string;
  origin?: string;
}

/** A Request for the mobile API. Bodies are JSON unless `raw` is given. */
function rq(path: string, opts: RqOpts = {}): Request {
  const headers = new Headers();
  if (opts.token !== undefined) headers.set('authorization', `Bearer ${opts.token}`);
  if (opts.origin !== undefined) headers.set('origin', opts.origin);
  let body: string | undefined = opts.raw;
  if (body === undefined && opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers.set('content-type', 'application/json');
  }
  return new Request(`${BASE}${path}`, { method: opts.method ?? 'GET', headers, body });
}

/** Runs a handler with the request's headers visible to next/headers, then reads the response. */
async function send(req: Request, handler: Handler): Promise<Result> {
  hdrState.current = req.headers;
  const res = await handler(req);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text === '' ? null : JSON.parse(text) };
}

function paramsCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Signs in a new student through POST /session. Each call gets its own email. */
async function freshStudent(name = 'Test Student'): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
  emailSeq++;
  const email = `mobile-${emailSeq}@virginia.edu`;
  const res = await send(rq('/api/mobile/session', { method: 'POST', body: { email, name } }), session.POST);
  expect(res.status).toBe(200);
  return { token: res.body.token as string, user: res.body.user };
}

/** Every protected route, as a request builder plus its handler. */
function protectedRoutes(): { label: string; make: (token?: string) => Request; run: Handler }[] {
  return [
    { label: 'GET /listings', make: (t) => rq('/api/mobile/listings', { token: t }), run: listings.GET },
    {
      label: 'GET /listings/[id]',
      make: (t) => rq(`/api/mobile/listings/${fpId}`, { token: t }),
      run: (r) => detail.GET(r, paramsCtx(fpId)),
    },
    {
      label: 'POST /swipes',
      make: (t) => rq('/api/mobile/swipes', { method: 'POST', body: { floorPlanId: fpId, direction: 'right' }, token: t }),
      run: swipes.POST,
    },
    { label: 'GET /saves', make: (t) => rq('/api/mobile/saves', { token: t }), run: saves.GET },
    {
      label: 'POST /saves',
      make: (t) => rq('/api/mobile/saves', { method: 'POST', body: { floorPlanId: fpId }, token: t }),
      run: saves.POST,
    },
    {
      label: 'DELETE /saves',
      make: (t) => rq(`/api/mobile/saves?floorPlanId=${fpId}`, { method: 'DELETE', token: t }),
      run: saves.DELETE,
    },
    { label: 'GET /alerts', make: (t) => rq('/api/mobile/alerts', { token: t }), run: alerts.GET },
  ];
}

// ---------------------------------------------------------------------------
// POST /session
// ---------------------------------------------------------------------------

describe('POST /api/mobile/session', () => {
  it('signs in a @virginia.edu student and returns a token for that user', async () => {
    const res = await send(
      rq('/api/mobile/session', { method: 'POST', body: { email: '  Jane.Doe@Virginia.edu ', name: 'Jane' } }),
      session.POST,
    );
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: expect.any(String), email: 'jane.doe@virginia.edu', name: 'Jane' });
    expect(typeof res.body.token).toBe('string');
    expect(sessionLib.verifySessionToken(res.body.token)).toBe(res.body.user.id);
  });

  it('defaults the name to the email local part', async () => {
    const res = await send(
      rq('/api/mobile/session', { method: 'POST', body: { email: 'noname.student@virginia.edu' } }),
      session.POST,
    );
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('noname.student');
  });

  it('rejects a non-virginia email with 400 and the reason', async () => {
    const res = await send(
      rq('/api/mobile/session', { method: 'POST', body: { email: 'someone@gmail.com' } }),
      session.POST,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Use your @virginia.edu email.');
    expect(res.body.token).toBeUndefined();
  });

  it('rejects bad bodies with 400', async () => {
    const cases: RqOpts[] = [
      { method: 'POST', raw: '{not json' },
      { method: 'POST' },
      { method: 'POST', body: [] },
      { method: 'POST', body: {} },
      { method: 'POST', body: { email: 42 } },
      { method: 'POST', body: { email: '   ' } },
      { method: 'POST', body: { email: 'a@virginia.edu', name: 7 } },
    ];
    for (const c of cases) {
      const res = await send(rq('/api/mobile/session', c), session.POST);
      expect(res.status, JSON.stringify(c)).toBe(400);
      expect(typeof res.body.error).toBe('string');
    }
  });

  it('answers 501 for Supabase auth and never sends a magic link', async () => {
    const g = globalThis as unknown as { __homedAuth?: unknown };
    const previous = g.__homedAuth;
    const startSignIn = vi.fn();
    g.__homedAuth = { mode: 'supabase', startSignIn };
    try {
      const res = await send(rq('/api/mobile/session', { method: 'POST', body: { email: 'x@virginia.edu' } }), session.POST);
      expect(res.status).toBe(501);
      expect(res.body.error).toBe('Mobile sign-in is not available with Supabase auth yet.');
      expect(startSignIn).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete g.__homedAuth;
      else g.__homedAuth = previous;
    }
  });

  it('answers 501 when the sign-in result is link_sent', async () => {
    const g = globalThis as unknown as { __homedAuth?: unknown };
    const previous = g.__homedAuth;
    g.__homedAuth = { mode: 'local', startSignIn: async () => ({ status: 'link_sent' }) };
    try {
      const res = await send(rq('/api/mobile/session', { method: 'POST', body: { email: 'x@virginia.edu' } }), session.POST);
      expect(res.status).toBe(501);
    } finally {
      if (previous === undefined) delete g.__homedAuth;
      else g.__homedAuth = previous;
    }
  });
});

// ---------------------------------------------------------------------------
// Auth on every protected route
// ---------------------------------------------------------------------------

describe('401 on protected routes', () => {
  // Route table is built inside each test: the route modules load in beforeAll.
  const labels = ['GET /listings', 'GET /listings/[id]', 'POST /swipes', 'GET /saves', 'POST /saves', 'DELETE /saves', 'GET /alerts'];
  const routeFor = (label: string) => protectedRoutes().find((r) => r.label === label)!;

  for (const label of labels) {
    it(`${label}: 401 with no token`, async () => {
      const route = routeFor(label);
      const res = await send(route.make(undefined), route.run);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Sign in required' });
    });

    it(`${label}: 401 with a garbage token`, async () => {
      const route = routeFor(label);
      const res = await send(route.make('not.a.token'), route.run);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Sign in required' });
    });

    it(`${label}: 401 with an expired token`, async () => {
      const route = routeFor(label);
      const user = await freshStudent();
      const expired = sessionLib.createSessionToken(user.user.id, Date.now() - 40 * DAY);
      const res = await send(route.make(expired), route.run);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Sign in required' });
    });
  }

  it('401 responses still carry CORS headers for an allowed origin', async () => {
    const res = await send(
      rq('/api/mobile/listings', { origin: MOBILE_ORIGIN }),
      listings.GET,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('access-control-allow-origin')).toBe(MOBILE_ORIGIN);
  });
});

// ---------------------------------------------------------------------------
// GET /listings
// ---------------------------------------------------------------------------

describe('GET /api/mobile/listings', () => {
  it('returns every listing in rank order with the list DTO shape', async () => {
    const user = await freshStudent();
    const res = await send(rq('/api/mobile/listings', { token: user.token }), listings.GET);
    expect(res.status).toBe(200);
    const rows = res.body.listings as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(1);
    const totals = rows.map((r) => r.scoreTotal as number);
    for (let i = 1; i < totals.length; i++) expect(totals[i]).toBeLessThanOrEqual(totals[i - 1]!);

    const first = rows[0]!;
    expect(Object.keys(first).sort()).toEqual(
      [
        'address',
        'badges',
        'bedBath',
        'floorPlanId',
        'floorPlanName',
        'lastVerified',
        'neighborhood',
        'onGrounds',
        'photoIsRendering',
        'photoUrl',
        'propertyId',
        'propertyName',
        'scoreTotal',
        'totalMonthly',
        'why',
      ].sort(),
    );
    for (const r of rows) {
      const url = r.photoUrl as string | null;
      expect(url === null || url.startsWith('http://') || url.startsWith('https://')).toBe(true);
    }
  });

  it('?limit= returns the top N in rank order', async () => {
    const user = await freshStudent();
    const all = await send(rq('/api/mobile/listings', { token: user.token }), listings.GET);
    const top = await send(rq('/api/mobile/listings?limit=2', { token: user.token }), listings.GET);
    expect(top.status).toBe(200);
    expect(top.body.listings.map((r: { floorPlanId: string }) => r.floorPlanId)).toEqual(
      all.body.listings.slice(0, 2).map((r: { floorPlanId: string }) => r.floorPlanId),
    );
  });

  it('rejects bad ?limit values with 400', async () => {
    const user = await freshStudent();
    for (const limit of ['0', '201', '-1', 'abc', '', '1.5', '1e2']) {
      const res = await send(rq(`/api/mobile/listings?limit=${limit}`, { token: user.token }), listings.GET);
      expect(res.status, `limit=${limit}`).toBe(400);
      expect(typeof res.body.error).toBe('string');
    }
  });

  it('accepts limit 1 and 200', async () => {
    const user = await freshStudent();
    const one = await send(rq('/api/mobile/listings?limit=1', { token: user.token }), listings.GET);
    expect(one.body.listings).toHaveLength(1);
    const big = await send(rq('/api/mobile/listings?limit=200', { token: user.token }), listings.GET);
    expect(big.status).toBe(200);
  });

  it('?queue=match drops a listing once it is swiped', async () => {
    const user = await freshStudent();
    const before = await send(rq('/api/mobile/listings?queue=match', { token: user.token }), listings.GET);
    const n = before.body.listings.length as number;
    expect(n).toBeGreaterThan(1);
    const swiped = before.body.listings[0].floorPlanId as string;

    const swipe = await send(
      rq('/api/mobile/swipes', { method: 'POST', body: { floorPlanId: swiped, direction: 'left' }, token: user.token }),
      swipes.POST,
    );
    expect(swipe.status).toBe(200);

    const after = await send(rq('/api/mobile/listings?queue=match', { token: user.token }), listings.GET);
    expect(after.body.listings).toHaveLength(n - 1);
    expect(after.body.listings.map((r: { floorPlanId: string }) => r.floorPlanId)).not.toContain(swiped);

    const all = await send(rq('/api/mobile/listings', { token: user.token }), listings.GET);
    expect(all.body.listings).toHaveLength(n);
  });

  it('rejects an unknown queue value with 400', async () => {
    const user = await freshStudent();
    const res = await send(rq('/api/mobile/listings?queue=bogus', { token: user.token }), listings.GET);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /listings/[id]
// ---------------------------------------------------------------------------

describe('GET /api/mobile/listings/[id]', () => {
  it('returns the detail DTO', async () => {
    const user = await freshStudent();
    const res = await send(rq(`/api/mobile/listings/${fpId}`, { token: user.token }), (r) =>
      detail.GET(r, paramsCtx(fpId)),
    );
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d.floorPlanId).toBe(fpId);
    expect(typeof d.score.price).toBe('number');
    expect(typeof d.score.location).toBe('number');
    expect(typeof d.score.looks).toBe('number');
    expect(['photos_and_age', 'age_only']).toContain(d.score.looksBasis);
    expect(d.cost.totalMonthly).toBe(d.totalMonthly);
    expect(typeof d.commute.averageMinutes).toBe('number');
    expect(typeof d.commute.usesBus).toBe('boolean');
    expect(d.rentAmount).toEqual(expect.any(Number));
    expect(['per_bed', 'per_unit']).toContain(d.rentBasis);
    expect(d.leaseStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.leaseEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof d.furnished).toBe('boolean');
    expect(typeof d.utilitiesIncluded).toBe('boolean');
    expect(Array.isArray(d.amenities)).toBe(true);
    expect(d.saved).toBe(false);
    expect(d.photos.length).toBeLessThanOrEqual(8);
    for (const p of d.photos as { url: string; alt: string; isRendering: boolean }[]) {
      expect(p.url.startsWith('http')).toBe(true);
      expect(typeof p.isRendering).toBe('boolean');
    }
    expect(d.walkTimes.length).toBeLessThanOrEqual(12);
    for (const w of d.walkTimes as { kind: string; walkMinutes: number; busMinutes: number | null }[]) {
      expect(['building', 'landmark']).toContain(w.kind);
      expect(typeof w.walkMinutes).toBe('number');
      expect(w.busMinutes === null || typeof w.busMinutes === 'number').toBe(true);
    }
  });

  it('includes the chosen extra landmarks in walkTimes', async () => {
    if (!landmarkWithWalk) return; // catalog has no landmark walk data for this property
    const user = await freshStudent();
    const repo = repoLib.getRepo();
    await repo.updateUser(user.user.id, { extras: [landmarkWithWalk.id] });
    const res = await send(rq(`/api/mobile/listings/${fpId}`, { token: user.token }), (r) =>
      detail.GET(r, paramsCtx(fpId)),
    );
    expect(res.status).toBe(200);
    const names = (res.body.walkTimes as { name: string; kind: string }[]).filter((w) => w.kind === 'landmark').map((w) => w.name);
    expect(names).toContain(landmarkWithWalk.name);
  });

  it('reports saved true after the listing is saved', async () => {
    const user = await freshStudent();
    await send(rq('/api/mobile/saves', { method: 'POST', body: { floorPlanId: fpId }, token: user.token }), saves.POST);
    const res = await send(rq(`/api/mobile/listings/${fpId}`, { token: user.token }), (r) =>
      detail.GET(r, paramsCtx(fpId)),
    );
    expect(res.body.saved).toBe(true);
  });

  it('404 JSON for an unknown id', async () => {
    const user = await freshStudent();
    const res = await send(rq('/api/mobile/listings/no-such-plan', { token: user.token }), (r) =>
      detail.GET(r, paramsCtx('no-such-plan')),
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Listing not found' });
  });
});

// ---------------------------------------------------------------------------
// POST /swipes
// ---------------------------------------------------------------------------

describe('POST /api/mobile/swipes', () => {
  it('a right swipe creates a save', async () => {
    const user = await freshStudent();
    const res = await send(
      rq('/api/mobile/swipes', { method: 'POST', body: { floorPlanId: fpId, direction: 'right' }, token: user.token }),
      swipes.POST,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, saved: true });
    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.body.saves.map((s: { floorPlanId: string }) => s.floorPlanId)).toEqual([fpId]);
  });

  it('a left swipe does not create a save', async () => {
    const user = await freshStudent();
    const res = await send(
      rq('/api/mobile/swipes', { method: 'POST', body: { floorPlanId: fpId, direction: 'left' }, token: user.token }),
      swipes.POST,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, saved: false });
    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.body.saves).toEqual([]);
  });

  it('400 on bad input', async () => {
    const user = await freshStudent();
    const cases: RqOpts[] = [
      { method: 'POST', raw: '{oops' },
      { method: 'POST', body: [] },
      { method: 'POST', body: { direction: 'right' } },
      { method: 'POST', body: { floorPlanId: '', direction: 'right' } },
      { method: 'POST', body: { floorPlanId: 12, direction: 'right' } },
      { method: 'POST', body: { floorPlanId: fpId, direction: 'up' } },
      { method: 'POST', body: { floorPlanId: fpId } },
      { method: 'POST', body: { floorPlanId: fpId, direction: true } },
    ];
    for (const c of cases) {
      const res = await send(rq('/api/mobile/swipes', { ...c, token: user.token }), swipes.POST);
      expect(res.status, JSON.stringify(c)).toBe(400);
    }
  });

  it('404 for an unknown listing', async () => {
    const user = await freshStudent();
    const res = await send(
      rq('/api/mobile/swipes', { method: 'POST', body: { floorPlanId: 'nope', direction: 'right' }, token: user.token }),
      swipes.POST,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Listing not found' });
  });
});

// ---------------------------------------------------------------------------
// /saves
// ---------------------------------------------------------------------------

describe('/api/mobile/saves', () => {
  it('POST saves with a note, GET lists it with the listing', async () => {
    const user = await freshStudent();
    const post = await send(
      rq('/api/mobile/saves', { method: 'POST', body: { floorPlanId: fpId, note: 'near the Corner' }, token: user.token }),
      saves.POST,
    );
    expect(post.status).toBe(200);
    expect(post.body).toEqual({ ok: true });

    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.status).toBe(200);
    expect(list.body.saves).toHaveLength(1);
    const row = list.body.saves[0];
    expect(row.floorPlanId).toBe(fpId);
    expect(row.note).toBe('near the Corner');
    expect(typeof row.createdAt).toBe('string');
    expect(row.listing.floorPlanId).toBe(fpId);
    expect(typeof row.listing.scoreTotal).toBe('number');
  });

  it('POST is idempotent and keeps the earlier note when none is sent', async () => {
    const user = await freshStudent();
    const body = { floorPlanId: fpId, note: 'first' };
    await send(rq('/api/mobile/saves', { method: 'POST', body, token: user.token }), saves.POST);
    const again = await send(rq('/api/mobile/saves', { method: 'POST', body: { floorPlanId: fpId }, token: user.token }), saves.POST);
    expect(again.status).toBe(200);
    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.body.saves).toHaveLength(1);
    expect(list.body.saves[0].note).toBe('first');
  });

  it('POST rejects bad input and unknown listings', async () => {
    const user = await freshStudent();
    const cases: [RqOpts, number][] = [
      [{ method: 'POST', body: {} }, 400],
      [{ method: 'POST', body: { floorPlanId: fpId, note: 5 } }, 400],
      [{ method: 'POST', body: { floorPlanId: fpId, note: 'x'.repeat(1001) } }, 400],
      [{ method: 'POST', raw: 'nope' }, 400],
      [{ method: 'POST', body: { floorPlanId: 'missing-plan' } }, 404],
    ];
    for (const [c, status] of cases) {
      const res = await send(rq('/api/mobile/saves', { ...c, token: user.token }), saves.POST);
      expect(res.status, JSON.stringify(c)).toBe(status);
    }
  });

  it('GET reports listing null for a save whose floor plan is gone', async () => {
    const user = await freshStudent();
    await repoLib.getRepo().addSave(user.user.id, 'ghost-floor-plan', 'old place');
    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.body.saves).toEqual([
      { floorPlanId: 'ghost-floor-plan', note: 'old place', createdAt: expect.any(String), listing: null },
    ]);
  });

  it('DELETE removes via the query string', async () => {
    const user = await freshStudent();
    await send(rq('/api/mobile/saves', { method: 'POST', body: { floorPlanId: fpId }, token: user.token }), saves.POST);
    const del = await send(
      rq(`/api/mobile/saves?floorPlanId=${encodeURIComponent(fpId)}`, { method: 'DELETE', token: user.token }),
      saves.DELETE,
    );
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });
    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.body.saves).toEqual([]);
  });

  it('DELETE removes via the JSON body', async () => {
    const user = await freshStudent();
    await send(rq('/api/mobile/saves', { method: 'POST', body: { floorPlanId: fpId }, token: user.token }), saves.POST);
    const del = await send(
      rq('/api/mobile/saves', { method: 'DELETE', body: { floorPlanId: fpId }, token: user.token }),
      saves.DELETE,
    );
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });
    const list = await send(rq('/api/mobile/saves', { token: user.token }), saves.GET);
    expect(list.body.saves).toEqual([]);
  });

  it('DELETE is idempotent and needs an id from the query or body', async () => {
    const user = await freshStudent();
    const twice = await send(
      rq(`/api/mobile/saves?floorPlanId=${fpId}`, { method: 'DELETE', token: user.token }),
      saves.DELETE,
    );
    expect(twice.status).toBe(200);
    const none = await send(rq('/api/mobile/saves', { method: 'DELETE', token: user.token }), saves.DELETE);
    expect(none.status).toBe(400);
    const empty = await send(rq('/api/mobile/saves?floorPlanId=', { method: 'DELETE', token: user.token }), saves.DELETE);
    expect(empty.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /alerts
// ---------------------------------------------------------------------------

describe('GET /api/mobile/alerts', () => {
  it('returns events newest first with the event shape and read flags', async () => {
    const user = await freshStudent();
    const repo = repoLib.getRepo();
    const alert = await repo.createAlert({
      userId: user.user.id,
      triggers: ['price_drop', 'new_listing'],
      target: { kind: 'property', propertyId: 'some-property' },
    });
    const [first] = await repo.addAlertEvents([
      { alertId: alert.id, userId: user.user.id, trigger: 'price_drop', propertyId: 'some-property', floorPlanId: fpId, message: 'Older update' },
    ]);
    await new Promise((r) => setTimeout(r, 5));
    await repo.addAlertEvents([
      { alertId: alert.id, userId: user.user.id, trigger: 'new_listing', propertyId: 'some-property', message: 'Newer update' },
    ]);

    const res = await send(rq('/api/mobile/alerts', { token: user.token }), alerts.GET);
    expect(res.status).toBe(200);
    const events = res.body.events as Record<string, unknown>[];
    expect(events.map((e) => e.message)).toEqual(['Newer update', 'Older update']);
    expect(events[0]).toEqual({
      id: expect.any(String),
      trigger: 'new_listing',
      message: 'Newer update',
      propertyId: 'some-property',
      createdAt: expect.any(String),
      read: false,
    });
    expect(events[1]!.floorPlanId).toBe(fpId);

    await repo.markAlertEventsRead(user.user.id, [first!.id]);
    const after = await send(rq('/api/mobile/alerts', { token: user.token }), alerts.GET);
    const older = (after.body.events as { id: string; read: boolean }[]).find((e) => e.id === first!.id);
    expect(older?.read).toBe(true);
  });

  it('returns an empty list for a new user', async () => {
    const user = await freshStudent();
    const res = await send(rq('/api/mobile/alerts', { token: user.token }), alerts.GET);
    expect(res.body).toEqual({ events: [] });
  });
});

// ---------------------------------------------------------------------------
// OPTIONS and CORS
// ---------------------------------------------------------------------------

describe('CORS', () => {
  // Getters, not values: the route modules load in beforeAll.
  const preflightRoutes: [string, () => (req: Request) => Response][] = [
    ['session', () => session.OPTIONS],
    ['listings', () => listings.OPTIONS],
    ['listings/[id]', () => detail.OPTIONS],
    ['swipes', () => swipes.OPTIONS],
    ['saves', () => saves.OPTIONS],
    ['alerts', () => alerts.OPTIONS],
  ];

  for (const [label, handlerFor] of preflightRoutes) {
    it(`OPTIONS ${label}: 204 with no auth`, () => {
      const res = handlerFor()(rq('/api/mobile/x', { method: 'OPTIONS', origin: MOBILE_ORIGIN }));
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe(MOBILE_ORIGIN);
    });
  }

  it('preflight sends the full allow list and max-age', () => {
    const res = listings.OPTIONS(rq('/api/mobile/listings', { method: 'OPTIONS', origin: MOBILE_ORIGIN }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toBe('Authorization, Content-Type');
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(res.headers.get('access-control-max-age')).toBe('600');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('reflects localhost, the LAN IPv4 range and the Expo port', () => {
    for (const origin of [MOBILE_ORIGIN, LAN_ORIGIN, WEB_ORIGIN, 'http://127.0.0.1:19006', 'http://[::1]:8081', 'http://10.0.0.7:8081', 'http://172.20.1.1:8081']) {
      const res = listings.OPTIONS(rq('/api/mobile/listings', { method: 'OPTIONS', origin }));
      expect(res.headers.get('access-control-allow-origin'), origin).toBe(origin);
    }
  });

  it('adds no CORS headers for an unlisted origin', () => {
    const res = listings.OPTIONS(rq('/api/mobile/listings', { method: 'OPTIONS', origin: EVIL_ORIGIN }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-methods')).toBeNull();
    expect(res.headers.get('vary')).toBe('Origin');
  });

  it('adds no CORS headers when there is no Origin', () => {
    const res = listings.OPTIONS(rq('/api/mobile/listings', { method: 'OPTIONS' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('is CORS-aware on JSON responses too', async () => {
    const user = await freshStudent();
    const ok = await send(rq('/api/mobile/alerts', { token: user.token, origin: LAN_ORIGIN }), alerts.GET);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe(LAN_ORIGIN);
    expect(ok.headers.get('vary')).toBe('Origin');

    const bad = await send(rq('/api/mobile/alerts', { token: user.token, origin: EVIL_ORIGIN }), alerts.GET);
    expect(bad.status).toBe(200);
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('allowedOrigin: private ranges, extra origins from HOMED_MOBILE_ORIGINS, and rejects', () => {
    const allowed = (o: string | null) => lib.allowedOrigin(o);
    expect(allowed('http://172.16.0.1:8081')).toBe('http://172.16.0.1:8081');
    expect(allowed('http://172.31.255.1')).toBe('http://172.31.255.1');
    expect(allowed('http://172.32.0.1:8081')).toBeNull();
    expect(allowed('http://192.169.1.1:8081')).toBeNull();
    expect(allowed('http://8.8.8.8:8081')).toBeNull();
    expect(allowed('http://10.300.1.1:8081')).toBeNull();
    expect(allowed('ftp://localhost:8081')).toBeNull();
    expect(allowed('not a url')).toBeNull();
    expect(allowed('null')).toBeNull();
    expect(allowed(null)).toBeNull();

    process.env.HOMED_MOBILE_ORIGINS = 'https://app.example.com/, https://tunnel.example.dev';
    try {
      // Trailing slashes are dropped from the env list; an Origin header never has one.
      expect(allowed('https://app.example.com')).toBe('https://app.example.com');
      expect(allowed('https://app.example.com/')).toBeNull();
      expect(allowed('https://tunnel.example.dev')).toBe('https://tunnel.example.dev');
      expect(allowed(EVIL_ORIGIN)).toBeNull();
    } finally {
      delete process.env.HOMED_MOBILE_ORIGINS;
    }
  });
});

// ---------------------------------------------------------------------------
// Errors and shared helpers
// ---------------------------------------------------------------------------

describe('errors', () => {
  it('unexpected failures return a generic 500 with no stack', async () => {
    const user = await freshStudent();
    const repo = repoLib.getRepo();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const listSpy = vi.spyOn(repo, 'listListings').mockRejectedValueOnce(new Error('disk on fire at /secret/path'));
    try {
      const res = await send(rq('/api/mobile/listings', { token: user.token }), listings.GET);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Server error' });
      expect(JSON.stringify(res.body)).not.toContain('secret');
    } finally {
      listSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('absolutize only rewrites root-relative urls', () => {
    expect(lib.absolutize('/photos/a.jpg', WEB_ORIGIN)).toBe(`${WEB_ORIGIN}/photos/a.jpg`);
    expect(lib.absolutize('https://cdn.example/a.jpg', WEB_ORIGIN)).toBe('https://cdn.example/a.jpg');
    expect(lib.absolutize('//cdn.example/a.jpg', WEB_ORIGIN)).toBe('//cdn.example/a.jpg');
  });

  it('ranking helper is the one the routes use', async () => {
    const user = await repoLib.getRepo().createUser({ email: 'direct@virginia.edu', name: 'Direct', role: 'student' });
    const ranked = await ranking.rankForUser(user);
    const res = await send(
      rq('/api/mobile/listings', { token: sessionLib.createSessionToken(user.id) }),
      listings.GET,
    );
    expect(res.body.listings.map((r: { floorPlanId: string }) => r.floorPlanId)).toEqual(
      ranked.map((r) => r.listing.floorPlan.id),
    );
  });
});
