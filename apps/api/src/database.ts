import { Pool } from 'pg';
import { randomToken, seal, unseal } from './crypto';
import type { NowPlaying, Playlist, Preferences } from './validation';

export type User = { id: string; email: string; name: string; displayName: string | null; picture: string | null; preferences: Preferences; nowPlaying: NowPlaying | null; createdAt: number };
export type SessionRow = { userId: string; csrf: string; expiresAt: number };
export type SpotifyLink = { userId: string; spotifyUserId: string | null; spotifyName: string | null; accessToken: string; refreshToken: string; expiresAt: number };
export type Share = { id: string; userId: string; playlist: Playlist; createdAt: number };
export type GoogleIdentity = { sub: string; email: string; name: string; picture: string | null };

/** The slice of `pg.Pool` this class uses, so specs can pass an in-memory pg-mem pool. */
export type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>; end(): Promise<void> };

// Append new migrations; never edit one that has shipped.
const MIGRATIONS = [`
CREATE TABLE users (
  id TEXT PRIMARY KEY, google_sub TEXT NOT NULL UNIQUE, email TEXT NOT NULL, name TEXT NOT NULL, display_name TEXT, picture TEXT,
  preferences TEXT NOT NULL DEFAULT '{}', now_playing TEXT, created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf TEXT NOT NULL, expires_at BIGINT NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE spotify_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, spotify_user_id TEXT, spotify_name TEXT,
  access_token TEXT NOT NULL, refresh_token TEXT NOT NULL, expires_at BIGINT NOT NULL, connected_at BIGINT NOT NULL);
CREATE TABLE shares (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, playlist_id TEXT NOT NULL, playlist TEXT NOT NULL,
  created_at BIGINT NOT NULL, UNIQUE (user_id, playlist_id));
`];

/** A pool for DATABASE_URL (Postgres). */
export function createPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set. Point it at a Postgres database, e.g. postgres://retroplay:secret@127.0.0.1:5432/retroplay.');
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
}

const parse = <T>(value: unknown, fallback: T): T => { try { return typeof value === 'string' ? JSON.parse(value) as T : fallback; } catch { return fallback; } };
// BIGINT columns come back from pg as strings.
const num = (value: unknown) => Number(value);
const toUser = (row: Record<string, any>): User => ({ id: row.id, email: row.email, name: row.name, displayName: row.display_name ?? null, picture: row.picture ?? null, preferences: parse(row.preferences, {}), nowPlaying: parse(row.now_playing, null), createdAt: num(row.created_at) });
const toShare = (row: Record<string, any>): Share => ({ id: row.id, userId: row.user_id, playlist: parse(row.playlist, null as unknown as Playlist), createdAt: num(row.created_at) });

/**
 * All persistent state in Postgres: users and their profile, sessions (stored by hash, so a leaked dump cannot be replayed
 * as cookies), Spotify connections (tokens sealed with APP_SECRET), and playlist share links.
 */
export class Database {
  constructor(private readonly pool: Queryable) {}

  /** Applies the numbered migrations that have not run yet, recording each in `schema_migrations`. */
  async migrate() {
    let applied: number[];
    try { applied = (await this.pool.query('SELECT version FROM schema_migrations')).rows.map(row => Number(row.version)); }
    catch { await this.pool.query('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at BIGINT NOT NULL)'); applied = []; }
    for (const [index, sql] of MIGRATIONS.entries()) {
      const version = index + 1;
      if (applied.includes(version)) continue;
      for (const statement of sql.split(';').map(part => part.trim()).filter(Boolean)) await this.pool.query(statement);
      await this.pool.query('INSERT INTO schema_migrations (version, applied_at) VALUES ($1, $2)', [version, Date.now()]);
    }
  }
  async onApplicationShutdown() { await this.pool.end(); }

  private async one(text: string, values: unknown[]) { return (await this.pool.query(text, values)).rows[0] as Record<string, any> | undefined; }
  private async run(text: string, values: unknown[]) { return (await this.pool.query(text, values)).rowCount ?? 0; }

  /** Creates the user on first Google sign-in; later sign-ins refresh the Google-owned fields but keep the chosen display name. */
  async upsertGoogleUser(identity: GoogleIdentity): Promise<User> {
    const now = Date.now();
    const row = await this.one(`INSERT INTO users (id, google_sub, email, name, picture, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)
      ON CONFLICT (google_sub) DO UPDATE SET email = excluded.email, name = excluded.name, picture = excluded.picture, updated_at = excluded.updated_at RETURNING *`,
      [randomToken(12), identity.sub, identity.email, identity.name, identity.picture, now]);
    return toUser(row!);
  }

