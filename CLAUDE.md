# Homed

UVA student housing search. Ranks every on- and off-Grounds option per student by all-in price,
walk time to *their* classes, and looks; group mode; apply in the app. Product spec: `Plan.md`.
Build plan (phases, ownership, acceptance): `docs/plans/2026-10-18-homed-build.md`.

## Repo map
```
packages/core   @homed/core  domain types (src/types.ts) + pure logic: cost, filters, Best Match score,
                             schedules/commute, groups, compare, match queue, alerts diff, fees, applications
packages/data   @homed/data  hand-curated catalog: seed/*.json (real), fixtures/*.json (tiny, for tests),
                             scripts/ (walk-time precompute, validation)
packages/db     @homed/db    Repository interface (src/repository.ts) + JSON-file store (src/json) +
                             Supabase store (src/supabase), crypto, local auth
supabase/                    Supabase migrations, config, seed
apps/web        @homed/web   Next.js 16 app router + Tailwind 4 (port 3010)
apps/mobile                  Expo app (talks to apps/web/src/app/api/mobile)
```

## Rules
- Runs with **no API keys**: JSON store under `apps/web/.data`, demo sign-in, OpenStreetMap tiles via Leaflet.
  Supabase is opt-in (`HOMED_BACKEND=supabase`). See `.env.example`.
- Apps talk to storage only through `Repository` (`getRepo()` in `apps/web/src/lib/repo.ts`).
- Pure logic lives in `@homed/core` and is unit-tested; UI code does not re-implement scoring or cost.
- Paid placement never changes the Best Match score. No filters on protected classes (fair housing).
- Roommates see only done / not done for each other's application parts. No SSNs are collected.
- Contract files (types, repository interface, auth, crypto, session, repo, nav-links, slot stubs) are lead-owned.
- Don't add npm dependencies inside a phase; ask the lead (lockfile conflicts across branches).

## Commands
- `npm test` (vitest, all packages) · `npm run typecheck` (packages) · `npm run typecheck -w @homed/web`
- `npm run dev` -> http://localhost:3010 · `npm run build`
- Windows: run npm from Git Bash. Use `--` arg passing from Git Bash, not PowerShell.
