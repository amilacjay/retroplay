export function formatDuration(ms: number) {
  const safe = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** "1 hr 12 min" / "47 min" for a playlist's loaded running time. */
export function formatRuntime(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export function normalizePlaylist(input: string) {
  const value = input.trim();
  const uri = value.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
  if (uri) return value;
  try { const url = new URL(value); if (!['open.spotify.com', 'www.open.spotify.com'].includes(url.hostname)) return ''; const match = url.pathname.match(/^(?:\/intl-[a-z-]+)?\/playlist\/([A-Za-z0-9]+)/i); return match ? `spotify:playlist:${match[1]}` : ''; } catch { return ''; }
}

/** Turns a spotify:{type}:{id} URI into its open.spotify.com page so users can jump back to Spotify. */
export function spotifyUrl(uri: string | undefined | null) {
  const match = uri?.match(/^spotify:(track|album|artist|playlist):([A-Za-z0-9]+)$/);
  return match ? `https://open.spotify.com/${match[1]}/${match[2]}` : null;
}

/** The share id in a Retro Play share link path (`/s/:id`), or null. */
export function shareIdFromPath(pathname: string) {
  return pathname.match(/^\/s\/([A-Za-z0-9_-]{8,32})\/?$/)?.[1] ?? null;
}

/** "just now" / "5 min ago" / "3 hr ago" / "2 days ago". */
export function timeAgo(at: number, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - at) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
