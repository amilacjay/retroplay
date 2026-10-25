# Cassete Phase 1 — Spotify Playback Pilot

## Objective

Implement Phase 1 of Cassete, a free, noncommercial technical pilot that lets me authenticate with my own Spotify Premium account and play a Spotify playlist in a browser using the official Spotify Web Playback SDK.

This is a working software implementation task, not a request for an architecture proposal. Inspect the current repository, implement the solution, run the available checks, and report what works and what remains.

## 1. Start by inspecting the existing project

Before modifying anything:

- Inspect the repository structure, README, package manifests, environment configuration, existing applications, and Docker setup.
- Identify the current frontend and backend frameworks and versions.
- Check existing authentication, API, database, and development conventions.
- Run appropriate existing tests or build checks to establish a baseline.
- Preserve existing working functionality. Do not replace the project with a new scaffold if a usable implementation already exists.
- Do not overwrite user changes or delete existing files unnecessarily.
- If the repository is empty, create a minimal implementation consistent with the established Cassete architecture.

Previously selected target architecture:
- Frontend: React 19, Vite, TypeScript.
- Backend: NestJS, Node.js, TypeScript.
- Database: PostgreSQL 17 and Prisma, if already configured or needed.
- Infrastructure: Docker Compose, with Redis, MinIO, and NGINX available for later phases.
- Keep Phase 1 simple. Do not introduce unnecessary infrastructure or dependencies.

## 2. Spotify developer requirements

Read the current official documentation before implementing:

- https://developer.spotify.com/documentation/web-playback-sdk
- https://developer.spotify.com/documentation/web-playback-sdk/reference
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-api/concepts/authorization
- https://developer.spotify.com/policy

Use the current documented SDK and authorization behavior. Do not rely on deprecated endpoints, obsolete tutorials, or invented SDK methods.

The pilot is intended for personal technical testing and is free, with no advertising or paid features. Free use does not itself establish permission for public distribution; document any policy questions that must be resolved before sharing or launching the application.

## 3. Implement Spotify authentication

Use the Authorization Code flow with a server-side token exchange, provided it remains supported by the current documentation.

Implement:

- A Spotify login button.
- A backend route that initiates authorization.
- Secure, unpredictable OAuth state validation.
- A registered callback route.
- Authorization-denied and callback-error handling.
- Secure server-side access-token refresh.
- A protected endpoint through which the frontend can obtain a short-lived access token for the Web Playback SDK.
- A logout/disconnect flow.
- A clear authentication/session status in the UI.

Request only the scopes needed by the implemented SDK and Web API operations. Determine the exact current scope requirements from official documentation.

Never expose the Spotify client secret or refresh token to the browser. Use secure session cookies and suitable CSRF protection. Never log credentials, tokens, authorization codes, or cookies.

Use environment variables for credentials and provide an `.env.example` containing placeholders only. Do not invent credentials or commit real secrets.

## 4. Implement the official Web Playback SDK

Load the official SDK from:

https://sdk.scdn.co/spotify-player.js

Implement a dedicated Spotify player service or React hook.

Handle the documented SDK lifecycle and events, including:

- SDK initialization.
- `ready` and `not_ready`.
- `player_state_changed`.
- `authentication_error`.
- `account_error`.
- `initialization_error`.
- `playback_error`.
- `autoplay_failed`.

Implement the documented playback methods needed for:

- Connect and disconnect.
- Play and pause.
- Resume.
- Previous and next track.
- Seek, where permitted.
- Volume control.
- Current playback state and progress.

When the SDK becomes ready, retain the active device ID in application state.

Starting a selected playlist must use the appropriate currently documented Spotify Web API operation, with the necessary permissions. Follow the current API requirements for device selection, playback transfer, request bodies, and error handling.

Do not assume that creating a device automatically starts a playlist.

