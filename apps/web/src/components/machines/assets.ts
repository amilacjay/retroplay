import type { PlayerTheme } from '../Hardware';
import type { SkinId } from './skins';

/** Every shipped image. Sources are PNGs in apps/web/art; `npm run images` writes these WebP files. */
const webp = (name: string) => `/assets/${name}.webp`;
export const IMAGES = {
  cassetteDeck: webp('retro-play-cassette-deck'),
  turntableResting: webp('retro-play-turntable-platter'),
  turntablePlaying: webp('retro-play-turntable'),
  vinylRecord: webp('retro-play-vinyl-record'),
  cassetteCase: webp('retro-play-cassette-case'),
  vinylSleeve: webp('retro-play-vinyl-cardboard-sleeve'),
  pocket: webp('models/pocket-stereo'),
  pocketBase: webp('models/pocket-stereo-base'),
  boombox: webp('models/boombox'),
  boomboxBase: webp('models/boombox-base'),
  suitcaseBase: webp('models/suitcase-base'),
  suitcaseRest: webp('models/suitcase-rest'),
  suitcaseArm: webp('models/suitcase-arm'),
} as const;

/** The album case or sleeve drawn over each machine. */
export const COVER_FRAME: Record<PlayerTheme, string> = { cassette: IMAGES.cassetteCase, vinyl: IMAGES.vinylSleeve };

/** The photos each model paints (the DJ Deck is drawn in SVG). Add a model's images here when they change. */
const MODEL_IMAGES: Record<SkinId, string[]> = {
  'hifi-deck': [IMAGES.cassetteDeck],
  pocket: [IMAGES.pocketBase, IMAGES.pocket],
  boombox: [IMAGES.boomboxBase, IMAGES.boombox],
  'hifi-turntable': [IMAGES.turntableResting, IMAGES.turntablePlaying, IMAGES.vinylRecord],
  suitcase: [IMAGES.suitcaseBase, IMAGES.suitcaseRest, IMAGES.suitcaseArm, IMAGES.vinylRecord],
  dj: [],
};

/** Everything that must be downloaded and decoded before a model can appear without painting in piece by piece. */
export const modelAssets = (id: SkinId, machine: PlayerTheme) => [...MODEL_IMAGES[id], COVER_FRAME[machine]];
