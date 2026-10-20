# Homed build plan (phased)

Lead: the main Claude session. Each phase is run by an `xvant-phase-manager` in its own worktree on
branch `phase/<name>`, cut from the base branch `build/v1`. The product spec is `Plan.md`; this file
is the engineering spec. Where they disagree, ask the lead.

Constraint from the owner: **build everything that works without API keys.** Concretely:
- Maps: Leaflet + OpenStreetMap raster tiles (attribution required), not Mapbox.
- Storage: JSON-file store by default; Supabase adapter + migrations ready for when keys exist.
- Auth: local demo sign-in (no email sent) by default; Supabase magic link when configured.
- Walk times: OSRM foot routing if reachable (self-hosted or a public keyless server, politely),
  else a straight-line estimate. Marked `source` either way.
- Class data: NO Lou's List / SIS scraping (Plan.md: ask Prof. Bloomfield first). Major mode +
  manual schedule entry with a building picker. `sections` stays empty.
- Photos: NO copying listing photos from landlord sites. Use placeholders, or Wikimedia Commons
  images with a `credit` line. Renderings are flagged `isRendering`.
- Email/push/payments/screening/e-signature: out (need keys or partners). In-app alert feed instead
  of email; "pay the landlord directly" at launch per Plan.md phasing.

## Phase graph

```
Phase 0  contract (lead) ── committed on build/v1
   |
   +── wave 1 ──────────────────────────────────────────────────────────
   |    P1 data            P2 core              P3 json-store
   |    (seed catalog,     (pure logic,         (Repository on a JSON
   |     walk times)        all specs below)     file + conformance suite)
   |
   +── wave 2 (after P2 + P3 merged; P1 may still be running) ───────────
   |    P4 supabase                     P5 web-search
   |    (migrations, RLS, adapter,      (sign-in, search map+list, Best Match,
   |     passes P3 conformance suite)    filters, listing page, My Classes,
   |                                     match, compare, saved, alerts)
   |
   +── wave 3 (after P5 merged) ─────────────────────────────────────────
   |    P6 groups      P7 apply          P8 landlord+reviews    P9 mobile
   |
   '── P10 integration (lead): wire-up, e2e, review swarm, docs
```

Unhappy paths every phase handles: signed-out user (redirect to /signin or read-only view),
empty results (explain which filter removed most listings), missing walk data (neutral score + "walk
times unavailable"), stale listing (dimmed + "Not verified in N days"), store errors (RepoError ->
friendly message, never a stack trace), forbidden (non-member / wrong role -> 404 or redirect).

## Global conventions
- TypeScript strict, `noUncheckedIndexedAccess`. No `any` except at JSON boundaries.
- Tests: vitest, files in `<pkg>/test/**/*.test.ts` (root `vitest.config.ts` picks them up;
  web tests in `apps/web/test`). TDD for logic.
- Commit per task on the phase branch. Message: `<phase>: <task>`.
- Never edit files outside the phase's **Owns** list. Need a contract change -> report `blocked`.
- Never add npm dependencies. Already installed: next, react, leaflet, react-leaflet, pdf-lib,
  @supabase/supabase-js, supabase (CLI), tsx, @playwright/test, tailwindcss.
- Windows host: run commands from Git Bash. `core.autocrlf=true`; `.gitattributes` forces LF.
- Dates: "today" comes from `ScoringContext.today` / `today()` in web, never `new Date()` in core.

---

## Phase 0: contract (lead, done)
Committed on `build/v1`: workspace config, `packages/core/src/types.ts`, every core module as a
signature stub, `packages/core/src/index.ts`, `packages/db/src/{repository,auth,crypto,local-auth,index}.ts`,
json/supabase factory stubs, `packages/data/src/index.ts` + `fixtures/` (and an initial `seed/` copy
of the fixture), web skeleton (`layout.tsx`, `globals.css`, landing `page.tsx`, `lib/repo.ts`,
`lib/session.ts`, `components/nav-links.ts`, slot stubs `components/reviews/reviews-section.tsx`,
`components/apply/apply-button.tsx`, `components/groups/add-to-group-button.tsx`), CI, `.env.example`.

---

## Phase 1: data
- **Goal:** `packages/data/seed/` holds a real, internally consistent catalog of ~50 properties near
  Grounds plus UVA upperclass on-Grounds options, ~100 UVA buildings, landmarks, majors, and a full
  walk-time matrix, with a test that proves its integrity.
- **Owns:** `packages/data/seed/**`, `packages/data/scripts/**`, `packages/data/test/seed.test.ts`,
  `packages/data/README.md`.
- **Depends on:** Phase 0.
- **Manager model:** sonnet. Research tasks are lookups (workers on haiku via the router).
- **Acceptance:**
  - `npx vitest run packages/data` -> all pass (fixture test + seed test).
  - `npx tsc -p tsconfig.json --noEmit` -> no errors.
  - `npx tsx packages/data/scripts/walk-times.ts --check` -> exits 0 (every property x target row present).
  - Counts: properties >= 45 (off-Grounds >= 35, on-Grounds >= 6), buildings >= 90, majors >= 25.

