import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

});

describe('json store encryption at rest', () => {
  const SECRET_INCOME_NOTE = 'ZEBRA-INCOME-7731-distinctive';
  const SECRET_BYTES_TEXT = 'PLAINTEXT-DOCUMENT-MARKER-4242';

  async function seedSensitiveData(filePath: string, key: string) {
    const repo = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: key, clock });
    const amy = await repo.createUser({ email: 'amy@virginia.edu', name: 'Amy', role: 'student' });
    await repo.saveApplicantProfile({
      userId: amy.id,
      legalName: 'Amy Q. Student',
      phone: '434-555-0100',
      currentAddress: '1 Main St',
      studentStatus: 'undergraduate',
      idVerified: false,
      sensitive: { rentalHistory: [{ address: SECRET_INCOME_NOTE, from: '2024-08-01' }], references: [] },
    });
    const [app] = await repo.createApplicationBatch({
      leaderId: amy.id,
      floorPlanIds: ['fp-lofts-4x4'],
      invitees: [],
      fees: [
        {
          perPerson: [],
          perPersonTotal: 0,
          people: 1,
          applicationTotal: 0,
          complianceIssues: [],
        },
      ],
    });
    const [leader] = await repo.listApplicationMembers(app!.id);
    const doc = await repo.putDocument({
      memberId: leader!.id,
      filename: 'paystub.txt',
      mime: 'text/plain',
      bytes: new TextEncoder().encode(SECRET_BYTES_TEXT),
      deleteAfter: '2030-01-01',
    });
    return { amy, docId: doc.id };
  }

  it('the raw database file contains neither the profile secret nor the document bytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'homed-json-enc-'));
    try {
      const filePath = join(dir, 'db.json');
      await seedSensitiveData(filePath, KEY);
      const raw = readFileSync(filePath, 'utf8');
      expect(raw).toContain('"profiles"');
      expect(raw).not.toContain(SECRET_INCOME_NOTE);
      expect(raw).not.toContain(SECRET_BYTES_TEXT);
      expect(raw).not.toContain(Buffer.from(SECRET_BYTES_TEXT).toString('base64'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a second store on the same file reads the profile and document back decrypted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'homed-json-enc-'));
    try {
      const filePath = join(dir, 'db.json');
      const { amy, docId } = await seedSensitiveData(filePath, KEY);
      const b = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: KEY, clock });
      const profile = await b.getApplicantProfile(amy.id);
      expect(profile?.sensitive.rentalHistory[0]?.address).toBe(SECRET_INCOME_NOTE);
      expect(new TextDecoder().decode((await b.getDocumentBytes(docId))!)).toBe(SECRET_BYTES_TEXT);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the wrong encryption key cannot decrypt the profile', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'homed-json-enc-'));
    try {
      const filePath = join(dir, 'db.json');
      const { amy } = await seedSensitiveData(filePath, KEY);
      const wrongKey = Buffer.alloc(32, 9).toString('base64');
      const b = createJsonRepository({ filePath, seed: loadFixture(), encryptionKey: wrongKey, clock });
      await expect(b.getApplicantProfile(amy.id)).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
