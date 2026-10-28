import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpotifyPlayer } from './useSpotifyPlayer';
import type { SpotifyPlayer } from './spotify-sdk';
import { api, errorMessage, type Page, type PlaylistResult, type PlaylistTrack, type SessionInfo, type SharedPlaylist, type ShareLink } from './lib/api';
import { shareIdFromPath } from './lib/format';
import type { Preferences } from './lib/preferences';
import { useStoredState } from './lib/storage';
import { useToasts } from './hooks/useToasts';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useMediaSession } from './hooks/useMediaSession';
import { useSleepTimer } from './hooks/useSleepTimer';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useNowPlayingSync, usePreferenceSync } from './hooks/useProfileSync';
import type { CoverFit, CoverPosition, MachineControlProps, PlayerTheme } from './components/Hardware';
import { DEFAULT_SKINS, findSkin, skinsFor, type SkinId } from './components/machines/skins';
import { Library } from './components/Library';
import { TrackPanel } from './components/TrackPanel';
import { Stage } from './components/Stage';
import { Controls, PlayerDock, SleepTimerMenu, VolumeControl } from './components/PlayerDock';
import { ShortcutsDialog, Toasts, TopBar, type Appearance } from './components/Chrome';
import { ProfileDialog } from './components/Profile';
import { Landing, Splash } from './components/Landing';
import { Tour } from './components/Tour';
import { CassetteIcon, LibraryIcon, ListIcon } from './components/Icons';

export { SessionCard } from './components/Library';
export { Controls } from './components/PlayerDock';
export { normalizePlaylist } from './lib/format';

type MobileView = 'library' | 'deck' | 'tracks';
const AUTH_ERRORS: Record<string, string> = {
  denied: 'Spotify connection was cancelled.', state: 'Sign-in security check failed. Please try again.', callback: 'Spotify returned an incomplete sign-in response.', exchange: 'Spotify connection could not be completed. Check your app credentials and callback URL.',
  signin: 'Sign in to Retro Play first, then connect Spotify.', google_denied: 'Google sign-in was cancelled.', google_state: 'Sign-in security check failed. Please try again.',
  google_exchange: 'Google sign-in could not be completed. Check the Google client credentials and redirect URI.', google_unverified: 'Verify the email address on your Google account, then sign in again.',
};
const prefersDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
const PHONE = '(max-width: 760px)';
const isNarrow = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches;

