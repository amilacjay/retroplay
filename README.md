# Retro Play · Phase 1

A free, noncommercial personal pilot for controlling a Spotify Premium browser player with the official Spotify Web Playback SDK. The repository started empty except for `spec.md`; this is a small React 19/Vite + NestJS implementation. Accounts use Google sign-in and profiles live in Postgres. Production runs as a Docker Compose stack (Caddy, API, Postgres) deployed by GitHub Actions; see [Deployment](#deployment).

## Prerequisites

- Node.js 22 and npm 10+
- Docker (for the local Postgres in `docker-compose.dev.yml`)
- A Google account and a Google Cloud OAuth client (see below)
- A Spotify Premium account
- A Spotify developer application (see below)

## Spotify application setup

1. Create an application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. In the app settings, add this exact Redirect URI: `http://127.0.0.1:3000/auth/callback`.
3. Copy `.env.example` to `.env` in the repository root.
4. Add the app's Client ID and Client Secret to `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. Keep the secret server side; never put it in frontend variables.
5. Keep `SPOTIFY_REDIRECT_URI` and `WEB_ORIGIN` aligned with the values above. Add your own Spotify account as an allowed user in the dashboard if Spotify's development mode requires it. Everyone who opens a share link and connects Spotify needs to be on that list too while the app is in development mode.

## Google sign-in setup

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen (External, testing is fine; add yourself and your listeners as test users).
2. Create an **OAuth client ID** of type **Web application**.
3. Add this exact authorized redirect URI: `http://127.0.0.1:3000/auth/google/callback`.
4. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and keep `GOOGLE_REDIRECT_URI` equal to the URI above.
5. Set `APP_SECRET` to at least 32 random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`). It encrypts the stored Spotify tokens; changing it means everyone reconnects Spotify.

Retro Play asks Google only for `openid email profile`. It never stores Google tokens: the ID token is checked (audience, issuer, expiry, nonce, verified email) and then discarded. The flow uses PKCE and a single-use state bound to a browser cookie.

## Accounts, profiles, and storage

- **Sign in first, then connect Spotify once.** A visitor signs in with Google; on first sign-in Retro Play creates a profile and asks them to connect Spotify. The Spotify connection is stored on the profile, so later visits go straight to the deck. Disconnecting Spotify (from the profile) keeps the Retro Play account.
- **What the profile stores:** display name (editable; defaults to the Google name), the current song and whether it is playing or paused (with position, saved on track and play/pause changes, every 15 s while playing, and when the tab closes), and the customisation options: day/night theme, cassette or vinyl, the model chosen for each, album-case placement per model, sleeve fit and pan, title printing, volume, and recent playlists. On the next visit the last playlist reopens and a **Resume** card picks the song up at the saved position.
- **Where:** Postgres at `DATABASE_URL`. The schema is created and upgraded by numbered migrations when the API starts (`schema_migrations` records what ran). Sessions are stored by hash, and Spotify access and refresh tokens are encrypted with AES-256-GCM under `APP_SECRET`. Restarting the API no longer signs anyone out.
- **Deleting the account** (from the profile) removes the profile, its Spotify connection, sessions, and share links.

## Sharing playlists

Open a playlist and press **Share** in the track panel. If Spotify reports the playlist as **public**, Retro Play creates (or reuses) a link like `http://127.0.0.1:5173/s/Ab3dE5gH9xYz` and copies it. Private and collaborative playlists are refused.

Anyone can open the link and see what was shared and by whom. To listen they sign in with Google and connect their own Spotify account; the link survives both redirects, and the playlist opens on their deck. Playback always runs on the listener's own account and goes through Spotify's own access checks. The API re-checks with Spotify (at most every five minutes) that the playlist is still public, and pauses the link if it no longer is. Owners can copy or remove their links from the profile.

Spotify only lists playlist tracks to the playlist's owner or collaborators, so a listener may see "Couldn’t open these tracks"; **Play anyway** still plays the whole playlist.

The app asks for `streaming` (required by the Web Playback SDK), `user-modify-playback-state` (required to start playback, shuffle, and repeat on the browser device), and `playlist-read-private` (required to list your playlists and browse private playlist tracks). No new Spotify scopes were added for the library, shuffle, repeat, profile, or sharing features. After adding the playlist scope, disconnect and reconnect Spotify to grant it. Spotify currently only exposes playlist items to the owner or collaborators. The backend keeps the Spotify tokens server side (encrypted in Postgres) and exposes a short-lived access token to the SDK only when it asks for one. OAuth login attempts live in process memory for 10 minutes. Use HTTPS in production; secure cookies are enabled automatically when `NODE_ENV=production`.

## Run locally

```sh
npm install
docker compose -f docker-compose.dev.yml up -d   # Postgres on 127.0.0.1:5432
npm run dev
```

Open the Vite address, normally `http://127.0.0.1:5173`. `npm run dev` starts the API on `127.0.0.1:3000` and the frontend proxies `/api` and `/auth` to it.

Individual processes can be started with `npm run dev:api` and `npm run dev:web`. Production builds are generated with `npm run build`; unit tests run with `npm test`.

## Using the deck

Sign in with Google, connect Spotify, and wait for “Deck ready”. Your own playlists load in the library automatically. The single search field searches Spotify as you type, and it also accepts a pasted playlist URL (`https://open.spotify.com/playlist/…`) or URI (`spotify:playlist:…`). Open a playlist to browse and filter its tracks, then press **Play**, **Shuffle**, or a track. Hover a playlist row for one-click play. Recently played playlists are remembered on your profile.

The playlist command targets the browser device ID reported by the SDK. Play/pause, previous/next, seek, volume, title, artist, album artwork, and the **Up next** list are driven by SDK state. Shuffle and repeat use the Web API player endpoints. Browser autoplay restrictions may require the explicit Play control after starting or transferring playback.

Each machine comes in several models, chosen from the model button next to the Cassette / Vinyl switch (or press `K`):

- **Cassette:** Hi-Fi Deck, Pocket Stereo, Boombox
- **Vinyl:** Walnut Turntable, Suitcase Player, DJ Deck

The motion follows how real hardware moves:

- **Cassettes:** both reels turn clockwise, at a speed set by how much tape is wound on each (ω = v / r). The tape pack moves from the left reel to the right as the track plays, and seeking fast-winds the reels.
- **Turntables:** they spin up and coast down with inertia. On the top-down models, the tonearm drops onto the lead-in, tracks inward with progress, and lifts on pause.

All of this follows playback position (the same data as the progress bar), never the audio signal.

Other conveniences:

- Day and night themes (following the system setting by default)
- A sleep timer (15–60 minutes or end of track)
- Mute
- "Open in Spotify" links
- OS media keys and lock-screen controls (Media Session)
- Keyboard shortcuts, listed by pressing `?`:
  - `Space`: play/pause
  - `Shift + ←/→`: previous/next track
  - `←/→`: seek
  - `↑/↓`: volume
  - `M` mute, `S` shuffle, `R` repeat, `T` switch machine, `K` next model, `/` search
- On phones, the app switches to a bottom tab bar (Library, Deck, Tracks).

## Troubleshooting

- **Callback/sign-in error:** Confirm the callback URI matches exactly, including `127.0.0.1`, port, and path; ensure both Spotify credentials are set in the API environment.
- **SDK script or initialization error:** Check network access to `sdk.scdn.co`, browser support for Encrypted Media Extensions, and whether a privacy extension blocks Spotify scripts.
- **Account error / playback 403:** The Web Playback SDK and full music streaming require a Spotify Premium account. A successful login alone does not guarantee playback eligibility.
- **Autoplay blocked:** Press Play after the browser gesture prompt. iOS may require user interaction after a playback transfer.
- **Device unavailable:** Wait for the Retro Play device to report “Deck ready” before sending the playlist. The API will not assume that device creation starts playback.
- **Tracks unavailable or restricted:** Confirm the playlist is accessible to the signed-in account and the track can be played in your region; Spotify may restrict playback operations or content.
- **Google sign-in error:** Confirm the authorized redirect URI is exactly `http://127.0.0.1:3000/auth/google/callback`, that `GOOGLE_*` and `APP_SECRET` are set, and that your Google account is a test user on the consent screen. Unverified Google emails are refused.
- **Asked to connect Spotify again:** Spotify revoked the refresh token, or `APP_SECRET` changed so the stored tokens can no longer be decrypted. Connect again from the deck or the profile.
- **Share refused:** The playlist must be public in Spotify. Make it public there, then press Share again.
- **API exits with `DATABASE_URL is not set` or `ECONNREFUSED 5432`:** start the dev database with `docker compose -f docker-compose.dev.yml up -d` and set `DATABASE_URL` as in `.env.example`.

## Deployment

Production is `docker-compose.yml`:

- **web**: Caddy serving the built React app, with automatic HTTPS (Let's Encrypt) for `SITE_ADDRESS`, proxying `/api` and `/auth` to the API. The only service with published ports (80/443).
- **api**: the NestJS API (`docker/api.Dockerfile`).
- **postgres**: Postgres 17 with a named volume `pgdata`.

Google and Spotify both reject bare-IP callbacks, so the server uses the free `156-67-27-54.sslip.io` hostname (it resolves to 156.67.27.54). Point a real domain at the server later and change `SITE_ADDRESS`.

**Pipeline** (`.github/workflows/ci-cd.yml`): every push and PR runs the tests and build. Pushes to `main` then build both images, push them to GHCR as `ghcr.io/amilacjay/retroplay-{api,web}:<sha>` and `:latest`, copy `docker-compose.yml` and `deploy/remote-deploy.sh` to `/opt/retroplay` over SSH, and run the script. It pulls that exact tag, restarts the stack, and waits for the API health check. The job's short-lived `GITHUB_TOKEN` is used for the pull and logged out afterwards.

**Repository secrets** (Settings → Secrets and variables → Actions, in a `production` environment):

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | `156.67.27.54` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | private key allowed in `~deploy/.ssh/authorized_keys` |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan 156.67.27.54` |

**Server**: `deploy/bootstrap-server.sh` (run once) installs Docker from Docker's apt repository, creates `/opt/retroplay`, and writes `/opt/retroplay/.env` (mode 600) with a generated `APP_SECRET` and `POSTGRES_PASSWORD`. App secrets live only in that file, never in GitHub. Fill in the Spotify and Google values there (see `.env.production.example`), and register these callback URLs:

- Spotify dashboard: `https://156-67-27-54.sslip.io/auth/callback`
- Google OAuth client: `https://156-67-27-54.sslip.io/auth/google/callback`

Manual operations on the server, from `/opt/retroplay`: `docker compose ps`, `docker compose logs -f api`, and `docker compose exec postgres pg_dump -U retroplay retroplay > backup.sql`.

## Policy and distribution

This pilot is intended for personal, free, noncommercial technical testing. Spotify's policy limits streaming to Premium subscribers, prohibits commercial use of streaming applications, restricts altering Spotify content, and prohibits synchronizing recordings with visual media. Retro Play's deck is decorative only; it has no beat-synchronized animation or audio visualizer. Album art and metadata appear only from the authorized SDK playback state.

Do not publicly distribute or launch this app until you have reviewed Spotify's current Developer Terms and Policy and resolved whether the product's cassette-player experience needs Spotify's prior written approval. Spotify describes restrictions on products that mimic or replace its core experience and requires prior written permission for commercial Web Playback SDK projects. Personal/free use does not by itself establish permission for public distribution. This pilot has not received Spotify approval.

## Manual integration check

After completing Spotify setup, sign in, wait for the browser device's ready status, submit a playlist you can access, and verify playback controls and metadata. Test sign-in denial, a non-Premium account, browser autoplay restrictions, and an unavailable playlist. This workspace has no real Spotify credentials, so live authorization and playback have not been verified here.
