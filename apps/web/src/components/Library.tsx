import { forwardRef, useEffect, useRef, useState } from 'react';
import { api, errorMessage, type Page, type PlaylistResult } from '../lib/api';
import { normalizePlaylist } from '../lib/format';
import type { PlayerStatus } from '../useSpotifyPlayer';
import { AlertIcon, CheckIcon, CloseIcon, LinkIcon, MusicIcon, PlayIcon, RefreshIcon, SearchIcon } from './Icons';

export function SessionCard({ authenticated, checking, status, onReconnect }: { authenticated: boolean; checking: boolean; status: string; onReconnect?: () => void }) {
  const title = checking ? 'Checking session' : !authenticated ? 'Not connected' : status === 'ready' ? 'Deck ready' : status === 'error' ? 'Needs attention' : 'Connecting deck';
  const subtitle = checking ? 'One moment…' : !authenticated ? 'Connect your account to begin' : status === 'ready' ? 'Playing through this browser' : status === 'error' ? 'The browser player stopped responding' : 'Warming up the browser player…';
  return <div className={`session-card status-${checking ? 'checking' : authenticated ? status : 'signed-out'}`}>
    <span className="status-dot" aria-hidden="true"/>
    <div><strong>{title}</strong><small>{subtitle}</small></div>
    {authenticated && status === 'error' && onReconnect ? <button type="button" className="chip-button" onClick={onReconnect}><RefreshIcon/> Retry</button> : authenticated && status === 'ready' ? <span className="session-check" aria-hidden="true"><CheckIcon/></span> : null}
  </div>;
}

export function PlaylistRow({ playlist, active, playing, canPlay, onOpen, onPlay }: { playlist: PlaylistResult; active: boolean; playing: boolean; canPlay: boolean; onOpen: () => void; onPlay: () => void }) {
  return <li className={`playlist-row ${active ? 'is-active' : ''}`}>
    <button type="button" className="playlist-row-main" onClick={onOpen} aria-current={active ? 'true' : undefined}>
      {playlist.image ? <img src={playlist.image} alt="" loading="lazy"/> : <span className="art-fallback"><MusicIcon/></span>}
      <span className="row-copy"><strong>{playlist.name}</strong><small>{playlist.owner}{playlist.total ? ` · ${playlist.total} tracks` : ''}</small></span>
      {playing && <span className="now-badge" title="Playing now">ON AIR</span>}
    </button>
    <button type="button" className="row-play" aria-label={`Play ${playlist.name}`} title={canPlay ? `Play ${playlist.name}` : 'Waiting for the deck'} disabled={!canPlay} onClick={onPlay}><PlayIcon/></button>
  </li>;
}

const RowSkeletons = ({ count = 5 }: { count?: number }) => <ul className="playlist-list" aria-hidden="true">{Array.from({ length: count }, (_, index) => <li key={index} className="skeleton-row"><span className="skeleton art"/><span className="skeleton-lines"><span className="skeleton line"/><span className="skeleton line short"/></span></li>)}</ul>;

type LibraryProps = {
  csrf?: string; authenticated: boolean; checking: boolean; status: PlayerStatus; canPlay: boolean;
  activePlaylistId: string; playingContextUri?: string | null; recents: PlaylistResult[];
  onOpen: (playlist: PlaylistResult) => void; onOpenLink: (id: string) => void; onPlay: (playlist: PlaylistResult) => void; onReconnect: () => void; onClearRecents: () => void;
};

