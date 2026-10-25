/** Shapes the client may store on a profile. Everything is re-validated here because it arrives from the browser. */
export type Playlist = { id: string; uri: string; name: string; owner: string; total: number; image: string | null };
export type NowPlaying = {
  playlist: Playlist | null;
  track: { uri: string; name: string; artists: string[]; album: string | null; image: string | null };
  positionMs: number; durationMs: number; paused: boolean; updatedAt: number;
};
export type Preferences = Record<string, unknown>;

export const PLAYLIST_ID = /^[A-Za-z0-9]+$/;
const TRACK_URI = /^spotify:track:[A-Za-z0-9]+$/;
const MAX_PREFERENCES_BYTES = 16 * 1024;
const DAY_MS = 24 * 60 * 60_000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

/** Artwork must be an https URL; Spotify serves it from its CDN. */
export function cleanImage(value: unknown): string | null {
  const url = cleanString(value, 500);
  if (!url) return null;
  try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; }
}

export function cleanPlaylist(value: unknown): Playlist | null {
  if (!isRecord(value)) return null;
  const id = cleanString(value.id, 64);
  const name = cleanString(value.name, 200);
  if (!id || !PLAYLIST_ID.test(id) || !name || value.uri !== `spotify:playlist:${id}`) return null;
  return { id, uri: `spotify:playlist:${id}`, name, owner: cleanString(value.owner, 200) ?? 'Spotify user', total: finite(value.total, 0, 1_000_000) ? Math.floor(value.total as number) : 0, image: cleanImage(value.image) };
}

export function cleanNowPlaying(value: unknown, now = Date.now()): NowPlaying | null {
  if (!isRecord(value) || !isRecord(value.track)) return null;
  const track = value.track;
  const uri = cleanString(track.uri, 64);
  const name = cleanString(track.name, 300);
  if (!uri || !TRACK_URI.test(uri) || !name) return null;
  if (!finite(value.positionMs, 0, DAY_MS) || !finite(value.durationMs, 0, DAY_MS) || typeof value.paused !== 'boolean') return null;
  const artists = Array.isArray(track.artists) ? track.artists.slice(0, 20).map(artist => cleanString(artist, 200)).filter((artist): artist is string => Boolean(artist)) : [];
  return {
    playlist: value.playlist == null ? null : cleanPlaylist(value.playlist),
    track: { uri, name, artists, album: cleanString(track.album, 300), image: cleanImage(track.image) },
    positionMs: Math.floor(value.positionMs as number), durationMs: Math.floor(value.durationMs as number), paused: value.paused, updatedAt: now,
  };
}

function cleanRecord(value: unknown, maxEntries: number, key: RegExp, entry: (item: unknown) => unknown) {
  if (!isRecord(value)) return undefined;
  const result: Record<string, unknown> = {};
  for (const [name, item] of Object.entries(value).slice(0, maxEntries)) {
    const clean = entry(item);
    if (key.test(name) && clean !== undefined) result[name] = clean;
  }
  return result;
}

const PREFERENCE_RULES: Record<string, (value: unknown) => unknown> = {
  appearance: value => value === 'light' || value === 'dark' ? value : undefined,
  playerTheme: value => value === 'cassette' || value === 'vinyl' ? value : undefined,
  coverFit: value => typeof value === 'string' && /^[a-z-]{1,20}$/.test(value) ? value : undefined,
  showCoverTitle: value => typeof value === 'boolean' ? value : undefined,
  volume: value => finite(value, 0, 1) ? value : undefined,
  skins: value => cleanRecord(value, 4, /^[a-z]{1,20}$/, item => typeof item === 'string' && /^[a-z-]{1,30}$/.test(item) ? item : undefined),
  coverPositions: value => cleanRecord(value, 12, /^[a-z-]{1,30}$/, item => isRecord(item) && finite(item.x, -1000, 1000) && finite(item.y, -1000, 1000) ? { x: item.x, y: item.y } : undefined),
  coverPan: value => cleanRecord(value, 4, /^[a-z]{1,20}$/, item => finite(item, 0, 100) ? item : undefined),
  recents: value => Array.isArray(value) ? value.slice(0, 5).map(cleanPlaylist).filter(Boolean) : undefined,
};

/** Keeps only known customisation keys with sane values; unknown keys are dropped. Returns null when the payload is too large. */
export function cleanPreferences(value: unknown): Preferences | null {
  if (!isRecord(value)) return null;
  const result: Preferences = {};
  for (const [key, rule] of Object.entries(PREFERENCE_RULES)) {
    const clean = rule(value[key]);
    if (clean !== undefined) result[key] = clean;
  }
  return JSON.stringify(result).length <= MAX_PREFERENCES_BYTES ? result : null;
}
