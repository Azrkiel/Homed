// GET /api/mobile/alerts: the user's alert events, newest first.
import { getRepo } from '../../../../lib/repo';
import { json, preflight, requireApiUser, toAlertEventDTO, withApi } from '../_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return withApi(req, async () => {
    const user = await requireApiUser(req);
    if (user instanceof Response) return user;

    const events = await getRepo().listAlertEvents(user.id);
    return json(req, { events: events.map(toAlertEventDTO) });
  });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
