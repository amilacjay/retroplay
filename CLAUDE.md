# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Retro Play (internal package name "Cassete", Phase 1): a personal, noncommercial pilot that controls a Spotify Premium browser player via the official Web Playback SDK, styled as a retro cassette deck / vinyl turntable. `spec.md` is the original Phase 1 requirements document; `README.md` covers Spotify app setup and troubleshooting.

npm workspaces monorepo: `apps/api` (NestJS 11, `@cassete/api`) and `apps/web` (React 19 + Vite 6, `@cassete/web`). Persistence is Postgres via `pg` (local dev: `docker compose -f docker-compose.dev.yml up -d`). Production is `docker-compose.yml` (Caddy + API + Postgres), deployed by `.github/workflows/ci-cd.yml`; see README "Deployment".

## Commands

Run from the repo root:

```sh
npm install
npm run dev        # API on 127.0.0.1:3000 + Vite on 127.0.0.1:5173 (concurrently)
npm run dev:api    # API only (nest start --watch)
npm run dev:web    # web only
npm run build      # nest build, then tsc -b && vite build
npm test           # API jest, then web vitest
```

Single tests:

```sh
npm --workspace @cassete/api run test -- src/spotify.service.spec.ts -t "OAuth state"
npm --workspace @cassete/web run test -- src/App.spec.tsx -t "normalizes"
```

There is no linter or formatter configured. API specs and `src/test/` helpers are excluded from `tsc` (`apps/api/tsconfig.json`) and run through ts-jest; `src/test/helpers.ts` `testApp()` builds a `Database` on pg-mem (in-memory Postgres) with a signed-in (optionally Spotify-connected) user. pg-mem rejects some DDL (e.g. `IF NOT EXISTS` on an existing table), which is one reason migrations are versioned; web tests use vitest with jsdom (configured in `vite.config.ts`, setup in `src/test-setup.ts`).

## Configuration

`.env` lives at the repo root; `apps/api/src/main.ts` loads it from either `./.env` or `../../.env` depending on cwd. Variables: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` (must exactly match the Spotify dashboard, `http://127.0.0.1:3000/auth/callback`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (`http://127.0.0.1:3000/auth/google/callback`), `APP_SECRET` (≥ 32 chars; encrypts stored Spotify tokens; both providers report unconfigured without it), `DATABASE_URL` (Postgres), `API_HOST` (default `127.0.0.1`; containers use `0.0.0.0`), `API_PORT`, `WEB_ORIGIN`, `NODE_ENV` (`production` enables secure cookies). `.env.example` holds placeholders. Never read out or print `.env` values.

## Architecture

