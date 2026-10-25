import { useEffect, useRef } from 'react';

export type ShortcutHandlers = {
  togglePlay(): void; next(): void; previous(): void; seekBy(ms: number): void; volumeBy(delta: number): void;
  toggleMute(): void; toggleShuffle(): void; cycleRepeat(): void; switchMachine(): void; cycleModel(): void; focusSearch(): void; showHelp(): void;
};

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'], ['Shift + →', 'Next track'], ['Shift + ←', 'Previous track'], ['→ / ←', 'Seek 10 seconds'],
  ['↑ / ↓', 'Volume up / down'], ['M', 'Mute'], ['S', 'Shuffle'], ['R', 'Repeat'], ['T', 'Switch cassette / vinyl'], ['K', 'Next model of that machine'], ['/', 'Search playlists'], ['?', 'Show shortcuts'],
];

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !(target instanceof HTMLInputElement && ['range', 'checkbox', 'radio', 'button'].includes(target.type)));

/** Global player shortcuts, ignored while the user types in a field or holds Ctrl/Meta/Alt. */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      const h = ref.current;
      const onRange = event.target instanceof HTMLInputElement && event.target.type === 'range';
      const onButton = event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement;
      switch (event.key) {
        case ' ': if (onButton) return; h.togglePlay(); break;
        case 'ArrowRight': if (onRange) return; event.shiftKey ? h.next() : h.seekBy(10_000); break;
        case 'ArrowLeft': if (onRange) return; event.shiftKey ? h.previous() : h.seekBy(-10_000); break;
        case 'ArrowUp': if (onRange) return; h.volumeBy(0.05); break;
        case 'ArrowDown': if (onRange) return; h.volumeBy(-0.05); break;
        case 'm': case 'M': h.toggleMute(); break;
        case 's': case 'S': h.toggleShuffle(); break;
        case 'r': case 'R': h.cycleRepeat(); break;
        case 't': case 'T': h.switchMachine(); break;
        case 'k': case 'K': h.cycleModel(); break;
        case '/': h.focusSearch(); break;
        case '?': h.showHelp(); break;
        default: return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
