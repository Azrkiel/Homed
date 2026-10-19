import { describe, expect, it } from 'vitest';
import type { Application, ApplicationStatus } from '@homed/core';
import { changeApplicationStatus } from '../../src/lib/apply/status';

function fakeRepo() {
  const calls: string[] = [];
  return {
    calls,
    updateApplicationStatus: async (id: string, to: ApplicationStatus) => {
      calls.push(`status:${id}:${to}`);
      return { id, status: to } as Application;
    },
    deleteDocumentsForApplication: async (id: string) => {
      calls.push(`docs:${id}`);
      return 1;
    },
  };
}

describe('changeApplicationStatus', () => {
  it.each(['denied', 'withdrawn', 'signed'] as const)('deletes the documents after %s', async (to) => {
    const repo = fakeRepo();
    await changeApplicationStatus(repo, 'app-1', to, 'u-1');
    expect(repo.calls).toEqual([`status:app-1:${to}`, 'docs:app-1']);
  });

  it.each(['submitted', 'under_review', 'approved', 'waitlisted', 'lease_sent'] as const)('keeps documents at %s', async (to) => {
    const repo = fakeRepo();
    await changeApplicationStatus(repo, 'app-1', to, 'u-1');
    expect(repo.calls).toEqual([`status:app-1:${to}`]);
  });
});
