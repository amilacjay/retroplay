import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { mockLoad } = vi.hoisted(() => ({ mockLoad: vi.fn<() => Promise<void>>() }));
vi.mock('./spotify-sdk', async () => {
  const actual = await vi.importActual<typeof import('./spotify-sdk')>('./spotify-sdk');
  return { ...actual, loadSpotifySdk: () => mockLoad() };
});
import { useSpotifyPlayer } from './useSpotifyPlayer';

afterEach(() => { vi.clearAllMocks(); delete window.Spotify; });

describe('Spotify player lifecycle', () => {
  it('surfaces SDK script initialization failures', async () => {
    mockLoad.mockRejectedValue(new Error('script unavailable'));
    const { result } = renderHook(() => useSpotifyPlayer(true));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBe('script unavailable');
  });

  it('tracks ready, disconnected, and playback error events', async () => {
    mockLoad.mockResolvedValue();
    let listeners: Record<string, (payload: any) => void> = {};
    const mockPlayer = { connect: vi.fn().mockResolvedValue(true), disconnect: vi.fn(), addListener: vi.fn((name: string, callback: (payload: any) => void) => { listeners[name] = callback; return true; }), removeListener: vi.fn(), togglePlay: vi.fn(), previousTrack: vi.fn(), nextTrack: vi.fn(), seek: vi.fn(), setVolume: vi.fn(), activateElement: vi.fn() };
    window.Spotify = { Player: vi.fn(function() { return mockPlayer; }) as any };
    const { result, unmount } = renderHook(() => useSpotifyPlayer(true));
    await waitFor(() => expect(mockPlayer.connect).toHaveBeenCalled());
    act(() => listeners.ready({ device_id: 'device-1' }));
    expect(result.current.deviceId).toBe('device-1');
    expect(result.current.status).toBe('ready');
    act(() => listeners.not_ready({ device_id: 'device-1' }));
    expect(result.current.deviceId).toBe('');
    expect(result.current.status).toBe('connecting');
    act(() => listeners.playback_error({ message: 'restricted track' }));
    expect(result.current.error).toContain('restricted track');
    unmount();
    expect(mockPlayer.disconnect).toHaveBeenCalled();
  });
});
