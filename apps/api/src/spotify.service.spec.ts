import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { testApp } from './test/helpers';

describe('SpotifyService security and token lifecycle', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('accepts an unexpired OAuth state only once, bound to the user who started it', async () => {
    const { spotify, user } = await testApp();
    const { state } = spotify.createAttempt(user.id, '/s/abcdefgh12');
    expect(spotify.consumeAttempt(state)).toEqual({ userId: user.id, returnTo: '/s/abcdefgh12' });
    expect(spotify.consumeAttempt(state)).toBeUndefined();
    expect(spotify.consumeAttempt('guess')).toBeUndefined();
  });

  it('requests SDK streaming and playlist playback permissions only', async () => {
    expect((await testApp()).spotify.scopes).toEqual(['streaming', 'user-modify-playback-state', 'playlist-read-private']);
  });

  it('removes the Spotify connection when Spotify rejects the refresh token, without leaking the upstream error', async () => {
    const { db, spotify, user } = await testApp();
    await db.updateSpotifyTokens(user.id, 'old', 'bad', 0);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 400 }));
    await expect(spotify.accessToken(user.id)).rejects.toThrow('Spotify authorization expired or was revoked. Please connect again.');
    expect(await spotify.connected(user.id)).toBe(false);
  });

  it('keeps the connection when the refresh fails because Spotify is unreachable', async () => {
    const { db, spotify, user } = await testApp();
    await db.updateSpotifyTokens(user.id, 'old', 'refresh', 0);
    jest.spyOn(global, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(spotify.accessToken(user.id)).rejects.toThrow('Spotify authorization expired');
    expect(await spotify.connected(user.id)).toBe(true);
  });

  it('shares one refresh between concurrent callers and persists rotated tokens', async () => {
    const { db, spotify, user } = await testApp();
    await db.updateSpotifyTokens(user.id, 'old', 'refresh', 0);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ access_token: 'fresh', refresh_token: 'rotated', expires_in: 3600 }), { status: 200 }));
    await expect(Promise.all([spotify.accessToken(user.id), spotify.accessToken(user.id)])).resolves.toEqual(['fresh', 'fresh']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await db.getSpotifyLink(user.id)).toMatchObject({ accessToken: 'fresh', refreshToken: 'rotated' });
  });

  it('reports a missing connection as a 401 on Web API calls', async () => {
    const { spotify, user } = await testApp({ spotify: false });
    await expect(spotify.request(user.id, '/me')).rejects.toMatchObject({ status: 401, message: 'Connect your Spotify account first.' });
  });
});
