import type { SkinProps } from './skins';
import { RecordTopDown, ScrewGradient, Textures } from './parts';
import { Dial, Hit } from './controls';
import { topDownArm } from './motion';

const CENTER: [number, number] = [650, 512];
const PIVOT: [number, number] = [1182, 232];
const ARM = 520;
export const djArm = topDownArm(PIVOT, CENTER, ARM, 356, 148, 92);
const FADER = { x: 1290, y0: 470, y1: 880 };

function Tonearm() {
  // S-shaped arm along +x from the pivot to the stylus at (ARM, 0); counterweight behind the pivot.
  const tube = `M0 0 C 110 -26, 210 30, 320 8 S ${ARM - 120} -14, ${ARM - 66} 0`;
  const arm = <>
    <rect x="-150" y="-26" width="74" height="52" rx="10" fill="url(#dj-metal)" stroke="#2a2b2e" strokeWidth="2"/>
    {Array.from({ length: 6 }, (_, i) => <line key={i} x1={-144 + i * 11} y1="-24" x2={-144 + i * 11} y2="24" stroke="#000" strokeOpacity=".25" strokeWidth="2"/>)}
    <rect x="-76" y="-9" width="70" height="18" rx="4" fill="#9ea2a8"/>
    <path d={tube} fill="none" stroke="#55585e" strokeWidth="15" strokeLinecap="round"/>
    <path d={tube} fill="none" stroke="url(#dj-tube)" strokeWidth="10" strokeLinecap="round"/>
    <g transform={`translate(${ARM - 40} 0) rotate(-22)`}>
      <rect x="-40" y="-22" width="88" height="44" rx="6" fill="#111113" stroke="#3b3c40" strokeWidth="2"/>
      <rect x="-26" y="-12" width="50" height="24" rx="3" fill="#d6d8db"/>
      <path d="M48 -12 L82 -30" stroke="#c7c9cd" strokeWidth="5" strokeLinecap="round"/>
    </g>
  </>;
  return <>
    <g style={{ transform: `translate(calc(${PIVOT[0]}px + var(--cue, 1) * 12px + 6px), calc(${PIVOT[1]}px + var(--cue, 1) * 16px + 8px)) rotate(var(--arm, 92deg))`, opacity: .45 }} filter="url(#dj-blur2)"><g fill="#000" stroke="#000">{arm}</g></g>
    <g style={{ transform: `translate(${PIVOT[0]}px, ${PIVOT[1]}px) rotate(var(--arm, 92deg))` }}>{arm}</g>
  </>;
}

