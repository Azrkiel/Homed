import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFixture } from '@homed/data';
import { createJsonRepository } from '../src/json/index';
import { runRepositoryConformance } from './conformance/index';

const KEY = Buffer.alloc(32, 7).toString('base64');
const clock = { now: () => new Date('2026-10-19T12:00:00.000Z') };

runRepositoryConformance('json', async () => createJsonRepository({ seed: loadFixture(), encryptionKey: KEY, clock }));

describe('json store persistence', () => {
  it('a second store on the same file reads what the first wrote', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'homed-json-'));
    try {
      const filePath = join(dir, 'db.json');
      const a = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: KEY, clock });
      const u = await a.createUser({ email: 'amy@virginia.edu', name: 'Amy', role: 'student' });
      await a.addSave(u.id, 'fp-lofts-4x4');
      const b = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: KEY, clock });
      expect(await b.getUser(u.id)).toEqual(u);
      expect(await b.listSaves(u.id)).toEqual(await a.listSaves(u.id));
      expect(b.backend).toBe('json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reloads when another instance changes the file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'homed-json-'));
    try {
      const filePath = join(dir, 'db.json');
      const a = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: KEY, clock });
      const b = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: KEY, clock });
      await a.listBuildings();
      await new Promise((r) => setTimeout(r, 20));
      const u = await b.createUser({ email: 'ben@virginia.edu', name: 'Ben', role: 'student' });
      expect((await a.getUserByEmail('ben@virginia.edu'))?.id).toBe(u.id);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('unimplemented methods throw a not implemented error', async () => {
    const r = createJsonRepository({ seed: loadFixture(), encryptionKey: KEY, clock });
    expect(() => r.getApplicantProfile('x')).toThrow('not implemented: getApplicantProfile');
  });
});
