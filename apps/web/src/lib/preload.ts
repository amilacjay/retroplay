import { useEffect, useState } from 'react';

type Entry = { done: boolean; fraction: number; promise: Promise<void>; listeners: Set<() => void> };
const entries = new Map<string, Entry>();
// Holding the decoded images keeps them warm in memory, so a model that was shown once reappears instantly.
const decoded: HTMLImageElement[] = [];

/** Resolves once the image can paint (or fails). Falls back to the load event where decode() is missing. */
export function decodeImage(image: HTMLImageElement): Promise<void> {
  if (typeof image.decode === 'function') return image.decode().catch(() => undefined);
  if (image.complete) return Promise.resolve();
  return new Promise(resolve => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => resolve(), { once: true }); });
}

async function download(url: string, onFraction: (fraction: number) => void) {
  // Reading the body ourselves gives real progress; the browser's HTTP cache then serves the <img> elements.
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    const total = Number(response.headers.get('content-length')) || 0;
    if (response.ok && response.body && total) {
      const reader = response.body.getReader();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        onFraction(Math.min(0.95, received / total));
      }
    } else await response.arrayBuffer();
  } catch { /* fall through: the <img> load below still fetches it */ }
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  // A broken image must not block the player forever, so failures resolve too.
  await decodeImage(image);
  decoded.push(image);
}

/** Starts (or joins) the download and decode of one image. */
export function preloadImage(url: string): Entry {
  let entry = entries.get(url);
  if (entry) return entry;
  const created: Entry = { done: false, fraction: 0, listeners: new Set(), promise: Promise.resolve() };
  const notify = () => created.listeners.forEach(listener => listener());
  created.promise = download(url, fraction => { created.fraction = fraction; notify(); }).finally(() => { created.done = true; created.fraction = 1; notify(); });
  entries.set(url, created);
  entry = created;
  return entry;
}

export const isPreloaded = (url: string) => entries.get(url)?.done === true;

/** Downloads and decodes a set of images; `progress` runs 0..1 and `ready` flips once all of them can paint at once. */
export function useImagePreload(urls: string[]) {
  const key = urls.join('|');
  const measure = () => {
    if (!urls.length) return { key, ready: true, progress: 1 };
    const list = urls.map(preloadImage);
    return { key, ready: list.every(entry => entry.done), progress: list.reduce((sum, entry) => sum + entry.fraction, 0) / list.length };
  };
  const [state, setState] = useState(measure);
  useEffect(() => {
    const list = urls.map(preloadImage);
    const update = () => setState(measure());
    list.forEach(entry => entry.listeners.add(update));
    update();
    return () => list.forEach(entry => entry.listeners.delete(update));
  }, [key]);
  // Until the effect runs for a new set of URLs, report it from the cache rather than the previous set's state.
  return state.key === key ? state : measure();
}

/**
 * Warms the cache with images the visitor may need next (other models), one at a time and only when the browser is idle,
 * so it never competes with the model being set up. Skipped when the browser asks to save data.
 */
export function prefetchImages(urls: string[]) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  const queue = urls.filter(url => !entries.has(url));
  const idle = (callback: () => void) => typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(callback, { timeout: 4000 }) : window.setTimeout(callback, 1500);
  const next = () => { const url = queue.shift(); if (url) idle(() => void preloadImage(url).promise.then(next)); };
  next();
}
