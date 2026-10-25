import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ProfileController } from './profile.controller';
import { NO_LONGER_PUBLIC, NOT_PUBLIC, SharesController } from './shares.controller';
import { json, signIn, testApp } from './test/helpers';

const playlist = (overrides: Record<string, unknown> = {}) => ({ id: 'pl1', uri: 'spotify:playlist:pl1', name: 'Late night', public: true, owner: { display_name: 'DJ' }, items: { total: 20 }, images: [{ url: 'https://i.scdn.co/x' }], ...overrides });

describe('ProfileController', () => {
  const setup = async () => { const app = await testApp(); return { ...app, controller: new ProfileController(app.sessions, app.db) }; };

  it('saves only known customisation keys', async () => {
    const { controller, req, csrf, db, user } = await setup();
    const result = await controller.preferences(req, csrf, { appearance: 'dark', playerTheme: 'vinyl', volume: 0.4, skins: { vinyl: 'suitcase' }, injected: '<script>', recents: [{ id: 'x', uri: 'spotify:playlist:x', name: 'X', owner: 'Me', total: 3, image: 'javascript:alert(1)' }] });
    expect(result.preferences).toEqual({ appearance: 'dark', playerTheme: 'vinyl', volume: 0.4, skins: { vinyl: 'suitcase' }, recents: [{ id: 'x', uri: 'spotify:playlist:x', name: 'X', owner: 'Me', total: 3, image: null }] });
    expect((await db.getUser(user.id))!.preferences).toEqual(result.preferences);
  });

  it('stores the current song and its state, and clears it', async () => {
    const { controller, req, csrf, db, user } = await setup();
    const state = { playlist: { id: 'pl1', uri: 'spotify:playlist:pl1', name: 'Late night', owner: 'DJ', total: 20, image: null }, track: { uri: 'spotify:track:t1', name: 'Song', artists: ['Band'], album: 'LP', image: 'https://i.scdn.co/y' }, positionMs: 42_000, durationMs: 200_000, paused: true };
    await controller.nowPlaying(req, csrf, state);
    expect((await db.getUser(user.id))!.nowPlaying).toMatchObject({ ...state, updatedAt: expect.any(Number) });
    await expect(controller.nowPlaying(req, csrf, { ...state, track: { ...state.track, uri: 'https://evil' } })).rejects.toThrow('could not be saved');
    await controller.nowPlaying(req, csrf, {});
    expect((await db.getUser(user.id))!.nowPlaying).toBeNull();
  });

  it('edits the display name and falls back to the Google name when cleared', async () => {
    const { controller, req, csrf } = await setup();
    expect((await controller.update(req, csrf, { displayName: '  Night   Owl ' })).user.name).toBe('Night Owl');
    expect((await controller.update(req, csrf, { displayName: '' })).user.name).toBe('Listener');
    await expect(controller.update(req, csrf, { displayName: 'x'.repeat(61) })).rejects.toThrow('60 characters');
  });

  it('deletes the account with its connections and shares', async () => {
    const { controller, req, csrf, db, user } = await setup();
    await db.upsertShare(user.id, { id: 'pl1', uri: 'spotify:playlist:pl1', name: 'Late night', owner: 'DJ', total: 1, image: null });
    await controller.remove(req, { clearCookie: jest.fn(), json: jest.fn() } as any, csrf);
    expect(await db.getUser(user.id)).toBeUndefined();
    expect(await db.hasSpotifyLink(user.id)).toBe(false);
    expect(await db.listShares(user.id)).toEqual([]);
  });
});

describe('SharesController', () => {
  afterEach(() => { jest.restoreAllMocks(); });
  const setup = async () => { const app = await testApp(); return { ...app, controller: new SharesController(app.sessions, app.spotify, app.db) }; };

  it('refuses to share a playlist that is not public on Spotify', async () => {
    const { controller, req, csrf } = await setup();
    jest.spyOn(global, 'fetch').mockImplementation(async () => json(playlist({ public: false })));
    await expect(controller.create(req, csrf, { playlistId: 'pl1' })).rejects.toMatchObject({ status: 422, message: NOT_PUBLIC });
  });

  it('creates one link per playlist and lets anyone open it, even signed out', async () => {
    const { controller, req, csrf } = await setup();
    jest.spyOn(global, 'fetch').mockImplementation(async () => json(playlist()));
    const share = await controller.create(req, csrf, { playlistId: 'pl1' });
    expect(share.url).toBe(`http://127.0.0.1:5173/s/${share.id}`);
    expect((await controller.create(req, csrf, { playlistId: 'pl1' })).id).toBe(share.id);
    await expect(controller.open({ cookies: {} } as any, share.id)).resolves.toMatchObject({ id: share.id, sharedBy: 'Listener', playlist: { name: 'Late night', owner: 'DJ', total: 20 } });
    expect((await controller.mine(req, csrf)).items).toHaveLength(1);
  });

  it('pauses a link when the owner makes the playlist private', async () => {
    const { controller, req, csrf } = await setup();
    jest.spyOn(global, 'fetch').mockImplementation(async () => json(playlist()));
    const share = await controller.create(req, csrf, { playlistId: 'pl1' });
    (controller as any).checkedAt.clear();
    jest.spyOn(global, 'fetch').mockImplementation(async () => json(playlist({ public: false })));
    await expect(controller.open({ cookies: {} } as any, share.id)).rejects.toMatchObject({ status: 410, message: NO_LONGER_PUBLIC });
  });

  it('lets only the owner revoke a link', async () => {
    const { controller, req, csrf, db, sessions } = await setup();
    jest.spyOn(global, 'fetch').mockImplementation(async () => json(playlist()));
    const share = await controller.create(req, csrf, { playlistId: 'pl1' });
    const other = await signIn(db, sessions, 'google-2', 'Other');
    await expect(controller.remove(other.req, other.csrf, share.id)).rejects.toThrow('does not exist');
    expect(await controller.remove(req, csrf, share.id)).toEqual({ ok: true });
    await expect(controller.open({ cookies: {} } as any, share.id)).rejects.toMatchObject({ status: 404 });
  });
});
