import { describe, expect, it } from 'vitest';
import { packRadii, reelSteps, topDownArm } from './motion';

describe('cassette transport physics', () => {
  it('moves tape from the supply reel to the take-up reel while conserving the wound area', () => {
    const start = packRadii(0); const end = packRadii(1);
    expect(start.left).toBeGreaterThan(start.right);
    expect(end.right).toBeGreaterThan(end.left);
    const area = (r: { left: number; right: number }) => r.left ** 2 + r.right ** 2;
    expect(area(packRadii(0.37))).toBeCloseTo(area(start), 6);
  });
  it('turns the emptier reel faster (ω = v / r) and both reels the same way', () => {
    const early = reelSteps(10_000, 11_000, 200_000);
    expect(early.left).toBeGreaterThan(0);
    expect(early.right).toBeGreaterThan(early.left);
    const late = reelSteps(190_000, 191_000, 200_000);
    expect(late.left).toBeGreaterThan(late.right);
    // At 47.6 mm/s a hub between 11 and 27 mm turns roughly 100–250°/s.
    expect(early.right).toBeGreaterThan(100); expect(early.right).toBeLessThan(260);
  });
  it('rewinds (negative rotation) when the position jumps backwards', () => {
    expect(reelSteps(60_000, 30_000, 200_000).left).toBeLessThan(0);
  });
});

describe('top-down tonearm geometry', () => {
  const pivot: [number, number] = [1080, 470]; const center: [number, number] = [650, 655];
  const arm = topDownArm(pivot, center, 430, 252, 104, 96);
  const stylus = (deg: number) => [pivot[0] + 430 * Math.cos(deg * Math.PI / 180), pivot[1] + 430 * Math.sin(deg * Math.PI / 180)];
  const radius = (deg: number) => { const [x, y] = stylus(deg); return Math.hypot(x - center[0], y - center[1]); };
  it('places the stylus on the lead-in groove at the start and near the label at the end', () => {
    expect(radius(arm(0))).toBeCloseTo(252, 3);
    expect(radius(arm(1))).toBeCloseTo(104, 3);
  });
  it('parks on the rest before the first play', () => {
    expect(arm(null)).toBe(96);
  });
});