**Request flow:** the browser only talks to Vite; `vite.config.ts` proxies `/api` and `/auth` to the API. OAuth redirects go to the API port directly, and the API redirects back to `WEB_ORIGIN` plus a `returnTo` path (`safeReturnTo` in `http.ts` allows only `/` and `/s/:id`, so it can't be an open redirect), with `?authError=<code>` on failure. Codes: Spotify `denied|state|callback|exchange|signin`, Google `google_denied|google_state|google_exchange|google_unverified`. The web app maps them to messages and strips them from the URL.

**Identity model:** signing in to Retro Play (Google) and connecting Spotify are separate steps. `authenticated` in `api/session` means a Retro Play session; `spotify.connected` says whether the profile has a Spotify link. The web player only starts when both are true.

**API (`apps/api/src`):**
- `database.ts`: the async `Database` class (provided via an async factory in `app.module.ts` that runs `migrate()`) owns the schema and all queries. Schema changes go in a new entry appended to `MIGRATIONS`; never edit a shipped one. BIGINT columns come back as strings and are converted with `Number()`. Tables: `users` (Google `sub`, name, editable `display_name`, `preferences` JSON, `now_playing` JSON), `sessions` (keyed by sha256 of the cookie id, with the CSRF token), `spotify_links` (tokens sealed with AES-256-GCM via `crypto.ts`), `shares` (one per user + playlist, with a playlist snapshot). Deleting a user cascades.
- `session.service.ts`: `cassete.sid` cookie (30 days) → `AuthContext { user, csrf }`. `require(req, csrf)` is the guard for every data or mutating route (401 signed out, 403 bad CSRF).
- `google.service.ts`: OIDC authorization-code flow with PKCE S256, nonce, and `OAuthAttempts` state (single use, 10 min, in memory, plus a `cassete.oauth.google` double-submit cookie). `readIdToken` validates iss/aud/exp/nonce/`email_verified`; no signature check because the token comes straight from Google's token endpoint. Google tokens are never stored.
- `spotify.service.ts`: Spotify linking per user (attempt bound to the user id who started it; callback refuses a different session), `accessToken(userId)` refreshes under 60 s from expiry with one in-flight refresh per user, deletes the link only when Spotify rejects the refresh (400/401), and `request(userId, path)` is the single Web API entry point (a dead or missing link becomes a 401).
- Controllers:
  - `auth.controller.ts`: `auth/google/login`, `auth/google/callback`, `api/session` (profile view: user, spotify status, preferences, nowPlaying, never tokens), `api/logout`.
  - `spotify.controller.ts`: `auth/login` + `auth/callback` (Spotify linking; signed-out visitors are redirected with `authError=signin`), `api/token`, `api/spotify/disconnect`, `api/playlists/search|mine|:id|:id/items`, `api/play` (accepts `position_ms` for resume), `api/player/shuffle|repeat`. `api/playlists/mine` must stay declared before `api/playlists/:id`. `upstreamError()` keeps a specific status (401/403/404/429) only when a message explains it, otherwise 502.
  - `profile.controller.ts`: `PATCH api/profile` (display name), `PUT api/profile/preferences`, `PUT api/profile/now-playing` (`{}` clears), `DELETE api/profile`.
  - `shares.controller.ts`: `POST api/shares` (422 unless Spotify says `public: true`), `GET api/shares` (mine), `GET api/shares/:id` (public, no session needed; re-checks publicity as the owner, or the viewer if the owner disconnected, at most every 5 min; 410 if no longer public), `DELETE api/shares/:id` (owner only).
- `validation.ts`: everything the browser sends to the profile is re-validated there (`cleanPreferences` whitelists keys, `cleanNowPlaying`, `cleanPlaylist`, https-only images).
- Security model: httpOnly session cookie plus a per-session CSRF token sent as `X-Cassete-CSRF`. The client secrets and refresh tokens never leave the server; `api/token` hands the SDK only a short-lived access token. Spotify scopes are deliberately minimal (`streaming`, `user-modify-playback-state`, `playlist-read-private`) and a spec asserts them; Google scopes are `openid email profile`.

**Web (`apps/web/src`):**
- `spotify-sdk.ts`: SDK type declarations plus a singleton script loader for `https://sdk.scdn.co/spotify-player.js` (15 s timeout, retry allowed after a failure).
- `useSpotifyPlayer.ts`: owns the `Spotify.Player` lifecycle. It creates the player when `authenticated` becomes true, subscribes to all documented SDK events, maps them to `status` (`disconnected | connecting | ready | error`) and error messages, and removes listeners and disconnects on cleanup (this keeps it safe under React StrictMode double effects). `getOAuthToken` fetches `/api/token`. `reconnect()` bumps a generation counter to rebuild the player.
- `App.tsx` orchestrates: session, the open playlist and its tracks, playback commands, volume/mute, sharing, the share invite (`/s/:id` read once on load via `shareIdFromPath`; sign-in and connect links carry `returnTo`), and the phone view (`data-view` on `.workspace`). On connect it reopens the shared playlist, or else the last playing one, and offers a Resume card. It wires in the hooks: `useKeyboardShortcuts`, `useMediaSession` (OS media keys plus the tab title), `useSleepTimer`, `useToasts`, and from `hooks/useProfileSync.ts`: `usePreferenceSync` (on sign-in, saved prefs replace local ones, or local ones are uploaded if none are saved; later changes are PUT after 1 s, keyed on the session CSRF) and `useNowPlayingSync` (saves on track or pause change, every 15 s while playing, and with `keepalive` on tab hide). It re-exports `SessionCard`, `Controls`, and `normalizePlaylist` for the existing specs.
- `components/`:
  - `Library` (left panel): owns search-as-you-type, which aborts stale requests and detects pasted links, plus "Your playlists".
  - `Stage` (center): machine switch, sleeve popover, liner notes, welcome copy for signed-out visitors.
  - `TrackPanel` (right): Tracks and Up next tabs.
  - `PlayerDock`: `Controls`, `VolumeControl`, `SleepTimerMenu`.
  - `Hardware`: the photo decks and the draggable album sleeve.
  - `Chrome`: top bar (Sign in, or the avatar button that opens the profile), toasts, shortcuts dialog.
  - `Landing`: what signed-out visitors see instead of the app (`App` renders `Splash` while the session check runs, which times out after 10 s). It must fit one screen and never scroll at any size. The `.landing` grid scales with viewport height, the art is the largest 3:2 box its cell allows (container units), and short screens drop the feature blurbs, then the features. Check new content at 360×640 and 1280×720 before shipping.
  - `Tour`: the first-visit guided tour (spotlight plus a callout card; the page stays clickable). It starts once Spotify is connected and `retro-play-tour-seen` is unset; the top bar's `?` button replays it. Steps find their targets by existing class names (`.stage-toolbar .segmented`, `.model-button`, `.sleeve-menu`, `.machine-frame`, `.album-cover-preview`, `.library`/`.mobile-nav`, `.player-dock`), so renaming those classes means updating `buildSteps`. A step whose target isn't on screen falls back to the next selector, is skipped if `optional`, or else shows centered.
  - `Profile`: `Avatar` and `ProfileDialog` (display name, Spotify connect/disconnect, last song, share links with copy/remove, sign out, two-step delete).
  - `Stage` also renders onboarding (sign in → connect Spotify), the share invite, and `ResumeCard`; its `authenticated` prop means Spotify is connected, and `account` carries the sign-in state.
- `lib/`: `api.ts` (fetch wrapper that adds the CSRF header and throws `ApiError` with a readable message; session/profile/share types), `format.ts` (durations, playlist-link parsing, open.spotify.com links, `shareIdFromPath`, `timeAgo`), `storage.ts` (`useStoredState`; all keys are prefixed `retro-play-`; still the local cache for preferences), `preferences.ts` (the `Preferences` shape and `readPreferences`, which drops malformed saved values).
- Machine models (`components/machines/`):
  - `skins.tsx` is the registry: three cassette models and three vinyl models, each with a default album-case position and an optional tonearm mapping. Its `Machine` wrapper runs `useMachineMotion`.
  - The chosen model is stored per machine (`retro-play-skins`), and the album-case position per model (`retro-play-cover-positions-v3`).
  - Photo models: `CassetteDeck` and `VinylDeck` live in `Hardware.tsx`; `PocketPhoto`, `BoomboxPhoto`, and `SuitcasePhoto` live in `machines/photo.tsx`. All of them use generated 1536×1024 photos, and every coordinate is a pixel measured from the photo.
  - Derived layers are built by `apps/web/scripts/derive-model-layers.ps1` (Windows PowerShell + System.Drawing):
    - pocket keys cleared
    - boombox knob removed, with the plate rows blended and the ticks restored
    - suitcase arm lifted out: the platter rim is refilled along its ellipse, the deck by rows, and the arm matted against the refilled base
    
    Re-run the script if a source photo changes.
  - Images: PNG sources live in `apps/web/art/` (not shipped). `npm run images` (`scripts/optimize-images.mjs`, sharp) writes same-size WebP files to `public/assets/` (about 35 MB of PNG becomes about 3 MB). Every image URL comes from `machines/assets.ts` (`IMAGES`, `COVER_FRAME`); `modelAssets(id, machine)` lists what a model paints, so add new images there.
  - Loading: `Stage` gates the model and its album case on `useImagePreload` (`lib/preload.ts`), which downloads each image once with byte progress, decodes it, then reveals everything together. If that takes over 180 ms, a "Setting up the …" panel shows. Once a model is ready, `prefetchImages` warms the other models one at a time when the browser is idle (skipped with Save-Data), so switching is instant. Use `decodeImage` (it falls back to the load event) instead of calling `img.decode()` directly, because jsdom has no `decode()`.
  - Cassette reels on photos (`PhotoReelOverlay`): an empty-interior layer, then a drawn tape pack scaled from `--pack-*`, then the photo's own hub turning on top.
  - The suitcase tonearm swings in the deck plane. `toDeck` stretches y by 1/k, where k is the platter ellipse's minor/major ratio. `suitcaseArmVars` publishes `--tube-turn`, `--tube-stretch`, `--head-x`, and `--head-y` (via the engine's `armVars` option):
    - The tube is a drawn chrome cylinder, because rotating the photo's tube aliases.
    - The headshell is a clipped photo sprite that follows the joint rigidly.
  - `DjDeck` is still inline SVG (1536×1024 viewBox) built from `parts.tsx`, with `Hit` and `Dial` controls from `controls.tsx`. Its SVG ids are prefixed `dj-`; `Textures` already defines `dj-brush`, `-grain`, `-foam`, `-weave`, `-soft`, `-blur2`, and `-shadow`.
