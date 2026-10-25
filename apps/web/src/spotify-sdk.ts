export type SpotifyTrack = { uri?: string; id?: string | null; name: string; duration_ms?: number; artists: { name: string; uri?: string }[]; album: { name?: string; uri?: string; images: { url: string }[] } };
export type SpotifyState = {
  paused: boolean; position: number; duration: number; shuffle?: boolean; repeat_mode?: 0 | 1 | 2; context?: { uri: string | null; metadata?: { name?: string } | null };
  disallows?: { pausing?: boolean; resuming?: boolean; seeking?: boolean; peeking_prev?: boolean; peeking_next?: boolean; skipping_prev?: boolean; skipping_next?: boolean; toggling_shuffle?: boolean; toggling_repeat_context?: boolean; toggling_repeat_track?: boolean };
  track_window: { current_track: SpotifyTrack; next_tracks?: SpotifyTrack[]; previous_tracks?: SpotifyTrack[] };
};
export type PlayerEvent = 'ready' | 'not_ready' | 'player_state_changed' | 'autoplay_failed' | 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error';
export type SpotifyPlayer = {
  connect(): Promise<boolean>; disconnect(): void; addListener(name: PlayerEvent, callback: (payload: any) => void): boolean;
  removeListener(name: PlayerEvent, callback: (payload: any) => void): boolean; togglePlay(): Promise<void>; previousTrack(): Promise<void>; nextTrack(): Promise<void>; seek(ms: number): Promise<void>; setVolume(value: number): Promise<void>; activateElement(): Promise<void>;
  pause?(): Promise<void>; resume?(): Promise<void>;
};
declare global { interface Window { Spotify?: { Player: new (options: { name: string; volume: number; getOAuthToken: (cb: (token: string) => void) => void }) => SpotifyPlayer; onSpotifyWebPlaybackSDKReady?: () => void } } }
let sdkPromise: Promise<void> | undefined;
export function loadSpotifySdk(): Promise<void> {
  if (window.Spotify?.Player) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { sdkPromise = undefined; reject(new Error('Spotify player script did not load. Check your connection or content blocker.')); }, 15000);
    (window as Window & { onSpotifyWebPlaybackSDKReady?: () => void }).onSpotifyWebPlaybackSDKReady = () => { window.clearTimeout(timeout); resolve(); };
    const script = document.createElement('script'); script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true;
    script.onerror = () => { window.clearTimeout(timeout); sdkPromise = undefined; script.remove(); reject(new Error('Spotify player script failed to load.')); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}
