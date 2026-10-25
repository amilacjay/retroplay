import { useEffect, useRef, useState } from 'react';
import type { SharedPlaylist } from '../lib/api';
import type { Toast } from '../hooks/useToasts';
import { decodeImage } from '../lib/preload';
import { Toasts, type Appearance } from './Chrome';
import { IMAGES } from './machines/assets';
import { CassetteIcon, LinkIcon, MoonIcon, MusicIcon, RefreshIcon, SunIcon, UserIcon } from './Icons';

type LandingProps = {
  appearance: Appearance; onAppearance: () => void; signInHref: string; signInAvailable: boolean;
  invite: SharedPlaylist | null; inviteError: string; toasts: Toast[]; onDismissToast: (id: number) => void;
};

const FEATURES: [typeof CassetteIcon, string, string][] = [
  [CassetteIcon, 'Real hardware', 'Tape decks and turntables with working keys and turning reels.'],
  [RefreshIcon, 'Picks up where you left off', 'Your deck, theme, and last song wait on your profile.'],
  [LinkIcon, 'Share with a link', 'Send a public playlist; friends play it on their own deck.'],
];

/**
 * The page signed-out visitors see. It is one screen by design: it never scrolls, so the pitch and the single way in
 * (Google sign-in) are visible at first sight. On short screens the less important parts drop out instead.
 */
export function Landing({ appearance, onAppearance, signInHref, signInAvailable, invite, inviteError, toasts, onDismissToast }: LandingProps) {
  return <div className="landing">
    <header className="landing-bar landing-wrap">
      <a className="brand" href="/" aria-label="Retro Play home"><span className="brand-mark" aria-hidden="true"><i/><i/></span><span>retro<span className="brand-play">play</span><span className="brand-dot">.</span></span></a>
      <div className="landing-bar-actions">
        <button type="button" className="icon-button" onClick={onAppearance} aria-label={appearance === 'dark' ? 'Switch to day mode' : 'Switch to night mode'} title={appearance === 'dark' ? 'Day mode' : 'Night mode'}>{appearance === 'dark' ? <SunIcon/> : <MoonIcon/>}</button>
        <a className="ghost-button landing-signin" href={signInHref} aria-disabled={!signInAvailable}>Sign in</a>
      </div>
    </header>

    <main className="landing-main landing-wrap">
      <section className="landing-copy" aria-labelledby="landing-title">
        <span className="eyebrow"><i className="status-dot" aria-hidden="true"/>{invite ? 'A playlist was shared with you' : 'Your listening room'}</span>
        <h1 id="landing-title" className="landing-title">{invite ? <>Press play on <em>{invite.playlist.name}</em>.</> : <>Rewind your <em>memories</em>.</>}</h1>
        <p className="landing-lede">{invite
          ? `${invite.sharedBy} shared this playlist with you. Sign in and connect Spotify Premium, and it will be waiting on your deck.`
          : 'Your Spotify playlists on a tape deck or a turntable. Real buttons, real ritual, right in your browser.'}</p>

        {invite && <div className="invite-card">
          {invite.playlist.image ? <img src={invite.playlist.image} alt=""/> : <span className="art-fallback"><MusicIcon/></span>}
          <span className="row-copy"><strong>{invite.playlist.name}</strong><small>{invite.playlist.owner}{invite.playlist.total ? ` · ${invite.playlist.total} tracks` : ''} · shared by {invite.sharedBy}</small></span>
        </div>}
        {inviteError && <p className="inline-error">{inviteError}</p>}

        <div className="landing-cta">
          <a className="primary-button big" href={signInHref} aria-disabled={!signInAvailable}><UserIcon/> Sign in with Google</a>
          <ol className="landing-steps" aria-label="How it works">
            <li><span>1</span>Sign in</li>
            <li><span>2</span>Connect Spotify once</li>
            <li><span>3</span>Press play</li>
          </ol>
        </div>
        {!signInAvailable && <p className="hint">Sign-in is not configured on this server yet.</p>}
      </section>

      <div className="landing-art" aria-hidden="true">
        <div className="landing-art-stage">
          <FadeImage className="landing-turntable" src={IMAGES.turntablePlaying}/>
          <FadeImage className="landing-deck" src={IMAGES.cassetteDeck}/>
        </div>
      </div>

      <ul className="landing-features" aria-label="What you get">
        {FEATURES.map(([Icon, title, body]) => <li key={title}><span className="feature-icon"><Icon/></span><span><strong>{title}</strong><small>{body}</small></span></li>)}
      </ul>
    </main>

    <footer className="landing-foot landing-wrap">
      <span className="landing-powered"><i aria-hidden="true"/>Powered by Spotify</span>
      <span>Needs Spotify Premium · Your passwords never touch Retro Play</span>
    </footer>
    <Toasts toasts={toasts} onDismiss={onDismissToast}/>
  </div>;
}

/** Shown for the moment the session check takes, so signed-in users don't see the landing page flash past. */
export function Splash() {
  return <div className="splash" role="status" aria-label="Loading Retro Play"><span className="brand-mark" aria-hidden="true"><i/><i/></span></div>;
}

/** A decorative image that appears once fully decoded, instead of painting in as it downloads. */
function FadeImage({ className, src }: { className: string; src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    let live = true;
    // Also covers an image that finished from cache before React attached a load handler.
    void decodeImage(image).then(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [src]);
  return <img ref={ref} className={`${className} fade-image ${loaded ? 'is-loaded' : ''}`} src={src} alt="" decoding="async"/>;
}
