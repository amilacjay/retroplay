import { PhotoKey, pxBox, type Box } from '../Hardware';
import type { SkinProps } from './skins';
import { topDownArm } from './motion';
import { IMAGES } from './assets';

/*
 * Photo-real models built from generated product photos (public/assets/models). All coordinates are pixels in the
 * 1536×1024 source images, measured from the photos. Derived layers (keys cleared, knob removed, tonearm lifted out)
 * are produced from the originals; see docs/model-photos.md.
 */
const IMG_W = 1536; const IMG_H = 1024;
const pct = (v: number, of: number) => `${v / of * 100}%`;
const FULL_PACK = 0.407; // hub radius / full pack radius in the motion engine (11 mm / 27 mm)

type ReelSpec = {
  image: string; hub: [number, number]; hubR: number; packMin: number; packMax: number; R: number;
  reel: '--reel-l' | '--reel-r'; pack: '--pack-l' | '--pack-r';
  /** Where to sample the empty cassette interior from (another spot in the photo), or a CSS background. */
  interior: { from: [number, number] } | { fill: string };
  packTone: [string, string, string]; lines?: number[];
};

/** One cassette reel over a photo: interior, a tape pack sized by the engine, the photo's own hub turning on top. */
function PhotoReelOverlay({ spec }: { spec: ReelSpec }) {
  const { hub: [cx, cy], R, hubR } = spec;
  const crop = (x: number, y: number, r: number): React.CSSProperties => ({
    backgroundImage: `url(${spec.image})`, backgroundSize: `${IMG_W / (2 * r) * 100}% auto`,
    backgroundPosition: `${(x - r) / (IMG_W - 2 * r) * 100}% ${(y - r) / (IMG_H - 2 * r) * 100}%`,
  });
  const scale = `calc((${spec.packMin} + ${(spec.packMax - spec.packMin) / (1 - FULL_PACK)} * (var(${spec.pack}, .7) - ${FULL_PACK})) / ${R})`;
  const [dark, mid, edge] = spec.packTone;
  return <div className="photo-reel-overlay" aria-hidden="true" style={{ left: pct(cx - R, IMG_W), top: pct(cy - R, IMG_H), width: pct(2 * R, IMG_W) }}>
    <div className="reel-layer" style={'from' in spec.interior ? crop(spec.interior.from[0], spec.interior.from[1], R) : { background: spec.interior.fill }}/>
    <div className="reel-layer reel-pack" style={{ transform: `scale(${scale})`, background: `radial-gradient(circle, transparent 0 84%, ${edge}b0 95%, ${dark} 100%), radial-gradient(circle at 38% 34%, #ffffff1c, transparent 55%), repeating-radial-gradient(circle, ${dark} 0 1.1px, ${mid} 1.6px 2.6px)` }}/>
    {spec.lines?.map(y => <div key={y} className="reel-shell-line" style={{ top: pct(y - (cy - R), 2 * R) }}/>)}
    <div className="reel-hub" style={{ ...crop(cx, cy, hubR), left: pct(R - hubR, 2 * R), top: pct(R - hubR, 2 * R), width: pct(2 * hubR, 2 * R), transform: `rotate(var(${spec.reel}, 0deg))` }}/>
  </div>;
}

/* ---------- Pocket Stereo ---------- */
const POCKET = IMAGES.pocket;
const POCKET_BASE = IMAGES.pocketBase;
const POCKET_KEYS: { box: Box; label: string; action: 'stop' | 'previous' | 'play' | 'next' }[] = [
  { box: pxBox(226, 84, 341, 170), label: 'Stop', action: 'stop' },
  { box: pxBox(357, 82, 467, 170), label: 'Rewind · previous track', action: 'previous' },
  { box: pxBox(487, 80, 623, 170), label: 'Play', action: 'play' },
  { box: pxBox(645, 82, 763, 170), label: 'Fast forward · next track', action: 'next' },
];
const POCKET_TAPE = { tones: ['#3b2014', '#57301d', '#7a4a2e'] as [string, string, string], lines: [393, 531] };

