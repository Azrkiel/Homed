import type { Metadata } from 'next';
import type { Landmark, Major } from '@homed/core';
import { Alert, PageHeader } from '@/components/ui';
import { getRepo } from '@/lib/repo';
import { effectiveRole, requireUser } from '@/lib/session';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: 'Settings | Homed' };

export default async function SettingsPage() {
  const user = await requireUser(undefined, '/settings');
  const isStudent = effectiveRole(user) !== 'landlord';
  let majors: Major[] = [];
  let landmarks: Landmark[] = [];
  let loadError = false;
  if (isStudent) {
    try {
      const repo = getRepo();
      [majors, landmarks] = await Promise.all([repo.listMajors(), repo.listLandmarks()]);
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />
      {loadError && (
        <Alert tone="warn" className="mb-6">
          Some options could not load, so majors and places are missing. Reload to try again.
        </Alert>
      )}
      <SettingsForm
        user={{
          name: user.name,
          email: user.email,
          classYear: user.classYear,
          school: user.school,
          majorId: user.majorId,
          budgetMax: user.budgetMax,
          weights: user.weights,
          extras: user.extras,
        }}
        isStudent={isStudent}
        majors={majors}
        landmarks={landmarks}
      />
    </div>
  );
}
