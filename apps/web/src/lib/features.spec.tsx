import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook } from '@testing-library/react';
import { AlbumCoverPreview } from '../components/Hardware';
import { formatRuntime, normalizePlaylist, spotifyUrl } from './format';
import { useSleepTimer } from '../hooks/useSleepTimer';

describe('Spotify link helpers', () => {
  it('accepts localized open.spotify.com playlist links', () => {
    expect(normalizePlaylist('https://open.spotify.com/intl-de/playlist/abc123?si=x')).toBe('spotify:playlist:abc123');
  });
  it('builds open.spotify.com links only for known URI types', () => {
    expect(spotifyUrl('spotify:track:abc')).toBe('https://open.spotify.com/track/abc');
    expect(spotifyUrl('spotify:local:a:b:c:1')).toBeNull();
    expect(spotifyUrl(undefined)).toBeNull();
  });
  it('formats playlist running time', () => {
    expect(formatRuntime(47 * 60_000)).toBe('47 min');
    expect(formatRuntime(72 * 60_000)).toBe('1 hr 12 min');
  });
});

// jsdom lacks PointerEvent; without it fired pointer events drop button/clientX.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent { pointerId: number; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; } }
  (window as any).PointerEvent = PointerEventPolyfill;
}

describe('J-card fit height', () => {
  it('pans the artwork sideways without moving the case', () => {
    const onPan = vi.fn(); const onPosition = vi.fn();
    const { container } = render(<AlbumCoverPreview theme="cassette" artwork="/art.png" title="Song" fit="fit-height" showTitle position={{ x: 0, y: 0 }} onPositionChange={onPosition} pan={50} onPanChange={onPan}/>);
    const art = container.querySelector('.cover-art-window') as HTMLElement;
    const image = container.querySelector('.cover-artwork') as HTMLImageElement;
    Object.defineProperty(image, 'naturalWidth', { value: 640 }); Object.defineProperty(image, 'naturalHeight', { value: 640 });
    art.getBoundingClientRect = () => ({ width: 100, height: 150 } as DOMRect);
    art.setPointerCapture = () => {};
    expect(image.style.objectPosition).toBe('50% 50%');
    fireEvent.pointerDown(art, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(art, { pointerId: 1, clientX: 125 });
    // 150px tall square art is 150px wide: 50px overflow, so a 25px drag right reveals half of it from the left.
    expect(onPan).toHaveBeenLastCalledWith(0);
    expect(onPosition).not.toHaveBeenCalled();
  });
});

describe('sleep timer', () => {
  afterEach(() => vi.useRealTimers());
  it('pauses once the chosen minutes pass', () => {
    vi.useFakeTimers();
    const pause = vi.fn();
    const { result } = renderHook(() => useSleepTimer('spotify:track:a', pause));
    act(() => result.current.startMinutes(15));
    act(() => { vi.advanceTimersByTime(15 * 60_000 + 1000); });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(result.current.setting).toBeNull();
  });
  it('pauses when the current track changes after "end of track"', () => {
    const pause = vi.fn();
    const { result, rerender } = renderHook(({ uri }) => useSleepTimer(uri, pause), { initialProps: { uri: 'spotify:track:a' } });
    act(() => result.current.endOfTrack());
    rerender({ uri: 'spotify:track:a' });
    expect(pause).not.toHaveBeenCalled();
    rerender({ uri: 'spotify:track:b' });
    expect(pause).toHaveBeenCalledTimes(1);
  });
});