export function PocketPhoto({ machine: m }: SkinProps) {
  const actions = { stop: m.onPause, previous: m.onPrevious, play: m.onPlay, next: m.onNext };
  const enabled = { stop: m.canPause, previous: m.canPrevious, play: m.canPlay, next: m.canNext };
  // The right reel in the photo is almost empty, so its surroundings stand in for the empty interior behind both packs.
  const reel = (hub: [number, number], hubR: number, reelVar: ReelSpec['reel'], packVar: ReelSpec['pack']): ReelSpec => ({ image: POCKET, hub, hubR, packMin: 97, packMax: 160, R: 165, reel: reelVar, pack: packVar, interior: { from: [728, 468] }, packTone: POCKET_TAPE.tones, lines: POCKET_TAPE.lines });
  return <div className="hardware-product photo-model pocket-photo" role="group" aria-label="Pocket stereo controls">
    <img className="hardware-image" src={POCKET_BASE} alt="" draggable={false}/>
    <PhotoReelOverlay spec={reel([409, 468], 80, '--reel-l', '--pack-l')}/>
    <PhotoReelOverlay spec={reel([728, 468], 80, '--reel-r', '--pack-r')}/>
    {POCKET_KEYS.map(key => <PhotoKey key={key.action} kind="top" box={key.box} image={POCKET} label={key.label} onClick={actions[key.action]} disabled={!enabled[key.action]} latched={key.action === 'play' && m.playing}/>)}
    <input className="hardware-volume is-vertical" style={{ left: pct(1012, IMG_W), top: pct(272, IMG_H), width: pct(72, IMG_W), height: pct(168, IMG_H) }} type="range" min="0" max="1" step="0.01" value={m.volume} aria-label="Volume wheel" title={`Volume ${Math.round(m.volume * 100)}%`} disabled={m.disabled} onChange={event => m.onVolumeChange(Number(event.target.value))}/>
  </div>;
}

/* ---------- Boombox ---------- */
const BOOM = IMAGES.boombox;
const BOOM_BASE = IMAGES.boomboxBase;
const BOOM_KEYS: { box: Box; label: string; action: 'restart' | 'play' | 'previous' | 'next' | 'stop' | 'pause' }[] = [
  { box: pxBox(479, 265, 575, 318), label: 'Record · restart track', action: 'restart' },
  { box: pxBox(579, 265, 669, 318), label: 'Play', action: 'play' },
  { box: pxBox(672, 265, 764, 318), label: 'Rewind · previous track', action: 'previous' },
  { box: pxBox(767, 265, 859, 318), label: 'Fast forward · next track', action: 'next' },
  { box: pxBox(861, 265, 952, 318), label: 'Stop / eject', action: 'stop' },
  { box: pxBox(955, 265, 1052, 318), label: 'Pause', action: 'pause' },
];
const SLIDER = { min: 597, max: 931, knob: [776, 836, 858, 889] as const };

export function BoomboxPhoto({ machine: m }: SkinProps) {
  const actions = { restart: m.onRestart, play: m.onPlay, previous: m.onPrevious, next: m.onNext, stop: m.onPause, pause: m.onPause };
  const enabled = { restart: m.canSeek, play: m.canPlay, previous: m.canPrevious, next: m.canNext, stop: m.canPause, pause: m.canPause };
  const [kx0, ky0, kx1, ky1] = SLIDER.knob;
  const knobW = kx1 - kx0 + 1; const knobH = ky1 - ky0 + 1;
  const knobLeft = SLIDER.min + (SLIDER.max - SLIDER.min) * m.volume - knobW / 2;
  const reel = (hub: [number, number], reelVar: ReelSpec['reel'], packVar: ReelSpec['pack']): ReelSpec => ({ image: BOOM, hub, hubR: 52, packMin: 56, packMax: 94, R: 97, reel: reelVar, pack: packVar, interior: { fill: 'radial-gradient(circle, #2e2622 0 60%, #241d1a 100%)' }, packTone: ['#1d130e', '#2f1f16', '#4a3122'] });
  return <div className="hardware-product photo-model boombox-photo" role="group" aria-label="Boombox controls">
    <img className="hardware-image" src={BOOM_BASE} alt="" draggable={false}/>
    <PhotoReelOverlay spec={reel([665, 634], '--reel-l', '--pack-l')}/>
    <PhotoReelOverlay spec={reel([860, 634], '--reel-r', '--pack-r')}/>
    {BOOM_KEYS.map(key => {
      const latched = key.action === 'play' ? m.playing || Boolean(m.paused) : key.action === 'pause' ? Boolean(m.paused) : false;
      return <PhotoKey key={key.action} box={key.box} image={BOOM_BASE} label={key.label} onClick={actions[key.action]} disabled={!enabled[key.action]} latched={latched}/>;
    })}
    <span className="photo-slider-knob" aria-hidden="true" style={{
      left: pct(knobLeft, IMG_W), top: pct(ky0, IMG_H), width: pct(knobW, IMG_W), height: pct(knobH, IMG_H),
      backgroundImage: `url(${BOOM})`, backgroundSize: `${IMG_W / knobW * 100}% ${IMG_H / knobH * 100}%`,
      backgroundPosition: `${kx0 / (IMG_W - knobW) * 100}% ${ky0 / (IMG_H - knobH) * 100}%`,
    }}/>
    <input className="hardware-volume" style={{ left: pct(556, IMG_W), top: pct(822, IMG_H), width: pct(417, IMG_W), height: pct(82, IMG_H) }} type="range" min="0" max="1" step="0.01" value={m.volume} aria-label="Volume slider" title={`Volume ${Math.round(m.volume * 100)}%`} disabled={m.disabled} onChange={event => m.onVolumeChange(Number(event.target.value))}/>
  </div>;
}

