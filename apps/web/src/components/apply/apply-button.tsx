import { Button } from '@/components/ui';
import { effectiveRole, getCurrentUser } from '@/lib/session';

/**
 * Apply entry point on a listing. Server component: signed-out -> sign in, students -> the batch builder,
 * landlords and admins -> nothing.
 */
export async function ApplyButton({ floorPlanId }: { floorPlanId: string }) {
  const applyPath = `/apply/new?fp=${encodeURIComponent(floorPlanId)}`;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button href={`/signin?next=${encodeURIComponent(applyPath)}`} variant="secondary">
        Sign in to apply
      </Button>
    );
  }
  if (effectiveRole(user) !== 'student') return null;
  return <Button href={applyPath}>Apply</Button>;
}
