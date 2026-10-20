// /api/mobile/saves: GET the shortlist, POST to save (idempotent), DELETE to unsave.
// DELETE takes floorPlanId from the query (?floorPlanId=) or the JSON body.
import type { RankedListing } from '@homed/core';
import { getRepo } from '../../../../lib/repo';
import { rankForUser } from '../../../../lib/ranking';
import {
  badRequest,
  json,
  notFound,
  originOf,
  preflight,
  readJson,
  requireApiUser,
  requireFloorPlanId,
  requireObject,
  toListingDTO,
  withApi,
} from '../_lib';

export const dynamic = 'force-dynamic';

const MAX_NOTE = 1000;

export async function GET(req: Request) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const repo = getRepo();
    const [saves, ranked] = await Promise.all([repo.listSaves(user.id), rankForUser(user)]);
    const byId = new Map<string, RankedListing>(ranked.map((r) => [r.listing.floorPlan.id, r]));
    const origin = originOf(req);
    return json(req, {
      saves: saves.map((s) => {
        const r = byId.get(s.floorPlanId);
        return {
          floorPlanId: s.floorPlanId,
          note: s.note ?? '',
          createdAt: s.createdAt,
          listing: r ? toListingDTO(r, origin) : null,
        };
      }),
    });
  });
}

export async function POST(req: Request) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const body = requireObject(await readJson(req));
    const floorPlanId = requireFloorPlanId(body.floorPlanId);
    const { note } = body;
    if (note !== undefined && note !== null && typeof note !== 'string') throw badRequest('note must be a string');
    if (typeof note === 'string' && note.length > MAX_NOTE) throw badRequest(`note must be ${MAX_NOTE} characters or fewer`);

    const repo = getRepo();
    if (!(await repo.getListing(floorPlanId))) throw notFound('Listing not found');
    await repo.addSave(user.id, floorPlanId, typeof note === 'string' ? note : undefined);
    return json(req, { ok: true });
  });
}

export async function DELETE(req: Request) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const fromQuery = new URL(req.url).searchParams.get('floorPlanId');
    const floorPlanId =
      fromQuery !== null ? requireFloorPlanId(fromQuery) : requireFloorPlanId(requireObject(await readJson(req)).floorPlanId);
    await getRepo().removeSave(user.id, floorPlanId);
    return json(req, { ok: true });
  });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
