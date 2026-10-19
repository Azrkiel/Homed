# Homed

Homed helps UVA students find next year's housing, starting with first-years picking their
second-year place in the September–October lease rush. It shows every option on and off Grounds
in one place and ranks each one for the student: all-in price per person, real walking minutes
to *their* classes, and how nice the place is. Groups can decide together, and students can apply
from the app.

Product plan: [`Plan.md`](Plan.md). Build plan and phase history:
[`docs/plans/2026-10-18-homed-build.md`](docs/plans/2026-10-18-homed-build.md).

## What's in it

| Area | What works |
|---|---|
| Search | Map (Leaflet + OpenStreetMap) and list of 56 properties / 109 floor plans near Grounds, on- and off-Grounds; every Plan.md filter; sort by Best Match, price or walk |
| Best Match | 0–100 score per student: price vs budget, walk time to their classes, looks (age + student photo ratings); presets and sliders; a one-line "why" on every card; paid placement never touches it |
| My Classes | Major mode (buildings a major's courses meet in) or schedule mode (enter classes, pick buildings); weekly walking time per place, bus when faster |
| Listing page | True cost per person (rent split, utilities, internet, parking, furniture; 12-month vs academic-year), walk times to classes and landmarks, accessibility and accommodation details, on-Grounds HRL info, "last verified" dimming after 14 days |
| Match / Compare / Saved / Alerts | Swipe mode in Best Match order; side-by-side compare of 2–4 places with the better value highlighted; shortlist with notes; alerts for new listings, price drops and "few left" |
| Groups | Invite link, shared shortlist, votes, per-person budgets (others see only "over budget"), merged class schedules, group Match where a place everyone swipes right on becomes a match |
| Apply | One reusable applicant profile (encrypted, no SSN), apply alone or with roommates and guarantors to up to 3 places at once, every fee shown first with Virginia's fee cap checked, status tracker, withdraw prompts, lease checklist + Student Legal Services nudge |
| Landlords | Self-listing with a map-click location picker, weekly availability confirmation, accessibility checklist, applications inbox with status actions, PDF packet for landlords not on Homed |
| Reviews | UVA-email students only, one per property, moderated by admins, landlord right to reply |
| Mobile | Expo app (ranked list, listing detail, swipe Match, saved) on a small JSON API |

## Run it (no API keys needed)

Requires Node 22+.

```bash
npm install
npm run dev          # http://localhost:3010
```

Sign in with any `@virginia.edu` address. In local mode no email is sent; it's demo sign-in, so
it runs in `npm run dev` and is refused in production builds unless you set `HOMED_ALLOW_DEMO_SIGNIN=1`
(for demos only).
Landlords can use any email. Data lives in a JSON file under `apps/web/.data/`, seeded from
`packages/data/seed` on first run. Delete that folder to start over.

To make someone an admin (review moderation), set `HOMED_ADMIN_EMAILS=you@virginia.edu`.

```bash
npm test               # unit + integration tests (vitest)
npm run typecheck      # packages; `npm run typecheck -w @homed/web` for the app
npm run build          # production build of the web app
npm run e2e            # Playwright end-to-end tests (uses your installed Chrome)
```

Mobile app: see [`apps/mobile/README.md`](apps/mobile/README.md).

## Configuration

Everything is optional; see [`.env.example`](.env.example).

| Variable | Purpose |
|---|---|
| `HOMED_BACKEND` | `json` (default) or `supabase` |
| `HOMED_DATA_DIR` | Where the JSON store and dev secrets live |
| `HOMED_ENCRYPTION_KEY` | 32-byte base64 key for applicant data and documents (required in production / Supabase mode) |
| `HOMED_SESSION_SECRET` | Session signing secret (required in production) |
| `HOMED_ADMIN_EMAILS` | Comma-separated admin emails |
| `HOMED_ALLOW_DEMO_SIGNIN` | `1` allows demo sign-in in a production build (`next start`); never set it on a real deployment |
| `HOMED_TODAY` | Pin "today" for demos and tests |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HOMED_APP_URL` | Supabase mode |

## Deploy (Fly.io)

Live demo: https://homed.fly.dev (app `homed`, region `iad`). `Dockerfile` builds a Next.js standalone
server; `fly.toml` mounts a 1 GB volume at `/data` for the JSON store; `HOMED_SESSION_SECRET` and
`HOMED_ENCRYPTION_KEY` are Fly secrets (keep a copy of the encryption key: without it, stored applicant
data can't be decrypted).

```bash
flyctl deploy --remote-only --depot=false   # from the repo root
```

The demo deployment runs with `HOMED_ALLOW_DEMO_SIGNIN=1`, so anyone can sign in as any email. Use seed
data only until Supabase sign-in is set up and that line is removed from `fly.toml`.

## Supabase (when you're ready)

The schema (Postgres + PostGIS, row-level security on every table), a seed script and a full
Supabase implementation of the storage layer are ready and pass the same conformance tests as the
JSON store against a local Supabase stack. See [`supabase/README.md`](supabase/README.md).

```bash
npx supabase start                                   # local stack (needs Docker)
npx supabase db reset                                # apply migrations
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx packages/db/scripts/supabase-seed.ts
```

## Data: read this before launch

The seed catalog was assembled from public websites on 2026-10-19 and is **not verified by hand**.
Every record is marked `unverified_seed` with its source URL. Known gaps:

- Rents are each floor plan's lowest published price. Many came from third-party listing pages
  because the UVA Off-Grounds portal blocked automated reads. 2027–28 lease dates are mostly
  inferred from 2026–27.
- Lease liability (individual vs joint) is rarely published, so most plans are marked `joint`.
- Some map pins sit on a street or area centroid rather than the building.
- Major-to-building mappings are informed estimates, not registrar data.
- No listing photos were copied from landlord sites. Placeholders are shown until real photos
  (landlord uploads or Commons images with credit) are added.
- No class data was scraped. Plan.md says to ask Prof. Bloomfield before using Lou's List.

Walk times are real OpenStreetMap foot routes (OSRM), precomputed for every property × 157
buildings and landmarks. Map data © OpenStreetMap contributors (ODbL).

## Not built (needs keys, partners or a lawyer)

- Email and push notifications (alerts show in the app's feed instead)
- In-app payments, tenant screening and e-signature (Plan.md defers these until landlords join)
- Mapbox (Leaflet + OSM tiles are used instead)
- Verified ID checks
- A lawyer's review of the application flow against Virginia's revised fee law (effective 2027-07-01) and of filters/roommate features under fair housing law. Both are flagged in Plan.md and in `packages/core/src/fees.ts`.

## Repo map

```
packages/core   domain types + pure logic (scoring, cost, filters, schedules, groups, alerts, fees, applications)
packages/data   seed catalog, OSM/OSRM scripts, validation
packages/db     Repository interface, JSON-file store, Supabase store, crypto
supabase/       migrations, RLS, email templates, local config
apps/web        Next.js 16 web app
apps/mobile     Expo app
```

## License

See [LICENSE](LICENSE).
