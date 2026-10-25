import type { NowPlaying, SharedPlaylist } from '../lib/api';
import type { SpotifyState } from '../spotify-sdk';
import type { PlayerStatus } from '../useSpotifyPlayer';
import { formatDuration, spotifyUrl } from '../lib/format';
import { AlbumCoverPreview, type CoverFit, type CoverPosition, type MachineControlProps, type PlayerTheme } from './Hardware';
import { AlertIcon, BoomboxIcon, PlayIcon, CassetteIcon, CheckIcon, CloseIcon, DjIcon, ExternalIcon, PocketIcon, RefreshIcon, SlidersIcon, SuitcaseIcon, VinylIcon } from './Icons';
import { Popover } from './Popover';
import { Machine, SKINS, skinsFor, type Skin, type SkinId } from './machines/skins';
import { modelAssets } from './machines/assets';
import { prefetchImages, useImagePreload } from '../lib/preload';
import { useEffect, useState } from 'react';

const SKIN_ICONS: Record<SkinId, (props: { className?: string }) => React.ReactElement> = { 'hifi-deck': CassetteIcon, pocket: PocketIcon, boombox: BoomboxIcon, 'hifi-turntable': VinylIcon, suitcase: SuitcaseIcon, dj: DjIcon };

type CoverSettings = { fit: CoverFit; showTitle: boolean; position: CoverPosition; pan: number; onFit: (fit: CoverFit) => void; onShowTitle: (show: boolean) => void; onPosition: (position: CoverPosition) => void; onPan: (pan: number) => void; onReset: () => void };

type StageProps = {
  theme: PlayerTheme; onTheme: (theme: PlayerTheme) => void; skin: Skin; onSkin: (id: SkinId) => void;
  machine: MachineControlProps; artwork: string | null; coverTitle: string; cover: CoverSettings;
  /** `authenticated` means Spotify is connected; `account` covers the Retro Play sign-in that comes first. */
  authenticated: boolean; checking: boolean; status: PlayerStatus; playback: SpotifyState | null; playerError: string; onDismissError: () => void; onReconnect: () => void;
  account: Account; invite: SharedPlaylist | null; inviteError: string; resume: { nowPlaying: NowPlaying; onResume: () => void; busy: boolean } | null;
};
type Account = { name?: string; connectHref: string };

const FIT_OPTIONS: [CoverFit, string][] = [['cover', 'Fill the window'], ['fit-width', 'Fit width'], ['fit-height', 'Fit height · full card, pan sideways'], ['stretch', 'Stretch'], ['title', 'Typeset title only']];

