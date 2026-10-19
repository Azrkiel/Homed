// JSON-file store. Phase 3 owns this folder.
import type { SeedData } from '@homed/data';
import type { Repository, StoreClock } from '../repository';
import { notImplemented } from '@homed/core';

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
  return notImplemented('createJsonRepository');
}
