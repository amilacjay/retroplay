import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import type { Toast } from '../hooks/useToasts';
import type { SessionInfo } from '../lib/api';
import { AlertIcon, CheckIcon, CloseIcon, HelpIcon, MoonIcon, SunIcon, UserIcon } from './Icons';
import { Avatar } from './Profile';

export type Appearance = 'light' | 'dark';

export function TopBar({ session, checking, appearance, onAppearance, onProfile, onTour, signInHref }: { session: SessionInfo; checking: boolean; appearance: Appearance; onAppearance: () => void; onProfile: () => void; onTour?: () => void; signInHref: string }) {
  const user = session.authenticated ? session.user : undefined;
  return <header className="topbar">
    <a className="brand" href="/" aria-label="Retro Play home"><span className="brand-mark" aria-hidden="true"><i/><i/></span><span>retro<span className="brand-play">play</span><span className="brand-dot">.</span></span></a>
    <div className="top-actions">
      <span className="powered" title="Playback and metadata provided by Spotify"><i aria-hidden="true"/>Powered by Spotify</span>
      {onTour && <button type="button" className="icon-button" onClick={onTour} aria-label="Take the tour" title="Take the tour"><HelpIcon/></button>}
      <button type="button" className="icon-button" onClick={onAppearance} aria-label={appearance === 'dark' ? 'Switch to day mode' : 'Switch to night mode'} title={appearance === 'dark' ? 'Day mode' : 'Night mode'}>{appearance === 'dark' ? <SunIcon/> : <MoonIcon/>}</button>
      {user ? <button type="button" className="account-button" onClick={onProfile} aria-label={`Your profile (${user.name})`} title="Your profile"><Avatar name={user.name} picture={user.picture} size={28}/><span className="hide-narrow">{user.name.split(' ')[0]}</span></button>
        : <a className="primary-button" href={signInHref} aria-disabled={checking}><UserIcon/><span>Sign in</span></a>}
    </div>
  </header>;
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return <div className="toasts" role="region" aria-label="Notifications">
    <div aria-live="polite" role="status">
      {toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.kind}`}>
        {toast.kind === 'error' ? <AlertIcon/> : toast.kind === 'success' ? <CheckIcon/> : <i className="toast-dot"/>}
        <span>{toast.text}</span>
        <button type="button" className="icon-button subtle" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}><CloseIcon/></button>
      </div>)}
    </div>
  </div>;
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || typeof dialog.showModal !== 'function') return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="shortcuts-dialog" aria-labelledby="shortcuts-title" onClose={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="dialog-head"><h2 id="shortcuts-title">Keyboard shortcuts</h2><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><CloseIcon/></button></div>
    <dl className="shortcut-list">{SHORTCUTS.map(([keys, label]) => <div key={keys}><dt>{keys.split(' ').map((key, index, parts) => parts.length > 1 && (key === '+' || key === '/') ? <span key={index} className="key-sep">{key}</span> : <kbd key={index}>{key}</kbd>)}</dt><dd>{label}</dd></div>)}</dl>
    <p className="dialog-foot">Media keys on your keyboard and lock screen work too.</p>
  </dialog>;
}
