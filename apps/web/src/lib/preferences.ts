import type { Appearance } from '../components/Chrome';
import type { CoverFit, CoverPosition, PlayerTheme } from '../components/Hardware';
import type { SkinId } from '../components/machines/skins';
import type { PlaylistResult } from './api';

/** Everything the deck lets you customise; synced to the signed-in profile and cached in localStorage. */
export type Preferences = {
  appearance: Appearance; playerTheme: PlayerTheme; coverFit: CoverFit; showCoverTitle: boolean;
  skins: Record<PlayerTheme, SkinId>; coverPositions: Partial<Record<SkinId, CoverPosition>>; coverPan: Record<PlayerTheme, number>;
  volume: number; recents: PlaylistResult[];
};

const FITS: CoverFit[] = ['cover', 'fit-width', 'fit-height', 'stretch', 'title'];
const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Reads saved preferences defensively: anything missing or malformed is left out so the current value stays. */
export function readPreferences(raw: unknown): Partial<Preferences> {
  if (!isRecord(raw)) return {};
  const result: Partial<Preferences> = {};
  if (raw.appearance === 'light' || raw.appearance === 'dark') result.appearance = raw.appearance;
  if (raw.playerTheme === 'cassette' || raw.playerTheme === 'vinyl') result.playerTheme = raw.playerTheme;
  if (FITS.includes(raw.coverFit)) result.coverFit = raw.coverFit;
  if (typeof raw.showCoverTitle === 'boolean') result.showCoverTitle = raw.showCoverTitle;
  if (isNumber(raw.volume) && raw.volume >= 0 && raw.volume <= 1) result.volume = raw.volume;
  if (isRecord(raw.skins) && typeof raw.skins.cassette === 'string' && typeof raw.skins.vinyl === 'string') result.skins = { cassette: raw.skins.cassette, vinyl: raw.skins.vinyl } as Preferences['skins'];
  if (isRecord(raw.coverPositions)) result.coverPositions = Object.fromEntries(Object.entries(raw.coverPositions).filter(([, value]) => isRecord(value) && isNumber(value.x) && isNumber(value.y)));
  if (isRecord(raw.coverPan) && isNumber(raw.coverPan.cassette) && isNumber(raw.coverPan.vinyl)) result.coverPan = { cassette: raw.coverPan.cassette, vinyl: raw.coverPan.vinyl };
  if (Array.isArray(raw.recents)) result.recents = raw.recents.filter(item => isRecord(item) && typeof item.id === 'string' && typeof item.uri === 'string' && typeof item.name === 'string').slice(0, 5);
  return result;
}
