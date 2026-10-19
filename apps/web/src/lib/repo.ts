// Server-side access to storage and sign-in. CONTRACT (Phase 0, lead-owned).
import { createLocalAuth, createSupabaseAuth, demoSignInAllowed, repositoryFromEnv, type AuthProvider, type Repository } from '@homed/db';
import type { ISODate } from '@homed/core';

const g = globalThis as unknown as { __homedRepo?: Repository; __homedAuth?: AuthProvider };

/** One store per server process (survives Next dev hot reloads). */
export function getRepo(): Repository {
  g.__homedRepo ??= repositoryFromEnv();
  return g.__homedRepo;
}

export function getAuth(): AuthProvider {
  if (!g.__homedAuth) {
    const env = process.env;
    // HOMED_AUTH picks sign-in separately from storage (default: follows HOMED_BACKEND). 'local' with a
    // Supabase backend keeps demo sign-in, e.g. when Homed shares another app's Supabase Auth.
    const authMode = env.HOMED_AUTH ?? (env.HOMED_BACKEND === 'supabase' ? 'supabase' : 'local');
    if (authMode === 'supabase') {
      const url = env.SUPABASE_URL;
      const anonKey = env.SUPABASE_ANON_KEY;
      const appUrl = env.HOMED_APP_URL;
      if (!url || !anonKey || !appUrl) {
        throw new Error('HOMED_BACKEND=supabase needs SUPABASE_URL, SUPABASE_ANON_KEY and HOMED_APP_URL');
      }
      g.__homedAuth = createSupabaseAuth({ url, anonKey, redirectTo: `${appUrl}/auth/callback`, repo: getRepo() });
    } else {
      g.__homedAuth = createLocalAuth(getRepo(), { enabled: demoSignInAllowed() });
    }
  }
  return g.__homedAuth;
}

/** Today's date in Charlottesville (America/New_York). HOMED_TODAY overrides it for demos and tests. */
export function today(): ISODate {
  if (process.env.HOMED_TODAY) return process.env.HOMED_TODAY;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}