### Data rules
- Every record is real and public. Never invent a property, rent, or feature. Unknown -> omit the
  optional field (or `unitsAvailable: null`). When rent is a range, store each floor plan's
  lowest published price and say so in `source`.
- `dataStatus: "unverified_seed"` on everything; `lastVerified` = the date the worker read the source.
  `meta.notes` says plainly: "Assembled from public websites on <date>; not yet verified by hand.
  Map data © OpenStreetMap contributors (ODbL)."
- `source` = the URL read. Lease dates for 2027-28 when published, else the 2026-27 pattern shifted
  one year (say so in `source`, e.g. "... (2027-28 dates inferred from 2026-27)").
- Coordinates: OpenStreetMap Nominatim or Overpass. Polite use: max 1 request/second, a descriptive
  User-Agent `Homed-data-builder/0.1 (+https://github.com/Azrkiel/Homed)`, cache responses under
  `packages/data/scripts/.cache/` and add `.cache/` to `packages/data/scripts/.gitignore` (owned). All coordinates inside bbox lat 37.98..38.10, lng -78.58..-78.42.
- Required landmark ids (code depends on them): `lawn`, `corner`, `clemons`, `newcomb`, `afc`,
  `slaughter-rec`, `ngrc` (North Grounds Rec), `grocery-barracks-kroger`, `grocery-barracks-harris-teeter`,
  plus places of worship (kind `worship`, `tradition` set) and `uva-hospital` (kind `health`).
- Ids: kebab-case with a prefix: `b-` buildings, `p-` properties, `fp-` floor plans, `ph-` photos,
  `ll-` landlords, `m-` majors. Slugs = property id without `p-`.
- VERVE Charlottesville (100 Stadium Rd, opens summer 2027, studios from about $1,910/mo per
  Plan.md) must be present with only rendering photos (`/placeholder/rendering.svg`, `isRendering: true`).
- On-Grounds options from UVA Housing & Residence Life (residential colleges, language houses,
  upperclass apartments/halls): rate per person converted to monthly over the contract months,
  `rentBasis: "per_bed"`, `termKind: "academic_year"`, `utilitiesIncluded: true`, `furnished: true`,
  `unitsAvailable: null`, fees 0, `onGroundsInfo` filled with `hrlUrl`.
- Accessibility rows only for facts a public source states (elevator, accessible units, ADA). No row
  when nothing is known. Never claim accommodation contacts that are not published.
- Majors (Plan.md "Major mode"): >= 25, covering every undergrad school (CLAS, SEAS, COMM, NURS, ARCH,
  EDUC, BATTEN, plus Data Science) and grad schools (LAW, DARDEN, MED, BATTEN-grad). Each major lists the
  buildings its second-year (grad: first-year) courses typically meet in, shares summing to 1, and
  `meetingsPerWeek` (undergrad ~10-14). This is an informed estimate: say so in `meta.notes`.

### Tasks
1. `scripts/osm.ts`: tiny polite client for Nominatim search + Overpass query (rate limit, UA, disk cache).
2. `seed/buildings.json`: Overpass query for named buildings in the UVA campus area (`operator`/`name`
   containing University of Virginia, or inside the campus polygon), then keep academic/library/rec
   buildings; use an `entrance=main` node when OSM has one, else the building centroid. Codes: UVA
   abbreviations where known, else a 3-5 letter code. >= 90 rows. Include Law School, Darden, Batten
   (Garrett Hall), Claude Moore Nursing Education Bldg, McLeod Hall, Medical school buildings, Rice,
   Thornton, Olsson, MEC, Rouss & Robertson, Monroe, Gilmer, Physical Life Sciences, Chemistry,
   Physics, Kerchof, Halsey, Nau, Gibson, New Cabell, Wilson, Campbell, Ruffner, Bryan, Clark, Clemons,
   Alderman, Shannon, Brown Science & Engineering Library, Memorial Gym.
3. `seed/landmarks.json` with the required ids.
4. `seed/majors.json`.
5. `seed/landlords.json` + `seed/properties.json` + `seed/floor_plans.json` for off-Grounds: research
   in batches of ~8 properties per worker (complexes near the Corner, JPA, Wertland/West Main, Rugby
   Road, Fontaine, Barracks Road, Venable, Grady Ave, Brandon Ave area; include houses/duplexes from
   local managers that publish listings). Each worker returns JSON objects in the exact contract types.
6. On-Grounds upperclass options (same files).
7. `seed/photos.json` (placeholders / renderings / Commons only) and `seed/accessibility.json`.
8. `scripts/walk-times.ts`: build the matrix property x (buildings + landmarks).
   - `OSRM_URL` set -> OSRM `/table/v1/foot/` in chunks (<= 100 coords per request, 1 req/s); else try
     `https://routing.openstreetmap.de/routed-foot` with the same politeness (one table request per
     property is fine; stop and fall back on any 429/5xx); else estimate.
   - Estimate: haversine x 1.3 detour / 80 m per minute, min 1.
   - Bus minutes (properties with `onBusRoute`): 3 min walk to stop + 5 min average wait + ride at
     18 km/h over straight-line x 1.4 + 3 min walk from stop; `busMinutes` only when that beats walking
     by >= 3 min, else null.
   - `--check` verifies completeness without network.
   - Write `seed/walk_times.json` sorted by propertyId, targetId.
