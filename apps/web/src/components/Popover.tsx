import { useEffect, useId, useRef, useState } from 'react';

/** A button with an anchored panel that closes on outside click, Escape, or when a child calls close(). */
export function Popover({ label, button, className = '', align = 'end', side = 'top', children }: { label: string; button: React.ReactNode; className?: string; align?: 'start' | 'end'; side?: 'top' | 'bottom'; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey, true); };
  }, [open]);
  return <div className={`popover ${className}`} ref={root}>
    <button ref={trigger} type="button" className={`icon-button ${open ? 'is-open' : ''}`} aria-label={label} title={label} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{button}</button>
    {open && <div className={`popover-panel align-${align} side-${side}`} id={id} role="dialog" aria-label={label}>{children(() => setOpen(false))}</div>}
  </div>;
}