Do not assume that successful OAuth authentication guarantees Premium eligibility. Display useful errors for unsupported accounts, unavailable tracks, expired/revoked authorization, unavailable devices, and restricted playback operations.

Respect browser autoplay restrictions and require a user gesture when necessary.

## 5. Build a minimal Cassete player UI

Create a polished, responsive first-pass player with:

- Cassete branding.
- A retro cassette deck appearance.
- Playlist URL or URI input.
- A Play Playlist action.
- Current track title and artist.
- Album artwork only where authorized by Spotify's rules.
- Play/pause, previous/next, progress, and volume controls.
- Playback status and connection status.
- Loading, empty, error, and reconnect states.
- A clear Spotify login/disconnect control.

Use original CSS and visual assets. Keep the code ready for future Walkman, vinyl, and room themes, but do not build the complete theme editor in this phase.

Do not implement beat-synchronized reel animations, waveform visualizers, or other audio-synchronized visuals. Keep animations decorative and independent of the recording unless Spotify explicitly approves the intended implementation.

Do not obscure or misrepresent required Spotify branding or controls.

## 6. Keep the implementation maintainable

Separate concerns into appropriate modules, such as:

- Spotify OAuth and session management.
- Spotify API client.
- SDK script loader.
- Player lifecycle and state.
- Player UI components.
- Environment configuration.

Avoid putting all logic in a single React component.

Handle React development lifecycle behavior, including duplicate initialization and cleanup. Avoid leaving multiple player instances or event listeners active.

Do not create a generalized multi-provider streaming abstraction yet. Spotify is the only provider in Phase 1.

## 7. Configuration and developer experience

Provide:

- `.env.example` with documented placeholders.
- A README with prerequisites and setup instructions.
- Instructions for creating a Spotify developer application.
- Instructions for registering the exact callback URI.
- Instructions for setting the client ID and server-only client secret.
- Frontend and backend development commands.
- Troubleshooting for OAuth callbacks, SDK initialization, Premium eligibility, autoplay, and playback errors.
- Docker instructions if the repository already uses Docker.

Use the existing project package manager and conventions.

Do not silently change package versions or infrastructure configuration without a clear reason.

## 8. Tests and validation

Add appropriate unit tests for the code that can be tested without Spotify credentials.

Test at least:

- OAuth state validation.
- Callback error handling.
- Token refresh failure handling.
- Session and authorization checks.
- Player event handling.
- SDK initialization failure.
- Disconnected device and unavailable playback states.
- UI rendering for unauthenticated, connecting, ready, and error states.

Run the available formatter, lint, tests, and production builds.

If real Spotify integration testing requires credentials or an eligible account, clearly identify that limitation and provide manual test steps. Do not claim real playback works unless it has actually been verified.

## 9. Acceptance criteria

Phase 1 is complete when:

1. The frontend and backend start successfully.
2. I can authenticate with my Spotify account.
3. OAuth credentials and tokens are handled securely.
4. The SDK initializes and exposes a ready device.
5. I can submit a Spotify playlist URI and attempt playback on the browser device.
6. Playback controls and track state update correctly when supported.
7. Errors and unsupported account states are explained clearly.
8. Existing project functionality remains intact.
9. Tests and production builds pass, or remaining failures are documented.
10. The README contains reproducible setup and testing instructions.

## Execution instructions

Work directly in the current workspace.

First inspect the repository and give me a concise summary of its current state. Then implement the smallest complete vertical slice, run tests and builds, fix issues introduced by your changes, and summarize the result.

Do not stop after producing a plan. Ask me only when a genuinely required external action is needed, such as providing my Spotify client ID, registering a callback URL, signing in to Spotify, or granting a required permission.

Never ask me to paste passwords, client secrets, access tokens, or refresh tokens into the chat.

At the end, report:
- Files created or changed.
- Commands executed and their results.
- Features actually verified.
- Remaining manual setup.
- Any Spotify policy or approval issues that prevent public distribution.