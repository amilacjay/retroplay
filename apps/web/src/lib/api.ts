export type UserProfile = { name: string; googleName: string; email: string; picture: string | null; createdAt: number };
export type NowPlaying = {
  playlist: PlaylistResult | null;
  track: { uri: string; name: string; artists: string[]; album: string | null; image: string | null };
  positionMs: number; durationMs: number; paused: boolean; updatedAt?: number;
};
/** `authenticated` means signed in to Retro Play (with Google); Spotify is a separate connection on the profile. */
export type SessionInfo = {
  authenticated: boolean; csrf?: string; signInAvailable?: boolean;
  user?: UserProfile; spotify?: { connected: boolean; displayName: string | null };
  preferences?: Record<string, unknown>; nowPlaying?: NowPlaying | null;
};
export type ShareLink = { id: string; url: string; playlist: PlaylistResult; createdAt: number };
export type SharedPlaylist = ShareLink & { sharedBy: string };
export type PlaylistTrack = { uri: string; name: string; artists: string[]; duration_ms: number; album?: string; image?: string | null };
export type PlaylistResult = { id: string; uri: string; name: string; owner: string; total: number; image?: string | null };
export type Page<T> = { total: number; offset: number; items: T[] };

export const API_UNREACHABLE = 'Retro Play could not reach its API. Start both apps with `npm run dev` and retry.';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function readResponse(response: Response): Promise<{ message?: string }> {
  const type = response.headers?.get('content-type') ?? '';
  if (type.includes('application/json')) return response.json();
  if (!response.ok) return { message: response.status >= 500 ? API_UNREACHABLE : `Request failed (HTTP ${response.status}).` };
  return {};
}

/** Calls the Retro Play API with the session cookie and CSRF header, turning failures into ApiError with a readable message. */
export async function api<T>(path: string, csrf: string | undefined, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: init.method ?? 'GET', credentials: 'include', signal: init.signal, headers: { ...(csrf ? { 'X-Cassete-CSRF': csrf } : {}), ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(API_UNREACHABLE, 0);
  }
  const result = await readResponse(response);
  if (!response.ok) throw new ApiError(result.message ?? `Request failed (HTTP ${response.status}).`, response.status);
  return result as T;
}

export const errorMessage = (cause: unknown, fallback: string) => cause instanceof Error && cause.message ? cause.message : fallback;
