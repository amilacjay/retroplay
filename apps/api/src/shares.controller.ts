import { Body, Controller, Delete, Get, Headers, HttpException, HttpStatus, Inject, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Database, type Share } from './database';
import { webOrigin } from './http';
import { SessionService } from './session.service';
import { mapPlaylist, upstreamError } from './spotify.controller';
import { SpotifyService } from './spotify.service';
import { PLAYLIST_ID } from './validation';

const SHARE_ID = /^[A-Za-z0-9_-]{8,32}$/;
const RECHECK_MS = 5 * 60_000;
export const NOT_PUBLIC = 'Only public Spotify playlists can be shared. Make this playlist public in Spotify, then try again.';
export const NO_LONGER_PUBLIC = 'This playlist is no longer public on Spotify, so the share link is paused.';
export const SHARE_MISSING = 'This share link does not exist or was removed by its owner.';

/**
 * Retro Play share links (`/s/:id`) for public Spotify playlists. Anyone with the link can see what was shared;
 * listening still needs their own Retro Play account with Spotify connected, because playback runs on their account.
 */
@Controller('api/shares')
export class SharesController {
  private readonly checkedAt = new Map<string, number>();

  constructor(@Inject(SessionService) private readonly sessions: SessionService, @Inject(SpotifyService) private readonly spotify: SpotifyService, @Inject(Database) private readonly db: Database) {}

  @Post() async create(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: { playlistId?: unknown }) {
    const { user } = await this.sessions.require(req, csrf);
    const id = typeof body.playlistId === 'string' ? body.playlistId : '';
    if (!PLAYLIST_ID.test(id) || id.length > 64) throw new HttpException('Choose a Spotify playlist to share.', HttpStatus.BAD_REQUEST);
    const response = await this.spotify.request(user.id, `/playlists/${encodeURIComponent(id)}`);
    if (!response.ok) throw upstreamError(response.status, { 403: 'Spotify did not share this playlist with Retro Play.', 404: 'Spotify could not find that playlist.' }, `Could not check the playlist (HTTP ${response.status}).`);
    const data = await response.json() as any;
    // Spotify reports `public: true` only for playlists anyone can open; private, collaborative, and unknown all count as not public.
    if (data.public !== true) throw new HttpException(NOT_PUBLIC, HttpStatus.UNPROCESSABLE_ENTITY);
    const share = await this.db.upsertShare(user.id, mapPlaylist(data));
    this.checkedAt.set(share.id, Date.now());
    return this.view(share);
  }

  @Get() async mine(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string) {
    const { user } = await this.sessions.require(req, csrf);
    return { items: (await this.db.listShares(user.id)).map(share => this.view(share)) };
  }

  /** Open to anyone with the link. Re-checks with Spotify (at most every few minutes) that the playlist is still public. */
  @Get(':id') async open(@Req() req: Request, @Param('id') id: string) {
    if (!SHARE_ID.test(id)) throw new HttpException(SHARE_MISSING, HttpStatus.NOT_FOUND);
    let share = await this.db.getShare(id);
    if (!share) throw new HttpException(SHARE_MISSING, HttpStatus.NOT_FOUND);
    if (Date.now() - (this.checkedAt.get(id) ?? 0) > RECHECK_MS) share = await this.recheck(share, (await this.sessions.current(req))?.user.id);
    const owner = await this.db.getUser(share.userId);
    return { ...this.view(share), sharedBy: owner?.displayName ?? owner?.name ?? 'A Retro Play listener' };
  }

  @Delete(':id') async remove(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Param('id') id: string) {
    const { user } = await this.sessions.require(req, csrf);
    if (!SHARE_ID.test(id) || !(await this.db.deleteShare(id, user.id))) throw new HttpException(SHARE_MISSING, HttpStatus.NOT_FOUND);
    this.checkedAt.delete(id);
    return { ok: true };
  }

  /**
   * Asks Spotify about the playlist as the owner (or, if the owner disconnected Spotify, as the viewer). If nobody can ask,
   * or Spotify is unavailable, the stored snapshot is served: playback still goes through Spotify's own access checks.
   */
  private async recheck(share: Share, viewerId: string | undefined): Promise<Share> {
    let asUser: string | undefined;
    for (const candidate of [share.userId, viewerId]) if (candidate && await this.spotify.connected(candidate)) { asUser = candidate; break; }
    if (!asUser) return share;
    let response: Response;
    try { response = await this.spotify.request(asUser, `/playlists/${encodeURIComponent(share.playlist.id)}`); }
    catch { return share; }
    if (response.status === 404) throw new HttpException('Spotify could not find this playlist anymore.', HttpStatus.GONE);
    if (!response.ok) return share;
    const data = await response.json() as any;
    if (data.public !== true) throw new HttpException(NO_LONGER_PUBLIC, HttpStatus.GONE);
    const playlist = mapPlaylist(data);
    await this.db.updateShareSnapshot(share.id, playlist);
    this.checkedAt.set(share.id, Date.now());
    return { ...share, playlist };
  }

  private view(share: Share) { return { id: share.id, url: `${webOrigin()}/s/${share.id}`, playlist: share.playlist, createdAt: share.createdAt }; }
}
