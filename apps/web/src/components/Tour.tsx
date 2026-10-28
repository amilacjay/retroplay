import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CoverFit, PlayerTheme } from './Hardware';
import { skinsFor } from './machines/skins';
import { CassetteIcon, CloseIcon, VinylIcon } from './Icons';

type Rect = { top: number; left: number; width: number; height: number };
type TourStep = {
  id: string; title: string; body: React.ReactNode; art?: React.ReactNode;
  /** Selectors tried in order; the first one that is on screen gets the spotlight. None: a centered card. */
  targets?: string[];
  /** Skipped (rather than shown centered) when none of its targets are on screen. */
  optional?: boolean;
};

const PAD = 6;
const GAP = 14;
const CARD_WIDTH = 340;

function findTarget(step: TourStep) {
  for (const selector of step.targets ?? []) {
    const element = document.querySelector(selector);
    const rect = element?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) return element as HTMLElement;
  }
  return null;
}
const sameRect = (a: Rect | null, b: Rect | null) => a === b || Boolean(a && b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

const FITS: [CoverFit, string][] = [['cover', 'Fill'], ['fit-width', 'Fit width'], ['fit-height', 'Fit height'], ['stretch', 'Stretch'], ['title', 'Title']];

/** Little J-cards (or sleeves) showing what each fit option does, painted with the current album art when there is some. */
function FitStrip({ theme, artwork }: { theme: PlayerTheme; artwork: string | null }) {
  return <div className={`tour-fits tour-fits-${theme}`} aria-hidden="true">
    {FITS.map(([fit, label]) => <figure key={fit} className={`tour-fit tour-fit-${fit}`}>
      <span className="tour-fit-card">
        {fit === 'title' ? <span className="tour-fit-title"><i/><i/><i/></span>
          : <span className="tour-fit-window">{artwork ? <img src={artwork} alt="" draggable={false}/> : <span className="tour-fit-placeholder"/>}{fit === 'fit-height' && <b className="tour-fit-pan">↔</b>}</span>}
      </span>
      <figcaption>{label}</figcaption>
    </figure>)}
  </div>;
}

function buildSteps(theme: PlayerTheme, artwork: string | null): TourStep[] {
  const sleeve = theme === 'vinyl' ? 'record sleeve' : 'cassette J-card';
  const models = skinsFor(theme).map(skin => skin.name);
  return [
    { id: 'welcome', title: 'Welcome to the listening room', art: <span className="tour-hero" aria-hidden="true"><CassetteIcon/><VinylIcon/></span>,
      body: <>Here's a quick look around: how to pick your machine, swap its model, and dress the case with album art. It takes under a minute.</> },
    { id: 'machine', targets: ['.stage-toolbar .segmented'], title: 'Tape or vinyl',
      body: <>Switch between the cassette deck and the turntable here. Give it a try, or press <kbd>T</kbd> any time.</> },
    { id: 'model', targets: ['.model-button'], title: 'Pick a model',
      body: <>Each machine comes in three models. {theme === 'vinyl' ? 'Turntables' : 'Cassette players'}: {models.join(', ')}. Same controls, different hardware. Press <kbd>K</kbd> to cycle through them.</> },
    { id: 'hardware', targets: ['.machine-frame'], title: 'The buttons are real',
      body: <>Press the keys on the hardware itself to play, pause, and skip, and drag its volume knob. The reels and platter follow the track as it plays.</> },
    { id: 'sleeve', targets: ['.sleeve-menu', '.model-button'], title: 'Fit the album art', art: <FitStrip theme={theme} artwork={artwork}/>,
      body: <>{artwork ? 'Open Sleeve' : 'Once a playlist is on the deck, a Sleeve button appears here. Open it'} to choose how the art fits the {sleeve}. <b>Fit height</b> fills the whole card; drag the art sideways to pick the crop. You can also print the title or reset the position.</> },
    { id: 'case', targets: ['.album-cover-preview'], optional: true, title: theme === 'vinyl' ? 'Move the sleeve' : 'Move the case',
      body: <>Drag it anywhere on the stage, or focus it and use the arrow keys for fine moves. Each model remembers its own spot.</> },
    { id: 'library', targets: ['.library', '.mobile-nav'], title: 'Find something to play',
      body: <>Search Spotify, paste a playlist link, or open one of your own playlists. Press <kbd>/</kbd> to jump to search.</> },
    { id: 'dock', targets: ['.player-dock'], title: 'Everything else lives down here',
      body: <>Transport, volume, and a sleep timer. Press <kbd>?</kbd> for every keyboard shortcut.</> },
    { id: 'done', title: "You're all set", body: <>Load a playlist and press Play. You can run this tour again from the <b>?</b> button in the top bar.</> },
  ];
}

/**
 * A first-visit guided tour: a spotlight on each feature with a callout card. It doesn't block the page, so people can
 * try the highlighted control as they go; targets that aren't on screen (the library on a phone) fall back or are skipped.
 */
export function Tour({ open, theme, artwork, onClose }: { open: boolean; theme: PlayerTheme; artwork: string | null; onClose: () => void }) {
  const steps = buildSteps(theme, artwork);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardHeight, setCardHeight] = useState(220);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const available = steps.filter(step => !step.optional || !open || findTarget(step));
  const step = available[Math.min(index, available.length - 1)];

  useEffect(() => { if (open) setIndex(0); }, [open]);
  useEffect(() => { if (open) primary.current?.focus({ preventScroll: true }); }, [open, step?.id]);

  // Follow the target every frame: layout shifts as machines switch, menus open, and the window resizes.
  useEffect(() => {
    if (!open || !step) return;
    let frame = 0;
    const element = findTarget(step);
    element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const measure = () => {
      const target = findTarget(step);
      // A menu opened from the highlighted control joins the spotlight instead of sitting in the shade.
      const boxes = target ? [target, ...target.querySelectorAll('.popover-panel')].map(element => element.getBoundingClientRect()) : [];
      const edge = (pick: (box: DOMRect) => number, combine: (...values: number[]) => number) => combine(...boxes.map(pick));
      const top = edge(box => box.top, Math.min) - PAD, left = edge(box => box.left, Math.min) - PAD;
      const next = boxes.length ? { top, left, width: edge(box => box.right, Math.max) + PAD - left, height: edge(box => box.bottom, Math.max) + PAD - top } : null;
      setRect(current => sameRect(current, next) ? current : next);
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(frame);
  }, [open, step?.id]);

  useLayoutEffect(() => { if (card.current) setCardHeight(card.current.offsetHeight); });

  const close = useCallback(() => { setRect(null); onClose(); }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || !step) return null;
  const position = Math.min(index, available.length - 1);
  const last = position === available.length - 1;
  const width = Math.min(CARD_WIDTH, window.innerWidth - 32);
  let style: React.CSSProperties;
  if (rect) {
    // Prefer below the target, then above; a target too tall for either (the stage) gets the card inside its bottom edge.
    const below = rect.top + rect.height + GAP;
    const above = rect.top - GAP - cardHeight;
    const top = below + cardHeight <= window.innerHeight - 16 ? below : above >= 16 ? above : Math.max(16, Math.min(rect.top + rect.height - cardHeight - GAP, window.innerHeight - cardHeight - 16));
    const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 16));
    style = { top, left, width };
  } else style = { top: '50%', left: '50%', width, transform: 'translate(-50%, -50%)' };

  return <div className="tour" data-step={step.id}>
    <div className={`tour-spotlight ${rect ? '' : 'is-blank'}`} aria-hidden="true" style={rect ?? undefined}/>
    <div ref={card} className="tour-card" role="dialog" aria-modal="false" aria-labelledby="tour-title" aria-describedby="tour-body" style={style}>
      <button type="button" className="icon-button subtle tour-close" aria-label="Close the tour" onClick={close}><CloseIcon/></button>
      {step.art}
      <span className="eyebrow tour-count">{position + 1} of {available.length}</span>
      <h2 id="tour-title">{step.title}</h2>
      <p id="tour-body">{step.body}</p>
      <div className="tour-actions">
        <span className="tour-dots" aria-hidden="true">{available.map((item, i) => <i key={item.id} className={i === position ? 'is-current' : ''}/>)}</span>
        {position > 0 ? <button type="button" className="ghost-button" onClick={() => setIndex(position - 1)}>Back</button>
          : <button type="button" className="ghost-button" onClick={close}>Skip</button>}
        <button ref={primary} type="button" className="primary-button" onClick={() => last ? close() : setIndex(position + 1)}>{last ? 'Start listening' : position === 0 ? 'Show me' : 'Next'}</button>
      </div>
    </div>
  </div>;
}
