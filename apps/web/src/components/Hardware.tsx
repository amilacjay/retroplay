import { useEffect, useRef, useState } from 'react';
import { PhotoReel } from './machines/parts';
import { COVER_FRAME, IMAGES } from './machines/assets';

export type PlayerTheme = 'cassette' | 'vinyl';
export type CoverFit = 'cover' | 'fit-width' | 'fit-height' | 'stretch' | 'title';
export type CoverPosition = { x: number; y: number };

export type MachineControlProps = { playing: boolean; paused?: boolean; disabled: boolean; canPlay: boolean; canPause: boolean; canPrevious: boolean; canNext: boolean; canSeek: boolean; volume: number; onPlay: () => void; onPause: () => void; onPrevious: () => void; onNext: () => void; onRestart: () => void; onVolumeChange: (value: number) => void };

function HardwareButton({ className = '', label, onClick, disabled }: { className?: string; label: string; onClick: () => void; disabled: boolean }) {
  return <button className={`hardware-hitbox ${className}`} type="button" aria-label={`Deck: ${label}`} data-tip={label} onClick={onClick} disabled={disabled}/>;
}

/** [left, top, width, height] in % of the photo. Measured from the 1536×1024 source images. */
export type Box = [number, number, number, number];
/** Box from inclusive pixel bounds in a 1536×1024 photo. */
export const pxBox = (x0: number, y0: number, x1: number, y1: number): Box => [x0 / 15.36, y0 / 10.24, (x1 - x0 + 1) / 15.36, (y1 - y0 + 1) / 10.24];

/**
 * A physical control cut out of the photo itself. At rest the patch sits exactly over its own pixels (invisible);
 * pressed or latched, the patch moves: piano keys sink into their slot, push buttons depress.
 */
