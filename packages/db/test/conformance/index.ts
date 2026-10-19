import { describe } from 'vitest';
import type { Repository } from '../../src/repository';
import { catalogConformance } from './catalog';
import { savesConformance } from './saves';
import { usersConformance } from './users';

/** Reusable against any Repository backend. Uses only the public API; makeRepo() must return a fresh store. */
export function runRepositoryConformance(name: string, makeRepo: () => Promise<Repository>): void {
  describe(`Repository conformance: ${name}`, () => {
    catalogConformance(makeRepo);
    usersConformance(makeRepo);
    savesConformance(makeRepo);
  });
}