export function Stage(props: StageProps) {
  const { theme, playback, authenticated, status } = props;
  const track = playback?.track_window.current_track;
  const playing = Boolean(playback && !playback.paused);
  const trackLink = spotifyUrl(track?.uri);
  const setup = useModelSetup(props.skin);
  return <section className={`stage theme-${theme} ${playing ? 'is-playing' : ''}`} aria-label="Player">
    <div className="stage-toolbar">
      <div className="segmented" role="radiogroup" aria-label="Choose your machine">
        <button type="button" role="radio" aria-checked={theme === 'cassette'} className={theme === 'cassette' ? 'is-active' : ''} onClick={() => props.onTheme('cassette')} title="Tape deck (T)"><CassetteIcon/> Cassette</button>
        <button type="button" role="radio" aria-checked={theme === 'vinyl'} className={theme === 'vinyl' ? 'is-active' : ''} onClick={() => props.onTheme('vinyl')} title="Turntable (T)"><VinylIcon/> Vinyl</button>
      </div>
      <div className="toolbar-group">
      <Popover className="model-button" label="Choose a model" side="bottom" button={<>{(() => { const Icon = SKIN_ICONS[props.skin.id]; return <Icon/>; })()}<span className="hide-narrow">{props.skin.name}</span></>}>
        {close => <div className="menu model-menu" role="radiogroup" aria-label={`${theme === 'vinyl' ? 'Turntable' : 'Cassette'} models`}>
          <p className="menu-title">{theme === 'vinyl' ? 'Turntables' : 'Cassette players'}</p>
          <p className="menu-hint">Same controls, different hardware. Press <b>K</b> to cycle.</p>
          {skinsFor(theme).map(skin => { const Icon = SKIN_ICONS[skin.id]; return <button key={skin.id} type="button" role="radio" aria-checked={skin.id === props.skin.id} className="menu-item" onClick={() => { props.onSkin(skin.id); close(); }}>
            <span className="model-swatch"><Icon/></span><span><strong>{skin.name}</strong><small>{skin.blurb}</small></span>{skin.id === props.skin.id && <CheckIcon/>}
          </button>; })}
        </div>}
      </Popover>
      {props.artwork && <Popover className="sleeve-menu" label="Sleeve settings" side="bottom" button={<><SlidersIcon/><span className="hide-narrow">Sleeve</span></>}>
        {() => <div className="menu">
          <p className="menu-title">{theme === 'vinyl' ? 'Record sleeve' : 'Cassette J-card'}</p>
          <p className="menu-hint">Drag the {theme === 'vinyl' ? 'sleeve' : 'case'} anywhere on stage.</p>
          <fieldset className="menu-group"><legend className="sr-only">Album art fit</legend>
            {FIT_OPTIONS.map(([value, label]) => <label key={value} className="menu-radio"><input type="radio" name="cover-fit" checked={props.cover.fit === value} onChange={() => props.cover.onFit(value)}/> {label}</label>)}
          </fieldset>
          {props.cover.fit === 'fit-height' && <label className="menu-slider">
            <span>Image position <small>drag the art, or slide</small></span>
            <input type="range" className="range" min="0" max="100" step="1" value={props.cover.pan} style={{ '--fill': `${props.cover.pan}%` } as React.CSSProperties} aria-valuetext={props.cover.pan < 34 ? 'Left side' : props.cover.pan > 66 ? 'Right side' : 'Centered'} onChange={event => props.cover.onPan(Number(event.target.value))}/>
          </label>}
          <label className="menu-toggle"><input type="checkbox" checked={props.cover.showTitle} onChange={event => props.cover.onShowTitle(event.target.checked)}/> Print the title on the sleeve</label>
          <button type="button" className="menu-item" onClick={props.cover.onReset}>Reset position</button>
        </div>}
      </Popover>}
      </div>
    </div>

    {props.playerError && authenticated && <div className={`stage-alert ${status === 'error' ? 'is-error' : ''}`} role="alert">
      <AlertIcon/><span>{props.playerError}</span>
      {status === 'error' && <button type="button" className="chip-button" onClick={props.onReconnect}><RefreshIcon/> Reconnect deck</button>}
      <button type="button" className="icon-button subtle" aria-label="Dismiss" onClick={props.onDismissError}><CloseIcon/></button>
    </div>}

    <div className={`stage-machine stage-machine-${theme}`}>
      <div className="machine-frame">
        {!setup.ready && <MachineSetup skin={props.skin} progress={setup.progress} visible={setup.slow}/>}
        {setup.ready && props.artwork && <AlbumCoverPreview theme={theme} artwork={props.artwork} title={props.coverTitle} fit={props.cover.fit} showTitle={props.cover.showTitle} position={props.cover.position} onPositionChange={props.cover.onPosition} pan={props.cover.pan} onPanChange={props.cover.onPan}/>}
        {setup.ready && <Machine key={props.skin.id} skin={props.skin} machine={props.machine} title={track?.name ?? props.coverTitle}
          motion={{ playing, position: playback?.position ?? 0, duration: playback?.duration ?? 0, trackKey: track?.uri }}/>}
      </div>
    </div>

    <div className="liner-notes" aria-live="polite">
      {track ? <>
        <span className="eyebrow"><i className={`status-dot ${playing ? 'is-live' : ''}`}/>{playing ? 'Now playing' : 'Paused'}{track.album.name ? ` · ${track.album.name}` : ''}</span>
        <h1 className="liner-title">{trackLink ? <a href={trackLink} target="_blank" rel="noreferrer" title="Open in Spotify">{track.name}<ExternalIcon/></a> : track.name}</h1>
        <p className="liner-artist">{track.artists.map(artist => artist.name).join(', ')}</p>
      </> : <>
        <span className="eyebrow"><i className={`status-dot ${status === 'ready' ? 'is-ready' : ''}`}/>{!authenticated ? (props.invite ? 'Shared with you' : 'Standby') : status === 'ready' ? 'Deck ready' : status === 'error' ? 'Deck needs attention' : 'Warming up'}</span>
        <h1 className="liner-title">{authenticated ? (status === 'ready' ? 'Drop a playlist on the deck.' : 'Warming up the valves…') : props.invite ? props.invite.playlist.name : 'Choose your machine. Press play.'}</h1>
        <p className="liner-artist">{authenticated ? (status === 'ready' ? 'Choose from your library, or press / to search.' : 'Spotify is connecting this browser as a speaker.')
          : props.invite ? `${props.invite.sharedBy} shared this playlist with you. Connect Spotify to listen on your own account.`
          : 'Stream your Spotify playlists through a tape deck or a turntable — real buttons, real ritual, right in your browser.'}</p>
        {props.inviteError && <p className="inline-error invite-error"><AlertIcon/>{props.inviteError}</p>}
        {!authenticated && !props.checking && <Welcome account={props.account}/>}
        {authenticated && status === 'ready' && props.resume && <ResumeCard {...props.resume}/>}
      </>}
    </div>
  </section>;
}

