import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error';
export type Toast = { id: number; kind: ToastKind; text: string };

const LIFETIME: Record<ToastKind, number> = { info: 4200, success: 3600, error: 9000 };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
    window.clearTimeout(timers.current.get(id)); timers.current.delete(id);
  }, []);
  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    if (!text) return;
    const id = nextId.current++;
    // Repeating the same message replaces the old toast instead of stacking duplicates.
    setToasts(current => [...current.filter(toast => toast.text !== text), { id, kind, text }].slice(-4));
    timers.current.set(id, window.setTimeout(() => dismiss(id), LIFETIME[kind]));
  }, [dismiss]);
  useEffect(() => () => { timers.current.forEach(timer => window.clearTimeout(timer)); }, []);
  return { toasts, notify, dismiss };
}
