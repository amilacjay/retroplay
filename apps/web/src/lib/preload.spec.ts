import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { isPreloaded, useImagePreload } from './preload';

// jsdom never loads images, so stand in an Image whose decode() resolves when the test says so.
let releaseDecode: () => void = () => {};
class FakeImage { src = ''; decoding = ''; decode() { return new Promise<void>(resolve => { releaseDecode = resolve; }); } }

describe('useImagePreload', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('reports progress while downloading and becomes ready only after the image is decoded', async () => {
    vi.stubGlobal('Image', FakeImage);
    const chunks = [new Uint8Array(400), new Uint8Array(600)];
    let pull!: () => void;
    const body = new ReadableStream<Uint8Array>({ start(controller) { pull = () => { const next = chunks.shift(); if (next) controller.enqueue(next); else controller.close(); }; } });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { headers: { 'content-length': '1000' } })));

    const { result } = renderHook(() => useImagePreload(['/assets/test-a.webp']));
    expect(result.current).toMatchObject({ ready: false, progress: 0 });
    act(() => pull());
    await waitFor(() => expect(result.current.progress).toBeCloseTo(0.4));
    act(() => { pull(); pull(); });
    // Fully downloaded is not enough: it must also be decoded, so it can paint in one go.
    await waitFor(() => expect(result.current.progress).toBeCloseTo(0.95));
    expect(result.current.ready).toBe(false);
    await act(async () => releaseDecode());
    await waitFor(() => expect(result.current).toMatchObject({ ready: true, progress: 1 }));
    expect(isPreloaded('/assets/test-a.webp')).toBe(true);
  });

  it('is ready at once for images it already has, and for models without photos', () => {
    expect(renderHook(() => useImagePreload(['/assets/test-a.webp'])).result.current.ready).toBe(true);
    expect(renderHook(() => useImagePreload([])).result.current).toMatchObject({ ready: true, progress: 1 });
  });
});
