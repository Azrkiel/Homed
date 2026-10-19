# Homed Supabase

Postgres 17 + PostGIS + RLS schema for the Supabase store (`packages/db/src/supabase`).
Migrations in `supabase/migrations/` apply in order. PostGIS lives in the `extensions` schema.

## Start

    npx supabase start      # needs Docker; project id `homed`, DB on port 54322
    npx supabase status     # prints the local URL and keys

Migrations are applied on first start. To re-apply, stop and start the stack or run the files in order with psql.

## Env vars

| Variable | Value |
| --- | --- |
| `HOMED_BACKEND` | `supabase` |
| `SUPABASE_URL` | API URL from `supabase status` (default `http://127.0.0.1:54321`) |
| `SUPABASE_ANON_KEY` | anon key (browser-safe, used by magic-link auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (server only, bypasses RLS) |
| `HOMED_ENCRYPTION_KEY` | 32 random bytes, base64 (encrypts profiles and documents) |
| `HOMED_APP_URL` | absolute web app URL, used for the magic-link callback |

## Seed

    npx tsx packages/db/scripts/supabase-seed.ts

Loads the catalog (buildings, landmarks, majors, landlords, properties, floor plans, photos, accessibility, walk times, sections).

## Tests

    SUPABASE_TEST_URL=<url> SUPABASE_TEST_SERVICE_ROLE_KEY=<service key> npm test -w @homed/db

The conformance suite then runs against Supabase as well as the JSON store.

## Table map

| Migration | Tables |
| --- | --- |
| 0002 catalog | landlords, properties (`location` generated from lat/lng), floor_plans, photos, photo_ratings, buildings, landmarks, majors, major_buildings, sections, walk_times, accessibility |
| 0003 users | users, user_schedules, saves, swipes |
| 0004 groups | groups, group_members, shortlist_items, votes |
| 0005 | alerts, alert_events, reviews |
| 0006 applications | applicant_profiles, applications, application_members, application_documents, storage bucket `application-docs` (private) |
| 0007 | RLS on every table, helper functions in schema `private` |

Notes
- Ids are text. Domain camelCase maps to snake_case columns; nested objects and arrays are jsonb or text[].
- Some references have no FK on purpose (swipes, alert_events, applications to floor plans or groups) to match the JSON store, which keeps those rows when a floor plan is deleted.
- Encrypted data (`applicant_profiles.sensitive_ciphertext`, `application_documents.ciphertext`) and `application_members.invite_token` are not selectable by anon or authenticated; only the service role reads them.
- RLS identity: JWT email, lower-cased, matched to `users.email`.

## Magic-link sign-in (token-hash flow)

Sign-in is stateless: the email links to `<HOMED_APP_URL>/auth/callback?token_hash=...&type=email`,
and the callback calls `verifyOtp`. Nothing is held in server memory, so links work after restarts
and on any instance.

- Local stack: `config.toml` already points the `magic_link` and `confirmation` templates at
  `supabase/templates/*.html`.
- Hosted project: in the dashboard (Authentication > Email Templates), set the **Magic Link** and
  **Confirm signup** bodies to the contents of those two files, and add
  `<HOMED_APP_URL>/auth/callback` to the redirect allow list.