/* ---------- Suitcase Player ---------- */
const SUIT_BASE = IMAGES.suitcaseBase;
const SUIT = IMAGES.suitcaseRest;
const SUIT_ARM = IMAGES.suitcaseArm;
// Platter top ellipse fitted to the photo: centre (659, 510), semi-axes 349 × 133 → plane tilt cos⁻¹(0.381) ≈ 67.6°.
const PLATTER = { cx: 659, cy: 510, k: 0.381, record: 340 };
const ARM_PIVOT: [number, number] = [1232, 482];
const ARM_REST_TIP: [number, number] = [982, 684];
/** Work in the deck's own plane (stretch y by 1/k), where the platter is a circle and the arm swings in a circle. */
const toDeck = ([x, y]: [number, number]): [number, number] => [x - PLATTER.cx, (y - PLATTER.cy) / PLATTER.k];
const pivotDeck = toDeck(ARM_PIVOT); const tipDeck = toDeck(ARM_REST_TIP);
const ARM_LENGTH = Math.hypot(tipDeck[0] - pivotDeck[0], tipDeck[1] - pivotDeck[1]);
const ARM_REST = Math.atan2(tipDeck[1] - pivotDeck[1], tipDeck[0] - pivotDeck[0]) * 180 / Math.PI;
const groove = topDownArm(pivotDeck, [0, 0], ARM_LENGTH, PLATTER.record - 10, 125, ARM_REST);
/** Where the tube meets the headshell in the photo (on the tube's centre line). */
const ARM_JOINT: [number, number] = [1068, 593.4];
const JOINT_ANGLE = Math.atan2(ARM_JOINT[1] - ARM_PIVOT[1], ARM_JOINT[0] - ARM_PIVOT[0]) * 180 / Math.PI;
const JOINT_LENGTH = Math.hypot(ARM_JOINT[0] - ARM_PIVOT[0], ARM_JOINT[1] - ARM_PIVOT[1]);
/**
 * The arm swings θ in the deck plane. On screen that moves the tube–headshell joint along an ellipse; the round tube
 * turns rigidly and only stretches along its length (a cylinder looks equally thick from any side), and the headshell
 * travels rigidly with the joint.
 */
export function suitcaseArmVars(progress: number | null): Record<string, string> {
  const theta = (groove(progress) - ARM_REST) * Math.PI / 180;
  const [jx, jy] = toDeck(ARM_JOINT); const [px, py] = pivotDeck;
  const dx = jx - px, dy = jy - py;
  const rx = dx * Math.cos(theta) - dy * Math.sin(theta), ry = dx * Math.sin(theta) + dy * Math.cos(theta);
  const sx = ARM_PIVOT[0] + rx, sy = ARM_PIVOT[1] + ry * PLATTER.k;
  const turn = Math.atan2(sy - ARM_PIVOT[1], sx - ARM_PIVOT[0]) * 180 / Math.PI - JOINT_ANGLE;
  return {
    '--tube-turn': `${turn.toFixed(3)}deg`,
    '--tube-stretch': (Math.hypot(sx - ARM_PIVOT[0], sy - ARM_PIVOT[1]) / JOINT_LENGTH).toFixed(4),
    '--head-x': `${((sx - ARM_JOINT[0]) / IMG_W * 100).toFixed(3)}%`,
    '--head-y': `${((sy - ARM_JOINT[1]) / IMG_H * 100).toFixed(3)}%`,
  };
}
const poly = (points: [number, number][]) => `polygon(${points.map(([x, y]) => `${(x / IMG_W * 100).toFixed(3)}% ${(y / IMG_H * 100).toFixed(3)}%`).join(', ')})`;
const TUBE_THICKNESS = 15;
const HEAD_CLIP = poly([[944, 628], [1058, 574], [1068, 577], [1068, 652], [1004, 698], [962, 698], [942, 664]]);