9. `scripts/validate.ts` + `test/seed.test.ts`: unique ids/slugs, every reference resolves, bbox,
   shares sum to 1 (+-0.001), required landmarks present, leaseEnd > leaseStart, rents > 0,
   onGrounds <=> onGroundsInfo, VERVE renderings-only, counts above, complete walk matrix, every
   property has `source`, every floor plan beds/baths sane (0 <= beds <= 8, baths >= 1).
10. `packages/data/README.md`: provenance, how to refresh, how to run walk-times with a self-hosted OSRM
    (`docker run osrm/osrm-backend` with the Virginia extract from Geofabrik, foot profile).

---

## Phase 2: core
- **Goal:** every function in `@homed/core` is implemented to the spec below and in its doc comment,
  with unit tests.
- **Owns:** `packages/core/src/**` except `types.ts`, `index.ts`, `not-implemented.ts`;
  `packages/core/test/**`.
- **Depends on:** Phase 0.
- **Manager model:** sonnet.
- **Acceptance:**
  - `npx vitest run packages/core` -> all pass, >= 120 tests.
  - `npx tsc -p tsconfig.json --noEmit` -> no errors.
  - `grep -rn "notImplemented(" packages/core/src --include=*.ts | grep -v not-implemented.ts` -> no output.

### Specs (in addition to each doc comment)
- `normalizeWeights`: negative -> 0; result sums to 1 (floating), all zero -> DEFAULT_WEIGHTS.
- `peopleInUnit`: max(beds, 1). `leaseMonths`: round(days(leaseStart..leaseEnd) / 30.44), min 1.
- `computeCost`: rent = per_bed ? rentAmount : rentAmount / peopleInUnit; components rounded to whole
  dollars, totalMonthly = sum of rounded components. note for `academic_year` / `semester`:
  `"<n>-month lease: plan summer housing separately"`.
- `neighborhoodMedians`: median of per-person rent (computeCost(...).rent) per `property.neighborhood`,
  plus key `"__all__"` over every listing. Empty -> `{}`.
- `priceScore(total, budget, perPersonRent, median)`:
  `effectiveBudget = budget ?? undefined`; when undefined, the caller passes
  `round(1.3 * medians.__all__)` (scoreListing does this; if `__all__` is missing, price = 50).
  ratio = total / effectiveBudget; ratio <= 0.85 -> 100; ratio >= 1 -> 0; else linear
  (100 * (1 - ratio) / 0.15). Bonus when median is defined and ratio < 1:
  `clamp(0, 10, (median - perPersonRent) / median * 50)`; result capped at 100, rounded.
- `locationScore(avg)`: <= 5 -> 100, >= 30 -> 0, linear between, rounded.
- Location input in `scoreListing`: meetings present -> commute.averageMinutes; else extras present ->
  mean minutes to extras; else walk to landmark `lawn`; no walk data at all -> location 50 and the why
  part says "walk times unavailable".
- `looksScore`: year = max(yearBuilt, yearRenovated) (either may be missing; none -> age score 50);
  year > current year (from `today`) -> 100; age <= 2 -> 100; age >= 40 -> 20; linear between.
  Photo score: real photos (isRendering false) with ratingCount > 0: rating mean weighted by
  ratingCount, mapped (r - 1) / 4 * 100. With photo score: 0.5 * age + 0.5 * photo, basis
  `photos_and_age`; else age only, basis `age_only`. Rounded.
- `scoreListing`: weights normalised; total = round(w.price * P + w.location * L + w.looks * A).
  why: up to three parts joined by " · ":
  price: budget set -> "$40 under budget" / "$25 over budget" / "right at budget"; no budget ->
  "$1,245/mo all-in"; location: meetings -> "9 min to your classes"; extras -> "6 min to your spots";
  else "12 min to the Lawn"; looks: renderings only -> "renderings only"; yearRenovated -> "renovated
  2024"; yearBuilt > current year -> "new for 2027"; yearBuilt >= current year - 5 -> "built 2022";
  else omit. Money formatted with thousands separators.
  badges: `renderings_only` (has photos and none real), `stale` (isStale(floorPlan.lastVerified)),
  `accommodation_friendly`, `few_left` (1..FEW_LEFT_THRESHOLD), `private_bath` (baths >= peopleInUnit),
  `on_grounds`, `individual_lease`, in that order.
- `rankListings`: sort by total desc, then cost.totalMonthly asc, then property.name asc.
- `weeklyMeetings` / `commuteFor` / `formatMinutes`: per doc comments. formatMinutes: < 60 ->
  "45 min"; else "2 h 10 min"; exact hours -> "2 h". Rounded to whole minutes.