export const Library = forwardRef<HTMLInputElement, LibraryProps>(function Library(props, searchRef) {
  const { csrf, authenticated, canPlay, activePlaylistId, playingContextUri } = props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaylistResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [mine, setMine] = useState<Page<PlaylistResult> | null>(null);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState('');
  const searchAbort = useRef<AbortController | null>(null);
  const link = normalizePlaylist(query);

  async function loadMine(offset = 0) {
    if (!csrf) return;
    setMineLoading(true); setMineError('');
    try {
      const page = await api<Page<PlaylistResult>>(`/api/playlists/mine?offset=${offset}`, csrf);
      setMine(current => offset && current ? { ...page, items: [...current.items, ...page.items] } : page);
    } catch (cause) { setMineError(errorMessage(cause, 'Could not load your playlists.')); }
    finally { setMineLoading(false); }
  }
  useEffect(() => { if (authenticated && csrf) void loadMine(0); else setMine(null); }, [authenticated, csrf]);

  async function runSearch(value: string) {
    searchAbort.current?.abort();
    if (!csrf || value.trim().length < 2) { setResults(null); setSearching(false); return; }
    const controller = new AbortController(); searchAbort.current = controller;
    setSearching(true); setSearchError('');
    try {
      const result = await api<{ items: PlaylistResult[] }>(`/api/playlists/search?q=${encodeURIComponent(value.trim())}`, csrf, { signal: controller.signal });
      setResults(result.items ?? []);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setResults([]); setSearchError(errorMessage(cause, 'Could not search playlists.'));
    } finally { if (searchAbort.current === controller) setSearching(false); }
  }
  // Search as you type, but give the user a beat to finish the word first.
  useEffect(() => {
    if (link || !authenticated) { searchAbort.current?.abort(); setResults(null); setSearching(false); return; }
    if (query.trim().length < 2) { setResults(null); setSearchError(''); return; }
    const timer = window.setTimeout(() => void runSearch(query), 380);
    return () => window.clearTimeout(timer);
  }, [query, link, authenticated, csrf]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (link) { props.onOpenLink(link.split(':').at(-1)!); setQuery(''); return; }
    void runSearch(query);
  }
  const rows = (items: PlaylistResult[]) => <ul className="playlist-list">{items.map(item => <PlaylistRow key={item.id} playlist={item} active={item.id === activePlaylistId} playing={Boolean(playingContextUri && playingContextUri === item.uri)} canPlay={canPlay} onOpen={() => props.onOpen(item)} onPlay={() => props.onPlay(item)}/>)}</ul>;
  const searchingMode = query.trim().length >= 2 && !link;

  return <aside className="panel library" aria-label="Playlist library">
    <SessionCard authenticated={authenticated} checking={props.checking} status={props.status} onReconnect={props.onReconnect}/>
    <form className="smart-search" role="search" onSubmit={submit}>
      <label htmlFor="playlist-search" className="sr-only">Search playlists or paste a Spotify playlist link</label>
      <span className="field-icon" aria-hidden="true">{link ? <LinkIcon/> : <SearchIcon/>}</span>
      <input id="playlist-search" ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && query) { event.stopPropagation(); setQuery(''); } }} placeholder={authenticated ? 'Search playlists or paste a link' : 'Connect Spotify to search'} disabled={!authenticated} autoComplete="off" spellCheck={false}/>
      {query && <button type="button" className="field-clear" aria-label="Clear search" onClick={() => setQuery('')}><CloseIcon/></button>}
      <kbd className="field-kbd" aria-hidden="true">/</kbd>
    </form>
    {link && <button type="button" className="link-detected" onClick={() => { props.onOpenLink(link.split(':').at(-1)!); setQuery(''); }}><LinkIcon/><span><strong>Open this Spotify playlist</strong><small>Press Enter or tap to load it</small></span></button>}
    {query && !link && query.trim().length < 2 && <p className="hint">Keep typing — or paste an <b>open.spotify.com/playlist</b> link.</p>}

    <div className="library-scroll">
      {!authenticated ? <div className="library-locked">
        <span className="locked-art" aria-hidden="true"><MusicIcon/></span>
        <strong>Your crate is empty</strong>
        <p>Connect Spotify and your playlists will line up here, ready to drop on the deck.</p>
      </div> : searchingMode ? <section aria-label="Search results" aria-busy={searching}>
        <h2 className="section-label">Results for “{query.trim()}”</h2>
        {searching && !results?.length ? <RowSkeletons/> : searchError ? <p className="inline-error"><AlertIcon/>{searchError}</p> : results?.length ? rows(results) : results ? <p className="hint">No playlists match. Try an artist, a mood, or a decade.</p> : null}
      </section> : <>
        {props.recents.length > 0 && <section aria-label="Recently played">
          <h2 className="section-label">Recently played <button type="button" className="text-button" onClick={props.onClearRecents}>Clear</button></h2>
          {rows(props.recents)}
        </section>}
        <section aria-label="Your playlists" aria-busy={mineLoading}>
          <h2 className="section-label">Your playlists {mine?.total ? <span className="count">{mine.total}</span> : null}</h2>
          {mineLoading && !mine ? <RowSkeletons count={6}/> : mineError ? <div className="inline-error"><AlertIcon/><span>{mineError}</span><button type="button" className="text-button" onClick={() => void loadMine(0)}>Retry</button></div> : mine?.items.length ? <>
            {rows(mine.items)}
            {mine.items.length < mine.total && <button type="button" className="load-more" disabled={mineLoading} onClick={() => void loadMine(mine.items.length)}>{mineLoading ? 'Loading…' : 'Show more playlists'}</button>}
          </> : mine ? <p className="hint">No saved playlists yet. Search above to find one.</p> : null}
        </section>
      </>}
    </div>
  </aside>;
});
