// GET /api/mobile/listings: ranked listings for the signed-in user.
//   ?queue=match  only listings the user has not swiped yet (Match queue order)
//   ?limit=N      1..200
import { matchQueue } from '@homed/core';
import { getRepo } from '../../../../lib/repo';
import { rankForUser } from '../../../../lib/ranking';
import { badRequest, json, originOf, preflight, requireApiUser, toListingDTO, withApi } from '../_lib';

export const dynamic = 'force-dynamic';

function parseLimit(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  if (!/^\d+$/.test(raw)) throw badRequest('limit must be a whole number from 1 to 200');
  const n = Number(raw);
  if (n < 1 || n > 200) throw badRequest('limit must be a whole number from 1 to 200');
  return n;
}

export async function GET(req: Request) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const queue = url.searchParams.get('queue');
    if (queue !== null && queue !== 'match') throw badRequest('queue must be "match"');

    const ranked = await rankForUser(user);
    const list =
      queue === 'match' ? matchQueue(ranked, await getRepo().listSwipes({ userId: user.id }), user.id) : ranked;
    const picked = limit === undefined ? list : list.slice(0, limit);
    const origin = originOf(req);
    return json(req, { listings: picked.map((r) => toListingDTO(r, origin)) });
  });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
