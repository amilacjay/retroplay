/* Shared SVG building blocks for the drawn machine skins. Rotations and tape packs read CSS variables written by useMachineMotion. */

const spin = (variable: string): React.CSSProperties => ({ transform: `rotate(var(${variable}, 0deg))`, transformBox: 'fill-box', transformOrigin: 'center' });
const pack = (variable: string): React.CSSProperties => ({ transform: `scale(var(${variable}, .5))`, transformBox: 'fill-box', transformOrigin: 'center' });

/** Texture filters: brushed metal (directional noise), fine grain, foam, and fabric weave. Ids are prefixed per skin. */
export function Textures({ id }: { id: string }) {
  return <>
    <filter id={`${id}-brush`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.002 0.55" numOctaves="2" seed="4"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id={`${id}-grain`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="9"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id={`${id}-foam`} x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.09" numOctaves="3" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.15"/></filter>
    <filter id={`${id}-weave`} x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.6 0.05" numOctaves="1" seed="5" result="a"/><feTurbulence type="fractalNoise" baseFrequency="0.05 0.6" numOctaves="1" seed="6" result="b"/><feBlend in="a" in2="b" mode="multiply"/><feColorMatrix type="saturate" values="0"/></filter>
    <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id={`${id}-blur2`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2"/></filter>
    <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity=".45"/></filter>
  </>;
}

export const ScrewGradient = () => <radialGradient id="screw-grad" cx=".35" cy=".3" r=".9"><stop offset="0" stopColor="#f2efe8"/><stop offset=".6" stopColor="#a9a499"/><stop offset="1" stopColor="#6a665e"/></radialGradient>;

/** A clear, open-flanged reel matched to the photographed hi-fi deck; 100×100 viewBox. */
export function PhotoReel({ reel, packVar }: { reel: string; packVar: string }) {
  const windows = Array.from({ length: 5 }, (_, i) => {
    const a0 = (i * 72 + 14) * Math.PI / 180; const a1 = (i * 72 + 58) * Math.PI / 180;
    const p = (r: number, a: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(24, a0)} L${p(41, a0 - .05)} A41 41 0 0 1 ${p(41, a1 + .05)} L${p(24, a1)} A24 24 0 0 0 ${p(24, a0)} Z`;
  }).join(' ');
  return <svg viewBox="0 0 100 100" className="photo-reel" aria-hidden="true">
    <defs>
      <radialGradient id={`${reel}-bg`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#0e0d0c"/><stop offset=".85" stopColor="#0b0a09"/><stop offset="1" stopColor="#0b0a09" stopOpacity="0"/></radialGradient>
      <radialGradient id={`${reel}-pk`} cx=".36" cy=".38" r=".8"><stop offset="0" stopColor="#8a5a35"/><stop offset=".45" stopColor="#5a3820"/><stop offset=".85" stopColor="#3a2312"/><stop offset="1" stopColor="#24150a"/></radialGradient>
      <radialGradient id={`${reel}-amber`} cx="0" cy=".5" r=".75"><stop offset="0" stopColor="#ffb347" stopOpacity=".75"/><stop offset=".45" stopColor="#ff9a2e" stopOpacity=".18"/><stop offset="1" stopColor="#ff9a2e" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill={`url(#${reel}-bg)`}/>
    <circle cx="50" cy="50" r="46" fill={`url(#${reel}-pk)`} style={pack(packVar)}/>
    <circle cx="50" cy="50" r="45.6" fill="none" stroke="#c48a55" strokeOpacity=".75" strokeWidth=".9" style={pack(packVar)}/>
    <g style={spin(reel)}>
      <path d={`M50 2 A48 48 0 1 1 49.99 2 Z ${windows}`} fillRule="evenodd" fill="#efe1c8" fillOpacity=".2" stroke="#f6e7cc" strokeOpacity=".35" strokeWidth=".5"/>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#fbeed6" strokeOpacity=".6" strokeWidth="1.4"/>
      <circle cx="50" cy="50" r="22" fill="#e9dcc3" fillOpacity=".55" stroke="#fff3dc" strokeOpacity=".5" strokeWidth=".6"/>
      {Array.from({ length: 12 }, (_, i) => <rect key={i} x="48.8" y="29.5" width="2.4" height="3.2" rx=".5" fill="#fff6e4" fillOpacity=".55" transform={`rotate(${i * 30} 50 50)`}/>)}
      <circle cx="50" cy="50" r="13" fill="#2a2420"/>
      <circle cx="50" cy="50" r="8.5" fill="#121010"/>
      {Array.from({ length: 6 }, (_, i) => <rect key={i} x="48.6" y="37" width="2.8" height="4.6" rx=".6" fill="#ddd2bd" transform={`rotate(${i * 60} 50 50)`}/>)}
      <circle cx="50" cy="50" r="4.4" fill="#0b0a09" stroke="#6b6158" strokeWidth=".6"/>
    </g>
    <circle cx="50" cy="50" r="50" fill={`url(#${reel}-amber)`} style={{ mixBlendMode: 'screen' }}/>
    <path d="M18 24 A40 40 0 0 1 60 10" fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>;
}

/** A top-down vinyl record. Grooves and label turn with --platter; the light reflection stays put, as it does on a real deck. */
export function RecordTopDown({ id, cx, cy, r, labelR, labelColor = '#b5462e', labelInk = '#f6ead7', title, side = 'SIDE A · 33⅓' }: { id: string; cx: number; cy: number; r: number; labelR: number; labelColor?: string; labelInk?: string; title: string; side?: string }) {
  const fit = title.length > 26 ? `${title.slice(0, 25)}…` : title;
  return <g>
    <defs>
      <radialGradient id={`${id}-groove`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r="3.2" spreadMethod="repeat"><stop offset="0" stopColor="#111"/><stop offset=".5" stopColor="#1e1e1f"/><stop offset="1" stopColor="#111"/></radialGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0"/><stop offset=".5" stopColor="#fff" stopOpacity=".2"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
      <radialGradient id={`${id}-label`} cx=".4" cy=".35" r=".8"><stop offset="0" stopColor={labelColor} stopOpacity=".85"/><stop offset="1" stopColor={labelColor}/></radialGradient>
      <clipPath id={`${id}-vinyl`}><circle cx={cx} cy={cy} r={r}/></clipPath>
      <filter id={`${id}-drop`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs>
    <circle cx={cx} cy={cy + 6} r={r} fill="#000" opacity=".45" filter={`url(#${id}-drop)`}/>
    <g style={{ transform: 'rotate(var(--platter, 0deg))', transformOrigin: `${cx}px ${cy}px` }}>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-groove)`}/>
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="#2d2d2f" strokeWidth="4"/>
      {[0.83, 0.68, 0.55].map(f => <circle key={f} cx={cx} cy={cy} r={labelR + (r - labelR) * f} fill="none" stroke="#070707" strokeWidth="2.2" strokeOpacity=".9"/>)}
      <circle cx={cx} cy={cy} r={labelR + 14} fill="#141415"/>
      <circle cx={cx} cy={cy} r={labelR} fill={`url(#${id}-label)`}/>
      <circle cx={cx} cy={cy} r={labelR - 6} fill="none" stroke={labelInk} strokeOpacity=".35" strokeWidth="1.2"/>
      <text x={cx} y={cy - labelR * .42} textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize={labelR * .2} fill={labelInk}>Retro Play</text>
      <text x={cx} y={cy + labelR * .5} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="600" fontSize={labelR * .12} fill={labelInk}>{fit}</text>
      <text x={cx} y={cy + labelR * .68} textAnchor="middle" fontFamily="'DM Mono', monospace" fontSize={labelR * .085} fill={labelInk} fillOpacity=".75" letterSpacing="1">{side}</text>
      <circle cx={cx + r * .62} cy={cy - r * .2} r="2.2" fill="#3a3a3c" opacity=".7"/>
    </g>
    <g clipPath={`url(#${id}-vinyl)`} style={{ mixBlendMode: 'screen' }} pointerEvents="none">
      <path d={`M${cx} ${cy} L${cx - r * 1.1} ${cy - r * .55} L${cx - r * .7} ${cy - r * 1.05} Z`} fill={`url(#${id}-sheen)`} opacity=".55"/>
      <path d={`M${cx} ${cy} L${cx + r * 1.1} ${cy + r * .55} L${cx + r * .7} ${cy + r * 1.05} Z`} fill={`url(#${id}-sheen)`} opacity=".4"/>
      <circle cx={cx} cy={cy} r={labelR + 1} fill="#000"/>
    </g>
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="1.5"/>
    <circle cx={cx} cy={cy} r="5.5" fill="url(#screw-grad)" stroke="#3d3a35" strokeWidth=".8"/>
  </g>;
}
