import type { User } from '@homed/core';
import type { Repository } from '../../src/repository';

export type MakeRepo = () => Promise<Repository>;

export async function makeStudent(repo: Repository, name = 'Student', local = name.toLowerCase()): Promise<User> {
  return repo.createUser({ email: `${local}@virginia.edu`, name, role: 'student' });
}

export async function expectRepoError(p: Promise<unknown>, code: string): Promise<void> {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  if (!(err instanceof Error) || err.name !== 'RepoError') {
    throw new Error(`expected RepoError(${code}), got ${String(err)}`);
  }
  const actual = (err as Error & { code?: string }).code;
  if (actual !== code) throw new Error(`expected RepoError code ${code}, got ${String(actual)}`);
}

/** Fixture ids from packages/data/fixtures. */
export const FX = {
  propertyLofts: 'p-fixture-lofts',
  propertyRugby: 'p-fixture-rugby-house',
  propertyOnGrounds: 'p-fixture-on-grounds',
  slugLofts: 'fixture-lofts',
  fpStudio: 'fp-lofts-studio',
  fp4x4: 'fp-lofts-4x4',
  fpRugby: 'fp-rugby-5x2',
  fpOnGrounds: 'fp-og-4x2',
  photoProperty: 'ph-lofts-1',
  photoFloorPlan: 'ph-lofts-2',
  buildingThornton: 'b-thornton',
  majorEngineering: 'm-engineering',
};
