import { Body, Controller, Delete, Headers, HttpException, HttpStatus, Inject, Patch, Put, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { profileView } from './auth.controller';
import { Database } from './database';
import { cookieOptions } from './http';
import { SID, SessionService } from './session.service';
import { cleanNowPlaying, cleanPreferences } from './validation';

/** The signed-in user's own profile: display name, customisation, and the last song they were playing. */
@Controller('api/profile')
export class ProfileController {
  constructor(@Inject(SessionService) private readonly sessions: SessionService, @Inject(Database) private readonly db: Database) {}

  @Patch() async update(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: { displayName?: unknown }) {
    const { user } = await this.sessions.require(req, csrf);
    if (body.displayName !== null && typeof body.displayName !== 'string') throw new HttpException('Enter a display name.', HttpStatus.BAD_REQUEST);
    const name = typeof body.displayName === 'string' ? body.displayName.replace(/\s+/g, ' ').trim() : '';
    if (name.length > 60) throw new HttpException('Keep your display name to 60 characters or fewer.', HttpStatus.BAD_REQUEST);
    // An empty name falls back to the name on the Google account.
    await this.db.setDisplayName(user.id, name || null);
    return profileView((await this.db.getUser(user.id))!, this.db);
  }

  @Put('preferences') async preferences(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: unknown) {
    const { user } = await this.sessions.require(req, csrf);
    const preferences = cleanPreferences(body);
    if (!preferences) throw new HttpException('Those preferences could not be saved.', HttpStatus.BAD_REQUEST);
    await this.db.setPreferences(user.id, preferences);
    return { preferences };
  }

  /** Saves the current track and its state; `null` clears it. */
  @Put('now-playing') async nowPlaying(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: unknown) {
    const { user } = await this.sessions.require(req, csrf);
    const empty = body === null || (typeof body === 'object' && body !== null && Object.keys(body).length === 0);
    const nowPlaying = empty ? null : cleanNowPlaying(body);
    if (!empty && !nowPlaying) throw new HttpException('That playback state could not be saved.', HttpStatus.BAD_REQUEST);
    await this.db.setNowPlaying(user.id, nowPlaying);
    return { nowPlaying };
  }

  /** Deletes the account with its Spotify connection, sessions, and share links. */
  @Delete() async remove(@Req() req: Request, @Res() res: Response, @Headers('x-cassete-csrf') csrf: string) {
    const { user } = await this.sessions.require(req, csrf);
    await this.db.deleteUser(user.id);
    res.clearCookie(SID, cookieOptions());
    return res.json({ authenticated: false });
  }
}
