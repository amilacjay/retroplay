import { describe, expect, it } from '@jest/globals';
import { seal, unseal } from './crypto';
import { OAuthAttempts } from './oauth-attempts';
import { memoryDatabase } from './test/helpers';

describe('token sealing', () => {
  it('round-trips and rejects tampering', () => {
    const sealed = seal('refresh-token');
    expect(sealed).not.toContain('refresh-token');
    expect(unseal(sealed)).toBe('refresh-token');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('forged').toString('base64url');
    expect(() => unseal(parts.join('.'))).toThrow();
  });
});

describe('OAuthAttempts', () => {
  it('is single use', () => {
    const attempts = new OAuthAttempts<{ n: number }>();
    const state = attempts.create({ n: 1 });
    expect(attempts.consume(state)).toEqual({ n: 1 });
    expect(attempts.consume(state)).toBeUndefined();
  });
});

describe('Database', () => {
  it('migrates idempotently', async () => {
    const db = await memoryDatabase();
    await expect(db.migrate()).resolves.toBeUndefined();
  });

  it('keeps a chosen display name across Google sign-ins', async () => {
    const db = await memoryDatabase();
    const user = await db.upsertGoogleUser({ sub: 's', email: 'a@example.com', name: 'Ada', picture: null });
    await db.setDisplayName(user.id, 'Countess');
    const again = await db.upsertGoogleUser({ sub: 's', email: 'ada@example.com', name: 'Ada L', picture: 'https://x' });
    expect(again).toMatchObject({ id: user.id, email: 'ada@example.com', name: 'Ada L', displayName: 'Countess' });
    expect(typeof again.createdAt).toBe('number');
  });

  it('stores Spotify tokens encrypted at rest', async () => {
    const db = await memoryDatabase();
    const user = await db.upsertGoogleUser({ sub: 's', email: 'a@example.com', name: 'Ada', picture: null });
    await db.putSpotifyLink({ userId: user.id, spotifyUserId: 'sp', spotifyName: 'Ada', accessToken: 'plain-access', refreshToken: 'plain-refresh', expiresAt: 1 });
    const raw = await (db as any).pool.query('SELECT access_token, refresh_token FROM spotify_links');
    expect(JSON.stringify(raw.rows)).not.toMatch(/plain-/);
    expect(await db.getSpotifyLink(user.id)).toMatchObject({ accessToken: 'plain-access', refreshToken: 'plain-refresh', expiresAt: 1 });
  });

  it('stores sessions by hash only', async () => {
    const db = await memoryDatabase();
    const user = await db.upsertGoogleUser({ sub: 's', email: 'a@example.com', name: 'Ada', picture: null });
    await db.createSession('hash-of-id', user.id, 'csrf', Date.now() + 1000);
    expect(await db.getSession('hash-of-id')).toMatchObject({ userId: user.id, csrf: 'csrf' });
    expect(await db.getSession('raw-id')).toBeUndefined();
  });

  it('keeps one share per user and playlist, and deletes everything with the user', async () => {
    const db = await memoryDatabase();
    const user = await db.upsertGoogleUser({ sub: 's', email: 'a@example.com', name: 'Ada', picture: null });
    const playlist = { id: 'p1', uri: 'spotify:playlist:p1', name: 'One', owner: 'Ada', total: 1, image: null };
    const first = await db.upsertShare(user.id, playlist);
    const second = await db.upsertShare(user.id, { ...playlist, name: 'Renamed' });
    expect(second.id).toBe(first.id);
    expect(second.playlist.name).toBe('Renamed');
    await db.deleteUser(user.id);
    expect(await db.getShare(first.id)).toBeUndefined();
  });
});