- Filters: privateBathroom: baths >= peopleInUnit; groupSize: peopleInUnit === groupSize; termKind exact;
  moveInBy: leaseStart <= moveInBy; noise 'quiet' -> property.noiseLevel === 'quiet', 'social' -> 'social';
  amenityBuilding: gym || studyRooms || rooftop; accommodationFriendly: accommodationBadge().friendly;
  accessibilityFeatures: every feature in accessibility.features; studioOr1Br: beds <= 1;
  onGrounds 'only' / 'exclude'; maxCostPerPerson: computeCost(fp, property).totalMonthly (no parking).
  Reasons, e.g. "Over budget by $120", "Has 3 bedrooms, group needs 4", "Lease starts Aug 25, after Aug 15",
  "No in-unit laundry".
- `accommodationBadge`: reasons list the satisfied criteria in plain words; missing lists the rest.
  undefined info -> friendly false, missing = all five criteria.
- Freshness: `daysBetween` uses UTC midnight of each ISO date. `isStale`: daysBetween > STALE_AFTER_DAYS.
  `verifiedLabel`: 0 -> "Verified today", 1 -> "Verified yesterday", <= 14 -> "Verified N days ago",
  else "Not verified in N days".
- Groups / compare / match / alerts / fees / applications / validation: per doc comments.
  `makeInviteCode` alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
  `buildCompareTable` displays: score "86", money "$1,245/mo", totalLease "$14,940 (12 mo)",
  walks via formatMinutes or "—" when null, bedBath "4 bd / 4 ba", sqft "1,500 sq ft" or "—",
  leaseTerm "12-month" / "Academic year" / "Semester" / "Other", leaseType "Individual" / "Joint",
  yes/no rows "Yes" / "No" (parking: "Yes, $75/mo" / "Yes, free" / "No"), looks "72".
  `statusLabel`: one label + detail for each ApplicationStatus (e.g. under_review: "Under review",
  "The landlord is reviewing your application.").
  `LEASE_CHECKLIST`: 10-14 plain-language items (see the comment in applications.ts).
  `isEmail`: one "@", non-empty local part, domain with a dot, no spaces.

---

## Phase 3: json-store
- **Goal:** `createJsonRepository` implements every `Repository` method per the contract comments,
  persists to a JSON file safely, and passes a reusable conformance suite.
- **Owns:** `packages/db/src/json/**`, `packages/db/test/conformance/**`, `packages/db/test/json.test.ts`,
  `packages/db/scripts/reset-json.ts`.
- **Depends on:** Phase 0. Tests use `loadFixture()`. The store may call only these core functions,
  which the contract already implements: `isStudentEmail`, `isEmail`, `canTransition`, `transitionActor`,
  plus the constants `DEFAULT_WEIGHTS`, `MAX_BATCH_SIZE`. Everything else in core is Phase 2's.
- **Manager model:** sonnet.
- **Acceptance:**
  - `npx vitest run packages/db` -> all pass (>= 60 tests).
  - `npx tsc -p tsconfig.json --noEmit` -> no errors.
  - Persistence test: create store on a temp file, write, create a second store on the same file,
    read back equal data.

### Design
- `test/conformance/index.ts` exports `runRepositoryConformance(name, makeRepo: () => Promise<Repository>)`:
  a vitest `describe` block covering every method and every rule in the contract comments (not-found
  returns null/[], RepoError codes, idempotency, swipe -> save/shortlist side effects, group leader
  promotion and deletion, 8-member cap, review one-per-user + pending default, batch max 3 and ranks,
  status transitions via canTransition with statusHistory/submittedAt/decidedAt, invite tokens unique
  and unguessable (>= 128 bits, base64url), encryption at rest (raw file must not contain a sensitive
  string), document purge, confirmAvailability updates both lastVerified fields, returned objects are
  copies). The Supabase phase reuses this suite unchanged, so it must not reach into JSON internals;
  JSON-only checks go in `test/json.test.ts`.
- One in-memory state object `{ schemaVersion: 1, catalog: SeedData (minus meta), users, schedules,
  saves, swipes, groups, groupMembers, shortlist, votes, alerts, alertEvents, reviews, photoRatings,
  profiles (sensitive stored as an encrypted envelope string), applications, applicationMembers,
  documents (metadata), documentBlobs (id -> envelope) }`.
- Load: file missing -> seed from `opts.seed ?? loadSeed()` and write. File present -> read it.
- Writes: serialised through a promise queue; write to `<file>.tmp` then rename. Before each
  operation, if the file's mtime is newer than the last load, reload (Next dev may run several workers).
- `scripts/reset-json.ts`: delete the db file under `dataDir()` so the next start reseeds.
- Copies: `structuredClone` on the way out.

---

## Phase 4: supabase
- **Goal:** the Supabase schema (Postgres + PostGIS + RLS) matches the domain, a seed script loads the
  catalog, and `createSupabaseRepository` / `createSupabaseAuth` pass the Phase 3 conformance suite
  against a local Supabase stack.
- **Owns:** `supabase/**` (repo root: `config.toml`, `migrations/*.sql`, `README.md`),
  `packages/db/src/supabase/**`, `packages/db/scripts/supabase-seed.ts`, `packages/db/test/supabase.test.ts`,
  `apps/web/src/app/auth/callback/route.ts`.
