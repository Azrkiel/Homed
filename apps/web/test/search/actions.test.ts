// Server actions called directly: session and Next cache are mocked; the store is a temp JSON file.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { User } from '@homed/core';

const who = vi.hoisted(() => ({ user: null as User | null }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('@/lib/session', () => ({ requireUser: async () => who.user }));

const dir = mkdtempSync(join(tmpdir(), 'homed-actions-'));
process.env.HOMED_DATA_DIR = dir;

let actions: typeof import('../../src/lib/search/actions');
let repo: import('@homed/db').Repository;

beforeAll(async () => {
  actions = await import('../../src/lib/search/actions');
  repo = (await import('../../src/lib/repo')).getRepo();
  who.user = await repo.createUser({ email: 'actions@virginia.edu', name: 'Ada', role: 'student' });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('recordSwipeAction / toggleSave reject places that are not listed', () => {
  it('a swipe on an unknown floor plan is refused and nothing is stored', async () => {
    const r = await actions.recordSwipeAction('fp-does-not-exist', 'right');
    expect(r).toEqual({ ok: false, message: 'That place is no longer listed.' });
    expect(await repo.listSwipes({ userId: who.user!.id })).toEqual([]);
    expect(await repo.listSaves(who.user!.id)).toEqual([]);
  });

  it('saving an unknown floor plan is refused', async () => {
    expect(await actions.toggleSave('fp-does-not-exist')).toEqual({ ok: false, message: 'That place is no longer listed.' });
    expect(await repo.listSaves(who.user!.id)).toEqual([]);
  });

  it('a real listing still saves and swipes', async () => {
    const [first] = await repo.listListings();
    const id = first!.floorPlan.id;
    expect(await actions.toggleSave(id)).toEqual({ ok: true, saved: true });
    expect(await actions.toggleSave(id)).toEqual({ ok: true, saved: false });
    expect((await actions.recordSwipeAction(id, 'right')).ok).toBe(true);
  });
});
