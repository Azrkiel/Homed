import Link from 'next/link';
import { loadMyGroups } from '@/lib/groups/data';
import { getCurrentUser } from '@/lib/session';
import { AddToGroupPicker } from './add-to-group-picker';

const LINK = 'text-sm font-medium text-ink underline underline-offset-2 hover:text-ink-2';

/**
 * "Add to group" for a listing. Signed out or no groups -> link to /groups. Otherwise a picker of the
 * viewer's groups that adds the listing to the chosen group's shortlist.
 */
export async function AddToGroupButton({ floorPlanId }: { floorPlanId: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="relative z-10">
        <Link href="/groups" className={LINK}>
          Add to group
        </Link>
      </div>
    );
  }
  const mine = await loadMyGroups(user);
  if (mine.length === 0) {
    return (
      <div className="relative z-10">
        <Link href="/groups" className={LINK}>
          Create a group
        </Link>
      </div>
    );
  }
  const groups = mine.map(({ group }) => ({ id: group.id, name: group.name }));
  return (
    <div className="relative z-10">
      <AddToGroupPicker floorPlanId={floorPlanId} groups={groups} />
    </div>
  );
}
