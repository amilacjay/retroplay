import { Controller, Get, Post, Put, Req, Res, Headers, Body, HttpException, HttpStatus, Inject, Param, Query } from '@nestjs/common';
import type { Request, Response } from 'express';
import { safeEqual } from './crypto';
import { appUrl, cookieOptions, safeReturnTo } from './http';
import { SessionService } from './session.service';
import { SPOTIFY_EXPIRED, SpotifyAuthError, SpotifyService } from './spotify.service';
import { PLAYLIST_ID } from './validation';

const OAUTH = 'cassete.oauth';
const REPEAT_STATES = ['off', 'context', 'track'] as const;

type UpstreamMessages = Partial<Record<number, string>>;
const COMMON_MESSAGES: UpstreamMessages = { 401: 'Spotify authorization expired. Connect your account again.', 429: 'Spotify is rate limiting requests. Please wait and retry.' };
const STATUS_FOR: Partial<Record<number, HttpStatus>> = { 401: HttpStatus.UNAUTHORIZED, 403: HttpStatus.FORBIDDEN, 404: HttpStatus.NOT_FOUND, 429: HttpStatus.TOO_MANY_REQUESTS };

/** Maps a failed Spotify Web API status to a user-facing error; unknown statuses become 502 with the fallback message. */
export function upstreamError(status: number, messages: UpstreamMessages, fallback: string) {
  const message = messages[status] ?? COMMON_MESSAGES[status];
  return new HttpException(message ?? fallback, message ? STATUS_FOR[status] ?? HttpStatus.BAD_GATEWAY : HttpStatus.BAD_GATEWAY);
}

export function mapPlaylist(item: any) {
  return { id: item.id, uri: item.uri, name: item.name, owner: item.owner?.display_name ?? item.owner?.id ?? 'Spotify user', total: item.items?.total ?? item.tracks?.total ?? 0, image: item.images?.[0]?.url ?? null };
}

@Controller()
export class SpotifyController {
  constructor(@Inject(SpotifyService) private readonly spotify: SpotifyService, @Inject(SessionService) private readonly sessions: SessionService) {}

  /** Links Spotify to the signed-in Retro Play account. Signing in with Google comes first. */
  @Get('auth/login') async login(@Req() req: Request, @Res() res: Response) {
    if (!this.spotify.configured()) throw new HttpException('Spotify credentials are not configured. Copy .env.example to .env and add your Spotify app credentials and APP_SECRET.', 503);
    const returnTo = safeReturnTo(req.query.returnTo);
    const context = await this.sessions.current(req);
    if (!context) return res.redirect(appUrl(returnTo, 'signin'));
    const { state } = this.spotify.createAttempt(context.user.id, returnTo);
    res.cookie(OAUTH, state, cookieOptions(10 * 60_000));
    return res.redirect(this.spotify.authorizationUrl(state));
  }

  @Get('auth/callback') async callback(@Req() req: Request, @Res() res: Response) {
    const state = String(req.query.state ?? '');
    const cookieState = req.cookies?.[OAUTH] as string | undefined;
    res.clearCookie(OAUTH, cookieOptions());
    const attempt = cookieState && safeEqual(cookieState, state) ? this.spotify.consumeAttempt(state) : undefined;
    const context = await this.sessions.current(req);
    if (!attempt || !context || context.user.id !== attempt.userId) return res.redirect(appUrl(attempt?.returnTo ?? '/', 'state'));
    if (req.query.error) return res.redirect(appUrl(attempt.returnTo, 'denied'));
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return res.redirect(appUrl(attempt.returnTo, 'callback'));
    try {
      await this.spotify.connect(context.user.id, code);
      return res.redirect(appUrl(attempt.returnTo));
    } catch {
      return res.redirect(appUrl(attempt.returnTo, 'exchange'));
    }
  }

  /** A short-lived access token for the Web Playback SDK. The refresh token never leaves the server. */
  @Get('api/token') async token(@Req() req: Request) {
    const context = await this.sessions.current(req);
    if (!context) throw new HttpException('Sign in to Retro Play first.', HttpStatus.UNAUTHORIZED);
    try { return { access_token: await this.spotify.accessToken(context.user.id) }; }
    catch (cause) { throw new HttpException(cause instanceof SpotifyAuthError ? cause.message : SPOTIFY_EXPIRED, HttpStatus.UNAUTHORIZED); }
  }

  @Post('api/spotify/disconnect') async disconnect(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string) {
    const { user } = await this.sessions.require(req, csrf);
    await this.spotify.disconnect(user.id);
    return { connected: false };
  }

  @Get('api/playlists/search') async searchPlaylists(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Query('q') queryValue?: string) {
    const { user } = await this.sessions.require(req, csrf);
    const query = queryValue?.trim() ?? '';
    if (query.length < 2 || query.length > 100) throw new HttpException('Enter at least 2 characters to search playlists.', HttpStatus.BAD_REQUEST);
    const params = new URLSearchParams({ q: query, type: 'playlist', limit: '10' });
    const response = await this.spotify.request(user.id, `/search?${params}`);
    if (!response.ok) throw upstreamError(response.status, {}, `Playlist search failed (HTTP ${response.status}).`);
    const data = await response.json() as any;
    return { items: (data.playlists?.items ?? []).filter(Boolean).map(mapPlaylist) };
  }

  @Get('api/playlists/mine') async myPlaylists(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Query('offset') offsetValue?: string) {
    const { user } = await this.sessions.require(req, csrf);
    const offset = parseOffset(offsetValue);
    const response = await this.spotify.request(user.id, `/me/playlists?limit=50&offset=${offset}`);
    if (!response.ok) throw upstreamError(response.status, { 403: 'Reconnect Spotify to let Retro Play read your playlists.' }, `Could not load your playlists (HTTP ${response.status}).`);
    const data = await response.json() as any;
    return { total: data.total ?? 0, offset: data.offset ?? offset, items: (data.items ?? []).filter(Boolean).map(mapPlaylist) };
  }

