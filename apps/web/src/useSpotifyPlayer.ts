import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSpotifySdk, type SpotifyPlayer, type SpotifyState, type PlayerEvent } from './spotify-sdk';

export type PlayerStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

export function useSpotifyPlayer(authenticated: boolean, initialVolume = 0.72) {
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const volumeRef = useRef(initialVolume);
  volumeRef.current = initialVolume;
  const [generation, setGeneration] = useState(0);
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<PlayerStatus>('disconnected');
  const [playback, setPlayback] = useState<SpotifyState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!authenticated) { playerRef.current?.disconnect(); playerRef.current = null; setDeviceId(''); setPlayback(null); setStatus('disconnected'); return; }
    let cancelled = false; let player: SpotifyPlayer | null = null;
    const listeners: [PlayerEvent, (payload: any) => void][] = [];
    setStatus('connecting'); setError('');
    const subscribe = (name: PlayerEvent, handler: (payload: any) => void) => { listeners.push([name, handler]); player!.addListener(name, handler); };
    void loadSpotifySdk().then(() => {
      if (cancelled || !window.Spotify?.Player) return;
      player = new window.Spotify.Player({ name: 'Retro Play Web Deck', volume: volumeRef.current, getOAuthToken: async callback => {
        try { const response = await fetch('/api/token', { credentials: 'include' }); if (!response.ok) throw new Error('Reconnect your Spotify account.'); const data = await response.json(); callback(data.access_token); }
        catch (cause) { setStatus('error'); setDeviceId(''); setError(cause instanceof Error ? cause.message : 'Could not refresh Spotify authorization.'); }
      } });
      playerRef.current = player;
      subscribe('ready', ({ device_id }) => { setDeviceId(device_id); setStatus('ready'); setError(''); });
      subscribe('not_ready', () => { setDeviceId(''); setStatus('connecting'); setError('The browser player went offline. Check your connection and reconnect.'); });
      subscribe('player_state_changed', state => setPlayback(state));
      subscribe('autoplay_failed', () => setError('Your browser blocked autoplay. Press Play to resume playback.'));
      subscribe('initialization_error', event => { setStatus('error'); setError(`Player could not initialize: ${event.message}`); });
      subscribe('authentication_error', () => { setStatus('error'); setError('Spotify authorization expired or was revoked. Disconnect and sign in again.'); });
      subscribe('account_error', () => { setStatus('error'); setError('This account cannot use the Spotify Web Playback SDK. A Premium account is required.'); });
      subscribe('playback_error', event => setError(`Spotify could not play this track: ${event.message}`));
      void player.connect().then(connected => { if (!connected && !cancelled) { setStatus('error'); setError('Spotify could not connect the browser player. Try reconnecting.'); } }).catch(cause => { if (!cancelled) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Spotify could not connect the browser player. Try reconnecting.'); } });
    }).catch(cause => { if (!cancelled) { setStatus('error'); setError(cause instanceof Error ? cause.message : 'Spotify SDK initialization failed.'); } });
    return () => { cancelled = true; if (player) { listeners.forEach(([name, handler]) => player?.removeListener(name, handler)); player.disconnect(); } if (playerRef.current === player) playerRef.current = null; setDeviceId(''); };
  }, [authenticated, generation]);
  /** Tears down the current SDK player and creates a fresh one, e.g. after a network drop or an initialization error. */
  const reconnect = useCallback(() => { setPlayback(null); setGeneration(value => value + 1); }, []);
  return { player: playerRef, deviceId, status, playback, error, setError, reconnect };
}
