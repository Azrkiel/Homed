# Homed mobile

Expo app (React Native, expo-router) for UVA students. It talks to the Homed web app's
JSON API under `/api/mobile`. It has no database or business logic of its own: scoring,
costs and the match queue come from the server.

## Run the web app (API server)

The API lives in `apps/web` (Next.js, port 3010). Run it first.

```bash
# from the repo root: web app only
npm run dev            # next dev --port 3010 (runs @homed/web)

# from apps/web: listen on the LAN so a phone can reach it
cd apps/web
npm run dev -- --hostname 0.0.0.0
```

Open http://localhost:3010 to confirm it is up. No API keys are needed. Data is a JSON store
under `apps/web/.data`.

## Run the app on a phone (Expo Go)

1. Phone and computer on the same Wi-Fi.
2. Find the computer's LAN IP: `ipconfig` on Windows (IPv4 address of the Wi-Fi adapter).
3. Allow Node through the Windows firewall on private networks (the first run prompts for it).
4. Start the app with the API URL pointed at the LAN IP:

```bash
cd apps/mobile
EXPO_PUBLIC_API_URL=http://<LAN IP>:3010 npx expo start
```

In PowerShell: `$env:EXPO_PUBLIC_API_URL="http://<LAN IP>:3010"; npx expo start`.

5. Scan the QR code with Expo Go. Keep the web app running.

`EXPO_PUBLIC_API_URL` is read at bundle time. Restart Expo after changing it.

## Web preview (browser)

```bash
cd apps/mobile
npx expo start --web
```

The API defaults to `http://localhost:3010` (see `src/config.ts`). CORS for `localhost` and
private LAN addresses is automatic in `/api/mobile` routes. For any other origin, add it to
`HOMED_MOBILE_ORIGINS` on the web app (comma-separated, for example in `apps/web/.env.local`).

## Sign in

Sign-in is local dev mode: enter a `@virginia.edu` email (name optional). There is no password.
Other domains are rejected. With Supabase auth (`HOMED_BACKEND=supabase`) the API returns 501
and sign-in does not work in the app yet.

## Screens

Tabs, in order:

- **Ranked**: listings sorted by Best Match score. Pull to refresh. Reloads when the tab gets focus.
- **Match**: swipe deck of listings you have not decided on. Swipe right to save, left to pass,
  tap to open details. The Pass, Details and Save buttons do the same without a gesture. Each
  decision is sent in the background; a failed send puts the card back on top with an error
  banner.
- **Saved**: your shortlist. Remove items here. Reloads when the tab gets focus.
- **Alerts**: alert events, newest first. Sign out is in this tab's header.

Also: **Sign in** (shown when signed out) and **Listing** (detail, opened from any tab; save toggle,
cost breakdown, commute, lease, amenities).

## API endpoints

All routes are under `/api/mobile`. Except `session`, they need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/session` | Sign in with `{ email, name? }`. Returns `{ token, user }`. |
| GET | `/listings` | Ranked listings. Optional `limit` (1-200). |
| GET | `/listings?queue=match` | Listings the user has not swiped yet, in Match order. |
| GET | `/listings/[id]` | Listing detail. |
| POST | `/swipes` | `{ floorPlanId, direction: 'right' \| 'left' }`. Right also saves. |
| GET | `/saves` | Saved listings (`listing` is null when taken down). |
| POST | `/saves` | `{ floorPlanId, note? }`. |
| DELETE | `/saves?floorPlanId=...` | Remove a save. |
| GET | `/alerts` | Alert events. |

Every route answers `OPTIONS` for CORS preflight. Errors are JSON `{ error: string }`.

## Limitations

- Session token is stored in expo-secure-store on iOS and Android. On web it is kept in memory,
  so a page reload signs you out.
- No push notifications. Alerts appear only when you open the Alerts tab.
- No offline mode. Lists and actions need the API to be reachable.
- Sign-in is dev-only (no password, no email verification).
- Supabase auth is not supported by the mobile sign-in yet (501).
- Phone testing needs the API on the LAN and the firewall open. A VPN or guest Wi-Fi may block it.

## Scripts

| Command | What it does |
| --- | --- |
| `npx expo start` | Dev server and QR code. |
| `npx expo start --web` | Browser preview. |
| `npx expo export --platform web` | Static web build into `dist/`. |
| `npx tsc --noEmit` | Typecheck. |