  @Get('api/playlists/:id') async playlist(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Param('id') id: string) {
    const { user } = await this.sessions.require(req, csrf);
    if (!PLAYLIST_ID.test(id)) throw new HttpException('Enter a valid Spotify playlist.', HttpStatus.BAD_REQUEST);
    const response = await this.spotify.request(user.id, `/playlists/${encodeURIComponent(id)}`);
    if (!response.ok) throw upstreamError(response.status, { 403: 'Spotify did not share this playlist with Retro Play.', 404: 'Spotify could not find that playlist.' }, `Could not load playlist (HTTP ${response.status}).`);
    return mapPlaylist(await response.json());
  }

  @Get('api/playlists/:id/items') async playlistItems(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Param('id') id: string, @Query('offset') offsetValue?: string) {
    const { user } = await this.sessions.require(req, csrf);
    if (!PLAYLIST_ID.test(id)) throw new HttpException('Enter a valid Spotify playlist.', HttpStatus.BAD_REQUEST);
    const offset = parseOffset(offsetValue);
    const response = await this.spotify.request(user.id, `/playlists/${encodeURIComponent(id)}/items?limit=50&offset=${offset}`);
    if (!response.ok) throw upstreamError(response.status, { 403: 'Spotify only lets this app browse playlists you own or collaborate on. Try a playlist from your library.', 404: 'Spotify could not find that playlist.' }, `Could not load playlist (HTTP ${response.status}).`);
    const data = await response.json() as any;
    return { total: data.total ?? 0, offset: data.offset ?? offset, items: (data.items ?? []).map((entry: any) => {
      const track = entry.item;
      if (!track || track.type !== 'track' || !track.uri) return null;
      return { uri: track.uri, name: track.name, artists: (track.artists ?? []).map((artist: any) => artist.name), duration_ms: track.duration_ms, album: track.album?.name, image: track.album?.images?.[1]?.url ?? track.album?.images?.[0]?.url ?? null };
    }).filter(Boolean) };
  }

  @Put('api/play') async play(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: { context_uri?: string; track_uri?: string; position_ms?: number; device_id?: string }) {
    const { user } = await this.sessions.require(req, csrf);
    const uri = body.context_uri?.trim() ?? '';
    if (!/^spotify:playlist:[A-Za-z0-9]+$/.test(uri)) throw new HttpException('Enter a Spotify playlist URL or URI.', HttpStatus.BAD_REQUEST);
    if (body.track_uri && !/^spotify:track:[A-Za-z0-9]+$/.test(body.track_uri)) throw new HttpException('Select a valid Spotify track.', HttpStatus.BAD_REQUEST);
    if (body.position_ms !== undefined && (!Number.isInteger(body.position_ms) || body.position_ms < 0 || body.position_ms > 24 * 60 * 60_000)) throw new HttpException('Choose a valid start position.', HttpStatus.BAD_REQUEST);
    const deviceId = requireDevice(body.device_id);
    const response = await this.spotify.request(user.id, `/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_uri: uri, ...(body.track_uri ? { offset: { uri: body.track_uri } } : {}), ...(body.track_uri && body.position_ms ? { position_ms: body.position_ms } : {}) }) });
    if (response.ok) return { ok: true };
    throw upstreamError(response.status, PLAYER_MESSAGES, `Spotify could not start playback (HTTP ${response.status}). Check that the playlist is available to your account.`);
  }

  @Put('api/player/shuffle') async shuffle(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: { state?: boolean; device_id?: string }) {
    const { user } = await this.sessions.require(req, csrf);
    if (typeof body.state !== 'boolean') throw new HttpException('Choose shuffle on or off.', HttpStatus.BAD_REQUEST);
    const deviceId = requireDevice(body.device_id);
    const response = await this.spotify.request(user.id, `/me/player/shuffle?state=${body.state}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
    if (response.ok) return { ok: true, state: body.state };
    throw upstreamError(response.status, PLAYER_MESSAGES, `Spotify could not change shuffle (HTTP ${response.status}).`);
  }

  @Put('api/player/repeat') async repeat(@Req() req: Request, @Headers('x-cassete-csrf') csrf: string, @Body() body: { state?: string; device_id?: string }) {
    const { user } = await this.sessions.require(req, csrf);
    if (!REPEAT_STATES.includes(body.state as typeof REPEAT_STATES[number])) throw new HttpException('Choose a repeat mode: off, context, or track.', HttpStatus.BAD_REQUEST);
    const deviceId = requireDevice(body.device_id);
    const response = await this.spotify.request(user.id, `/me/player/repeat?state=${body.state}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' });
    if (response.ok) return { ok: true, state: body.state };
    throw upstreamError(response.status, PLAYER_MESSAGES, `Spotify could not change repeat (HTTP ${response.status}).`);
  }
}

const PLAYER_MESSAGES: UpstreamMessages = { 403: 'Playback requires Spotify Premium and an eligible playback account.', 404: 'Spotify could not find an active device. Wait for the browser player to connect.' };

function requireDevice(deviceId: string | undefined) {
  if (!deviceId || deviceId.length > 256) throw new HttpException('The browser player is not ready yet. Reconnect and try again.', HttpStatus.CONFLICT);
  return deviceId;
}

function parseOffset(value: string | undefined) {
  const offset = Number(value ?? 0);
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw new HttpException('Invalid playlist page.', HttpStatus.BAD_REQUEST);
  return offset;
}