- **Depends on:** Phase 2, Phase 3.
- **Manager model:** sonnet.
- **Acceptance:**
  - `npx tsc -p tsconfig.json --noEmit` -> no errors.
  - `npx vitest run packages/db` -> JSON suites pass; the Supabase suite runs when `SUPABASE_TEST_URL`
    and `SUPABASE_TEST_SERVICE_ROLE_KEY` are set and is skipped (not failed) otherwise.
  - With Docker running: `npx supabase start` then the Supabase suite with the local URL/key -> all pass.
    If the local stack cannot start on this machine, report the exact error and instead validate the
    migrations against `postgis/postgis` in Docker with `psql -v ON_ERROR_STOP=1`.

### Design
- One migration per area: `0001_extensions.sql` (postgis, pgcrypto), `0002_catalog.sql` (landlords,
  properties with `location geography(Point,4326)`, floor_plans, photos, photo_ratings, buildings,
  landmarks, majors, major_buildings, sections, walk_times, accessibility), `0003_users.sql` (users
  linked to auth.users by email, user_schedules, saves, swipes), `0004_groups.sql`, `0005_alerts_reviews.sql`,
  `0006_applications.sql` (applicant_profiles with `sensitive_ciphertext text`, applications,
  application_members, application_documents + a private storage bucket `application-docs`),
  `0007_rls.sql` (RLS on every table: catalog readable by all; user rows readable/writable by owner via
  `auth.email()`; group rows by members; applications by leader/members; sensitive columns never
  selectable by other members; landlords see applications to their properties). The server uses the
  service role and enforces rules in the adapter too (defense in depth). GIST index on locations;
  indexes on every foreign key.
- Column names snake_case; the adapter maps to the camelCase domain types in one `mappers.ts`.
- Encryption: reuse `encryptJson` / `encryptBytes` from `src/crypto.ts` (application-level, same as JSON).
- `createSupabaseAuth`: `startSignIn` validates the domain rule first, then `signInWithOtp({ email,
  options: { emailRedirectTo: redirectTo, shouldCreateUser: true } })`; `completeSignIn({ code })`
  -> `exchangeCodeForSession`, then find-or-create the Homed user by email (role from user metadata,
  default student). `auth/callback/route.ts`: reads `code`, calls `getAuth().completeSignIn`, then
  `startSession(user.id)` and redirects to `next` or `/search`; on failure redirect `/signin?error=...`.
- `scripts/supabase-seed.ts`: upsert `loadSeed()` through the service role.

---

## Phase 5: web-search
- **Goal:** a student can sign in, set preferences and classes, and search, rank, inspect, swipe,
  compare, save and get alerts on listings in a polished, responsive, accessible web app.
- **Owns (apps/web/src):** `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/(search)/**` or
  these route folders: `app/search/**`, `app/listings/**`, `app/match/**`, `app/compare/**`,
  `app/classes/**`, `app/saved/**`, `app/alerts/**`, `app/signin/**`, `app/signout/**`, `app/settings/**`,
  `app/about/**`, `app/not-found.tsx`, `app/error.tsx`; `components/ui/**`, `components/search/**`,
  `components/listing/**`, `components/match/**`, `components/compare/**`, `components/classes/**`,
  `components/alerts/**`; `lib/search/**`, `lib/format.ts`, `lib/ranking.ts`; `apps/web/test/search/**`.
- **Depends on:** Phase 2, Phase 3 (Phase 1 data may land mid-phase; code must work with the fixture).
- **Manager model:** opus (largest UI phase; sets the UI patterns later phases reuse).
- **Acceptance:**
  - `npm run typecheck -w @homed/web` and `npm run build` -> succeed.
  - `npx vitest run apps/web/test/search` -> pass.
  - Smoke script `apps/web/test/search/smoke.sh` (owned): starts `next start` on port 3011 with a temp
    `HOMED_DATA_DIR`, signs in as `demo@virginia.edu` via the sign-in form action (or a POST), and
    checks `/`, `/search`, `/listings/<first fp id>`, `/classes`, `/match`, `/compare?ids=a,b`,
    `/saved`, `/alerts`, `/settings`, `/about` return 200 and contain a marker text; prints PASS.

### Features (each a task or two)
1. `lib/ranking.ts`: `rankForUser(user | null, opts?: { filters?, groupContext? }) => Promise<RankedListing[]>`
   builds a ScoringContext from the user's weights, budget, schedule (via weeklyMeetings), extras,
   walk lookup (index walk times by `${propertyId}:${targetId}`), neighborhood medians, `today()`.
   Signed-out: default weights, no budget, no meetings. Exposes `buildWalkLookup` and
   `scoringContextFor(user)` for reuse by Phase 6 / Phase 9. Filters arrive as URL search params:
   `lib/search/params.ts` parses/serialises ListingFilters <-> URLSearchParams (round-trip tested).
2. Sign-in (`/signin`): email + optional name, student/landlord toggle, server action ->
   `getAuth().startSignIn` -> `startSession` -> redirect `next` (landlords -> /landlord). Local mode shows
   "Demo sign-in: no email is sent." Supabase mode shows "Check your email". `/signout` ends session.
