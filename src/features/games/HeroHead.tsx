import { useId, type ReactNode } from 'react';
import { SKIN, type Extra, type Look } from './heroes';

// Dibuja la cabeza (con hombros) de un personaje a partir de su ficha, en una caja de 48×48.
const INK = '#111827';
const FACE = 'M12 24c0-8.5 5.2-14 12-14s12 5.5 12 14c0 8-5.4 14-12 14s-12-6-12-14z';
const COWL = 'M11.4 31C10.4 17 15.5 9 24 9s13.6 8 12.6 22c-2.4-3.2-6.4-4.9-12.6-4.9S13.8 27.8 11.4 31z';
const HELMET = 'M11 24c0-9 5.5-15 13-15s13 6 13 15c0 8.5-5.8 15-13 15s-13-6.5-13-15z';
const DOMINO = 'M13 20.5q11-4.5 22 0-.8 6-5.5 6-3.6-.4-5.5-3-1.9 2.6-5.5 3-4.7 0-5.5-6z';

function hairBack(style: string, color: string): ReactNode {
  if (style === 'long') return <path d="M10.5 22c0-9 5.5-14.5 13.5-14.5S37.5 13 37.5 22l1 17-6-2V24H15.5v13l-6 2z" fill={color} />;
  if (style === 'pigtails') return <g fill={color}><path d="M12 18c-6 2-8 10-5 17 2-5 4-9 6-11z" /><path d="M36 18c6 2 8 10 5 17-2-5-4-9-6-11z" /></g>;
  return null;
}

function hairFront(style: string, color: string): ReactNode {
  switch (style) {
    case 'short': return <path d="M12 21c0-7 5-11.5 12-11.5S36 14 36 21c-2-3-5-5-12-5s-10 2-12 5z" fill={color} />;
    case 'long': return <path d="M12 22c0-8 5-12.5 12-12.5S36 14 36 22c-3-5-6-6.5-12-6.5S15 17 12 22z" fill={color} />;
    case 'pigtails': return <path d="M12 21c0-7 5-11.5 12-11.5S36 14 36 21c-3-4-7-5.5-12-5.5S15 17 12 21z" fill={color} />;
    case 'spiky': return <path d="M12 21l1-7 3 2 2-6 3 4 3-6 3 6 3-4 2 6 3-2 1 7c-3-3-6-4.5-12-4.5S15 18 12 21z" fill={color} />;
    case 'wild': return <path d="M11 22l-1-6 3 1-1-5 4 2 1-5 3 3 4-4 3 4 3-3 1 5 4-2-1 5 3-1-1 6c-3-4-7-5-12-5s-9 1-12 5z" fill={color} />;
    case 'slick': return <path d="M12 20c0-6.5 5-10.5 12-10.5S36 13.5 36 20c-1.5-2.4-3.5-4-6-4.6-3 2-9.5 2.2-14 .6-2 1-3.2 2.4-4 4z" fill={color} />;
    case 'curl': return <g fill={color}><path d="M12 20c0-6.5 5-10.5 12-10.5S36 13.5 36 20c-2.5-3-6.5-4.5-12-4.5S14.5 17 12 20z" /><path d="M22.5 15.5c-2 1.5-1.8 4 .3 4.4" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" /></g>;
    case 'bun': return <g fill={color}><circle cx="24" cy="7.5" r="3.5" /><path d="M12 21c0-7 5-11.5 12-11.5S36 14 36 21c-3-4-7-5.5-12-5.5S15 17 12 21z" /></g>;
    case 'mohawk': return <path d="M21 16l1-9 2 3 2-3 1 9z" fill={color} />;
    default: return null;
  }
}

function eyes(kind: string, color?: string): ReactNode {
  switch (kind) {
    case 'lens': return <g fill="#fff" stroke={INK} strokeWidth="1"><path d="M13.6 19.8q5.6-2.2 8.6 2.1-3.3 3.4-8.6-2.1z" /><path d="M34.4 19.8q-5.6-2.2-8.6 2.1 3.3 3.4 8.6-2.1z" /></g>;
    case 'slit': return <g fill={color ?? '#e0f2fe'}><rect x="14.5" y="20.6" width="7" height="2.4" rx="1.2" /><rect x="26.5" y="20.6" width="7" height="2.4" rx="1.2" /></g>;
    case 'glow': return <g><circle cx="19" cy="22" r="2.4" fill={color ?? '#fde047'} /><circle cx="29" cy="22" r="2.4" fill={color ?? '#fde047'} /><circle cx="19" cy="22" r=".9" fill="#fff" /><circle cx="29" cy="22" r=".9" fill="#fff" /></g>;
    case 'angry': return <g><path d="M15 18.4l6.2 2M33 18.4l-6.2 2" stroke={INK} strokeWidth="1.5" strokeLinecap="round" /><circle cx="19" cy="22.6" r="1.6" fill={color ?? INK} /><circle cx="29" cy="22.6" r="1.6" fill={color ?? INK} /></g>;
    case 'dot': return <g><circle cx="19" cy="22.2" r="1.7" fill={color ?? INK} /><circle cx="29" cy="22.2" r="1.7" fill={color ?? INK} /><circle cx="19.6" cy="21.6" r=".55" fill="#fff" /><circle cx="29.6" cy="21.6" r=".55" fill="#fff" /><path d="M16.5 18.6q2.5-1.2 5 0M26.5 18.6q2.5-1.2 5 0" stroke={INK} strokeWidth=".9" fill="none" strokeLinecap="round" /></g>;
    default: return null;
  }
}