- Motion (`machines/motion.ts`):
  - `useMachineMotion` writes CSS variables on the wrapper every animation frame: `--reel-l` / `--reel-r`, `--pack-l` / `--pack-r`, `--platter`, `--arm`, `--cue`. It never re-renders React.
  - Cassette reels use real transport physics (47.6 mm/s, ω = v / r). Seeks fast-wind the tape.
  - The platter has spin-up and coast-down inertia. `topDownArm` turns track progress into a tonearm angle using the law of cosines.
  - All of this is driven by playback position, never the audio signal; the spec forbids audio-synchronised visuals.
  - When styling a rotating SVG part, set `transform-box: fill-box`, or give an explicit `transform-origin` in viewBox px.
- Photo controls (`PhotoKey` in `Hardware.tsx`): each key or knob is a cut-out of the photo's own pixels, positioned by a measured `[left, top, width, height]` box in % of the image. At rest it's invisible.
  - Piano keys sink into a dark slot. Push buttons shade in rather than shrink, because a smaller patch would reveal the photo's own edge as a ghost.
  - Latching: Play stays down while playing; Pause and Play stay down while paused (`paused` on `MachineControlProps`); the turntable start button stays in while it spins.
  - On the turntable, cut-outs must come from whichever photo is showing (resting or playing), since they differ around the cue lever.
  - Re-measure the boxes if a photo changes. `docs/model-photos.md` has the image prompts and which models still need photos (the DJ Deck).
