import { Badge, Card, CardBody } from '@/components/ui';
import type { MemberView } from '@/lib/groups/view';
import { budgetLabel } from '@/lib/groups/present';
import { BudgetForm } from './budget-form';

/**
 * Member list from MemberView only. Other members show Budget set / No budget; the viewer's own row
 * gets the budget form. Never takes raw members or the leader user.
 */
export function MembersSection({ groupId, views }: { groupId: string; views: MemberView[] }) {
  return (
    <section aria-labelledby="members-heading">
      <Card>
        <CardBody className="grid gap-4">
          <h2 id="members-heading" className="text-lg font-semibold text-ink">
            Members ({views.length})
          </h2>
          <ul className="grid gap-3">
            {views.map((m) => (
              <li key={m.userId} className="grid gap-3 rounded-sm border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{m.name}</span>
                  {m.role === 'leader' && <Badge tone="accent">Leader</Badge>}
                  {m.isYou && <Badge tone="neutral">You</Badge>}
                  {!m.isYou && <Badge tone={m.hasBudget ? 'good' : 'neutral'}>{budgetLabel(m.hasBudget)}</Badge>}
                </div>
                {m.isYou && <BudgetForm groupId={groupId} initial={m.budgetMax} />}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </section>
  );
}
