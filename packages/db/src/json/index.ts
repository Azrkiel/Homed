// JSON-file store. Phase 3 owns this folder.
import type { SeedData } from '@homed/data';
import type { Repository, StoreClock } from '../repository';
import { alertRepo } from './alerts';
import { catalogRepo } from './catalog';
import { groupRepo } from './groups';
import { saveRepo } from './saves';
import { createCtx } from './store';
import { stubs } from './stubs';
import { userRepo } from './users';

export interface JsonStoreOptions {
  /** Database file. Omit for an in-memory store (tests). */
  filePath?: string;
  /** Catalog to seed a new database with. Default: loadSeed(). */
  seed?: SeedData;
  /** 32-byte key, base64. Encrypts ApplicantProfile.sensitive and document bytes (AES-256-GCM). */
  encryptionKey: string;
  clock?: StoreClock;
}

export function createJsonRepository(opts: JsonStoreOptions): Repository {
  const ctx = createCtx(opts);
  return {
    backend: 'json',
    ...stubs(),
    ...catalogRepo(ctx),
    ...userRepo(ctx),
    ...saveRepo(ctx),
    ...groupRepo(ctx),
    ...alertRepo(ctx),
  };
}
