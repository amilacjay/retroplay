import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from './auth.controller';
import { GoogleService, readIdToken, UnverifiedEmailError } from './google.service';
import { safeReturnTo } from './http';
import { SID } from './session.service';
import { json, testApp } from './test/helpers';

const token = (claims: Record<string, unknown>) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const valid = { iss: 'https://accounts.google.com', aud: 'client-id', exp: Math.floor(Date.now() / 1000) + 600, nonce: 'nonce-1', sub: '1234', email: 'a@example.com', email_verified: true, name: 'Ada', picture: 'https://lh3.googleusercontent.com/a' };

describe('Google ID token checks', () => {
  it('returns the identity for a valid token', async () => {
    expect(readIdToken(token(valid), { clientId: 'client-id', nonce: 'nonce-1' })).toEqual({ sub: '1234', email: 'a@example.com', name: 'Ada', picture: 'https://lh3.googleusercontent.com/a' });
  });
  it.each([
    ['wrong audience', { aud: 'someone-else' }],
    ['wrong issuer', { iss: 'https://evil.example' }],
    ['expired', { exp: 1 }],
    ['replayed nonce', { nonce: 'other' }],
  ])('rejects a token with a %s', (_, override) => {
    expect(() => readIdToken(token({ ...valid, ...override }), { clientId: 'client-id', nonce: 'nonce-1' })).toThrow();
  });
  it('rejects unverified email addresses', async () => {
    expect(() => readIdToken(token({ ...valid, email_verified: false }), { clientId: 'client-id', nonce: 'nonce-1' })).toThrow(UnverifiedEmailError);
  });
});

describe('return paths', () => {
  it('allows only the home page and share pages', async () => {
    expect(safeReturnTo('/')).toBe('/');
    expect(safeReturnTo('/s/abcdefgh12')).toBe('/s/abcdefgh12');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('https://evil.example/s/abcdefgh12')).toBe('/');
    expect(safeReturnTo(undefined)).toBe('/');
  });
});

describe('AuthController', () => {
  afterEach(() => { jest.restoreAllMocks(); });
  const setup = async (options?: { spotify?: boolean }) => { const app = await testApp(options); const google = new GoogleService(); return { ...app, google, controller: new AuthController(google, app.sessions, app.db) }; };
  const response = () => ({ redirect: jest.fn(), clearCookie: jest.fn(), cookie: jest.fn(), json: jest.fn() }) as any;

  it('describes a signed-in user with their Spotify connection and saved profile, but no tokens', async () => {
    const { controller, req, csrf, db, user } = await setup();
    await db.setPreferences(user.id, { appearance: 'dark' });
    const session = await controller.session(req) as any;
    expect(session).toMatchObject({ authenticated: true, csrf, user: { name: 'Listener', email: 'listener@example.com' }, spotify: { connected: true, displayName: 'Listener' }, preferences: { appearance: 'dark' }, nowPlaying: null });
    expect(JSON.stringify(session)).not.toMatch(/access|refresh/);
  });

  it('reports a signed-out visitor', async () => {
    expect(await (await setup()).controller.session({ cookies: {} } as any)).toMatchObject({ authenticated: false });
  });

  it('rejects a callback whose state does not match the browser cookie', async () => {
    const { controller, google } = await setup();
    const { state } = google.begin('/');
    const res = response();
    await controller.callback({ query: { state, code: 'code' }, cookies: { 'cassete.oauth.google': 'different' } } as any, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('authError=google_state'));
  });

  it('signs a Google user in, creates the account, and returns to the share page they came from', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'; process.env.GOOGLE_CLIENT_SECRET = 'secret'; process.env.GOOGLE_REDIRECT_URI = 'http://127.0.0.1:3000/auth/google/callback';
    const { controller, google, db, sessions } = await setup();
    const { state, url } = google.begin('/s/abcdefgh12');
    const nonce = new URL(url).searchParams.get('nonce');
    expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(json({ id_token: token({ ...valid, nonce, aud: 'client-id', sub: 'new-user' }) }));
    const res = response();
    await controller.callback({ query: { state, code: 'code' }, cookies: { 'cassete.oauth.google': state } } as any, res);
    expect(String((fetchSpy.mock.calls[0][1] as RequestInit).body)).toContain('code_verifier=');
    expect(res.redirect).toHaveBeenCalledWith('http://127.0.0.1:5173/s/abcdefgh12');
    const [name, sid] = res.cookie.mock.calls[0];
    expect(name).toBe(SID);
    const context = (await sessions.current({ cookies: { [SID]: sid } } as any))!;
    expect(context.user.email).toBe('a@example.com');
    expect(await db.hasSpotifyLink(context.user.id)).toBe(false);
  });

  it('logs out only with the session CSRF token', async () => {
    const { controller, req, csrf, sessions } = await setup();
    await expect(controller.logout(req, response(), 'wrong')).rejects.toThrow('Invalid CSRF token.');
    await controller.logout(req, response(), csrf);
    expect(await sessions.current(req)).toBeUndefined();
  });
});