/** Onboarding for a signed-in profile that has not connected Spotify yet (signed-out visitors see the landing page). */
function Welcome({ account }: { account: Account }) {
  return <div className="welcome">
    <ol className="onboarding-steps" aria-label="Get started">
      <li className="is-done"><span>1</span>Signed in{account.name ? ` as ${account.name}` : ''}</li>
      <li className="is-current"><span>2</span>Connect Spotify</li>
    </ol>
    <a className="primary-button big" href={account.connectHref}>Connect Spotify</a>
    <ul className="welcome-points">
      <li>Needs Spotify <b>Premium</b> for in-browser playback</li>
      <li>You do this once — Retro Play remembers the connection</li>
    </ul>
  </div>;
}

/**
 * Downloads and decodes everything the chosen model paints before it is shown, so it appears whole instead of painting
 * in strip by strip on slow connections. The setup panel only appears if that takes longer than a moment (a cached
 * model shows straight away), and once the model is up the other models are fetched quietly for instant switching.
 */
function useModelSetup(skin: Skin) {
  const { ready, progress } = useImagePreload(modelAssets(skin.id, skin.machine));
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (ready) return;
    const timer = window.setTimeout(() => setSlow(true), 180);
    return () => window.clearTimeout(timer);
  }, [skin.id, ready]);
  useEffect(() => {
    if (!ready) return;
    const others = SKINS.filter(other => other.id !== skin.id).sort((a, b) => Number(b.machine === skin.machine) - Number(a.machine === skin.machine));
    prefetchImages(others.flatMap(other => modelAssets(other.id, other.machine)));
  }, [ready, skin.id]);
  return { ready, progress, slow };
}

function MachineSetup({ skin, progress, visible }: { skin: Skin; progress: number; visible: boolean }) {
  const Icon = SKIN_ICONS[skin.id];
  const percent = Math.round(progress * 100);
  return <div className={`machine-setup ${visible ? 'is-visible' : ''}`} role="status" aria-live="polite">
    <span className={`setup-icon setup-${skin.machine}`} aria-hidden="true"><Icon/></span>
    <strong>Setting up the {skin.name}…</strong>
    <span className="setup-bar" role="progressbar" aria-label={`Setting up the ${skin.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${Math.max(4, percent)}%` }}/></span>
    <small>{percent < 100 ? `${percent}% · unpacking the hardware` : 'Warming up'}</small>
  </div>;
}

function ResumeCard({ nowPlaying, onResume, busy }: { nowPlaying: NowPlaying; onResume: () => void; busy: boolean }) {
  const { track, playlist, positionMs } = nowPlaying;
  return <div className="resume-card">
    {track.image ? <img src={track.image} alt=""/> : null}
    <span className="row-copy"><small>Pick up where you left off</small><strong>{track.name}</strong><small>{track.artists.join(', ')}{playlist ? ` · ${playlist.name}` : ''}</small></span>
    {playlist && <button type="button" className="primary-button" disabled={busy} onClick={onResume}><PlayIcon/> Resume{positionMs > 5000 ? ` at ${formatDuration(positionMs)}` : ''}</button>}
  </div>;
}
