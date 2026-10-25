import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { randomToken, safeEqual, sha256 } from './crypto';
import { Database, type User } from './database';

export const SID = 'cassete.sid';
export const SESSION_TTL = 30 * 24 * 60 * 60_000;
export type AuthContext = { sessionId: string; user: User; csrf: string };

/** App sign-in sessions: an httpOnly cookie holding a random id (stored hashed) plus a per-session CSRF token. */
@Injectable()
export class SessionService {
  constructor(@Inject(Database) private readonly db: Database) {}

  async create(userId: string) {
    const id = randomToken();
    await this.db.createSession(sha256(id), userId, randomToken(), Date.now() + SESSION_TTL);
    return id;
  }

  async current(req: Request): Promise<AuthContext | undefined> {
    const id = req.cookies?.[SID];
    if (typeof id !== 'string' || !id) return undefined;
    const session = await this.db.getSession(sha256(id));
    if (!session) return undefined;
    if (session.expiresAt < Date.now()) { await this.db.deleteSession(sha256(id)); return undefined; }
    const user = await this.db.getUser(session.userId);
    return user ? { sessionId: id, user, csrf: session.csrf } : undefined;
  }

  /** The signed-in user for a data or mutating route; the CSRF header must match the session's token. */
  async require(req: Request, csrf: string | undefined): Promise<AuthContext> {
    const context = await this.current(req);
    if (!context) throw new HttpException('Sign in to Retro Play first.', HttpStatus.UNAUTHORIZED);
    if (!csrf || !safeEqual(context.csrf, csrf)) throw new HttpException('Session check failed. Refresh the page and sign in again.', HttpStatus.FORBIDDEN);
    return context;
  }

  async destroy(sessionId: string) { await this.db.deleteSession(sha256(sessionId)); }
}
