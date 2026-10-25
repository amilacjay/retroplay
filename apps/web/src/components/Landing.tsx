import type { SharedPlaylist } from '../lib/api';
import type { Toast } from '../hooks/useToasts';
import { Toasts, type Appearance } from './Chrome';
import { CassetteIcon, LinkIcon, MoonIcon, MusicIcon, RefreshIcon, SunIcon, UserIcon } from './Icons';

type LandingProps = {
  appearance: Appearance; onAppearance: () => void; signInHref: string; signInAvailable: boolean;
  invite: SharedPlaylist | null; inviteError: string; toasts: Toast[]; onDismissToast: (id: number) => void;
};

const FEATURES: [typeof CassetteIcon, string, string][] = [
  [CassetteIcon, 'Real hardware, in your browser', 'Six cassette decks and turntables with working keys, turning reels, and a tonearm that follows the track.'],
  [RefreshIcon, 'Picks up where you left off', 'Your deck, theme, and the song you were playing are saved to your profile and waiting next time.'],
  [LinkIcon, 'Share a playlist with a link', 'Send any public Spotify playlist as a Retro Play link. Friends sign in and play it on their own deck.'],
];

/** The page signed-out visitors see: what Retro Play is, and one way in (Google sign-in). */
export function Landing({ appearance, onAppearance, signInHref, signInAvailable, invite, inviteError, toasts, onDismissToast }: LandingProps) {
  const signIn = <a className="primary-button big" href={signInHref} aria-disabled={!signInAvailable}><UserIcon/> Sign in with Google</a>;
  return <div className="landing">
    <header className="topbar landing-bar">
      <a className="brand" href="/" aria-label="Retro Play home"><span className="brand-mark" aria-hidden="true"><i/><i/></span><span>retro<span className="brand-play">play</span><span className="brand-dot">.</span></span></a>
      <div className="top-actions">
        <button type="button" className="icon-button" onClick={onAppearance} aria-label={appearance === 'dark' ? 'Switch to day mode' : 'Switch to night mode'} title={appearance === 'dark' ? 'Day mode' : 'Night mode'}>{appearance === 'dark' ? <SunIcon/> : <MoonIcon/>}</button>
        <a className="primary-button" href={signInHref} aria-disabled={!signInAvailable}><UserIcon/><span>Sign in</span></a>
      </div>
    </header>

    <main className="landing-main">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <span className="eyebrow"><i className="status-dot" aria-hidden="true"/>{invite ? 'A playlist was shared with you' : 'Your listening room'}</span>
          <h1 id="landing-title" className="landing-title">{invite ? <>Press play on <em>{invite.playlist.name}</em>.</> : <>Choose your machine.<br/>Press play.</>}</h1>
          <p className="landing-lede">{invite
            ? `${invite.sharedBy} shared this playlist with you on Retro Play. Sign in, connect your Spotify Premium account, and it will be waiting on your deck.`
            : 'Stream your Spotify playlists through a tape deck or a turntable. Real buttons, real ritual, right in your browser.'}</p>

          {invite && <div className="invite-card">
            {invite.playlist.image ? <img src={invite.playlist.image} alt=""/> : <span className="art-fallback"><MusicIcon/></span>}
            <span className="row-copy"><strong>{invite.playlist.name}</strong><small>{invite.playlist.owner}{invite.playlist.total ? ` · ${invite.playlist.total} tracks` : ''} · shared by {invite.sharedBy}</small></span>
          </div>}
          {inviteError && <p className="inline-error">{inviteError}</p>}

          <div className="landing-cta">
            {signIn}
            {!signInAvailable && <p className="hint">Sign-in is not configured on this server yet.</p>}
          </div>
          <ol className="landing-steps" aria-label="How it works">
            <li><span>1</span>Sign in with Google</li>
            <li><span>2</span>Connect Spotify Premium, once</li>
            <li><span>3</span>Choose a deck and press play</li>
          </ol>
        </div>

        <div className="landing-art" aria-hidden="true">
          <img className="landing-deck" src="/assets/retro-play-cassette-deck.png" alt=""/>
          <img className="landing-turntable" src="/assets/retro-play-turntable.png" alt=""/>
        </div>
      </section>

      <section className="landing-features" aria-label="What you get">
        {FEATURES.map(([Icon, title, body]) => <article key={title}><span className="feature-icon"><Icon/></span><h2>{title}</h2><p>{body}</p></article>)}
      </section>
    </main>

    <footer className="landing-foot">
      <span className="powered"><i aria-hidden="true"/>Powered by Spotify</span>
      <span>Playback needs a Spotify Premium account. Sign-in happens on Google and Spotify; your passwords never touch Retro Play.</span>
    </footer>
    <Toasts toasts={toasts} onDismiss={onDismissToast}/>
  </div>;
}

/** Shown for the moment the session check takes, so signed-in users don't see the landing page flash past. */
export function Splash() {
  return <div className="splash" role="status" aria-label="Loading Retro Play"><span className="brand-mark" aria-hidden="true"><i/><i/></span></div>;
}
