import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App, { Controls, normalizePlaylist, SessionCard } from './App';

vi.mock('./useSpotifyPlayer', () => ({ useSpotifyPlayer: (authenticated: boolean) => ({ player: { current: null }, deviceId: '', status: authenticated ? 'connecting' : 'disconnected', playback: null, error: '', setError: vi.fn() }) }));
beforeEach(() => cleanup());
describe('Cassete UI', () => {
  const respond = (routes: Record<string, unknown>) => vi.fn(async (input: RequestInfo) => {
    const path = String(input);
    const match = Object.keys(routes).find(route => path.startsWith(route));
    return { ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }), json: async () => match ? routes[match] : {} } as Response;
  });
  const signedIn = { authenticated: true, csrf: 'csrf', user: { name: 'Ada', googleName: 'Ada', email: 'ada@example.com', picture: null, createdAt: 0 }, preferences: {}, nowPlaying: null };

  it('shows signed-out visitors a landing page with Google sign-in instead of the deck', async () => {
    window.fetch = respond({ '/api/session': { authenticated: false, signInAvailable: true } }) as any;
    history.replaceState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('status', { name: /loading retro play/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: /choose your machine.*press play/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in with google/i })).toHaveAttribute('href', '/auth/google/login');
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/auth/google/login');
    expect(screen.queryByRole('complementary', { name: /playlist library/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /search playlists/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /connect spotify/i })).not.toBeInTheDocument();
  });

  it('asks a signed-in user to connect Spotify before playing', async () => {
    window.fetch = respond({ '/api/session': { ...signedIn, spotify: { connected: false, displayName: null } } }) as any;
    history.replaceState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('link', { name: /connect spotify/i })).toHaveAttribute('href', '/auth/login');
    expect(screen.getByText(/signed in as ada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /your profile/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search playlists/i })).toBeDisabled();
  });

  it('shows a shared playlist and carries the link through sign-in', async () => {
    window.fetch = respond({
      '/api/session': { authenticated: false, signInAvailable: true },
      '/api/shares/abcdefgh12': { id: 'abcdefgh12', url: 'http://127.0.0.1:5173/s/abcdefgh12', sharedBy: 'Grace', createdAt: 0, playlist: { id: 'p1', uri: 'spotify:playlist:p1', name: 'Night Drive', owner: 'Grace', total: 9, image: null } },
    }) as any;
    history.replaceState({}, '', '/s/abcdefgh12');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /press play on night drive/i })).toBeInTheDocument();
    expect(screen.getByText(/grace shared this playlist with you/i)).toBeInTheDocument();
    expect(screen.getByText(/shared by grace/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in with google/i })).toHaveAttribute('href', '/auth/google/login?returnTo=%2Fs%2Fabcdefgh12');
    history.replaceState({}, '', '/');
  });
  it('normalizes Spotify playlist URLs and rejects unrelated input', () => {
    expect(normalizePlaylist('https://open.spotify.com/playlist/abc123?si=track')).toBe('spotify:playlist:abc123');
    expect(normalizePlaylist('spotify:playlist:abc123')).toBe('spotify:playlist:abc123');
    expect(normalizePlaylist('https://example.com/playlist/abc123')).toBe('');
  });
  it.each([
    [false, false, 'disconnected', 'Not connected'],
    [true, false, 'connecting', 'Connecting deck'],
    [true, false, 'ready', 'Deck ready'],
    [true, false, 'error', 'Needs attention'],
  ] as const)('shows session state %s / %s / %s', (authenticated, checking, status, title) => {
    cleanup();
    render(<SessionCard authenticated={authenticated} checking={checking} status={status}/>);
    expect(screen.getByText(title)).toBeInTheDocument();
  });
  it('keeps the seek thumb responsive and commits the chosen position', () => {
    const sdkPlayer = { seek: vi.fn().mockResolvedValue(undefined), setVolume: vi.fn().mockResolvedValue(undefined), togglePlay: vi.fn().mockResolvedValue(undefined), previousTrack: vi.fn().mockResolvedValue(undefined), nextTrack: vi.fn().mockResolvedValue(undefined) } as any;
    render(<Controls playback={{ paused: true, position: 2000, duration: 10000, track_window: { current_track: { name: 'Track', artists: [], album: { images: [] } } } }} player={sdkPlayer} status="ready" onError={vi.fn()}/>);
    const seek = screen.getByRole('slider', { name: 'Track progress' });
    fireEvent.change(seek, { target: { value: '7000' } });
    expect(seek).toHaveValue('7000');
    fireEvent.pointerUp(seek);
    expect(sdkPlayer.seek).toHaveBeenCalledWith(7000);
  });
  it('disables Spotify-restricted actions and reports rejected control commands', async () => {
    const onError = vi.fn();
    const sdkPlayer = { seek: vi.fn(), setVolume: vi.fn(), togglePlay: vi.fn().mockRejectedValue(new Error('operation unavailable')), previousTrack: vi.fn().mockRejectedValue(new Error('operation unavailable')), nextTrack: vi.fn() } as any;
    render(<Controls playback={{ paused: false, position: 0, duration: 10000, disallows: { pausing: true }, track_window: { current_track: { name: 'Track', artists: [], album: { images: [] } } } }} player={sdkPlayer} status="ready" onError={onError}/>);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next track' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Previous track' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous track' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Playback control failed: operation unavailable'));
  });
});