3. Settings (`/settings`): name, class year, school, major, max budget, weights (three presets + three
   linked sliders that keep the sum at 100%), extras (landmark checkboxes). Server actions, `updateUser`.
4. Search (`/search`): split view, list left / Leaflet map right (stacked on mobile with a Map/List
   toggle); OSM tiles `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with attribution; markers for
   properties (best score per property), on-Grounds styled distinctly, popups link to listings.
   Cards: photo or placeholder, name, floor plan, all-in $/person, Best Match score ring, the why line,
   badges, "Verified N days ago" (stale dimmed), save toggle, `<AddToGroupButton>`. Sort: Best Match
   (default), price, walk. Filter drawer with every ListingFilters field, grouped (Budget & size, Lease,
   Unit, Building, Getting around, Accessibility, Grad), active count, clear. Weight presets inline.
   "Alert me about new matches" saves a search alert. Empty state explains the filter that removed the
   most listings (use passesFilters reasons).
5. Listing page (`/listings/[floorPlanId]`): gallery (renderings badge, credit lines), students can
   rate real photos 1-5 (ratePhoto), facts (beds, baths, bed:bath, sqft, lease dates + term + type,
   furnished, utilities, laundry, AC, dishwasher, parking), True cost per person table (rent, utilities,
   internet, parking toggle, furniture, total monthly, total lease, the note), 12-month vs academic-year
   explanation, Best Match breakdown (three sub-scores with weights), walk times to your classes
   (per building) and to landmarks (Corner, Lawn, Clemons, Newcomb, AFC, grocery), bus note, other floor
   plans in the building, accessibility section (features with photo-confirmed marks, accommodation
   contact/process, assistance-animal policy, the badge and what's missing; on-Grounds: link to UVA
   SDAC housing accommodations page https://studenthealth.virginia.edu/sdac-housing-accommodations and
   the note that requests are yearly and approval doesn't guarantee a spot), on-Grounds info box with
   HRL link and dates, data source + verifiedLabel, "Watch this building" (property alert),
   `<ApplyButton floorPlanId>`, `<AddToGroupButton floorPlanId>`, `<ReviewsSection propertyId>`.
   Unknown id -> notFound().
6. My Classes (`/classes`): mode toggle. Major mode: pick major (grouped by school). Schedule mode:
   add rows (course number, days checkboxes, start/end, building picker with search). Shows "Your week:
   2 h 10 min walking" for the top saved place and the best-ranked place; save -> `saveSchedule`.
7. Match (`/match`): one card at a time in Best Match order (matchQueue), big photo, why line, cost,
   walk; swipe with pointer drag, buttons, and keyboard (Left/Right); right -> recordSwipe (adds a save);
   undo last; empty queue state.
8. Compare (`/compare?ids=fp1,fp2[,fp3,fp4]`): columns from buildCompareTable, best cells highlighted,
   photos on top; picker from saved items when ids are missing; 1 or >4 ids -> explain.
9. Saved (`/saved`): list with notes (edit), remove, select 2-4 -> Compare, "Swipe these" link.
10. Alerts (`/alerts`): feed of AlertEvents (mark read), list/delete alerts, unread count in the nav
    is NOT required (nav is contract).
11. Landing (`/`): value prop, three steps, "Start searching", stats from the catalog (how many places,
    how many still have units, median all-in cost) as the "is waiting safe" signal from Plan.md.
12. About (`/about`): data provenance (seed meta notes), last-verified policy (14 days), "paid placement
    never changes the score", OSM attribution, no protected-class filters, Student Legal Services link.
13. Polish: loading and error states, focus styles, keyboard support, color contrast, mobile layout.

---

## Phase 6: groups
- **Goal:** students form a group by invite link, share a shortlist, vote, set per-person budgets,
  and see group-ranked results using everyone's schedules, plus group Match mode.
- **Owns:** `apps/web/src/app/groups/**`, `apps/web/src/components/groups/**` (replace the
  `add-to-group-button.tsx` stub, same props), `apps/web/src/lib/groups/**`, `apps/web/test/groups/**`.
- **Depends on:** Phase 5.
- **Manager model:** sonnet.
- **Acceptance:** typecheck + build succeed; `npx vitest run apps/web/test/groups` passes; a smoke script
  `apps/web/test/groups/smoke.sh` signs in two users, creates a group, joins by code, both swipe right
  on the same listing, and checks the match appears on `/groups/<id>`; prints PASS.

### Features
1. `/groups`: my groups, create group. `/groups/join/[code]`: preview + join (signed-out -> sign in, then back).
2. `/groups/[id]`: members (leader badge, each member edits only their own budget), invite link with
   copy button, shortlist with notes, yes/no votes per member, tally (tallyVotes) and unanimous marker,
   members over budget per item (membersOverBudget), merged commute per item (mergeCommutes from each
   member's commuteFor), matches (groupMatches), leave group.
3. `lib/groups/context.ts`: group ScoringContext: weights = leader's, budget = groupBudget(members),
   location = merged commute (pass a custom location input via weeklyMeetings of all members? No:
   compute each member's meetings, score location from the mergeCommutes average); groupSize filter
   defaults to member count. `/groups/[id]/browse`: ranked list with group context and a group-size note.
4. `/groups/[id]/match`: group Match mode (recordSwipe with groupId); a match banner when the last
   member swipes right.
5. `AddToGroupButton`: dropdown of the user's groups -> addToShortlist; signed-out or no groups ->
   link to /groups.
6. Privacy: non-members get notFound(); budgets visible to members only as "over budget" flags,
   not the numbers, except your own.

---

## Phase 7: apply
- **Goal:** a student fills one reusable profile and applies alone or with roommates and guarantors
  to up to 3 places at once, sees every fee first, tracks status, and gets the lease checklist before
  signing.
- **Owns:** `apps/web/src/app/applications/**`, `apps/web/src/app/apply/**`, `apps/web/src/app/profile/**`,
  `apps/web/src/components/apply/**` (replace `apply-button.tsx` stub, same props), `apps/web/src/lib/apply/**`,
  `apps/web/test/apply/**`.
- **Depends on:** Phase 5.
- **Manager model:** sonnet.
- **Acceptance:** typecheck + build; `npx vitest run apps/web/test/apply`; smoke script
  `apps/web/test/apply/smoke.sh`: leader creates a profile, starts a 2-place batch with one roommate
  and one guarantor, both invitees complete via their invite links, leader submits, the tracker shows
  "Submitted"; prints PASS.

### Features
1. `/profile/applicant`: the "Common App for housing" form: legal name, phone, current address,
   student status, expected graduation; sensitive section (income source and amount, guarantor,
   rental history rows, references, date of birth) with a note that it is encrypted and never shown
   to roommates. No SSN field anywhere (screening partner collects it later).
2. `ApplyButton`: "Apply" -> `/apply/new?fp=<id>`; signed-out -> sign-in; landlords hidden.
3. `/apply/new`: batch builder: up to 3 places ranked (prefilled from `fp`, add from saved, reorder);
   solo or group (pick a group: roommates prefilled from members' emails; add guarantors per person);
   fee summary per place and batch total (quoteFees, batchTotal) with VA compliance warnings shown
   to the student; the "applying is not signing" line; "Fees are paid to the landlord directly for now."
   Create -> createApplicationBatch -> `/applications/batch/[batchId]`.
4. `/applications`: all my applications grouped by batch with status chips.
5. `/applications/batch/[batchId]` + `/applications/[id]`: tracker (TRACKER_STEPS, statusHistory),
   members as done / not done (memberStatusViews) with the leader seeing who is holding things up and
   copyable invite links; leader marks their own part done by attaching their profile; Submit (all
   members done) -> submitted for every application in the batch; Withdraw; when one is approved, a
   prompt listing withdrawSuggestions; lease_sent -> lease checklist (LEASE_CHECKLIST, all ticked) +
   Student Legal Services nudge -> "I signed the lease" -> signed. Link "Download PDF for landlords not
   on Homed" -> `/api/applications/<id>/pdf` (built in Phase 8).
6. `/apply/invite/[token]`: roommate: sign in with @virginia.edu, profile check, mark done; guarantor:
   no account; name, relationship, typed full-name signature + consent checkbox -> done. Invalid token ->
   notFound().
7. Documents: upload on the applicant profile (pdf/png/jpg, <= 5 MB) -> putDocument with deleteAfter
   today + 90 days; list; the page states files are encrypted and deleted after the decision.

---

## Phase 8: landlord + reviews
- **Goal:** landlords self-list and keep availability fresh, receive and decide applications (or as a
  PDF), and students leave verified, moderated reviews with landlord replies.
- **Owns:** `apps/web/src/app/landlord/**`, `apps/web/src/app/admin/**`,
  `apps/web/src/app/api/applications/**`, `apps/web/src/components/landlord/**`,
  `apps/web/src/components/reviews/**` (replace the stub, same props), `apps/web/src/lib/landlord/**`,
  `apps/web/src/lib/reviews/**`, `apps/web/test/landlord/**`.
- **Depends on:** Phase 5.
- **Manager model:** sonnet.
- **Acceptance:** typecheck + build; `npx vitest run apps/web/test/landlord`; smoke script
  `apps/web/test/landlord/smoke.sh`: a landlord signs up, lists a property with one floor plan, confirms
  availability, a student with an alert on that search sees a new_listing event in /alerts, the student
  posts a review, an admin (HOMED_ADMIN_EMAILS) publishes it, the landlord replies, the reply shows on
  the listing page; prints PASS.

### Features
1. `/landlord`: onboarding (createLandlord linked to the user), dashboard: properties, floor plans
   with "Confirm availability" (weekly; shows verifiedLabel; stale in red), applications inbox count.
2. Property editor: all Property fields a landlord knows (address -> lat/lng via a map click picker, no
   geocoding key), amenities, bus routes, policies; floor plan editor (all FloorPlan fields; fees with
   live VA-cap warning); photos by URL with the "this is a rendering" checkbox; accessibility checklist
   + accommodation contact/process + assistance-animal policy (the form explains landlords are legally
   required to consider reasonable accommodations).
3. `lib/landlord/catalog-change.ts`: wraps every catalog write: listListings before, write, listListings
   after, diffForAlerts with listAllAlerts, addAlertEvents. Unit-tested with the JSON store.
4. Applications inbox `/landlord/applications` + detail: applicant profiles for each member (sensitive
   data visible to the landlord they applied to), documents download, status actions allowed by
   transitionActor('landlord'), status history. Landlords only see applications to their properties.
5. `/api/applications/[id]/pdf`: pdf-lib application packet (property, floor plan, members, profiles,
   fees, statement that Homed never stores credit reports); allowed for the leader and the landlord of
   that property; others 404.
6. Reviews: `ReviewsSection` shows published reviews (average ratings per dimension, noise tag,
   accommodation rating when present), landlord replies, a form for signed-in students (one per
   property; "pending moderation" after posting). Landlord reply form in the dashboard. `/admin/reviews`
   moderation queue (publish / reject) for admins.
7. Self-listed properties show "Listed by landlord · not yet verified" until verified.

---

## Phase 9: mobile
- **Goal:** an Expo app shows the student's ranked list, listing detail, swipe Match mode and saves,
  backed by a small JSON API on the web app.
- **Owns:** `apps/mobile/**`, `apps/web/src/app/api/mobile/**`, `apps/web/test/mobile/**`.
- **Depends on:** Phase 5. The lead installs Expo dependencies before this phase starts.
- **Manager model:** sonnet.
- **Acceptance:** `npx tsc --noEmit` in apps/mobile; `npx expo export --platform web` in apps/mobile
  succeeds; `npx vitest run apps/web/test/mobile` passes (route handlers called directly with a test
  store).

### Features
1. API: `POST /api/mobile/session` {email, name?} -> local sign-in -> `{ token, user }` (token =
   createSessionToken); supabase mode -> 501 with a message. `GET /api/mobile/listings` -> ranked
   (rankForUser) trimmed DTOs; `GET /api/mobile/listings/[id]`; `POST /api/mobile/swipes`;
   `GET/POST/DELETE /api/mobile/saves`; `GET /api/mobile/alerts`. Bearer auth via getCurrentUser.
2. App (expo-router): sign-in, ranked list with why lines and badges, listing detail with cost and
   walk times, Match swipe deck (gesture + buttons), saved list; API base URL from `EXPO_PUBLIC_API_URL`.
3. README: how to run on a phone with Expo Go on the same Wi-Fi.

---

## Phase 10: integration (lead)
1. Merge order: P1, P2, P3 -> P4, P5 -> P6, P7, P8, P9. Full suite + build after each merge.
2. Playwright e2e for the core journeys (sign in -> classes -> search -> listing -> save -> compare;
   group invite -> group match; apply batch; landlord availability -> alert).
3. Review swarm on the full diff (correctness, security, architecture, concurrency) + verifier.
4. Root README: what it is, run it, env vars, data provenance, what needs keys (Supabase, email,
   Mapbox optional, push), open questions from Plan.md.
5. Hand back: push branch + PR to main only with the owner's OK.

---

## Notes for wave 3 (lead, after Phase 5 merged)
- Reuse Phase 5's kit: `components/ui/index.ts` (Button, Card, Badge, ScoreRing, Field, Select, Slider,
  Sheet, EmptyState, Tabs...), `components/listing/listing-card.tsx`, `lib/format.ts`, and
  `lib/ranking.ts` (`rankForUser(user, { filters?, groupContext? })` where groupContext =
  `{ weights?, budgetMax?, meetings?, extras? }` overrides the user's values; `scoringContextFor`,
  `buildWalkLookup`, `getRankedListing`). Server actions return `ActionResult` (see `lib/search/actions.ts`).
  Import these; never edit them (Phase 5 owns them). Need a change? Report blocked.
- Do NOT add `loading.tsx` to routes that call `requireUser` or `notFound()`: a loading boundary
  streams HTTP 200 before the redirect / 404 happens.
- Sign-out and other state-changing actions use POST forms, never prefetched `<Link>`s.
- `apps/web/test/search/smoke.sh` is the pattern for smoke scripts (temp HOMED_DATA_DIR, `next start`
  on a free port, cookie sign-in, curl markers, PASS, port cleanup). Use ports 3013 (groups),
  3014 (apply), 3015 (landlord), 3016 (mobile API) so phases can run smoke tests side by side.
  Build once per smoke run into a separate `distDir` is NOT needed: each worktree has its own .next.
- Real seed data (56 properties) is merged. Nav links to /groups and /applications 404 until merged.
- Mobile: `apps/mobile` exists as a minimal Expo SDK 58 + expo-router skeleton (React 19.3.0, single
  copy via root `overrides`). `npx expo export --platform web` and `npx tsc --noEmit` pass there.
  Installed: expo, expo-router, expo-constants, expo-linking, expo-secure-store, expo-status-bar,
  react-native 0.88, react-native-web, react-native-safe-area-context, react-native-screens.
  No gesture-handler/reanimated: build swipe with RN `Animated` + `PanResponder`.