function mouth(kind: string): ReactNode {
  switch (kind) {
    case 'smile': return <path d="M20 30q4 3.4 8 0" stroke="#7f1d1d" strokeWidth="1.3" fill="none" strokeLinecap="round" />;
    case 'grin': return <g><path d="M15.5 28.5q8.5 8.5 17 0-8.5 3.2-17 0z" fill="#7f1d1d" /><path d="M16.5 29.3q7.5 2.6 15 0" stroke="#fff" strokeWidth="1.2" fill="none" /></g>;
    case 'frown': return <path d="M20 32q4-3 8 0" stroke="#7f1d1d" strokeWidth="1.3" fill="none" strokeLinecap="round" />;
    case 'flat': return <path d="M20.5 31h7" stroke="#7f1d1d" strokeWidth="1.3" strokeLinecap="round" />;
    case 'smirk': return <path d="M20.5 31q4 1.2 7.5-1.6" stroke="#7f1d1d" strokeWidth="1.3" fill="none" strokeLinecap="round" />;
    default: return null;
  }
}

const BACK: Extra[] = ['cloak', 'tentacles', 'hoodCloth', 'arrowHood', 'leaves', 'antlers', 'tubes'];

function extra(kind: Extra, look: Look): ReactNode {
  const accent = look.accent ?? '#facc15';
  const hood = look.hood?.[1] ?? INK;
  switch (kind) {
    // detrás de la cabeza
    case 'cloak': return <path d="M5 48l3-14 8 4h16l8-4 3 14z" fill={accent} />;
    case 'tentacles': return <g fill="none" stroke="#4b5563" strokeWidth="2.6" strokeLinecap="round"><path d="M14 40C6 38 4 30 7 24" /><path d="M34 40c8-2 10-10 7-16" /><path d="M12 44C3 45 1 38 2 33" /><path d="M36 44c9 1 11-6 10-11" /></g>;
    case 'hoodCloth': return <path d="M7 40c-1-20 6-33 17-33s18 13 17 33l-4 4H11z" fill={accent} />;
    case 'arrowHood': return <path d="M8 40C7 22 13 9 24 3c11 6 17 19 16 37l-4 4H12z" fill={accent} />;
    case 'leaves': return <g fill="#16a34a">{[[10, 16, -30], [38, 16, 30], [9, 26, -60], [39, 26, 60], [14, 9, -10], [34, 9, 10]].map(([x, y, a], i) => <ellipse key={i} cx={x} cy={y} rx="3.6" ry="1.8" transform={`rotate(${a} ${x} ${y})`} />)}</g>;
    case 'antlers': return <g fill="#052e16"><path d="M15 14L6 2l3 9-6-3 8 9zM33 14l9-12-3 9 6-3-8 9z" /><path d="M20 11L16 1l1 8zM28 11l4-10-1 8z" /></g>;
    case 'tubes': return <g fill="none" stroke="#9ca3af" strokeWidth="1.8"><path d="M13 30c-5 1-7 6-6 10" /><path d="M35 30c5 1 7 6 6 10" /></g>;
    // delante
    case 'faceplate': return <path d="M15 19c3-1 6-1.4 9-1.4s6 .4 9 1.4c0 9-3.5 15-9 15s-9-6-9-15z" fill={accent} />;
    case 'web': return <g stroke={INK} strokeWidth=".45" fill="none" opacity=".7"><path d="M24 22V9M24 22L13 14M24 22l11-8M24 22H12M24 22h24M24 22l-10 12M24 22l10 12M24 22v16" /><path d="M18 14q6 3 12 0M15 21q9 4 18 0M16 29q8-4 16 0" /></g>;
    case 'letterA': return <text x="24" y="17.5" textAnchor="middle" fontSize="7" fontWeight="900" fill={accent} fontFamily="Nunito, sans-serif">A</text>;
    case 'capWings': return <g fill={accent}><path d="M12.6 18l-4-3 1 2-2 0 2 2-2 1 4 1z" /><path d="M35.4 18l4-3-1 2 2 0-2 2 2 1-4 1z" /></g>;
    case 'batEars': return <g fill={hood}><path d="M14 15l1.5-10.5 4.5 7z" /><path d="M34 15l-1.5-10.5-4.5 7z" /></g>;
    case 'devilHorns': return <g fill={hood}><path d="M15.5 13.5l-1-5.5 4 3.8z" /><path d="M32.5 13.5l1-5.5-4 3.8z" /></g>;
    case 'boltEars': return <g fill={accent} stroke="#a16207" strokeWidth=".4"><path d="M11 17l-3 3h2l-2 4 4-4h-2l2-3z" /><path d="M37 17l3 3h-2l2 4-4-4h2l-2-3z" /></g>;
    case 'lokiHorns': return <g fill={accent} stroke="#a16207" strokeWidth=".5"><path d="M19 13C16 8 12 5 8 4c3 3 5 7 8 11z" /><path d="M29 13c3-5 7-8 11-9-3 3-5 7-8 11z" /></g>;
    case 'wolverineFins': return <g fill={INK}><path d="M15 20L6 7l3 13z" /><path d="M33 20L42 7l-3 13z" /></g>;
    case 'antennae': return <g stroke="#9ca3af" strokeWidth="1" fill="#9ca3af"><path d="M19 11L15 3M29 11l4-8" fill="none" /><circle cx="15" cy="3" r="1.2" /><circle cx="33" cy="3" r="1.2" /></g>;
    case 'topHat': return <g><rect x="12" y="11" width="24" height="2.5" rx="1" fill={INK} /><rect x="16" y="1" width="16" height="11" rx="1" fill={INK} /><rect x="16" y="9" width="16" height="2" fill={accent} /><circle cx="29" cy="22.2" r="3" fill="none" stroke="#a16207" strokeWidth=".8" /></g>;
    case 'bowler': return <g><path d="M11 14.5h26" stroke="#14532d" strokeWidth="2.4" strokeLinecap="round" /><path d="M15 14c0-6 4-9 9-9s9 3 9 9z" fill="#16a34a" /><text x="24" y="12.5" textAnchor="middle" fontSize="6" fontWeight="900" fill={accent} fontFamily="Nunito, sans-serif">?</text></g>;
    case 'splitFace': return <path d="M24 10c6.8 0 12 5.5 12 14 0 8-5.4 14-12 14z" fill={look.accent ?? '#a78bfa'} opacity={look.hood ? 1 : .85} />;
    case 'sack': return <g><path d="M9 14h30l-5 2H14z" fill="#78350f" /><path d="M14 14c1-7 5-11 10-11s9 4 10 11z" fill="#92400e" /><path d="M18 33l1-2 1 2 1-2 1 2 1-2 1 2 1-2 1 2 1-2 1 2 1-2 1 2" stroke="#3f2a10" strokeWidth=".6" fill="none" /></g>;
    case 'goggles': return <g><path d="M12 22h24" stroke="#374151" strokeWidth="1.6" /><ellipse cx="19" cy="22" rx="4" ry="3" fill="#dc2626" stroke="#374151" /><ellipse cx="29" cy="22" rx="4" ry="3" fill="#dc2626" stroke="#374151" /></g>;
    case 'freezeDome': return <g><ellipse cx="24" cy="22" rx="15" ry="16" fill="#bae6fd55" stroke="#e0f2fe" strokeWidth="1" /><path d="M14 15q3-6 9-7" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" /></g>;
    case 'beard': return <path d="M13 26c1 8 5 13 11 13s10-5 11-13c-2 3-4 4-6 4-1-1.5-3-2-5-2s-4 .5-5 2c-2 0-4-1-6-4z" fill={look.hair?.[1] ?? '#78350f'} />;
    case 'stubble': return <path d="M14 28c2 6 5.5 9 10 9s8-3 10-9c-2 2-5 3-10 3s-8-1-10-3z" fill="#1f2937" opacity=".22" />;
    case 'chinLines': return <path d="M21 33v4M24 33.5v4.5M27 33v4" stroke="#6d28d9" strokeWidth="1" strokeLinecap="round" />;
    case 'magnetoCrest': return <path d="M18 12l6-6 6 6-6-2z" fill={look.costume} />;
    case 'star': return <path d="M24 39.5l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z" fill={accent} />;
    case 'hammer': return <g><rect x="35.5" y="38" width="2" height="9" fill="#78350f" /><rect x="32" y="34" width="9" height="5" rx="1" fill="#9ca3af" stroke="#4b5563" strokeWidth=".6" /></g>;
    case 'tiara': return <g><path d="M15 15.5q9-4 18 0l-1 2q-8-3-16 0z" fill="#facc15" /><path d="M24 12.3l.9 1.8 2 .2-1.5 1.3.4 1.9-1.8-1-1.8 1 .4-1.9-1.5-1.3 2-.2z" fill="#dc2626" /></g>;
    case 'ring': return <g><circle cx="38" cy="42" r="3.4" fill="none" stroke={look.eyeColor && look.eyeColor !== '#fff' ? look.eyeColor : accent === '#facc15' ? accent : '#22c55e'} strokeWidth="1.8" /><circle cx="38" cy="42" r="5.5" fill={accent === '#facc15' ? '#facc1533' : '#22c55e33'} /></g>;
    case 'gem': return <circle cx="24" cy="44" r="2.6" fill="#bae6fd" stroke="#e0f2fe" />;
    case 'shades': return <g fill="#111827"><circle cx="19" cy="22.2" r="3" /><circle cx="29" cy="22.2" r="3" /><path d="M22 22h4" stroke="#111827" strokeWidth="1" /></g>;
    case 'skull': return <g fill="#450a0a"><ellipse cx="19" cy="22" rx="3.6" ry="3.2" /><ellipse cx="29" cy="22" rx="3.6" ry="3.2" /><path d="M24 25l-1.6 3h3.2z" /></g>;
    case 'diamondTattoo': return <path d="M30 25.5l1 1.5-1 1.5-1-1.5z" fill={INK} />;
    case 'stoneFace': return <path d="M16 15l3 4M32 15l-3 4M15 28l3-1M33 28l-3-1M21 12l1 3M27 12l-1 3" stroke="#374151" strokeWidth=".9" strokeLinecap="round" />;
    case 'rhinoHorn': return <path d="M22 13l2-9 2 9z" fill="#e5e7eb" stroke="#6b7280" strokeWidth=".6" />;
    case 'amulet': return <g><circle cx="24" cy="43" r="3" fill="#facc15" /><circle cx="24" cy="43" r="1.5" fill="#22c55e" /></g>;
    case 'cyborgHalf': return <g><path d="M24 10c6.8 0 12 5.5 12 14 0 8-5.4 14-12 14z" fill="#9ca3af" /><circle cx="29" cy="22.2" r="2.2" fill="#ef4444" /><circle cx="29" cy="22.2" r=".8" fill="#fff" /></g>;
    case 'jesterHat': return <g fill={accent}><path d="M11 17C10 9 15 4 24 3c-3 3-4 6-4 9 4-4 9-6 16-5-5 2-8 5-9 10z" /><circle cx="36" cy="7" r="1.6" /></g>;
    default: return null;
  }
}

