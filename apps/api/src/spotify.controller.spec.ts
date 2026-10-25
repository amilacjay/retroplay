import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { SpotifyController, upstreamError } from './spotify.controller';
import { signIn, testApp } from './test/helpers';

async function setup(options?: { spotify?: boolean }) {
  const app = await testApp(options);
  return { ...app, controller: new SpotifyController(app.spotify, app.sessions) };
}
const response = () => ({ redirect: jest.fn(), clearCookie: jest.fn(), cookie: jest.fn() }) as any;

describe('SpotifyController input checks', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('sends signed-out visitors to Google sign-in before linking Spotify', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'id'; process.env.SPOTIFY_CLIENT_SECRET = 'secret'; process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3000/auth/callback';
    const { controller } = await setup();
    const res = response();
    await controller.login({ cookies: {}, query: { returnTo: '/s/abcdefgh12' } } as any, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/s/abcdefgh12?authError=signin'));
  });

  it('reports callback denial and state failures without exchanging a code', async () => {
    const { controller, spotify, user, req } = await setup();
    const res = response();
    const attempt = spotify.createAttempt(user.id);
    await controller.callback({ ...req, query: { error: 'access_denied', state: attempt.state }, cookies: { ...req.cookies, 'cassete.oauth': attempt.state } } as any, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('authError=denied'));
    res.redirect.mockClear();
    await controller.callback({ ...req, query: { state: 'bad', code: 'unused' } } as any, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('authError=state'));
    expect(res.clearCookie).toHaveBeenCalledTimes(2);
  });

  it('refuses to link Spotify to a different account than the one that started the flow', async () => {
    const { controller, spotify, user, db, sessions } = await setup();
    const other = await signIn(db, sessions, 'google-2', 'Other');
    const attempt = spotify.createAttempt(user.id);
    const fetchSpy = jest.spyOn(global, 'fetch');
    const res = response();
    await controller.callback({ ...other.req, query: { state: attempt.state, code: 'code' }, cookies: { ...other.req.cookies, 'cassete.oauth': attempt.state } } as any, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('authError=state'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires a session and CSRF token before playback', async () => {
    const { controller, req } = await setup();
    await expect(controller.play({ cookies: {} } as any, '', { context_uri: 'spotify:playlist:abc', device_id: 'device' })).rejects.toThrow('Sign in to Retro Play first.');
    await expect(controller.play(req, 'wrong', { context_uri: 'spotify:playlist:abc', device_id: 'device' })).rejects.toMatchObject({ status: 403 });
  });

  it('asks to connect Spotify when the signed-in user has not linked it', async () => {
    const { controller, req, csrf } = await setup({ spotify: false });
    await expect(controller.myPlaylists(req, csrf)).rejects.toMatchObject({ status: 401, message: 'Connect your Spotify account first.' });
  });

  it('explains a disconnected browser device', async () => {
    const { controller, req, csrf } = await setup();
    await expect(controller.play(req, csrf, { context_uri: 'spotify:playlist:abc123' })).rejects.toThrow('browser player is not ready yet');
  });

  it('explains when Spotify cannot find an available playback device', async () => {
    const { controller, req, csrf } = await setup();
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    await expect(controller.play(req, csrf, { context_uri: 'spotify:playlist:abc123', device_id: 'device-1' })).rejects.toThrow('Spotify could not find an active device.');
  });

  it('resumes a track at a saved position', async () => {
    const { controller, req, csrf } = await setup();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(controller.play(req, csrf, { context_uri: 'spotify:playlist:abc123', track_uri: 'spotify:track:t1', position_ms: 61_000, device_id: 'device-1' })).resolves.toEqual({ ok: true });
    expect(JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))).toEqual({ context_uri: 'spotify:playlist:abc123', offset: { uri: 'spotify:track:t1' }, position_ms: 61_000 });
    await expect(controller.play(req, csrf, { context_uri: 'spotify:playlist:abc123', position_ms: -5, device_id: 'device-1' })).rejects.toThrow('valid start position');
  });

  it('lists the signed-in user\'s playlists with normalized fields', async () => {
    const { controller, req, csrf } = await setup();
    const body = { total: 1, offset: 0, items: [{ id: 'p1', uri: 'spotify:playlist:p1', name: 'Road trip', owner: { display_name: 'Me' }, items: { total: 12 }, images: [{ url: 'https://i.scdn.co/a' }] }, null] };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(controller.myPlaylists(req, csrf)).resolves.toEqual({ total: 1, offset: 0, items: [{ id: 'p1', uri: 'spotify:playlist:p1', name: 'Road trip', owner: 'Me', total: 12, image: 'https://i.scdn.co/a' }] });
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/me/playlists?limit=50&offset=0');
  });

  it('validates shuffle and repeat requests before calling Spotify', async () => {
    const { controller, req, csrf } = await setup();
    await expect(controller.shuffle(req, csrf, { device_id: 'device-1' })).rejects.toThrow('Choose shuffle on or off.');
    await expect(controller.repeat(req, csrf, { state: 'forever', device_id: 'device-1' })).rejects.toThrow('Choose a repeat mode');
    await expect(controller.repeat(req, csrf, { state: 'track' })).rejects.toThrow('browser player is not ready yet');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(controller.repeat(req, csrf, { state: 'context', device_id: 'device-1' })).resolves.toEqual({ ok: true, state: 'context' });
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/me/player/repeat?state=context&device_id=device-1');
  });

  it('reports an expired authorization as 401 instead of a server error', async () => {
    const { controller, req, csrf, db, user } = await setup();
    await db.updateSpotifyTokens(user.id, 'old', 'bad', 0);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 400 }));
    await expect(controller.myPlaylists(req, csrf)).rejects.toMatchObject({ status: 401 });
  });

  it('disconnects Spotify without signing the user out', async () => {
    const { controller, req, csrf, spotify, user, sessions } = await setup();
    expect(await controller.disconnect(req, csrf)).toEqual({ connected: false });
    expect(await spotify.connected(user.id)).toBe(false);
    expect((await sessions.current(req))?.user.id).toBe(user.id);
  });
});

describe('upstreamError', () => {
  it('keeps specific statuses only when a message explains them', async () => {
    expect(upstreamError(403, { 403: 'Premium required' }, 'fallback').getStatus()).toBe(403);
    expect(upstreamError(403, {}, 'fallback').getStatus()).toBe(502);
    expect(upstreamError(429, {}, 'fallback').getStatus()).toBe(429);
    expect(upstreamError(500, {}, 'fallback').message).toBe('fallback');
  });
});