  async getUser(id: string): Promise<User | undefined> { const row = await this.one('SELECT * FROM users WHERE id = $1', [id]); return row ? toUser(row) : undefined; }
  async setDisplayName(userId: string, displayName: string | null) { await this.run('UPDATE users SET display_name = $1, updated_at = $2 WHERE id = $3', [displayName, Date.now(), userId]); }
  async setPreferences(userId: string, preferences: Preferences) { await this.run('UPDATE users SET preferences = $1, updated_at = $2 WHERE id = $3', [JSON.stringify(preferences), Date.now(), userId]); }
  async setNowPlaying(userId: string, nowPlaying: NowPlaying | null) { await this.run('UPDATE users SET now_playing = $1, updated_at = $2 WHERE id = $3', [nowPlaying ? JSON.stringify(nowPlaying) : null, Date.now(), userId]); }
  async deleteUser(userId: string) { await this.run('DELETE FROM users WHERE id = $1', [userId]); }

  async createSession(idHash: string, userId: string, csrf: string, expiresAt: number) {
    await this.run('DELETE FROM sessions WHERE expires_at < $1', [Date.now()]);
    await this.run('INSERT INTO sessions (id_hash, user_id, csrf, expires_at) VALUES ($1, $2, $3, $4)', [idHash, userId, csrf, expiresAt]);
  }
  async getSession(idHash: string): Promise<SessionRow | undefined> {
    const row = await this.one('SELECT user_id, csrf, expires_at FROM sessions WHERE id_hash = $1', [idHash]);
    return row ? { userId: row.user_id, csrf: row.csrf, expiresAt: num(row.expires_at) } : undefined;
  }
  async deleteSession(idHash: string) { await this.run('DELETE FROM sessions WHERE id_hash = $1', [idHash]); }

  async putSpotifyLink(link: SpotifyLink) {
    await this.run(`INSERT INTO spotify_links (user_id, spotify_user_id, spotify_name, access_token, refresh_token, expires_at, connected_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id) DO UPDATE SET spotify_user_id = excluded.spotify_user_id, spotify_name = excluded.spotify_name, access_token = excluded.access_token, refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, connected_at = excluded.connected_at`,
      [link.userId, link.spotifyUserId, link.spotifyName, seal(link.accessToken), seal(link.refreshToken), link.expiresAt, Date.now()]);
  }
  async updateSpotifyTokens(userId: string, accessToken: string, refreshToken: string, expiresAt: number) {
    await this.run('UPDATE spotify_links SET access_token = $1, refresh_token = $2, expires_at = $3 WHERE user_id = $4', [seal(accessToken), seal(refreshToken), expiresAt, userId]);
  }
  async getSpotifyLink(userId: string): Promise<SpotifyLink | undefined> {
    const row = await this.one('SELECT * FROM spotify_links WHERE user_id = $1', [userId]);
    if (!row) return undefined;
    try { return { userId, spotifyUserId: row.spotify_user_id ?? null, spotifyName: row.spotify_name ?? null, accessToken: unseal(row.access_token), refreshToken: unseal(row.refresh_token), expiresAt: num(row.expires_at) }; }
    catch { return undefined; } // APP_SECRET changed: the stored tokens are unreadable, so the user reconnects.
  }
  async hasSpotifyLink(userId: string) { return Boolean(await this.one('SELECT 1 AS present FROM spotify_links WHERE user_id = $1', [userId])); }
  async spotifyProfile(userId: string) {
    const row = await this.one('SELECT spotify_name FROM spotify_links WHERE user_id = $1', [userId]);
    return row ? { connected: true, displayName: row.spotify_name ?? null } : { connected: false, displayName: null };
  }
  async deleteSpotifyLink(userId: string) { await this.run('DELETE FROM spotify_links WHERE user_id = $1', [userId]); }

  /** One link per user and playlist: sharing the same playlist again returns the existing link with a fresh snapshot. */
  async upsertShare(userId: string, playlist: Playlist): Promise<Share> {
    const row = await this.one(`INSERT INTO shares (id, user_id, playlist_id, playlist, created_at) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, playlist_id) DO UPDATE SET playlist = excluded.playlist RETURNING *`, [randomToken(9), userId, playlist.id, JSON.stringify(playlist), Date.now()]);
    return toShare(row!);
  }
  async updateShareSnapshot(id: string, playlist: Playlist) { await this.run('UPDATE shares SET playlist = $1 WHERE id = $2', [JSON.stringify(playlist), id]); }
  async getShare(id: string): Promise<Share | undefined> { const row = await this.one('SELECT * FROM shares WHERE id = $1', [id]); return row ? toShare(row) : undefined; }
  async listShares(userId: string): Promise<Share[]> { return (await this.pool.query('SELECT * FROM shares WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows.map(toShare); }
  async deleteShare(id: string, userId: string) { return (await this.run('DELETE FROM shares WHERE id = $1 AND user_id = $2', [id, userId])) > 0; }
}