export function HeroHead({ look }: { look: Look }) {
  const clip = useId();
  const extras = look.extras ?? [];
  const [hoodShape, hoodColor] = look.hood ?? [];
  const covered = hoodShape === 'full' || hoodShape === 'helmet';
  return <svg viewBox="0 0 48 48" aria-hidden="true">
    {extras.filter(e => BACK.includes(e)).map(e => <g key={e}>{extra(e, look)}</g>)}
    {look.hair && !covered && hairBack(look.hair[0], look.hair[1])}
    <path d="M6 48c0-7.5 7.5-11 18-11s18 3.5 18 11z" fill={look.costume} />
    <path d={FACE} fill={look.skin ?? SKIN} />
    {hoodShape === 'full' && <path d={FACE} fill={hoodColor} />}
    {hoodShape === 'helmet' && <path d={HELMET} fill={hoodColor} />}
    {hoodShape === 'cowl' && <path d={COWL} fill={hoodColor} />}
    {look.hair && !covered && hoodShape !== 'cowl' && hairFront(look.hair[0], look.hair[1])}
    {extras.filter(e => !BACK.includes(e) && (e === 'splitFace' || e === 'cyborgHalf')).map(e => <g key={e}>{extra(e, look)}</g>)}
    {hoodShape === 'domino' && <path d={DOMINO} fill={hoodColor} />}
    {look.eyes && !extras.includes('cyborgHalf') ? eyes(look.eyes, look.eyeColor) : look.eyes && <circle cx="19" cy="22.2" r="1.7" fill={INK} />}
    {mouth(look.mouth ?? (covered ? 'none' : 'flat'))}
    {extras.includes('faceplate') && extra('faceplate', look)}
    {look.eyes && extras.includes('faceplate') && eyes(look.eyes, look.eyeColor)}
    {extras.filter(e => !BACK.includes(e) && !['splitFace', 'cyborgHalf', 'faceplate', 'web'].includes(e)).map(e => <g key={e}>{extra(e, look)}</g>)}
    {/* la telaraña queda dentro de la cabeza */}
    {extras.includes('web') && <><clipPath id={clip}><path d={FACE} /></clipPath><g clipPath={`url(#${clip})`}>{extra('web', look)}</g></>}
  </svg>;
}
