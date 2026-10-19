import type { Metadata } from 'next';
import { weeklyMeetings, type Building, type Major, type RankedListing, type UserSchedule } from '@homed/core';
import { Alert, PageHeader } from '@/components/ui';
import { ClassesForm } from '@/components/classes/classes-form';
import { WeekSummary, type WeekSummaryState } from '@/components/classes/week-summary';
import { rankForUser } from '@/lib/ranking';
import { getRepo } from '@/lib/repo';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'My Classes | Homed' };

export default async function ClassesPage() {
  const user = await requireUser(undefined, '/classes');
  const repo = getRepo();

  let majors: Major[] = [];
  let buildings: Building[] = [];
  let schedule: UserSchedule | null = null;
  let summary: WeekSummaryState | null = null;
  let loadError = false;

  try {
    [majors, buildings, schedule] = await Promise.all([repo.listMajors(), repo.listBuildings(), repo.getSchedule(user.id)]);
  } catch {
    loadError = true;
  }

  if (!loadError) {
    try {
      const meetings = weeklyMeetings(schedule, majors);
      if (meetings.length === 0) {
        summary = { kind: 'no-meetings' };
      } else {
        const [ranked, saves] = await Promise.all([rankForUser(user), repo.listSaves(user.id)]);
        const savedIds = new Set(saves.map((s) => s.floorPlanId));
        const saved: RankedListing | null = ranked.find((r) => savedIds.has(r.listing.floorPlan.id)) ?? null;
        summary = { kind: 'ready', best: ranked[0] ?? null, saved, hasSaves: saves.length > 0 };
      }
    } catch {
      loadError = true;
    }
  }

  const mode = schedule?.mode ?? 'major';
  const initialMajorId = (schedule?.mode === 'major' ? schedule.majorId : undefined) ?? user.majorId ?? '';

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <div>
        <PageHeader
          title="My Classes"
          subtitle="Tell Homed where you have class so it can rank places by your real walks."
        />
        <Alert tone="info">
          Course lookup (Lou&apos;s List / SIS) is not connected, so enter buildings and times manually, or pick your major for an estimate.
        </Alert>
      </div>
      {loadError && (
        <Alert tone="warn">Some of your class data could not load. Reload to try again.</Alert>
      )}
      <ClassesForm
        initialMode={mode}
        initialMajorId={initialMajorId}
        initialEntries={schedule?.entries ?? []}
        majors={majors}
        buildings={buildings}
      />
      {summary && <WeekSummary state={summary} />}
    </div>
  );
}
