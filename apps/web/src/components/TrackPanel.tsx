import { useMemo, useState } from 'react';
import type { PlaylistResult, PlaylistTrack } from '../lib/api';
import { formatDuration, formatRuntime, spotifyUrl } from '../lib/format';
import type { SpotifyState, SpotifyTrack } from '../spotify-sdk';
import { AlertIcon, ClockIcon, CloseIcon, ExternalIcon, ListIcon, MusicIcon, PlayIcon, SearchIcon, ShareIcon, ShuffleIcon, VolumeIcon } from './Icons';

type TrackPanelProps = {
  playlist: PlaylistResult | null; tracks: PlaylistTrack[]; total: number; loading: boolean; error: string; busy: boolean; canPlay: boolean;
  playback: SpotifyState | null; onPlay: (trackUri?: string) => void; onShufflePlay: () => void; onLoadMore: () => void; onRetry: () => void;
  /** Present when the viewer can create share links (signed in with Spotify connected). */
  onShare?: () => void; sharing?: boolean;
};

export function TrackPanel(props: TrackPanelProps) {
  const { playlist, tracks, total, loading, canPlay, playback } = props;
  const [tab, setTab] = useState<'tracks' | 'queue'>('tracks');
  const [filter, setFilter] = useState('');
  const currentUri = playback?.track_window.current_track.uri;
  const playing = Boolean(playback && !playback.paused);
  const playingThisPlaylist = Boolean(playlist && playback?.context?.uri === playlist.uri);
  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return tracks.map((track, index) => ({ track, index }));
    return tracks.map((track, index) => ({ track, index })).filter(({ track }) => [track.name, track.album ?? '', ...track.artists].some(value => value.toLowerCase().includes(needle)));
  }, [tracks, filter]);
  const runtime = tracks.reduce((sum, track) => sum + (track.duration_ms ?? 0), 0);
  const playlistLink = spotifyUrl(playlist?.uri);
  const upNext = playback?.track_window.next_tracks ?? [];
  const previous = playback?.track_window.previous_tracks ?? [];

  return <aside className="panel tracks-panel" aria-label="Playlist and queue">
    <div className="tabs" role="tablist" aria-label="Track views">
      <button type="button" role="tab" id="tab-tracks" aria-controls="panel-tracks" aria-selected={tab === 'tracks'} className={tab === 'tracks' ? 'is-active' : ''} onClick={() => setTab('tracks')}>Tracks</button>
      <button type="button" role="tab" id="tab-queue" aria-controls="panel-queue" aria-selected={tab === 'queue'} className={tab === 'queue' ? 'is-active' : ''} onClick={() => setTab('queue')}>Up next {upNext.length > 0 && <span className="count">{upNext.length}</span>}</button>
    </div>

    {tab === 'tracks' ? <div className="tab-body" role="tabpanel" id="panel-tracks" aria-labelledby="tab-tracks">
      <header className="playlist-hero">
        <div className="playlist-cover">{playlist?.image ? <img src={playlist.image} alt=""/> : <MusicIcon/>}</div>
        <div className="playlist-meta">
          <span className="eyebrow">{playingThisPlaylist ? (playing ? 'On the deck now' : 'Paused on the deck') : playlist ? 'Playlist' : 'Nothing loaded'}</span>
          <h2 title={playlist?.name}>{playlist?.name ?? (loading ? 'Loading…' : 'Choose a playlist')}</h2>
          <p>{playlist ? [playlist.owner, `${total || playlist.total} tracks`, runtime && tracks.length >= (total || playlist.total) ? formatRuntime(runtime) : null].filter(Boolean).join(' · ') : 'Pick one from your library, search, or paste a Spotify link.'}</p>
        </div>
      </header>
      {playlist && <div className="playlist-actions">
        <button type="button" className="primary-button" disabled={!canPlay || props.busy} onClick={() => props.onPlay()}><PlayIcon/> Play</button>
        <button type="button" className="secondary-button" disabled={!canPlay || props.busy || tracks.length === 0} onClick={props.onShufflePlay} title="Start at a random track with shuffle on"><ShuffleIcon/> Shuffle</button>
        {playlistLink && <a className="icon-button" href={playlistLink} target="_blank" rel="noreferrer" aria-label="Open playlist in Spotify" title="Open in Spotify"><ExternalIcon/></a>}
        {props.onShare && <button type="button" className="icon-button" onClick={props.onShare} disabled={props.sharing} aria-label="Share this playlist" title="Copy a Retro Play share link (public playlists only)"><ShareIcon/></button>}
        {tracks.length > 8 && <label className="track-filter"><SearchIcon/><span className="sr-only">Filter tracks</span><input value={filter} onChange={event => setFilter(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setFilter(''); } }} placeholder="Filter"/>{filter && <button type="button" aria-label="Clear filter" onClick={() => setFilter('')}><CloseIcon/></button>}</label>}
      </div>}
      {!canPlay && playlist && <p className="hint pad">The deck is still warming up — tracks become playable once it says <b>Deck ready</b>.</p>}

      <div className="track-scroll">
        {props.error ? <div className="empty-state"><AlertIcon className="empty-icon"/><strong>Couldn’t open these tracks</strong><small>{props.error}</small>{playlist && <div className="empty-actions"><button type="button" className="secondary-button" onClick={props.onRetry}>Try again</button><button type="button" className="primary-button" disabled={!canPlay} onClick={() => props.onPlay()}><PlayIcon/> Play anyway</button></div>}</div>
        : loading && tracks.length === 0 ? <ol className="track-list" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <li key={index} className="skeleton-row"><span className="skeleton art"/><span className="skeleton-lines"><span className="skeleton line"/><span className="skeleton line short"/></span></li>)}</ol>
        : tracks.length > 0 ? <>
          <div className="track-head" aria-hidden="true"><span>#</span><span>Title</span><span><ClockIcon/></span></div>
          <ol className="track-list">
            {filtered.map(({ track, index }) => {
              const isCurrent = track.uri === currentUri;
              return <li key={`${track.uri}-${index}`}>
                <button type="button" className={`track-row ${isCurrent ? 'is-current' : ''}`} disabled={!canPlay || props.busy} onClick={() => props.onPlay(track.uri)} aria-current={isCurrent ? 'true' : undefined} aria-label={`Play ${track.name} by ${track.artists.join(', ')}`}>
                  <span className="track-index">{isCurrent && playing ? <VolumeIcon/> : <><span className="num">{index + 1}</span><PlayIcon className="hover-play"/></>}</span>
                  {track.image ? <img src={track.image} alt="" loading="lazy"/> : <span className="art-fallback"><MusicIcon/></span>}
                  <span className="row-copy"><strong>{track.name}</strong><small>{track.artists.join(', ')}{track.album ? <span className="album"> · {track.album}</span> : null}</small></span>
                  <span className="track-length">{formatDuration(track.duration_ms)}</span>
                </button>
              </li>;
            })}
          </ol>
          {filter && filtered.length === 0 && <p className="hint pad">No loaded tracks match “{filter}”.</p>}
          {tracks.length < total && <button type="button" className="load-more" disabled={loading} onClick={props.onLoadMore}>{loading ? 'Loading…' : `Load more · ${total - tracks.length} left`}</button>}
        </>
        : <div className="empty-state">
          <div className="empty-vinyl" aria-hidden="true"><span/></div>
          <strong>{playlist ? 'No playable tracks here' : 'Your tape is still blank'}</strong>
          <small>{playlist ? 'This playlist may only contain podcasts or local files. You can still try playing it.' : 'Open a playlist from the library to see its tracks.'}</small>
          {!playlist && <ol className="how-steps">
            <li><span><b>Connect</b> your Spotify Premium account</span></li>
            <li><span><b>Pick</b> a playlist — yours, a search, or a pasted link</span></li>
            <li><span><b>Choose</b> cassette or vinyl and press play on the deck</span></li>
          </ol>}
        </div>}
      </div>
    </div> : <div className="tab-body" role="tabpanel" id="panel-queue" aria-labelledby="tab-queue">
      <div className="track-scroll">
        {playback ? <>
          <h3 className="section-label pad">Now playing</h3>
          <QueueRow track={playback.track_window.current_track} current playing={playing}/>
          <h3 className="section-label pad">Next from Spotify</h3>
          {upNext.length ? upNext.map((track, index) => <QueueRow key={`${track.uri}-${index}`} track={track}/>) : <p className="hint pad">Nothing queued after this track.</p>}
          {previous.length > 0 && <><h3 className="section-label pad">Recently played</h3>{[...previous].reverse().map((track, index) => <QueueRow key={`${track.uri}-${index}`} track={track} muted/>)}</>}
        </> : <div className="empty-state"><ListIcon className="empty-icon"/><strong>The queue is quiet</strong><small>Start a playlist and the next few tracks Spotify has lined up appear here.</small></div>}
      </div>
    </div>}
  </aside>;
}

function QueueRow({ track, current = false, playing = false, muted = false }: { track: SpotifyTrack; current?: boolean; playing?: boolean; muted?: boolean }) {
  const link = spotifyUrl(track.uri);
  return <div className={`queue-row ${current ? 'is-current' : ''} ${muted ? 'is-muted' : ''}`}>
    {track.album.images[0]?.url ? <img src={track.album.images.at(-1)!.url} alt=""/> : <span className="art-fallback"><MusicIcon/></span>}
    <span className="row-copy"><strong>{track.name}</strong><small>{track.artists.map(artist => artist.name).join(', ')}</small></span>
    {current && <span className="now-badge">{playing ? 'ON AIR' : 'PAUSED'}</span>}
    {link && <a className="icon-button subtle" href={link} target="_blank" rel="noreferrer" aria-label={`Open ${track.name} in Spotify`} title="Open in Spotify"><ExternalIcon/></a>}
  </div>;
}