/** A matte-black direct-drive DJ turntable, top view: strobe-dot platter rim, S-shaped tonearm, fader. */
export function DjDeck({ machine, title }: SkinProps) {
  const toggle = machine.playing ? machine.onPause : machine.onPlay;
  const toggleOk = machine.playing ? machine.canPause : machine.canPlay;
  const faderY = FADER.y1 - (FADER.y1 - FADER.y0) * machine.volume;
  return <div className="skin skin-dj" role="group" aria-label="DJ turntable controls">
    <svg viewBox="0 0 1536 1024" className="skin-art" aria-hidden="true">
      <defs>
        <Textures id="dj"/><ScrewGradient/>
        <linearGradient id="dj-plinth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a2a2d"/><stop offset=".5" stopColor="#1b1b1d"/><stop offset="1" stopColor="#121213"/></linearGradient>
        <radialGradient id="dj-platter" cx=".4" cy=".35" r=".8"><stop offset="0" stopColor="#f2f3f5"/><stop offset=".55" stopColor="#a5a9af"/><stop offset=".8" stopColor="#d8dade"/><stop offset="1" stopColor="#6e7278"/></radialGradient>
        <linearGradient id="dj-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f5f7"/><stop offset=".5" stopColor="#8f939a"/><stop offset="1" stopColor="#d3d5d9"/></linearGradient>
        <linearGradient id="dj-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fafbfc"/><stop offset=".5" stopColor="#9ca0a6"/><stop offset="1" stopColor="#e8eaed"/></linearGradient>
        <radialGradient id="dj-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#ffc277" stopOpacity=".75"/><stop offset="1" stopColor="#ff8a2a" stopOpacity="0"/></radialGradient>
        <clipPath id="dj-plinth-clip"><rect x="168" y="44" width="1200" height="936" rx="24"/></clipPath>
      </defs>

      <ellipse cx="768" cy="990" rx="640" ry="22" fill="#000" opacity=".55" filter="url(#dj-soft)"/>
      <rect x="168" y="44" width="1200" height="936" rx="24" fill="url(#dj-plinth)"/>
      <g clipPath="url(#dj-plinth-clip)"><rect x="168" y="44" width="1200" height="936" filter="url(#dj-grain)" opacity=".18" style={{ mixBlendMode: 'overlay' }}/></g>
      <rect x="172" y="48" width="1192" height="928" rx="21" fill="none" stroke="#5c5d62" strokeOpacity=".55" strokeWidth="3"/>
      <rect x="168" y="44" width="1200" height="936" rx="24" fill="none" stroke="#000" strokeWidth="2"/>

      {/* Platter: silver rim with strobe dots and a felt slipmat, all turning together */}
      <circle cx={CENTER[0]} cy={CENTER[1] + 6} r={414} fill="#000" opacity=".55" filter="url(#dj-blur2)"/>
      <g style={{ transform: 'rotate(var(--platter, 0deg))', transformOrigin: `${CENTER[0]}px ${CENTER[1]}px` }}>
        <circle cx={CENTER[0]} cy={CENTER[1]} r={410} fill="url(#dj-platter)"/>
        {[[402, '3.2 4.6'], [394, '3.2 4.75'], [386, '3.2 4.9'], [378, '3.2 5.05']].map(([r, dash]) => <circle key={r} cx={CENTER[0]} cy={CENTER[1]} r={r as number} fill="none" stroke="#3a3c40" strokeWidth="4" strokeDasharray={dash as string}/>)}
        <circle cx={CENTER[0]} cy={CENTER[1]} r={372} fill="#0f0f10"/>
        <text x={CENTER[0]} y={CENTER[1] + 330} textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize="30" letterSpacing="2" fill="#2a2a2c">RETRO PLAY</text>
      </g>
      <circle cx={CENTER[0]} cy={CENTER[1]} r={410} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="2"/>
      <RecordTopDown id="dj-rec" cx={CENTER[0]} cy={CENTER[1]} r={364} labelR={110} labelColor="#d9a441" labelInk="#1f1a12" title={title}/>
      {/* Strobe lamp washing the rim */}
      <circle cx="292" cy="860" r="120" fill="url(#dj-lamp)" style={{ mixBlendMode: 'screen' }}/>
      <circle cx="262" cy="890" r="22" fill="#2b2b2e" stroke="#5c5d62" strokeWidth="2"/><circle cx="262" cy="890" r="12" fill="#ffb04d" opacity=".9"/>

      {/* Tonearm base, rest, and arm */}
      <circle cx={PIVOT[0]} cy={PIVOT[1]} r="78" fill="#000" opacity=".35" filter="url(#dj-blur2)" transform="translate(5 8)"/>
      <circle cx={PIVOT[0]} cy={PIVOT[1]} r="76" fill="#232326" stroke="#000" strokeWidth="2"/>
      <circle cx={PIVOT[0]} cy={PIVOT[1]} r="58" fill="url(#dj-metal)"/>
      {Array.from({ length: 24 }, (_, i) => <line key={i} x1={PIVOT[0]} y1={PIVOT[1] - 58} x2={PIVOT[0]} y2={PIVOT[1] - 50} stroke="#444" strokeWidth="2" transform={`rotate(${i * 15} ${PIVOT[0]} ${PIVOT[1]})`}/>)}
      <circle cx={PIVOT[0]} cy={PIVOT[1]} r="32" fill="#18181a"/>
      <rect x="1166" y="728" width="34" height="50" rx="8" fill="#2a2a2d" stroke="#000"/>
      <path d="M1168 742 Q1183 722 1198 742" fill="none" stroke="#c7c9cd" strokeWidth="5"/>
      <Tonearm/>

      {/* Start/stop, 33/45, nudge buttons, level fader */}
      <rect x="196" y="914" width="150" height="50" rx="6" fill="#0b0b0c"/>
      <rect x="200" y="910" width="142" height="46" rx="5" fill="url(#dj-metal)" stroke="#3b3c40" strokeWidth="2" transform={machine.playing ? 'translate(0 3)' : undefined}/>
      <text x="271" y="940" textAnchor="middle" fontFamily="'DM Mono', monospace" fontSize="15" letterSpacing="2" fill="#1d1d20" transform={machine.playing ? 'translate(0 3)' : undefined}>START·STOP</text>
      {[['33', 372, true], ['45', 448, false]].map(([label, x, on]) => <g key={label as string}>
        <rect x={x as number} y="920" width="62" height="36" rx="5" fill="#2b2b2e" stroke="#000"/>
        <text x={(x as number) + 31} y="944" textAnchor="middle" fontFamily="'DM Mono', monospace" fontSize="15" fill={on ? '#ffb04d' : '#8b8d92'}>{label}</text>
      </g>)}
      {[['◀◀', 1258], ['▶▶', 1318]].map(([glyph, x]) => <g key={glyph as string}>
        <rect x={(x as number) - 24} y="330" width="48" height="40" rx="6" fill="#2b2b2e" stroke="#000"/>
        <text x={x as number} y="356" textAnchor="middle" fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize="15" fill="#c9cbcf">{glyph}</text>
      </g>)}
      <rect x={FADER.x - 6} y={FADER.y0 - 10} width="12" height={FADER.y1 - FADER.y0 + 20} rx="6" fill="#050506" stroke="#3b3c40"/>
      {Array.from({ length: 11 }, (_, i) => <line key={i} x1={FADER.x - 36} y1={FADER.y0 + i * 41} x2={FADER.x - 20} y2={FADER.y0 + i * 41} stroke={i === 5 ? '#3ad07a' : '#6c6e73'} strokeWidth={i === 5 ? 3 : 1.5}/>)}
      <g transform={`translate(${FADER.x} ${faderY.toFixed(1)})`} style={{ transition: 'transform .1s linear' }}>
        <rect x="-26" y="-18" width="52" height="36" rx="5" fill="url(#dj-metal)" stroke="#1d1d20" strokeWidth="1.5"/>
        <rect x="-26" y="-1.5" width="52" height="3" fill="#1d1d20"/>
      </g>
      <text x={FADER.x} y="920" textAnchor="middle" fontFamily="'DM Mono', monospace" fontSize="13" letterSpacing="2" fill="#8b8d92">LEVEL</text>
      <text x="200" y="96" fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize="26" letterSpacing="-1" fill="#d7d8db">retro<tspan fill="#e0773f" fontWeight="500">play</tspan><tspan fontFamily="'DM Mono', monospace" fontSize="12" fontWeight="400" letterSpacing="3" fill="#8b8d92" dx="14">DIRECT DRIVE · QUARTZ</tspan></text>
    </svg>
    <Hit rect={[196, 904, 152, 64]} label={machine.playing ? 'Stop' : 'Start'} onClick={toggle} disabled={!toggleOk}/>
    <Hit rect={[1234, 326, 48, 48]} label="Previous track" onClick={machine.onPrevious} disabled={!machine.canPrevious}/>
    <Hit rect={[1294, 326, 48, 48]} label="Next track" onClick={machine.onNext} disabled={!machine.canNext}/>
    <Hit rect={[372, 916, 62, 44]} label="Restart track" onClick={machine.onRestart} disabled={!machine.canSeek}/>
    <Hit rect={[PIVOT[0] - 70, PIVOT[1] - 70, 140, 140]} label={`Tonearm · ${machine.playing ? 'Pause' : 'Play'}`} onClick={toggle} disabled={!toggleOk} round/>
    <Dial rect={[FADER.x - 34, FADER.y0 - 24, 68, FADER.y1 - FADER.y0 + 48]} volume={machine.volume} disabled={machine.disabled} onChange={machine.onVolumeChange} vertical label="Level fader"/>
  </div>;
}
