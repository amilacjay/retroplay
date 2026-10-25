/** Accessible hit areas laid over a drawn skin. Rects are in the skin's 1536×1024 SVG coordinates. */
export type Rect = [x: number, y: number, w: number, h: number];
const place = ([x, y, w, h]: Rect): React.CSSProperties => ({ left: `${x / 15.36}%`, top: `${y / 10.24}%`, width: `${w / 15.36}%`, height: `${h / 10.24}%` });

export function Hit({ rect, label, onClick, disabled, round = false }: { rect: Rect; label: string; onClick: () => void; disabled: boolean; round?: boolean }) {
  return <button type="button" className={`hardware-hitbox ${round ? 'is-round' : ''}`} style={place(rect)} aria-label={`Deck: ${label}`} data-tip={label} onClick={onClick} disabled={disabled}/>;
}

export function Dial({ rect, volume, disabled, onChange, vertical = false, label = 'Deck volume' }: { rect: Rect; volume: number; disabled: boolean; onChange: (value: number) => void; vertical?: boolean; label?: string }) {
  return <input className={`hardware-volume ${vertical ? 'is-vertical' : ''}`} style={place(rect)} type="range" min="0" max="1" step="0.01" value={volume} aria-label={label} title={`Volume ${Math.round(volume * 100)}%`} disabled={disabled} onChange={event => onChange(Number(event.target.value))}/>;
}
