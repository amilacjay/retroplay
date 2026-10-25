import { useEffect, useState } from 'react';

export function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

export function writeStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable (private mode, quota) */ }
}

/** useState that survives reloads via localStorage under a `retro-play-*` key. */
export function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStored(key, fallback));
  useEffect(() => { writeStored(key, value); }, [key, value]);
  return [value, setValue] as const;
}