export default function App() {
  const [session, setSession] = useState<SessionInfo>({ authenticated: false });
  const [checking, setChecking] = useState(true);
  const [appearance, setAppearance] = useStoredState<Appearance>('retro-play-appearance', prefersDark() ? 'dark' : 'light');
  const [playerTheme, setPlayerTheme] = useStoredState<PlayerTheme>('retro-play-player-theme', 'cassette');
  const [coverFit, setCoverFit] = useStoredState<CoverFit>('retro-play-cover-fit', 'cover');
  const [showCoverTitle, setShowCoverTitle] = useStoredState('retro-play-show-cover-title', true);
  const [skinChoice, setSkinChoice] = useStoredState<Record<PlayerTheme, SkinId>>('retro-play-skins', DEFAULT_SKINS);
  const skin = findSkin(skinChoice[playerTheme], playerTheme);
  // The album case is placed per model, since each piece of hardware has a different silhouette.
  const [coverPositions, setCoverPositions] = useStoredState<Partial<Record<SkinId, CoverPosition>>>('retro-play-cover-positions-v3', {});
  const [coverPan, setCoverPan] = useStoredState<Record<PlayerTheme, number>>('retro-play-cover-pan', { cassette: 50, vinyl: 50 });
  const [volume, setVolume] = useStoredState('retro-play-volume', 0.72);
  const [muted, setMuted] = useState(false);
  const [recents, setRecents] = useStoredState<PlaylistResult[]>('retro-play-recent-playlists', []);
  const [playlist, setPlaylist] = useState<PlaylistResult | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [trackTotal, setTrackTotal] = useState(0);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>('deck');
  const phone = useMediaQuery(PHONE);
  // Tablets always show the stage, so the "deck" view there means the side panel shows tracks.
  const activeView: MobileView = !phone && mobileView === 'deck' ? 'tracks' : mobileView;
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [touring, setTouring] = useState(false);
  const [tourSeen, setTourSeen] = useStoredState('retro-play-tour-seen', false);
  const { toasts, notify, dismiss } = useToasts();
  const searchRef = useRef<HTMLInputElement>(null);
  const activePlaylistId = useRef('');

  // A share link (/s/:id) brings its playlist along through sign-in and the Spotify connection.
  const [shareId] = useState(() => shareIdFromPath(location.pathname));
  const [invite, setInvite] = useState<SharedPlaylist | null>(null);
  const [inviteError, setInviteError] = useState('');
  const withReturn = (base: string) => shareId ? `${base}?returnTo=${encodeURIComponent(`/s/${shareId}`)}` : base;
  const signInHref = withReturn('/auth/google/login');
  const connectHref = withReturn('/auth/login');

  // Signing in (Google) comes first; Spotify is linked to the profile once and is what the player needs.
  const connected = Boolean(session.authenticated && session.spotify?.connected);
  const player = useSpotifyPlayer(connected, muted ? 0 : volume);
  const playback = player.playback;
  const currentTrack = playback?.track_window.current_track;
  const ready = player.status === 'ready' && Boolean(player.player.current);
  const canStart = ready && Boolean(player.deviceId);

  // Estimate the live position between SDK state events so keyboard seeking is relative to what the user hears.
  const positionClock = useRef({ position: 0, at: 0, paused: true });
  useEffect(() => { positionClock.current = { position: playback?.position ?? 0, at: Date.now(), paused: playback?.paused ?? true }; }, [playback]);
  const livePosition = () => { const clock = positionClock.current; return clock.paused ? clock.position : clock.position + Date.now() - clock.at; };

  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appearance === 'dark' ? '#15120e' : '#ece6d8');
  }, [appearance]);

  const refreshSession = useCallback(async () => {
    try { const response = await fetch('/api/session', { credentials: 'include', signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error(); setSession(await response.json()); }
    catch { setSession({ authenticated: false }); }
    finally { setChecking(false); }
  }, []);
  useEffect(() => {
    void refreshSession();
    const error = new URLSearchParams(location.search).get('authError');
    if (error) { notify(AUTH_ERRORS[error] ?? 'Sign-in failed.', 'error'); history.replaceState({}, '', location.pathname); }
  }, [refreshSession, notify]);

  usePreferenceSync(session, { appearance, playerTheme, coverFit, showCoverTitle, skins: skinChoice, coverPositions, coverPan, volume, recents } satisfies Preferences, saved => {
    if (saved.appearance) setAppearance(saved.appearance);
    if (saved.playerTheme) setPlayerTheme(saved.playerTheme);
    if (saved.coverFit) setCoverFit(saved.coverFit);
    if (saved.showCoverTitle !== undefined) setShowCoverTitle(saved.showCoverTitle);
    if (saved.skins) setSkinChoice(saved.skins);
    if (saved.coverPositions) setCoverPositions(saved.coverPositions);
    if (saved.coverPan) setCoverPan(saved.coverPan);
    if (saved.volume !== undefined) { setVolume(saved.volume); void player.player.current?.setVolume(saved.volume).catch(() => {}); }
    if (saved.recents) setRecents(saved.recents);
  });

  useEffect(() => {
    if (!shareId) return;
    api<SharedPlaylist>(`/api/shares/${encodeURIComponent(shareId)}`, undefined).then(setInvite).catch(cause => setInviteError(errorMessage(cause, 'This share link could not be opened.')));
  }, [shareId]);
  // Once the listener can play, open what they came for: the shared playlist, or else the playlist they were last playing.
  const restored = useRef(false);
  useEffect(() => {
    if (!connected || !session.csrf || restored.current) return;
    if (shareId && !invite && !inviteError) return;
    restored.current = true;
    if (invite) { openPlaylist(invite.playlist); notify(`${invite.sharedBy} shared “${invite.playlist.name}” with you. Press Play when the deck is ready.`, 'success'); }
    else if (session.nowPlaying?.playlist) openPlaylist(session.nowPlaying.playlist);
  }, [connected, session.csrf, invite, inviteError]);

  async function control(action: (active: SpotifyPlayer) => Promise<void>) {
    const active = player.player.current;
    if (!active || player.status !== 'ready') { notify('Wait until the deck is ready, then try again.'); return; }
    try { await active.activateElement(); await action(active); player.setError(''); }
    catch (cause) { player.setError(cause instanceof Error ? `Playback control failed: ${cause.message}` : 'Playback control failed. Try again.'); }
  }
  const pause = () => void control(active => active.pause ? active.pause() : playback && !playback.paused ? active.togglePlay() : Promise.resolve());
  const resume = () => void control(active => active.resume ? active.resume() : playback?.paused ? active.togglePlay() : Promise.resolve());

  function changeVolume(value: number) {
    const next = Math.min(1, Math.max(0, Math.round(value * 100) / 100));
    setVolume(next); setMuted(false);
    void player.player.current?.setVolume(next).catch(() => player.setError('Could not change volume.'));
  }
  function toggleMute() {
    const nextMuted = !muted;
    setMuted(nextMuted);
    void player.player.current?.setVolume(nextMuted ? 0 : volume || 0.5).catch(() => player.setError('Could not change volume.'));
    if (!nextMuted && volume === 0) setVolume(0.5);
  }

  async function setShuffle(state: boolean) {
    if (!session.csrf || !player.deviceId) return;
    try { await api('/api/player/shuffle', session.csrf, { method: 'PUT', body: { state, device_id: player.deviceId } }); notify(state ? 'Shuffle on' : 'Shuffle off'); }
    catch (cause) { notify(errorMessage(cause, 'Could not change shuffle.'), 'error'); }
  }
  async function cycleRepeat() {
    if (!session.csrf || !player.deviceId || !playback) return;
    const next = (['context', 'track', 'off'] as const)[playback.repeat_mode ?? 0];
    try { await api('/api/player/repeat', session.csrf, { method: 'PUT', body: { state: next, device_id: player.deviceId } }); notify(next === 'off' ? 'Repeat off' : next === 'track' ? 'Repeating this track' : 'Repeating the playlist'); }
    catch (cause) { notify(errorMessage(cause, 'Could not change repeat.'), 'error'); }
  }

  async function loadTracks(id: string, offset: number) {
    if (!session.csrf) return;
    setTracksLoading(true); if (!offset) setTracksError('');
    try {
      const page = await api<Page<PlaylistTrack>>(`/api/playlists/${encodeURIComponent(id)}/items?offset=${offset}`, session.csrf);
      if (activePlaylistId.current !== id) return;
      setTracks(previous => offset ? [...previous, ...page.items] : page.items);
      setTrackTotal(page.total);
    } catch (cause) { if (activePlaylistId.current === id) { if (offset) notify(errorMessage(cause, 'Could not load more tracks.'), 'error'); else setTracksError(errorMessage(cause, 'Could not load playlist.')); } }
    finally { if (activePlaylistId.current === id) setTracksLoading(false); }
  }
  function openPlaylist(item: PlaylistResult) {
    activePlaylistId.current = item.id;
    setPlaylist(item); setTracks([]); setTrackTotal(item.total); setTracksError('');
    if (isNarrow()) setMobileView('tracks');
    void loadTracks(item.id, 0);
  }
  async function openLink(id: string) {
    const placeholder: PlaylistResult = { id, uri: `spotify:playlist:${id}`, name: 'Spotify playlist', owner: 'Shared link', total: 0, image: null };
    openPlaylist(placeholder);
    try {
      const details = await api<PlaylistResult>(`/api/playlists/${encodeURIComponent(id)}`, session.csrf);
      if (activePlaylistId.current === id) setPlaylist(details);
    } catch { /* metadata is a nicety; the track list reports access problems */ }
  }
  function rememberPlaylist(item: PlaylistResult) {
    if (item.owner === 'Shared link' && item.name === 'Spotify playlist') return;
    setRecents(current => [item, ...current.filter(entry => entry.id !== item.id)].slice(0, 5));
  }

  async function startPlayback(target: PlaylistResult, trackUri?: string, positionMs?: number) {
    if (!connected || !session.csrf) { notify('Connect your Spotify account first.', 'error'); return false; }
    if (!canStart) { notify('Wait until the deck is ready, then try again.'); return false; }
    setBusy(true); player.setError('');
    try {
      void player.player.current?.activateElement().catch(() => notify('Your browser blocked playback activation. Press Play once the track loads.'));
      await api('/api/play', session.csrf, { method: 'PUT', body: { context_uri: target.uri, track_uri: trackUri, position_ms: trackUri && positionMs ? Math.floor(positionMs) : undefined, device_id: player.deviceId } });
      rememberPlaylist(target);
      return true;
    } catch (cause) { notify(errorMessage(cause, 'Could not start playback.'), 'error'); return false; }
    finally { setBusy(false); }
  }
  function playFromLibrary(item: PlaylistResult) {
    if (playlist?.id !== item.id) openPlaylist(item);
    if (isNarrow()) setMobileView('deck');
    void startPlayback(item);
  }
  async function shufflePlay() {
    if (!playlist || !tracks.length) return;
    const pick = tracks[Math.floor(Math.random() * tracks.length)];
    if (await startPlayback(playlist, pick.uri)) void setShuffle(true);
  }

  function clearDeck() { activePlaylistId.current = ''; setPlaylist(null); setTracks([]); setTrackTotal(0); restored.current = false; }
  async function signOut() {
    try { if (session.csrf) await fetch('/api/logout', { method: 'POST', credentials: 'include', headers: { 'X-Cassete-CSRF': session.csrf } }); }
    catch { /* the session is dropped locally either way */ }
    finally { await refreshSession(); clearDeck(); notify('Signed out. See you next session.', 'success'); }
  }
  async function disconnectSpotify() {
    try { await api('/api/spotify/disconnect', session.csrf, { method: 'POST' }); }
    catch (cause) { notify(errorMessage(cause, 'Could not disconnect Spotify.'), 'error'); return; }
    await refreshSession(); clearDeck(); notify('Spotify disconnected. Connect it again whenever you like.', 'success');
  }
  async function accountDeleted() { await refreshSession(); clearDeck(); notify('Your Retro Play account was deleted.', 'success'); }

  async function sharePlaylist() {
    if (!playlist || !session.csrf) return;
    setSharing(true);
    try {
      const share = await api<ShareLink>('/api/shares', session.csrf, { method: 'POST', body: { playlistId: playlist.id } });
      try { await navigator.clipboard.writeText(share.url); notify('Share link copied. Anyone signed in to Retro Play with Spotify can listen.', 'success'); }
      catch { notify(`Share link: ${share.url}`, 'success'); }
    } catch (cause) { notify(errorMessage(cause, 'Could not create a share link.'), 'error'); }
    finally { setSharing(false); }
  }

  // The current song and its state are saved to the profile so the next visit can resume it.
  useNowPlayingSync(session.csrf, connected, playback, contextUri => {
    if (!contextUri) return null;
    const known = [playlist, invite?.playlist, ...recents, session.nowPlaying?.playlist].find(item => item?.uri === contextUri);
    if (known) return known;
    const id = contextUri.match(/^spotify:playlist:([A-Za-z0-9]+)$/)?.[1];
    return id ? { id, uri: contextUri, name: playback?.context?.metadata?.name || 'Spotify playlist', owner: 'Spotify', total: 0, image: null } : null;
  });
  const lastSession = session.nowPlaying;
  const resumeOffer = connected && !playback && lastSession?.playlist ? { nowPlaying: lastSession, busy: busy || !canStart, onResume: () => {
    const target = lastSession.playlist!;
    if (playlist?.id !== target.id) openPlaylist(target);
    void startPlayback(target, lastSession.track.uri, lastSession.positionMs);
  } } : null;

  const sleep = useSleepTimer(currentTrack?.uri, () => { pause(); notify('Sleep timer finished — the deck is resting. Goodnight.', 'success'); });
  useMediaSession(playback, { play: resume, pause, next: () => void control(active => active.nextTrack()), previous: () => void control(active => active.previousTrack()), seekTo: ms => void control(active => active.seek(ms)) });
  useKeyboardShortcuts({
    togglePlay: () => { if (ready) void control(active => active.togglePlay()); },
    next: () => { if (ready) void control(active => active.nextTrack()); },
    previous: () => { if (ready) void control(active => active.previousTrack()); },
    seekBy: ms => { if (ready && playback && !playback.disallows?.seeking) void control(active => active.seek(Math.min(Math.max(0, livePosition() + ms), playback.duration))); },
    volumeBy: delta => changeVolume((muted ? 0 : volume) + delta),
    toggleMute, toggleShuffle: () => { if (playback) void setShuffle(!playback.shuffle); }, cycleRepeat: () => void cycleRepeat(),
    switchMachine: () => setPlayerTheme(theme => theme === 'cassette' ? 'vinyl' : 'cassette'),
    cycleModel: () => { const models = skinsFor(playerTheme); const next = models[(models.findIndex(model => model.id === skin.id) + 1) % models.length]; setSkinChoice(current => ({ ...current, [playerTheme]: next.id })); notify(`${next.name} on the stage`); },
    focusSearch: () => { setMobileView('library'); window.setTimeout(() => searchRef.current?.focus(), 0); },
    showHelp: () => setShowShortcuts(true),
  }, !showShortcuts && !showProfile);

  const disallows = playback?.disallows;
  const machine: MachineControlProps = {
    playing: Boolean(playback && !playback.paused), paused: Boolean(playback?.paused && playback.position > 0), disabled: !ready,
    canPlay: ready && !disallows?.resuming, canPause: ready && !disallows?.pausing,
    canPrevious: ready && !disallows?.peeking_prev && !disallows?.skipping_prev,
    canNext: ready && !disallows?.peeking_next && !disallows?.skipping_next,
    canSeek: ready && !disallows?.seeking, volume: muted ? 0 : volume,
    onPlay: resume, onPause: pause,
    onPrevious: () => void control(active => active.previousTrack()),
    onNext: () => void control(active => active.nextTrack()),
    onRestart: () => void control(active => active.seek(0)),
    onVolumeChange: changeVolume,
  };
  const artwork = currentTrack?.album.images[0]?.url ?? playlist?.image ?? tracks[0]?.image ?? null;
  const coverTitle = currentTrack?.name ?? playlist?.name ?? 'Retro Play album';

  // First visit with a working deck: show people around once the stage has had a moment to set up.
  useEffect(() => {
    if (!connected || tourSeen || touring) return;
    const timer = window.setTimeout(() => startTour(), 900);
    return () => window.clearTimeout(timer);
  }, [connected, tourSeen]);
  function startTour() { setShowShortcuts(false); setShowProfile(false); setMobileView('deck'); setTouring(true); }
  const endTour = useCallback(() => { setTouring(false); setTourSeen(true); }, [setTourSeen]);

  const toggleAppearance = () => setAppearance(value => value === 'dark' ? 'light' : 'dark');
  // Signed-out visitors get the landing page; the deck, library, and player are for signed-in profiles only.
  if (checking) return <Splash/>;
  if (!session.authenticated) return <Landing appearance={appearance} onAppearance={toggleAppearance} signInHref={signInHref} signInAvailable={session.signInAvailable !== false}
    invite={invite} inviteError={inviteError} toasts={toasts} onDismissToast={dismiss}/>;

  return <div className="app-shell">
    <a className="skip-link" href="#playlist-search">Skip to search</a>
    <TopBar session={session} checking={checking} appearance={appearance} onAppearance={toggleAppearance} onProfile={() => setShowProfile(true)} onTour={startTour} signInHref={signInHref}/>
    <main className="workspace" data-view={activeView}>
      <Library ref={searchRef} csrf={session.csrf} authenticated={connected} checking={checking} status={player.status} canPlay={canStart && !busy}
        activePlaylistId={playlist?.id ?? ''} playingContextUri={playback?.context?.uri} recents={recents}
        onOpen={openPlaylist} onOpenLink={id => void openLink(id)} onPlay={playFromLibrary} onReconnect={player.reconnect} onClearRecents={() => setRecents([])}/>
      <Stage theme={playerTheme} onTheme={setPlayerTheme} skin={skin} onSkin={id => setSkinChoice(current => ({ ...current, [playerTheme]: id }))} machine={machine} artwork={artwork} coverTitle={coverTitle}
        cover={{ fit: coverFit, showTitle: showCoverTitle, position: coverPositions[skin.id] ?? skin.cover, onFit: setCoverFit, onShowTitle: setShowCoverTitle, onPosition: position => setCoverPositions(current => ({ ...current, [skin.id]: position })), pan: coverPan[playerTheme] ?? 50, onPan: pan => setCoverPan(current => ({ ...current, [playerTheme]: pan })),
          onReset: () => { setCoverPositions(current => ({ ...current, [skin.id]: skin.cover })); setCoverPan(current => ({ ...current, [playerTheme]: 50 })); } }}
        authenticated={connected} checking={checking} status={player.status} playback={playback} playerError={player.error} onDismissError={() => player.setError('')} onReconnect={player.reconnect}
        account={{ name: session.user?.name, connectHref }} invite={invite} inviteError={inviteError} resume={resumeOffer}/>
      <TrackPanel playlist={playlist} tracks={tracks} total={trackTotal} loading={tracksLoading} error={tracksError} busy={busy} canPlay={canStart} playback={playback}
        onPlay={trackUri => { if (playlist) void startPlayback(playlist, trackUri); }} onShufflePlay={() => void shufflePlay()}
        onLoadMore={() => { if (playlist) void loadTracks(playlist.id, tracks.length); }} onRetry={() => { if (playlist) openPlaylist(playlist); }}
        onShare={connected ? () => void sharePlaylist() : undefined} sharing={sharing}/>
    </main>
    <PlayerDock playback={playback} status={player.status} onShowShortcuts={() => setShowShortcuts(true)}
      controls={<Controls playback={playback} player={player.player.current} status={player.status} onError={player.setError} onToggleShuffle={() => { if (playback) void setShuffle(!playback.shuffle); }} onCycleRepeat={() => void cycleRepeat()}/>}
      volume={<VolumeControl volume={volume} muted={muted} disabled={!ready} onChange={changeVolume} onToggleMute={toggleMute}/>}
      sleep={<SleepTimerMenu timer={sleep} disabled={!ready || !playback}/>}/>
    <nav className="mobile-nav" aria-label="Sections">
      {([['library', 'Library', LibraryIcon], ['deck', 'Deck', CassetteIcon], ['tracks', 'Tracks', ListIcon]] as const).map(([view, label, Icon]) => <button type="button" key={view} className={activeView === view ? 'is-active' : ''} aria-current={activeView === view ? 'page' : undefined} onClick={() => setMobileView(view)}><Icon/>{label}</button>)}
    </nav>
    <Toasts toasts={toasts} onDismiss={dismiss}/>
    <Tour open={touring} theme={playerTheme} artwork={artwork} onClose={endTour}/>
    <ShortcutsDialog open={showShortcuts} onClose={() => setShowShortcuts(false)}/>
    {session.authenticated && <ProfileDialog open={showProfile} onClose={() => setShowProfile(false)} session={session} connectHref={connectHref} notify={notify}
      onProfileChange={refreshSession} onSpotifyDisconnect={disconnectSpotify} onSignOut={signOut} onAccountDeleted={accountDeleted}/>}
  </div>;
}
