import type { DataStatus } from '@homed/core';

/** Self-listed properties stay marked until an admin verifies them. */
export function ListingStatusNote({ dataStatus }: { dataStatus: DataStatus }) {
  if (dataStatus !== 'unverified_seed') return null;
  return (
    <p className="inline-flex w-fit items-center rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
      Listed by landlord · not yet verified
    </p>
  );
}