- Hardware decks: transparent hitbox buttons and a range input are absolutely positioned (in %) over the photos in `public/assets/`. Those percentages are tuned to the photos, so don't change them casually. `.machine-frame` is sized with container-query units (`min(100cqw, 150cqh)`, 3:2) so the overlays stay aligned at every size. The album sleeve's saved position is a percentage of that frame. The J-card art window uses paper bounds measured from `retro-play-cassette-case.png` (left 14.01%, top 8.07%, 76.55% × 81.67%). In "fit height" the art fills the full card with `object-fit: cover`; dragging the art changes `object-position` (the pan, stored per machine) instead of moving the case.
- Styling: `style.css` is token-based. Light tokens sit on `:root`; dark tokens override them under `:root[data-theme="dark"]`, which `App` sets. Breakpoints:
  - ≤1180px: two columns, with the side panel swapped via `.mobile-nav`
  - ≤760px: one view at a time
- Control buttons respect the SDK's `disallows` flags.

## Constraints from the spec and Spotify policy

- Spotify is the only provider. Don't add a multi-provider abstraction.
- Animations must stay decorative. No beat-synced reels, visualizers, or other audio-synchronized visuals.
- Album art and metadata may come only from authorized Spotify responses or SDK state. Profile and share snapshots store copies of exactly that, nothing else.
- Only public Spotify playlists can be shared, and listening from a share always uses the listener's own signed-in, Spotify-connected account.
- Don't assume that creating a device starts playback, or that a successful OAuth login means the account is Premium. Surface these cases as errors.
- Never log tokens, auth codes, or cookies.
- Live Spotify playback can't be verified without real credentials and a Premium account. Don't claim it works unless it was actually tested.
