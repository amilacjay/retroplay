import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { shareIdFromPath, timeAgo } from './format';
import { readPreferences, type Preferences } from './preferences';
import { toNowPlaying, usePreferenceSync } from '../hooks/useProfileSync';

const base: Preferences = { appearance: 'light', playerTheme: 'cassette', coverFit: 'cover', showCoverTitle: true, skins: { cassette: 'hifi-deck', vinyl: 'hifi-turntable' }, coverPositions: {}, coverPan: { cassette: 50, vinyl: 50 }, volume: 0.7, recents: [] };

describe('profile helpers', () => {
  it('finds share ids only in /s/:id paths', () => {
    expect(shareIdFromPath('/s/abcdefgh12')).toBe('abcdefgh12');
    expect(shareIdFromPath('/s/short')).toBeNull();
    expect(shareIdFromPath('/playlist/abcdefgh12')).toBeNull();
  });
  it('reads saved preferences and drops malformed values', () => {
    expect(readPreferences({ appearance: 'dark', coverFit: 'sideways', volume: 3, skins: { cassette: 'boombox', vinyl: 'dj' }, recents: [{ id: 'x' }, { id: 'p', uri: 'spotify:playlist:p', name: 'P' }] }))
      .toEqual({ appearance: 'dark', skins: { cassette: 'boombox', vinyl: 'dj' }, recents: [{ id: 'p', uri: 'spotify:playlist:p', name: 'P' }] });
    expect(readPreferences(null)).toEqual({});
  });
  it('describes how long ago something happened', () => {
    expect(timeAgo(1_000_000, 1_000_000)).toBe('just now');
    expect(timeAgo(0, 3 * 3_600_000)).toBe('3 hr ago');
  });
  it('saves only resumable Spotify tracks', () => {
    const state = (uri: string) => ({ paused: true, position: 1234.5, duration: 9000, track_window: { current_track: { uri, name: 'Song', artists: [{ name: 'Band' }], album: { name: 'LP', images: [{ url: 'https://i.scdn.co/a' }] } } } });
    expect(toNowPlaying(state('spotify:track:t1'), null)).toEqual({ playlist: null, track: { uri: 'spotify:track:t1', name: 'Song', artists: ['Band'], album: 'LP', image: 'https://i.scdn.co/a' }, positionMs: 1234, durationMs: 9000, paused: true });
    expect(toNowPlaying(state('spotify:episode:e1'), null)).toBeNull();
  });
});

describe('usePreferenceSync', () => {
  afterEach(() => { vi.useRealTimers(); });
  const fetchMock = () => vi.fn(async () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({}) }) as Response);

  it('applies saved preferences on sign-in without echoing them back', () => {
    vi.useFakeTimers();
    window.fetch = fetchMock() as any;
    const apply = vi.fn();
    const session = { authenticated: true, csrf: 'c1', preferences: { appearance: 'dark' } };
    const { rerender } = renderHook(({ current }) => usePreferenceSync(session, current, apply), { initialProps: { current: base } });
    expect(apply).toHaveBeenCalledWith({ appearance: 'dark' });
    rerender({ current: { ...base, appearance: 'dark' } });
    vi.advanceTimersByTime(1500);
    expect(window.fetch).not.toHaveBeenCalled();
  });

  it('uploads local preferences on a first sign-in and saves later changes', () => {
    vi.useFakeTimers();
    window.fetch = fetchMock() as any;
    const session = { authenticated: true, csrf: 'c1', preferences: {} };
    const { rerender } = renderHook(({ current }) => usePreferenceSync(session, current, vi.fn()), { initialProps: { current: base } });
    vi.advanceTimersByTime(1500);
    expect(window.fetch).toHaveBeenCalledTimes(1);
    rerender({ current: { ...base, volume: 0.3 } });
    vi.advanceTimersByTime(1500);
    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((window.fetch as any).mock.calls[1][1].body)).volume).toBe(0.3);
  });
});
