import { useEffect, useRef, useState } from 'react';
import { api, errorMessage, type SessionInfo, type ShareLink } from '../lib/api';
import { formatDuration, timeAgo } from '../lib/format';
import type { ToastKind } from '../hooks/useToasts';
import { AlertIcon, CheckIcon, CloseIcon, CopyIcon, LogoutIcon, MusicIcon, TrashIcon } from './Icons';

export function Avatar({ name, picture, size = 32 }: { name: string; picture: string | null | undefined; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]!.toUpperCase()).join('') || '?';
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
    {picture && !broken ? <img src={picture} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)}/> : initials}
  </span>;
}

type ProfileDialogProps = {
  open: boolean; onClose: () => void; session: SessionInfo; connectHref: string;
  onProfileChange: () => Promise<void>; onSpotifyDisconnect: () => Promise<void>; onSignOut: () => Promise<void>; onAccountDeleted: () => Promise<void>;
  notify: (text: string, kind?: ToastKind) => void;
};

/** The signed-in user's profile: name, Spotify connection, last session, share links, and account actions. */
export function ProfileDialog({ open, onClose, session, connectHref, onProfileChange, onSpotifyDisconnect, onSignOut, onAccountDeleted, notify }: ProfileDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const user = session.user;
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [shares, setShares] = useState<ShareLink[] | null>(null);
  const [sharesError, setSharesError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || typeof dialog.showModal !== 'function') return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? ''); setConfirmDelete(false); setSharesError('');
    if (!session.csrf) return;
    api<{ items: ShareLink[] }>('/api/shares', session.csrf).then(result => setShares(result.items)).catch(cause => setSharesError(errorMessage(cause, 'Could not load your share links.')));
  }, [open, session.csrf]);

  if (!user) return <dialog ref={ref} className="shortcuts-dialog profile-dialog" onClose={onClose}/>;

  async function saveName(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try { await api('/api/profile', session.csrf, { method: 'PATCH', body: { displayName: name } }); await onProfileChange(); notify('Profile saved.', 'success'); }
    catch (cause) { notify(errorMessage(cause, 'Could not save your profile.'), 'error'); }
    finally { setSaving(false); }
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); notify('Share link copied.', 'success'); }
    catch { notify(`Copy this link: ${url}`); }
  }
  async function revoke(id: string) {
    try { await api(`/api/shares/${encodeURIComponent(id)}`, session.csrf, { method: 'DELETE' }); setShares(current => current?.filter(share => share.id !== id) ?? null); notify('Share link removed. It no longer opens.', 'success'); }
    catch (cause) { notify(errorMessage(cause, 'Could not remove that link.'), 'error'); }
  }
  async function deleteAccount() {
    try { await api('/api/profile', session.csrf, { method: 'DELETE' }); onClose(); await onAccountDeleted(); }
    catch (cause) { notify(errorMessage(cause, 'Could not delete your account.'), 'error'); }
  }

  const last = session.nowPlaying;
  const spotify = session.spotify;
  return <dialog ref={ref} className="shortcuts-dialog profile-dialog" aria-labelledby="profile-title" onClose={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="dialog-head"><h2 id="profile-title">Your profile</h2><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><CloseIcon/></button></div>
    <div className="profile-body">
      <div className="profile-id">
        <Avatar name={user.name} picture={user.picture} size={52}/>
        <div><strong>{user.name}</strong><small>{user.email}</small><small>Signed in with Google · member since {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</small></div>
      </div>

      <form className="profile-section" onSubmit={saveName}>
        <label htmlFor="profile-name" className="section-label">Display name</label>
        <div className="profile-field">
          <input id="profile-name" value={name} maxLength={60} onChange={event => setName(event.target.value)} placeholder={user.googleName} autoComplete="nickname"/>
          <button type="submit" className="secondary-button" disabled={saving || name.trim() === user.name}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
        <small className="profile-note">Shown on playlists you share. Leave it empty to use your Google name.</small>
      </form>

      <section className="profile-section" aria-labelledby="profile-spotify">
        <h3 id="profile-spotify" className="section-label">Spotify</h3>
        <div className="profile-row">
          <span className={`status-dot ${spotify?.connected ? 'is-ready' : ''}`} aria-hidden="true"/>
          <span className="row-copy"><strong>{spotify?.connected ? `Connected${spotify.displayName ? ` as ${spotify.displayName}` : ''}` : 'Not connected'}</strong><small>{spotify?.connected ? 'Playback runs on this Spotify Premium account.' : 'Connect Spotify Premium to play music.'}</small></span>
          {spotify?.connected ? <button type="button" className="ghost-button" onClick={() => void onSpotifyDisconnect()}>Disconnect</button> : <a className="primary-button" href={connectHref}>Connect</a>}
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-last">
        <h3 id="profile-last" className="section-label">Last on the deck</h3>
        {last ? <div className="profile-row">
          {last.track.image ? <img className="profile-art" src={last.track.image} alt=""/> : <span className="art-fallback"><MusicIcon/></span>}
          <span className="row-copy"><strong>{last.track.name}</strong><small>{last.track.artists.join(', ')}{last.playlist ? ` · from ${last.playlist.name}` : ''}</small>
            <small>{last.paused ? `Paused at ${formatDuration(last.positionMs)}` : `Playing · ${formatDuration(last.positionMs)} of ${formatDuration(last.durationMs)}`}{last.updatedAt ? ` · ${timeAgo(last.updatedAt)}` : ''}</small></span>
        </div> : <p className="hint">Nothing yet. Whatever you play is saved here so you can pick up where you left off.</p>}
        <small className="profile-note">Your theme, machine models, sleeve layout, volume, and recent playlists are saved to this profile too.</small>
      </section>

      <section className="profile-section" aria-labelledby="profile-shares">
        <h3 id="profile-shares" className="section-label">Your share links {shares?.length ? <span className="count">{shares.length}</span> : null}</h3>
        {sharesError ? <p className="inline-error"><AlertIcon/>{sharesError}</p> : shares === null ? <p className="hint">Loading…</p> : shares.length ? <ul className="share-list">
          {shares.map(share => <li key={share.id} className="profile-row">
            {share.playlist.image ? <img className="profile-art" src={share.playlist.image} alt=""/> : <span className="art-fallback"><MusicIcon/></span>}
            <span className="row-copy"><strong>{share.playlist.name}</strong><small>{share.url.replace(/^https?:\/\//, '')}</small></span>
            <button type="button" className="icon-button subtle" aria-label={`Copy link to ${share.playlist.name}`} title="Copy link" onClick={() => void copy(share.url)}><CopyIcon/></button>
            <button type="button" className="icon-button subtle" aria-label={`Remove link to ${share.playlist.name}`} title="Remove link" onClick={() => void revoke(share.id)}><TrashIcon/></button>
          </li>)}
        </ul> : <p className="hint">Open a public playlist and press <b>Share</b> to get a Retro Play link.</p>}
      </section>
    </div>
    <div className="profile-foot">
      <button type="button" className="ghost-button" onClick={() => { onClose(); void onSignOut(); }}><LogoutIcon/> Sign out</button>
      {confirmDelete ? <span className="confirm-delete" role="group" aria-label="Confirm account deletion">
        <small>Delete your profile, Spotify connection, and share links?</small>
        <button type="button" className="text-button" onClick={() => setConfirmDelete(false)}>Keep</button>
        <button type="button" className="danger-button" onClick={() => void deleteAccount()}><CheckIcon/> Delete</button>
      </span> : <button type="button" className="text-button danger" onClick={() => setConfirmDelete(true)}><TrashIcon/> Delete account</button>}
    </div>
  </dialog>;
}

