import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { appSecretConfigured, randomToken, safeEqual } from './crypto';
import type { GoogleIdentity } from './database';
import { OAuthAttempts } from './oauth-attempts';

type GoogleAttempt = { returnTo: string; verifier: string; nonce: string };
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Reads the identity claims from an ID token that came straight from Google's token endpoint.
 * OpenID Connect allows skipping the signature check in that case (TLS to the issuer authenticates it), but the
 * audience, issuer, expiry, nonce, and verified email are still enforced.
 */
export function readIdToken(idToken: string, expected: { clientId: string; nonce: string; now?: number }): GoogleIdentity {
  const [, payload] = idToken.split('.');
  let claims: Record<string, any>;
  try { claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString('utf8')); } catch { throw new Error('Google returned an unreadable ID token.'); }
  const now = Math.floor((expected.now ?? Date.now()) / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ISSUERS.includes(claims.iss) || !audience.includes(expected.clientId) || typeof claims.exp !== 'number' || claims.exp < now) throw new Error('Google ID token failed validation.');
  if (typeof claims.nonce !== 'string' || !safeEqual(claims.nonce, expected.nonce)) throw new Error('Google ID token nonce mismatch.');
  if (typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string') throw new Error('Google ID token is missing the account id or email.');
  if (claims.email_verified !== true) throw new UnverifiedEmailError();
  const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 120) : claims.email.split('@')[0];
  const picture = typeof claims.picture === 'string' && claims.picture.startsWith('https://') ? claims.picture : null;
  return { sub: claims.sub, email: claims.email, name, picture };
}

export class UnverifiedEmailError extends Error { constructor() { super('Google account email is not verified.'); } }

@Injectable()
export class GoogleService {
  private readonly attempts = new OAuthAttempts<GoogleAttempt>();
  readonly scopes = ['openid', 'email', 'profile'];

  configured() { return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI && appSecretConfigured()); }

  /** Starts an authorization-code flow with PKCE (S256) and a nonce; returns the state for the double-submit cookie. */
  begin(returnTo: string) {
    const verifier = randomToken(48);
    const nonce = randomToken();
    const state = this.attempts.create({ returnTo, verifier, nonce });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      response_type: 'code', client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: process.env.GOOGLE_REDIRECT_URI!, scope: this.scopes.join(' '),
      state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account',
    }).toString();
    return { state, url: url.toString() };
  }

  consumeAttempt(state: string | undefined) { return this.attempts.consume(state); }

  async identify(code: string, attempt: GoogleAttempt): Promise<GoogleIdentity> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: attempt.verifier, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: process.env.GOOGLE_REDIRECT_URI! }),
    });
    if (!response.ok) throw new Error(`Google token request failed (${response.status}).`);
    const result = await response.json() as { id_token?: string };
    if (!result.id_token) throw new Error('Google did not return an ID token.');
    return readIdToken(result.id_token, { clientId: process.env.GOOGLE_CLIENT_ID!, nonce: attempt.nonce });
  }
}
