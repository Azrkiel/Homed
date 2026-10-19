import { describe, expect, it } from 'vitest';
import { loadFixture } from '@homed/data';
import { createJsonRepository } from '../src/json/index';
import { createLocalAuth, demoSignInAllowed } from '../src/local-auth';

const KEY = Buffer.alloc(32, 7).toString('base64');
const repo = () => createJsonRepository({ seed: loadFixture(), encryptionKey: KEY });

describe('local demo sign-in', () => {
  it('signs a student in (and creates them) when enabled', async () => {
    const r = await createLocalAuth(repo()).startSignIn({ email: 'Demo@Virginia.edu', role: 'student' });
    expect(r.status).toBe('signed_in');
  });

  it('refuses everyone when disabled, without creating a user', async () => {
    const store = repo();
    const r = await createLocalAuth(store, { enabled: false }).startSignIn({ email: 'demo@virginia.edu', role: 'student' });
    expect(r).toEqual({ status: 'rejected', reason: expect.stringContaining('Demo sign-in is turned off') });
    expect(await store.getUserByEmail('demo@virginia.edu')).toBeNull();
  });

  it('is off in production unless HOMED_ALLOW_DEMO_SIGNIN=1', () => {
    expect(demoSignInAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(demoSignInAllowed({ NODE_ENV: 'test' })).toBe(true);
    expect(demoSignInAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(demoSignInAllowed({ NODE_ENV: 'production', HOMED_ALLOW_DEMO_SIGNIN: '1' })).toBe(true);
    expect(demoSignInAllowed({ NODE_ENV: 'production', HOMED_ALLOW_DEMO_SIGNIN: 'true' })).toBe(false);
  });
});
