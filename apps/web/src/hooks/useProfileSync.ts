import { useEffect, useRef } from 'react';
import { api, type NowPlaying, type PlaylistResult, type SessionInfo } from '../lib/api';
import { readPreferences, type Preferences } from '../lib/preferences';
import type { SpotifyState } from '../spotify-sdk';

/**
 * Keeps customisation in the signed-in profile. On sign-in, saved values replace the local ones (a first sign-in has none,
 * so the local ones are uploaded instead); after that, changes are saved a moment after they settle.
 */
export function usePreferenceSync(session: SessionInfo, current: Preferences, apply: (saved: Partial<Preferences>) => void) {
  const hydratedFor = useRef<string | null>(null);
  const lastSent = useRef('');
  const serialized = JSON.stringify(current);
  const { authenticated, csrf } = session;

  useEffect(() => {
    if (!authenticated || !csrf) { hydratedFor.current = null; return; }
    if (hydratedFor.current === csrf) return;
    hydratedFor.current = csrf;
    const saved = readPreferences(session.preferences);
    if (Object.keys(saved).length) { apply(saved); lastSent.current = JSON.stringify({ ...current, ...saved }); }
    else lastSent.current = '';
  }, [authenticated, csrf]);

  useEffect(() => {
    if (!authenticated || !csrf || hydratedFor.current !== csrf || serialized === lastSent.current) return;
    const timer = window.setTimeout(() => {
      lastSent.current = serialized;
      void api('/api/profile/preferences', csrf, { method: 'PUT', body: JSON.parse(serialized) }).catch(() => { lastSent.current = ''; });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [authenticated, csrf, serialized]);
}

/** The SDK state as a profile "now playing" record, or null for things that cannot be resumed (podcasts, local files). */
export function toNowPlaying(playback: SpotifyState, playlist: PlaylistResult | null): NowPlaying | null {
  const track = playback.track_window.current_track;
  if (!track?.uri || !/^spotify:track:[A-Za-z0-9]+$/.test(track.uri)) return null;
  return {
    playlist,
    track: { uri: track.uri, name: track.name, artists: track.artists.map(artist => artist.name), album: track.album.name ?? null, image: track.album.images[0]?.url ?? null },
    positionMs: Math.max(0, Math.floor(playback.position)), durationMs: Math.max(0, Math.floor(playback.duration)), paused: playback.paused,
  };
}

const SAVE_EVERY_MS = 15_000;

/**
 * Saves the current song and whether it is playing: immediately on a track or play/pause change, every 15 s while playing
 * (the SDK sends no events in between), and once more when the tab is hidden or closed.
 */
export function useNowPlayingSync(csrf: string | undefined, enabled: boolean, playback: SpotifyState | null, playlistFor: (contextUri: string | null | undefined) => PlaylistResult | null) {
  const latest = useRef<{ state: NowPlaying; at: number } | null>(null);
  const lastKey = useRef('');
  const playlistForRef = useRef(playlistFor);
  playlistForRef.current = playlistFor;

  const estimate = () => {
    const entry = latest.current;
    if (!entry) return null;
    const { state } = entry;
    return state.paused ? state : { ...state, positionMs: Math.min(state.durationMs || Infinity, state.positionMs + Date.now() - entry.at) };
  };
  const send = (state: NowPlaying | null, keepalive = false) => {
    if (!state || !csrf) return;
    if (keepalive) { void fetch('/api/profile/now-playing', { method: 'PUT', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json', 'X-Cassete-CSRF': csrf }, body: JSON.stringify(state) }).catch(() => {}); return; }
    void api('/api/profile/now-playing', csrf, { method: 'PUT', body: state }).catch(() => {});
  };

  useEffect(() => {
    if (!enabled || !csrf || !playback) return;
    const state = toNowPlaying(playback, playlistForRef.current(playback.context?.uri));
    if (!state) return;
    latest.current = { state, at: Date.now() };
    const key = `${state.track.uri}|${state.paused}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    send(state);
  }, [playback, enabled, csrf]);

  useEffect(() => {
    if (!enabled || !csrf) { latest.current = null; lastKey.current = ''; return; }
    const timer = window.setInterval(() => { if (latest.current && !latest.current.state.paused) send(estimate()); }, SAVE_EVERY_MS);
    const onHide = () => { if (document.visibilityState === 'hidden') send(estimate(), true); };
    const onPageHide = () => send(estimate(), true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onPageHide); };
  }, [enabled, csrf]);
}
