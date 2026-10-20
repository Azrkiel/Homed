import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, Card, CardBody, PageHeader } from '@/components/ui';
import { JoinGroupButton } from '@/components/groups/join-group-button';
import { loadJoinPreview } from '@/lib/groups/data';
import { checkInviteCode } from '@/lib/groups/input';
import { plural } from '@/lib/format';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Join group | Homed' };
// No loading.tsx here: a loading boundary would stream a 200 before notFound() runs.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ code: string }> };

export default async function JoinGroupPage({ params }: Props) {
  const { code: raw } = await params;
  // The code is only used in the lookup and the paths below after it passes the format check.
  const check = checkInviteCode(raw);
  if (!check.ok) notFound();
  const code = check.value;

  // getCurrentUser (not requireUser): signed-out visitors can preview the group, then sign in to join.
  const user = await getCurrentUser();
  const preview = await loadJoinPreview(code, user?.id ?? null);
  if (!preview) notFound();

  const joinPath = `/groups/join/${encodeURIComponent(code)}`;

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`Join ${preview.name}`}
        subtitle={`Led by ${preview.leaderName} · ${plural(preview.memberCount, 'member')}`}
        className="pb-0"
      />

      <Card as="section" className="max-w-xl">
        <CardBody className="grid gap-4">
          {!user ? (
            <>
              <p className="text-sm text-ink">Sign in to join. You will come back here after.</p>
              <div>
                <Button href={`/signin?next=${encodeURIComponent(joinPath)}`}>Sign in to join</Button>
              </div>
            </>
          ) : preview.alreadyMember ? (
            <>
              <p className="text-sm text-ink">You are already in this group.</p>
              <div>
                <Button href={`/groups/${preview.groupId}`}>Open group</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink">Joining gives you the group shortlist, votes and member list.</p>
              <JoinGroupButton code={code} />
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
