import { useRef } from 'react';
import type { CoverPosition, MachineControlProps, PlayerTheme } from '../Hardware';
import { CassetteDeck, VinylDeck } from '../Hardware';
import { useMachineMotion, type MotionInput } from './motion';
import { BoomboxPhoto, PocketPhoto, SuitcasePhoto, suitcaseArmVars } from './photo';
import { DjDeck, djArm } from './DjDeck';

export type SkinProps = { machine: MachineControlProps; title: string };
export type SkinId = 'hifi-deck' | 'pocket' | 'boombox' | 'hifi-turntable' | 'suitcase' | 'dj';
export type Skin = { id: SkinId; machine: PlayerTheme; name: string; blurb: string; cover: CoverPosition; Component: (props: SkinProps) => React.ReactElement; armAngle?: (progress: number | null) => number; armVars?: (progress: number | null) => Record<string, string> };

export const SKINS: Skin[] = [
  { id: 'hifi-deck', machine: 'cassette', name: 'Hi-Fi Deck', blurb: 'Champagne tape deck with VU meters', cover: { x: 1.5, y: -13 }, Component: CassetteDeck },
  { id: 'pocket', machine: 'cassette', name: 'Pocket Stereo', blurb: 'Brushed-metal personal stereo & foam headphones', cover: { x: -1, y: 44 }, Component: PocketPhoto },
  { id: 'boombox', machine: 'cassette', name: 'Boombox', blurb: 'Stereo radio-cassette with chrome handle', cover: { x: 1, y: -6 }, Component: BoomboxPhoto },
  { id: 'hifi-turntable', machine: 'vinyl', name: 'Walnut Turntable', blurb: 'Belt-drive deck in a walnut plinth', cover: { x: 1, y: -13 }, Component: VinylDeck },
  { id: 'suitcase', machine: 'vinyl', name: 'Suitcase Player', blurb: '1960s portable with a speaker in the lid', cover: { x: 0, y: 4 }, Component: SuitcasePhoto, armVars: suitcaseArmVars },
  { id: 'dj', machine: 'vinyl', name: 'DJ Deck', blurb: 'Direct-drive turntable with strobe platter', cover: { x: -6, y: 28 }, Component: DjDeck, armAngle: djArm },
];
export const DEFAULT_SKINS: Record<PlayerTheme, SkinId> = { cassette: 'hifi-deck', vinyl: 'hifi-turntable' };
export const skinsFor = (machine: PlayerTheme) => SKINS.filter(skin => skin.machine === machine);
export const findSkin = (id: string | undefined, machine: PlayerTheme) => SKINS.find(skin => skin.id === id && skin.machine === machine) ?? SKINS.find(skin => skin.id === DEFAULT_SKINS[machine])!;

/** Renders the chosen model and drives its reels / platter / tonearm from playback position. */
export function Machine({ skin, machine, title, motion }: { skin: Skin; machine: MachineControlProps; title: string; motion: MotionInput }) {
  const root = useRef<HTMLDivElement>(null);
  useMachineMotion(root, motion, { armAngle: skin.armAngle, armVars: skin.armVars });
  const Component = skin.Component;
  return <div ref={root} className={`machine-motion skin-${skin.id}`}><Component machine={machine} title={title}/></div>;
}