export function SuitcasePhoto({ machine: m }: SkinProps) {
  const toggle = m.playing ? m.onPause : m.onPlay;
  const toggleOk = m.playing ? m.canPause : m.canPlay;
  const recordWidth = PLATTER.record * 2 / 0.98; // the disc fills 98% of its PNG
  return <div className={`hardware-product photo-model suitcase-photo ${m.playing ? 'is-playing' : ''}`} role="group" aria-label="Suitcase record player controls">
    <img className="hardware-image" src={SUIT_BASE} alt="" draggable={false}/>
    <div className="photo-record-plane" aria-hidden="true" style={{ left: pct(PLATTER.cx, IMG_W), top: pct(PLATTER.cy, IMG_H), width: pct(recordWidth, IMG_W), transform: `translate(-50%, -50%) rotateX(${Math.acos(PLATTER.k) * 180 / Math.PI}deg)` }}>
      <img className="record-disc" src={IMAGES.vinylRecord} alt="" draggable={false} style={{ transform: 'rotate(var(--platter, 0deg))' }}/>
    </div>
    <span className="photo-spindle" aria-hidden="true" style={{ left: pct(646, IMG_W), top: pct(458, IMG_H), width: pct(27, IMG_W), height: pct(46, IMG_H), backgroundImage: `url(${SUIT})`, backgroundSize: `${IMG_W / 27 * 100}% ${IMG_H / 46 * 100}%`, backgroundPosition: `${646 / (IMG_W - 27) * 100}% ${458 / (IMG_H - 46) * 100}%` }}/>
    {/* Tube: turn about the pivot and stretch along its own axis. Headshell: follow the joint rigidly. The cue lifts both. */}
    <div className="photo-arm-lift" aria-hidden="true">
      {/* Drawn chrome tube (rotating photo pixels of a thin highlight aliases into a zig-zag); matches the photo's shading. */}
      <span className="photo-tube" style={{ left: pct(ARM_PIVOT[0], IMG_W), top: pct(ARM_PIVOT[1] - TUBE_THICKNESS / 2, IMG_H), height: pct(TUBE_THICKNESS, IMG_H), width: `calc(${JOINT_LENGTH / IMG_W * 100}% * var(--tube-stretch, 1))`, transform: `rotate(calc(var(--tube-turn, 0deg) + ${JOINT_ANGLE}deg))` }}/>
      <img className="photo-arm" src={SUIT_ARM} alt="" draggable={false} style={{ clipPath: HEAD_CLIP, transformOrigin: `${pct(ARM_JOINT[0], IMG_W)} ${pct(ARM_JOINT[1], IMG_H)}`, transform: 'translate(var(--head-x, 0%), var(--head-y, 0%)) rotate(var(--tube-turn, 0deg))' }}/>
    </div>
    <PhotoKey kind="push" box={pxBox(1262, 574, 1292, 640)} image={SUIT_BASE} label={`Cue lever · ${m.playing ? 'Pause' : 'Play'}`} onClick={toggle} disabled={!toggleOk}/>
    <PhotoKey kind="push" box={pxBox(1186, 698, 1242, 752)} image={SUIT_BASE} label="Skip · next track" onClick={m.onNext} disabled={!m.canNext}/>
    <button type="button" className="hardware-hitbox is-round" style={{ left: pct(630, IMG_W), top: pct(455, IMG_H), width: pct(58, IMG_W), height: pct(60, IMG_H) }} aria-label="Deck: Spindle · restart track" data-tip="Spindle · restart track" onClick={m.onRestart} disabled={!m.canSeek}/>
    <button type="button" className="hardware-hitbox" style={{ left: pct(940, IMG_W), top: pct(560, IMG_H), width: pct(160, IMG_W), height: pct(120, IMG_H) }} aria-label={`Deck: Tonearm · ${m.playing ? 'Pause' : 'Play'}`} data-tip={`Tonearm · ${m.playing ? 'Pause' : 'Play'}`} onClick={toggle} disabled={!toggleOk}/>
    <input className="hardware-volume" style={{ left: pct(1060, IMG_W), top: pct(650, IMG_H), width: pct(105, IMG_W), height: pct(92, IMG_H) }} type="range" min="0" max="1" step="0.01" value={m.volume} aria-label="Volume knob" title={`Volume ${Math.round(m.volume * 100)}%`} disabled={m.disabled} onChange={event => m.onVolumeChange(Number(event.target.value))}/>
  </div>;
}
