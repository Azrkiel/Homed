// GET /api/mobile/listings/[id]: one listing (id = floor plan id) with score, cost, walk times and photos.
import { getRepo } from '../../../../../lib/repo';
import { getRankedListing } from '../../../../../lib/ranking';
import {
  json,
  originOf,
  preflight,
  requireApiUser,
  toListingDetailDTO,
  walkTimesFor,
  withApi,
} from '../../_lib';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const { id } = await context.params;
    const ranked = await getRankedListing(user, id);
    if (!ranked) return json(req, { error: 'Listing not found' }, 404);

    const repo = getRepo();
    const [walkTimes, saves] = await Promise.all([
      walkTimesFor(repo, user, ranked.listing.property.id),
      repo.listSaves(user.id),
    ]);
    const saved = saves.some((s) => s.floorPlanId === id);
    return json(req, toListingDetailDTO(ranked, originOf(req), { walkTimes, saved }));
  });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