export function PhotoKey({ box, image, label, onClick, disabled, latched = false, kind = 'key' }: { box: Box; image: string; label: string; onClick: () => void; disabled: boolean; latched?: boolean; kind?: 'key' | 'push' | 'top' }) {
  const [pulse, setPulse] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const [l, t, w, h] = box;
  const face: React.CSSProperties = { backgroundImage: `url(${image})`, backgroundSize: `${10000 / w}% ${10000 / h}%`, backgroundPosition: `${l / (100 - w) * 100}% ${t / (100 - h) * 100}%` };
  const press = () => { setPulse(true); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setPulse(false), 170); onClick(); };
  return <button type="button" className={`photo-key kind-${kind} ${latched || pulse ? 'is-down' : ''}`} style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` }} aria-label={`Deck: ${label}`} aria-pressed={kind !== 'push' ? latched : undefined} data-tip={label} onClick={press} disabled={disabled}>
    <span className="photo-key-slot"><span className="photo-key-face" style={face}/></span>
  </button>;
}

const DECK_IMAGE = IMAGES.cassetteDeck;
const TAPE_KEYS: { box: Box; label: string; action: 'stop' | 'previous' | 'play' | 'next' | 'restart' | 'pause' }[] = [
  { box: [18.29, 64.84, 7.0, 8.79], label: 'Stop', action: 'stop' },
  { box: [25.65, 64.70, 6.48, 8.94], label: 'Rewind · previous track', action: 'previous' },
  { box: [32.45, 64.45, 6.61, 9.18], label: 'Play', action: 'play' },
  { box: [39.39, 64.31, 7.16, 9.33], label: 'Fast forward · next track', action: 'next' },
  { box: [47.04, 64.21, 7.81, 9.42], label: 'Record · restart track', action: 'restart' },
  { box: [55.08, 64.06, 6.93, 9.57], label: 'Pause', action: 'pause' },
];
function VolumeHotspot({ className = '', volume, disabled, onChange }: { className?: string; volume: number; disabled: boolean; onChange: (value: number) => void }) {
  return <input className={`hardware-volume ${className}`} type="range" min="0" max="1" step="0.01" value={volume} aria-label="Deck volume knob" title={`Volume ${Math.round(volume * 100)}%`} disabled={disabled} onChange={event => onChange(Number(event.target.value))}/>;
}

/** How far the art overflows its window horizontally when it fills the window's height (0 when it doesn't overflow). */
function horizontalOverflow(windowEl: HTMLElement, image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) return 0;
  const { width, height } = windowEl.getBoundingClientRect();
  return Math.max(0, height * image.naturalWidth / image.naturalHeight - width);
}

export function AlbumCoverPreview({ theme, artwork, title, fit, showTitle, position, onPositionChange, pan = 50, onPanChange }: { theme: PlayerTheme; artwork: string; title: string; fit: CoverFit; showTitle: boolean; position: CoverPosition; onPositionChange: (position: CoverPosition) => void; pan?: number; onPanChange?: (pan: number) => void }) {
  const frame = COVER_FRAME[theme];
  const drag = useRef<{ pointer: number; x: number; y: number; left: number; top: number } | null>(null);
  const panDrag = useRef<{ pointer: number; x: number; pan: number; overflow: number } | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const pannable = fit === 'fit-height' && Boolean(onPanChange);
  // In "fit height" the art fills the card's full height; dragging the art itself slides the crop sideways instead of moving the case.
  const startPan = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (!pannable || event.button !== 0 || !image.current) return;
    const overflow = horizontalOverflow(event.currentTarget, image.current);
    if (!overflow) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panDrag.current = { pointer: event.pointerId, x: event.clientX, pan, overflow };
  };
  const movePan = (event: React.PointerEvent<HTMLSpanElement>) => {
    const start = panDrag.current;
    if (!start || start.pointer !== event.pointerId) return;
    event.stopPropagation();
    onPanChange?.(Math.min(100, Math.max(0, start.pan - (event.clientX - start.x) / start.overflow * 100)));
  };
  const endPan = (event: React.PointerEvent<HTMLSpanElement>) => { if (panDrag.current?.pointer === event.pointerId) { event.stopPropagation(); panDrag.current = null; } };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return;
    onPositionChange({ x: Math.min(100, Math.max(-10, start.left + (event.clientX - start.x) / bounds.width * 100)), y: Math.min(100, Math.max(-45, start.top + (event.clientY - start.y) / bounds.height * 100)) });
  };
  const nudge = (event: React.KeyboardEvent) => {
    const amount = event.shiftKey ? 2 : 0.5;
    const moves: Record<string, CoverPosition> = { ArrowLeft: { ...position, x: position.x - amount }, ArrowRight: { ...position, x: position.x + amount }, ArrowUp: { ...position, y: position.y - amount }, ArrowDown: { ...position, y: position.y + amount } };
    if (!moves[event.key]) return;
    event.preventDefault(); event.stopPropagation(); onPositionChange(moves[event.key]);
  };
  return <div className={`album-cover-preview album-cover-${theme} art-fit-${fit}`} role="button" tabIndex={0} aria-label={`${theme === 'vinyl' ? 'Record sleeve' : 'Cassette case'} for ${title}. Drag or use arrow keys to move it.`} title="Drag to reposition · arrow keys for fine moves" style={{ left: `${position.x}%`, top: `${position.y}%` }}
    onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: position.x, top: position.y }; }}
    onPointerMove={move} onPointerUp={event => { if (drag.current?.pointer === event.pointerId) drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={nudge}>
    {fit === 'title' ? <span className="cover-title-art"><small>RETRO PLAY / ORIGINALS</small><strong>{title}</strong><i>STEREO / SIDE A</i></span> : <span className={`cover-art-window ${pannable ? 'is-pannable' : ''}`} title={pannable ? 'Drag the artwork sideways to choose the crop' : undefined} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan}><img ref={image} className="cover-artwork" src={artwork} alt="" draggable={false} style={fit === 'fit-height' ? { objectPosition: `${pan}% 50%` } : undefined}/>{theme === 'vinyl' && showTitle && <span className="vinyl-jacket-caption">{title}</span>}</span>}
    {theme === 'cassette' && showTitle && fit !== 'title' && <span className={`cassette-jcard-caption ${fit === 'fit-height' || fit === 'stretch' ? 'caption-over-art' : ''}`}><strong>{title}</strong><small>STEREO / SIDE A / SIDE B</small></span>}
    <img className="cover-frame" src={frame} alt="" draggable={false}/>
  </div>;
}

/** The photographed hi-fi cassette deck. Its reels are drawn over the photo so the tape packs and speeds can follow the tape. */
export function CassetteDeck({ machine: props }: { machine: MachineControlProps; title?: string }) {
  const { playing, disabled } = props;
  return <div className="hardware-product cassette-product" role="group" aria-label="Cassette deck controls">
    <img className="hardware-image" src={DECK_IMAGE} alt="" draggable={false}/>
    <div className="reel-motion reel-motion-left"><PhotoReel reel="--reel-l" packVar="--pack-l"/></div>
    <div className="reel-motion reel-motion-right"><PhotoReel reel="--reel-r" packVar="--pack-r"/></div>
    <div className={`vu-needle vu-left ${playing ? 'is-active' : ''}`} aria-hidden="true"/>
    <div className={`vu-needle vu-right ${playing ? 'is-active' : ''}`} aria-hidden="true"/>
    {TAPE_KEYS.map(key => {
      const actions = { stop: props.onPause, previous: props.onPrevious, play: props.onPlay, next: props.onNext, restart: props.onRestart, pause: props.onPause };
      const enabled = { stop: props.canPause, previous: props.canPrevious, play: props.canPlay, next: props.canNext, restart: props.canSeek, pause: props.canPause };
      // Like a real deck: Play stays latched while the tape runs, and Pause latches on top of Play while paused.
      const latched = key.action === 'play' ? playing || Boolean(props.paused) : key.action === 'pause' ? Boolean(props.paused) : false;
      return <PhotoKey key={key.action} box={key.box} image={DECK_IMAGE} label={key.label} onClick={actions[key.action]} disabled={!enabled[key.action]} latched={latched}/>;
    })}
    <VolumeHotspot className="tape-volume" volume={props.volume} disabled={disabled} onChange={props.onVolumeChange}/>
  </div>;
}

/** The photographed walnut turntable. The record turns with --platter, so it spins up and coasts down with inertia. */
export function VinylDeck({ machine: props }: { machine: MachineControlProps; title?: string }) {
  const { playing, disabled } = props;
  const toggleLabel = playing ? 'Pause' : 'Play';
  const toggle = playing ? props.onPause : props.onPlay;
  const toggleDisabled = playing ? !props.canPause : !props.canPlay;
  // Cut-outs must come from whichever photo is showing: the resting photo has the headshell parked over the cue lever.
  const plinth = playing ? IMAGES.turntablePlaying : IMAGES.turntableResting;
  return <div className={`hardware-product vinyl-product ${playing ? 'is-playing' : ''}`} role="group" aria-label="Turntable controls">
    <img className="hardware-image" src={IMAGES.turntableResting} alt="" draggable={false}/>
    <img className="hardware-image turntable-playing-art" src={IMAGES.turntablePlaying} alt="" aria-hidden="true" draggable={false}/>
    <svg className="turntable-tonearm" viewBox="0 0 1536 1024" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="tonearm-cutout" clipPathUnits="userSpaceOnUse"><path d="M1281 215 C1277 267 1269 323 1256 365 C1248 390 1228 408 1203 423 C1178 438 1150 450 1121 456 L1116 441 C1145 434 1173 422 1195 408 C1216 394 1233 377 1241 357 C1254 320 1260 264 1265 219 Z M1127 425 L1112 439 L1096 429 L1084 423 L1002 437 L969 447 L944 461 L950 480 L970 486 L975 501 L998 501 L1006 484 L1087 475 L1100 464 L1127 452 Z"/></clipPath></defs><image href={IMAGES.turntablePlaying} width="1536" height="1024" clipPath="url(#tonearm-cutout)"/></svg>
    <div className="record-plane" aria-hidden="true"><img className="record-disc" src={IMAGES.vinylRecord} alt="" draggable={false} style={{ transform: 'rotate(var(--platter, 0deg))' }}/></div>
    <PhotoKey kind="push" box={[10.68, 54.39, 6.25, 6.15]} image={plinth} label={`Start · ${toggleLabel}`} onClick={toggle} disabled={toggleDisabled} latched={playing}/>
    <PhotoKey kind="push" box={[8.27, 61.52, 2.15, 1.86]} image={plinth} label="Previous track" onClick={props.onPrevious} disabled={!props.canPrevious}/>
    <PhotoKey kind="push" box={[91.34, 61.43, 1.95, 1.95]} image={plinth} label="Next track" onClick={props.onNext} disabled={!props.canNext}/>
    <PhotoKey kind="push" box={[84.51, 49.51, 6.45, 10.35]} image={plinth} label={`Cue lever · ${toggleLabel}`} onClick={toggle} disabled={toggleDisabled}/>
    <HardwareButton className="vinyl-restart" label="Spindle · restart track" onClick={props.onRestart} disabled={!props.canSeek}/>
    <VolumeHotspot className="vinyl-volume" volume={props.volume} disabled={disabled} onChange={props.onVolumeChange}/>
  </div>;
}
