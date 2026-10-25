import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { appSecretConfigured } from './crypto';
import { Database } from './database';
import { OAuthAttempts } from './oauth-attempts';

type SpotifyAttempt = { userId: string; returnTo: string };
type TokenResult = { access_token: string; refresh_token?: string; expires_in: number };
const SPOTIFY_API = 'https://api.spotify.com/v1';

export const SPOTIFY_EXPIRED = 'Spotify authorization expired or was revoked. Please connect again.';
export const SPOTIFY_NOT_CONNECTED = 'Connect your Spotify account first.';
export class SpotifyAuthError extends Error {}
class TokenRequestError extends Error { constructor(readonly status: number) { super(`Spotify token request failed (${status}).`); } }

/** The Spotify connection of each signed-in user: OAuth linking, token refresh, and authenticated Web API calls. */
@Injectable()
export class SpotifyService {
  private readonly attempts = new OAuthAttempts<SpotifyAttempt>();
  private readonly refreshing = new Map<string, Promise<string>>();
  readonly scopes = ['streaming', 'user-modify-playback-state', 'playlist-read-private'];

  constructor(@Inject(Database) private readonly db: Database) {}

  configured() { return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_REDIRECT_URI && appSecretConfigured()); }

  /** The attempt is bound to the user who started it, so the callback can only link Spotify to that same account. */
  createAttempt(userId: string, returnTo = '/'): { state: string } { return { state: this.attempts.create({ userId, returnTo }) }; }
  consumeAttempt(state: string | undefined) { return this.attempts.consume(state); }

  authorizationUrl(state: string) {
    const url = new URL('https://accounts.spotify.com/authorize');
    url.search = new URLSearchParams({ response_type: 'code', client_id: process.env.SPOTIFY_CLIENT_ID!, redirect_uri: process.env.SPOTIFY_REDIRECT_URI!, scope: this.scopes.join(' '), state }).toString();
    return url.toString();
  }

  async connect(userId: string, code: string) {
    const result = await this.tokenRequest(new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: process.env.SPOTIFY_REDIRECT_URI! }));
    if (!result.refresh_token) throw new Error('Spotify did not return a refresh token. Disconnect and authorize again.');
    // The public profile needs no extra scope; it only labels the connection, so a failure here is not fatal.
    let profile: { id?: string; display_name?: string | null } = {};
    try { const response = await fetch(`${SPOTIFY_API}/me`, { headers: { Authorization: `Bearer ${result.access_token}` } }); if (response.ok) profile = await response.json() as typeof profile; } catch { /* label stays empty */ }
    await this.db.putSpotifyLink({ userId, spotifyUserId: profile.id ?? null, spotifyName: profile.display_name ?? profile.id ?? null, accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + result.expires_in * 1000 });
  }

  connected(userId: string) { return this.db.hasSpotifyLink(userId); }
  async disconnect(userId: string) { await this.db.deleteSpotifyLink(userId); }

  /**
   * A valid access token for the user, refreshing it when it is under 60 s from expiry. Concurrent callers share one refresh,
   * since Spotify may rotate the refresh token. A rejected refresh removes the connection; a network failure does not.
   */
  async accessToken(userId: string): Promise<string> {
    const pending = this.refreshing.get(userId);
    if (pending) return pending;
    const link = await this.db.getSpotifyLink(userId);
    if (!link) throw new SpotifyAuthError(SPOTIFY_NOT_CONNECTED);
    if (link.expiresAt > Date.now() + 60_000) return link.accessToken;
    // Another caller may have started a refresh while this one was reading the link.
    const started = this.refreshing.get(userId);
    if (started) return started;
    const refresh = (async () => {
      try {
        const result = await this.tokenRequest(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: link.refreshToken }));
        await this.db.updateSpotifyTokens(userId, result.access_token, result.refresh_token ?? link.refreshToken, Date.now() + result.expires_in * 1000);
        return result.access_token;
      } catch (cause) {
        if (cause instanceof TokenRequestError && (cause.status === 400 || cause.status === 401)) await this.db.deleteSpotifyLink(userId);
        throw new SpotifyAuthError(SPOTIFY_EXPIRED);
      } finally { this.refreshing.delete(userId); }
    })();
    this.refreshing.set(userId, refresh);
    return refresh;
  }

  /** Calls the Spotify Web API as the user; a missing or dead connection becomes a 401 with a readable message. */
  async request(userId: string, path: string, init: RequestInit = {}) {
    let token: string;
    try { token = await this.accessToken(userId); }
    catch (cause) { throw new HttpException(cause instanceof SpotifyAuthError ? cause.message : SPOTIFY_EXPIRED, HttpStatus.UNAUTHORIZED); }
    return fetch(`${SPOTIFY_API}${path}`, { ...init, headers: { ...init.headers as Record<string, string>, Authorization: `Bearer ${token}` } });
  }

  private async tokenRequest(body: URLSearchParams): Promise<TokenResult> {
    const credentials = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    if (!response.ok) throw new TokenRequestError(response.status);
    return response.json() as Promise<TokenResult>;
  }
}
