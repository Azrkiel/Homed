// POST /api/mobile/swipes: {floorPlanId, direction: 'right' | 'left'}. Right also saves the listing.
import { getRepo } from '../../../../lib/repo';
import {
  json,
  notFound,
  parseDirection,
  preflight,
  readJson,
  requireApiUser,
  requireFloorPlanId,
  requireObject,
  withApi,
} from '../_lib';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const body = requireObject(await readJson(req));
    const floorPlanId = requireFloorPlanId(body.floorPlanId);
    const direction = parseDirection(body.direction);

    const repo = getRepo();
    if (!(await repo.getListing(floorPlanId))) throw notFound('Listing not found');
    await repo.recordSwipe({ userId: user.id, floorPlanId, direction });
    const saved = (await repo.listSaves(user.id)).some((s) => s.floorPlanId === floorPlanId);
    return json(req, { ok: true, saved });
  });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
