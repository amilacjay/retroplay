import { useEffect, useRef } from 'react';

/*
 * Physical motion for the decks, driven by playback *position* (the same data as the progress bar) — never by the audio
 * signal, so nothing here is beat- or audio-synchronised.
 *
 * Cassette: tape moves past the head at a constant 47.6 mm/s, so each reel turns at ω = v / r. The supply (left) pack
 * shrinks while the take-up (right) pack grows; both reels turn clockwise. Seeks and track changes "fast-wind" the tape,
 * so the reels whizz forward or backward until the displayed position catches up.
 * Vinyl: the platter has inertia (spin-up / coast-down) at 33⅓ rpm and the tonearm tracks inward with progress.
 *
 * Writes CSS custom properties on the root element every animation frame:
 *   --reel-l, --reel-r  (deg)   --pack-l, --pack-r (0–1, pack radius as a fraction of the full pack)
 *   --platter (deg)             --arm (deg, from the skin's armAngle mapping)    --cue (0 lowered … 1 lifted)
 */

export type MotionInput = { playing: boolean; position: number; duration: number; trackKey?: string };
export type MotionOptions = { armAngle?: (progress: number | null) => number; armVars?: (progress: number | null) => Record<string, string> };

const TAPE_SPEED = 47.6;          // mm/s, compact cassette
const HUB_RADIUS = 11;            // mm
const FULL_RADIUS = 27;           // mm, a well-filled C60 side
const RPM = 100 / 3;              // 33⅓
const PLATTER_DEG_PER_S = RPM * 6;
const MAX_CATCH_UP_S = 1.1;       // fast-wind never takes longer than this
const FAST_WIND = 24;             // ×realtime, minimum fast-wind speed

/** Map track progress onto most of one tape side, so the pack visibly moves from reel to reel. */
const tapeShare = (progress: number) => 0.06 + 0.88 * Math.min(1, Math.max(0, progress));
export function packRadii(progress: number) {
  const q = tapeShare(progress);
  const span = FULL_RADIUS ** 2 - HUB_RADIUS ** 2;
  return { left: Math.sqrt(HUB_RADIUS ** 2 + (1 - q) * span), right: Math.sqrt(HUB_RADIUS ** 2 + q * span) };
}
/** Reel angular step (deg) for a change in played milliseconds, with the tape length scaled so one track ≈ one side. */
export function reelSteps(fromMs: number, toMs: number, durationMs: number) {
  const mid = packRadii(((fromMs + toMs) / 2) / Math.max(1, durationMs));
  const tape = (toMs - fromMs) / 1000 * TAPE_SPEED;
  const toDeg = 180 / Math.PI;
  return { left: tape / mid.left * toDeg, right: tape / mid.right * toDeg };
}
const packFraction = (radius: number) => radius / FULL_RADIUS;

export function useMachineMotion(root: React.RefObject<HTMLElement | null>, input: MotionInput, options: MotionOptions = {}) {
  const live = useRef(input);
  live.current = input;
  const opts = useRef(options);
  opts.current = options;
  const sync = useRef({ position: input.position, at: performance.now() });
  useEffect(() => { sync.current = { position: input.position, at: performance.now() }; }, [input.position, input.playing, input.trackKey]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const state = { shown: live.current.position, reelL: 0, reelR: 0, platter: 0, omega: 0, arm: live.current.position > 0 || live.current.playing ? live.current.position / Math.max(1, live.current.duration) : -1, cue: 0, started: live.current.position > 0 || live.current.playing };
    let frame = 0; let last = performance.now();
    const write = () => {
      const duration = Math.max(1, live.current.duration);
      const radii = packRadii(state.shown / duration);
      el.style.setProperty('--reel-l', `${state.reelL.toFixed(2)}deg`);
      el.style.setProperty('--reel-r', `${state.reelR.toFixed(2)}deg`);
      el.style.setProperty('--pack-l', packFraction(radii.left).toFixed(4));
      el.style.setProperty('--pack-r', packFraction(radii.right).toFixed(4));
      el.style.setProperty('--platter', `${state.platter.toFixed(2)}deg`);
      el.style.setProperty('--arm', `${(opts.current.armAngle?.(state.arm < 0 ? null : state.arm) ?? 0).toFixed(3)}deg`);
      el.style.setProperty('--cue', state.cue.toFixed(3));
      const extra = opts.current.armVars?.(state.arm < 0 ? null : state.arm);
      if (extra) for (const name in extra) el.style.setProperty(name, extra[name]);
    };
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const { playing, duration } = live.current;
      const target = Math.min(duration || Infinity, sync.current.position + (playing ? now - sync.current.at : 0));
      // Tape transport: follow the real position at play speed, or fast-wind toward it after a jump.
      const gap = target - state.shown;
      let next = target;
      if (Math.abs(gap) > (playing ? 900 : 60)) next = state.shown + Math.sign(gap) * Math.min(Math.abs(gap), Math.max(FAST_WIND * 1000 * dt, Math.abs(gap) / MAX_CATCH_UP_S * dt * 3));
      if (!reduced) { const turn = reelSteps(state.shown, next, duration || 1); state.reelL += turn.left; state.reelR += turn.right; }
      state.shown = next;
      // Platter inertia: quick spin-up, slower coast-down.
      const tau = playing ? 0.45 : 0.95;
      state.omega += ((playing ? PLATTER_DEG_PER_S : 0) - state.omega) * (1 - Math.exp(-dt / tau));
      if (Math.abs(state.omega) < 0.5 && !playing) state.omega = 0;
      if (!reduced) state.platter = (state.platter + state.omega * dt) % 360;
      // Tonearm: rests until the first play, then swings to the groove matching progress; cue lifts while paused.
      if (playing || target > 0) state.started = true;
      const armTarget = state.started ? Math.min(1, Math.max(0, target / Math.max(1, duration))) : -1;
      if (state.arm < 0 && armTarget >= 0) state.arm = 0;
      state.arm = armTarget < 0 ? (state.arm > 0.001 ? state.arm * (1 - Math.min(1, dt * 3)) : -1) : state.arm + (armTarget - state.arm) * (1 - Math.exp(-dt / 0.5));
      // The cue only lifts an arm that is out over the record; parked on its rest, the arm stays down.
      const cueTarget = playing || state.arm < 0 ? 0 : 1;
      state.cue += (cueTarget - state.cue) * (1 - Math.exp(-dt / 0.25));
      write();
      const settled = !playing && state.omega === 0 && Math.abs(target - state.shown) < 1 && Math.abs(state.cue - cueTarget) < 0.01 && (armTarget < 0 ? state.arm < 0 : Math.abs(armTarget - state.arm) < 0.001);
      frame = settled ? 0 : requestAnimationFrame(step);
    };
    const kick = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(step); } };
    write(); kick();
    const id = window.setInterval(kick, 250);
    return () => { cancelAnimationFrame(frame); window.clearInterval(id); };
  }, [root]);
}

/** Tonearm angle for a top-down turntable: pivot→stylus direction (deg) for a given groove, via the law of cosines. */
export function topDownArm(pivot: [number, number], center: [number, number], armLength: number, outer: number, inner: number, rest: number, side: 1 | -1 = -1) {
  const dx = center[0] - pivot[0]; const dy = center[1] - pivot[1];
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx) * 180 / Math.PI;
  return (progress: number | null) => {
    if (progress === null) return rest;
    const rho = outer + (inner - outer) * progress;
    const cos = Math.min(1, Math.max(-1, (d * d + armLength * armLength - rho * rho) / (2 * d * armLength)));
    return base + side * Math.acos(cos) * 180 / Math.PI;
  };
}
