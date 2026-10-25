import { useEffect, useRef } from 'react';
import type { SpotifyState } from '../spotify-sdk';

type Actions = { play(): void; pause(): void; next(): void; previous(): void; seekTo(ms: number): void };

/** Mirrors SDK playback into the OS media controls (media keys, lock screen) and the tab title. */
export function useMediaSession(playback: SpotifyState | null, actions: Actions) {
  const ref = useRef(actions);
  ref.current = actions;
  const track = playback?.track_window.current_track;
  const playing = Boolean(playback && !playback.paused);

  useEffect(() => {
    const base = 'Retro Play';
    document.title = track ? `${playing ? '▶ ' : ''}${track.name} · ${track.artists.map(artist => artist.name).join(', ')} — ${base}` : `${base} — your listening room`;
  }, [track?.name, track?.artists, playing]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = track ? new MediaMetadata({ title: track.name, artist: track.artists.map(artist => artist.name).join(', '), album: track.album.name ?? '', artwork: track.album.images.map(image => ({ src: image.url })) }) : null;
  }, [track?.uri, track?.name]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playback ? (playing ? 'playing' : 'paused') : 'none';
  }, [playback, playing]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => ref.current.play()], ['pause', () => ref.current.pause()],
      ['nexttrack', () => ref.current.next()], ['previoustrack', () => ref.current.previous()],
      ['seekto', details => { if (details.seekTime !== undefined) ref.current.seekTo(details.seekTime * 1000); }],
    ];
    for (const [action, handler] of handlers) { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ } }
    return () => { for (const [action] of handlers) { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* unsupported action */ } } };
  }, []);
}
