// Loads the full catalog into a Supabase project (upsert; never resets data).
// Usage (Git Bash): SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx packages/db/scripts/supabase-seed.ts
import { createClient } from '@supabase/supabase-js';
import { loadSeed } from '@homed/data';
import { loadCatalog } from '../src/supabase/seed';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('usage: SUPABASE_URL=<api url> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx packages/db/scripts/supabase-seed.ts');
  process.exit(1);
}

const sb = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const counts = await loadCatalog(sb, loadSeed());
let total = 0;
for (const [table, n] of Object.entries(counts)) {
  console.log(`${table}: ${n}`);
  total += n;
}
console.log(`total: ${total} rows`);
