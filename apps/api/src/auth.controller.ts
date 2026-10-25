import { Controller, Get, Headers, HttpException, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { safeEqual } from './crypto';
import { Database, type User } from './database';
import { GoogleService, UnverifiedEmailError } from './google.service';
import { appUrl, cookieOptions, safeReturnTo } from './http';
import { SESSION_TTL, SID, SessionService } from './session.service';

const OAUTH = 'cassete.oauth.google';

/** The profile the web app renders. Email is shown only to its owner; tokens never appear here. */
export async function profileView(user: User, db: Database) {
  return {
    user: { name: user.displayName ?? user.name, googleName: user.name, email: user.email, picture: user.picture, createdAt: user.createdAt },
    spotify: await db.spotifyProfile(user.id), preferences: user.preferences, nowPlaying: user.nowPlaying,
  };
}

@Controller()
export class AuthController {
  constructor(@Inject(GoogleService) private readonly google: GoogleService, @Inject(SessionService) private readonly sessions: SessionService, @Inject(Database) private readonly db: Database) {}

  @Get('auth/google/login') login(@Req() req: Request, @Res() res: Response) {
    if (!this.google.configured()) throw new HttpException('Google sign-in is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and APP_SECRET to .env.', 503);
    const { state, url } = this.google.begin(safeReturnTo(req.query.returnTo));
    res.cookie(OAUTH, state, cookieOptions(10 * 60_000));
    return res.redirect(url);
  }

  @Get('auth/google/callback') async callback(@Req() req: Request, @Res() res: Response) {
    const state = String(req.query.state ?? '');
    const cookieState = req.cookies?.[OAUTH] as string | undefined;
    res.clearCookie(OAUTH, cookieOptions());
    const attempt = cookieState && safeEqual(cookieState, state) ? this.google.consumeAttempt(state) : undefined;
    if (!attempt) return res.redirect(appUrl('/', 'google_state'));
    if (req.query.error) return res.redirect(appUrl(attempt.returnTo, 'google_denied'));
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return res.redirect(appUrl(attempt.returnTo, 'google_state'));
    try {
      const user = await this.db.upsertGoogleUser(await this.google.identify(code, attempt));
      const previous = await this.sessions.current(req);
      if (previous) await this.sessions.destroy(previous.sessionId);
      res.cookie(SID, await this.sessions.create(user.id), cookieOptions(SESSION_TTL));
      return res.redirect(appUrl(attempt.returnTo));
    } catch (cause) {
      return res.redirect(appUrl(attempt.returnTo, cause instanceof UnverifiedEmailError ? 'google_unverified' : 'google_exchange'));
    }
  }

  @Get('api/session') async session(@Req() req: Request) {
    const context = await this.sessions.current(req);
    if (!context) return { authenticated: false, signInAvailable: this.google.configured() };
    return { authenticated: true, csrf: context.csrf, ...await profileView(context.user, this.db) };
  }

  @Post('api/logout') async logout(@Req() req: Request, @Res() res: Response, @Headers('x-cassete-csrf') csrf: string) {
    const context = await this.sessions.current(req);
    if (context && (!csrf || !safeEqual(context.csrf, csrf))) throw new HttpException('Invalid CSRF token.', HttpStatus.FORBIDDEN);
    if (context) await this.sessions.destroy(context.sessionId);
    res.clearCookie(SID, cookieOptions());
    return res.json({ authenticated: false });
  }
}
