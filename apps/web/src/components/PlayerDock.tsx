import { useEffect, useState } from 'react';
import type { SpotifyPlayer, SpotifyState } from '../spotify-sdk';
import type { PlayerStatus } from '../useSpotifyPlayer';
import { formatDuration, spotifyUrl } from '../lib/format';
import type { useSleepTimer } from '../hooks/useSleepTimer';
import { Popover } from './Popover';
import { CheckIcon, ExternalIcon, KeyboardIcon, MusicIcon, MuteIcon, NextIcon, PauseIcon, PlayIcon, PreviousIcon, RepeatIcon, ShuffleIcon, SleepIcon, VolumeIcon, VolumeLowIcon } from './Icons';

type ControlsProps = {
  playback: SpotifyState | null; player: SpotifyPlayer | null; status: string; volume?: number; onVolumeChange?: (value: number) => void; onError: (message: string) => void;
  onToggleShuffle?: () => void; onCycleRepeat?: () => void;
};

export function Controls({ playback, player, status, onError, onToggleShuffle, onCycleRepeat }: ControlsProps) {
  const [seekDraft, setSeekDraft] = useState<number | null>(null);
  const [position, setPosition] = useState(playback?.position ?? 0);
  useEffect(() => { setPosition(playback?.position ?? 0); }, [playback?.position]);
  useEffect(() => {
    if (!playback || playback.paused) return;
    const startedAt = Date.now(); const startedPosition = playback.position;
    const timer = window.setInterval(() => setPosition(Math.min(startedPosition + Date.now() - startedAt, playback.duration)), 250);
    return () => window.clearInterval(timer);
  }, [playback?.paused, playback?.position, playback?.duration]);
  useEffect(() => {
    if (seekDraft === null || !player) return;
    const timer = window.setTimeout(() => { void run(() => player.seek(seekDraft)); setSeekDraft(null); }, 450);
    return () => window.clearTimeout(timer);
  }, [seekDraft, player]);
  async function run(action: () => Promise<void>) {
    try { await action(); onError(''); }
    catch (cause) { onError(cause instanceof Error ? `Playback control failed: ${cause.message}` : 'Playback control failed. Try again.'); }
  }
  const commitSeek = (value: number) => { if (seekDraft !== null && player) { setSeekDraft(null); void run(() => player.seek(value)); } };
  const disabled = status !== 'ready' || !player;
  const duration = playback?.duration ?? 0;
  const progress = duration ? Math.min(seekDraft ?? position, duration) : 0;
  const disallows = playback?.disallows;
  const playing = playback?.paused === false;
  const repeat = playback?.repeat_mode ?? 0;
  const repeatLabel = repeat === 2 ? 'Repeat: track' : repeat === 1 ? 'Repeat: playlist' : 'Repeat: off';
  return <div className="controls">
    <div className="transport">
      {onToggleShuffle && <button type="button" className={`mode-button ${playback?.shuffle ? 'is-on' : ''}`} aria-label="Shuffle" aria-pressed={Boolean(playback?.shuffle)} title={playback?.shuffle ? 'Shuffle on (S)' : 'Shuffle off (S)'} disabled={disabled || !playback || Boolean(disallows?.toggling_shuffle)} onClick={onToggleShuffle}><ShuffleIcon/></button>}
      <button type="button" aria-label="Previous track" title="Previous (Shift + ←)" disabled={disabled || Boolean(disallows?.peeking_prev || disallows?.skipping_prev)} onClick={() => player && void run(() => player.previousTrack())}><PreviousIcon/></button>
      <button type="button" className="play-control" aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (Space)' : 'Play (Space)'} disabled={disabled || Boolean(playback?.paused ? disallows?.resuming : disallows?.pausing)} onClick={() => player && void run(() => player.togglePlay())}>{playing ? <PauseIcon/> : <PlayIcon/>}</button>
      <button type="button" aria-label="Next track" title="Next (Shift + →)" disabled={disabled || Boolean(disallows?.peeking_next || disallows?.skipping_next)} onClick={() => player && void run(() => player.nextTrack())}><NextIcon/></button>
      {onCycleRepeat && <button type="button" className={`mode-button ${repeat ? 'is-on' : ''}`} aria-label={repeatLabel} title={`${repeatLabel} (R)`} disabled={disabled || !playback} onClick={onCycleRepeat}><RepeatIcon/>{repeat === 2 && <b className="repeat-one">1</b>}</button>}
    </div>
    <div className="progress-line">
      <span className="time">{formatDuration(progress)}</span>
      <input className="range" aria-label="Track progress" aria-valuetext={`${formatDuration(progress)} of ${formatDuration(duration)}`} type="range" min="0" max={duration || 1} value={progress} style={{ '--fill': `${duration ? progress / duration * 100 : 0}%` } as React.CSSProperties} disabled={disabled || !duration || Boolean(disallows?.seeking)} onChange={e => setSeekDraft(Number(e.target.value))} onPointerUp={e => commitSeek(Number(e.currentTarget.value))} onKeyUp={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageDown', 'PageUp'].includes(e.key)) commitSeek(Number(e.currentTarget.value)); }}/>
      <span className="time">{formatDuration(duration)}</span>
    </div>
  </div>;
}

export function VolumeControl({ volume, muted, disabled, onChange, onToggleMute }: { volume: number; muted: boolean; disabled: boolean; onChange: (value: number) => void; onToggleMute: () => void }) {
  const shown = muted ? 0 : volume;
  return <div className="volume-control">
    <button type="button" className="icon-button" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute (M)' : 'Mute (M)'} disabled={disabled} onClick={onToggleMute}>{muted || volume === 0 ? <MuteIcon/> : volume < 0.5 ? <VolumeLowIcon/> : <VolumeIcon/>}</button>
    <input className="range" aria-label="Volume" aria-valuetext={`${Math.round(shown * 100)}%`} type="range" min="0" max="1" step="0.01" value={shown} style={{ '--fill': `${shown * 100}%` } as React.CSSProperties} disabled={disabled} onChange={e => onChange(Number(e.target.value))}/>
  </div>;
}

export function TrackInfo({ playback }: { playback: SpotifyState | null }) {
  const track = playback?.track_window.current_track;
  if (!track) return <div className="track-info is-empty"><span className="album-art"><MusicIcon/></span><span className="track-copy"><strong>Nothing playing yet</strong><small>Pick a playlist to load the deck</small></span></div>;
  const link = spotifyUrl(track.uri);
  const art = track.album.images[0]?.url;
  return <div className="track-info">
    {art ? <img className="album-art" src={art} alt={`${track.album.name ?? 'Album'} artwork`}/> : <span className="album-art"><MusicIcon/></span>}
    <span className="track-copy"><strong title={track.name}>{track.name}</strong><small title={track.artists.map(a => a.name).join(', ')}>{track.artists.map(a => a.name).join(', ')}</small></span>
    {link && <a className="icon-button open-spotify" href={link} target="_blank" rel="noreferrer" aria-label={`Open ${track.name} in Spotify`} title="Open in Spotify"><ExternalIcon/></a>}
  </div>;
}

export function SleepTimerMenu({ timer, disabled }: { timer: ReturnType<typeof useSleepTimer>; disabled: boolean }) {
  const active = timer.setting !== null;
  const badge = timer.remainingMs !== null ? `${Math.ceil(timer.remainingMs / 60000)}m` : timer.setting?.kind === 'track' ? 'end' : '';
  return <Popover className={`sleep-menu ${active ? 'is-active' : ''}`} label={active ? 'Sleep timer (on)' : 'Sleep timer'} button={<><SleepIcon/>{badge && <b className="badge">{badge}</b>}</>}>
    {close => <div className="menu">
      <p className="menu-title">Sleep timer</p>
      <p className="menu-hint">{active ? (timer.remainingMs !== null ? `Pausing in ${formatDuration(timer.remainingMs)}` : 'Pausing when this track ends') : 'Fade out the night — the deck pauses itself.'}</p>
      {[15, 30, 45, 60].map(minutes => <button type="button" key={minutes} className="menu-item" disabled={disabled} onClick={() => { timer.startMinutes(minutes); close(); }}>{minutes} minutes</button>)}
      <button type="button" className="menu-item" disabled={disabled} onClick={() => { timer.endOfTrack(); close(); }}>End of this track {timer.setting?.kind === 'track' && <CheckIcon/>}</button>
      {active && <button type="button" className="menu-item danger" onClick={() => { timer.cancel(); close(); }}>Turn off timer</button>}
    </div>}
  </Popover>;
}

export function PlayerDock({ playback, status, controls, volume, sleep, onShowShortcuts }: { playback: SpotifyState | null; status: PlayerStatus; controls: React.ReactNode; volume: React.ReactNode; sleep: React.ReactNode; onShowShortcuts: () => void }) {
  return <footer className="player-dock" aria-label="Playback controls">
    <div className="dock-track"><TrackInfo playback={playback}/></div>
    <div className="dock-controls">{controls}</div>
    <div className="dock-extras">
      {sleep}
      <button type="button" className="icon-button hide-touch" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={onShowShortcuts}><KeyboardIcon/></button>
      {volume}
      <span className={`device-chip status-${status}`} title={status === 'ready' ? 'Playing on this browser via Spotify Connect' : 'Browser player offline'}><i className="status-dot"/>{status === 'ready' ? 'This browser' : status === 'connecting' ? 'Connecting…' : 'Offline'}</span>
    </div>
  </footer>;
}
