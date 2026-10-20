import type { Metadata } from 'next';
import { matchQueue } from '@homed/core';
import { RepoError } from '@homed/db';
import { Alert, PageHeader } from '@/components/ui';
import { MatchDeck } from '@/components/match/match-deck';
import { MatchEmpty } from '@/components/match/match-empty';
import { rankForUser } from '@/lib/ranking';
import { getRepo, today } from '@/lib/repo';
import { requireUser } from '@/lib/session';
import { parseIdsParam, restrictToIds, toMatchCard, type MatchCard } from '@/lib/search/match';

export const metadata: Metadata = { title: 'Match | Homed' };
// No loading.tsx here: requireUser redirects, and a loading boundary would stream a 200 first.
export const dynamic = 'force-dynamic';

export default async function MatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(undefined, '/match');
  const params = await searchParams;
  // ?ids=a,b,c comes from "Swipe these" on /saved. Unknown ids are ignored; Best Match order is kept.
  const ids = parseIdsParam(params.ids);
  const day = today();

  let cards: MatchCard[] = [];
  let catalogEmpty = false;
  let loadError: string | null = null;
  try {
    const ranked = await rankForUser(user);
    const swipes = await getRepo().listSwipes({ userId: user.id });
    catalogEmpty = ranked.length === 0;
    cards = restrictToIds(
      matchQueue(ranked, swipes, user.id).map((r) => toMatchCard(r, day)),
      ids,
    );
  } catch (e) {
    if (!(e instanceof RepoError)) throw e;
    loadError = e.message || 'We could not load listings right now.';
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Match"
        className="pb-0"
      />

      {loadError ? (
        <Alert tone="bad" title="Could not load your matches">
          {loadError} Please refresh the page in a moment.
        </Alert>
      ) : (
        <MatchDeck
          cards={cards}
          today={day}
          empty={<MatchEmpty catalogEmpty={catalogEmpty} restricted={ids !== null} />}
        />
      )}
    </div>
  );
}
