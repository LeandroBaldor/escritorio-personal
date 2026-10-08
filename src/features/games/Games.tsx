import { Link } from 'react-router-dom';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunner';
import { cardImage } from './futureCards';
import { readSolitaireRecord } from './PixelSolitaire';
import { readTikiRecord } from './TikiTaka';
import { formatTime, readTrepaRecord } from './Trepaluna';
import { readSnakeRecord } from './ReverseSnake';
import { formatLavaTime, readLavaRecord } from './LavaFloor';
import { formatSharkTime, readSharkRecord } from './SharkCity';
import type { Suit } from './solitaire';
import memeJigsaw from '../../assets/images/meme-jigsaw.jpg';

// Dibujo chiquito del juego para la tarjeta: piezas cayendo y el personaje abajo.
function BlockRunnerArt() {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <rect width="160" height="100" fill="#1d1a44" />
    <g stroke="#0003" strokeWidth="1">
      <rect x="20" y="8" width="12" height="12" fill="#38bdf8" /><rect x="32" y="8" width="12" height="12" fill="#38bdf8" /><rect x="44" y="8" width="12" height="12" fill="#38bdf8" /><rect x="56" y="8" width="12" height="12" fill="#38bdf8" />
      <rect x="104" y="26" width="12" height="12" fill="#a855f7" /><rect x="116" y="26" width="12" height="12" fill="#a855f7" /><rect x="128" y="26" width="12" height="12" fill="#a855f7" /><rect x="116" y="38" width="12" height="12" fill="#a855f7" />
      <rect x="0" y="76" width="12" height="12" fill="#22c55e" /><rect x="12" y="76" width="12" height="12" fill="#22c55e" /><rect x="0" y="88" width="12" height="12" fill="#22c55e" /><rect x="12" y="88" width="12" height="12" fill="#facc15" /><rect x="24" y="88" width="12" height="12" fill="#facc15" />
      <rect x="124" y="88" width="12" height="12" fill="#f97316" /><rect x="136" y="88" width="12" height="12" fill="#f97316" /><rect x="148" y="88" width="12" height="12" fill="#f97316" /><rect x="148" y="76" width="12" height="12" fill="#f97316" />
    </g>
    <g transform="translate(76 84)">
      <path d="M2 10 0 16M6 10 8 16" stroke="#e2e8f0" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="0" y="4" width="8" height="7" rx="1.5" fill="#ef4444" />
      <circle cx="4" cy="2" r="3.2" fill="#fcd9b6" />
    </g>
  </svg>;
}

// Dibujo de la tarjeta del solitario: mesa futurista con grilla de neón y cuatro cartas en abanico.
function SolitaireArt() {
  const card = (x: number, angle: number, suit: Suit, rank: number) =>
    <image key={`${suit}${rank}`} href={cardImage(suit, rank)} x={x} y="20" width="36" height="49" transform={`rotate(${angle} ${x + 18} 100)`} />;
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs>
      <pattern id="grilla-neon" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#22d3ee" strokeOpacity=".25" strokeWidth=".6" /></pattern>
      <radialGradient id="luz-neon" cx=".5" cy=".7" r=".7"><stop offset="0" stopColor="#22c55e" stopOpacity=".35" /><stop offset="1" stopColor="#22c55e" stopOpacity="0" /></radialGradient>
    </defs>
    <rect width="160" height="100" fill="#050816" /><rect width="160" height="100" fill="url(#grilla-neon)" /><rect width="160" height="100" fill="url(#luz-neon)" />
    {card(24, -16, 'pica', 1)}{card(50, -5, 'corazon', 13)}{card(76, 6, 'diamante', 12)}{card(100, 17, 'trebol', 11)}
  </svg>;
}

// Dibujo de la tarjeta del fútbol: cancha rayada, jugadores y la cadena de pases hasta el gol.
function TikiTakaArt() {
  const passes = [[30, 70], [58, 40], [86, 62], [112, 34], [150, 50]];
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    {Array.from({ length: 8 }, (_, i) => <rect key={i} x={i * 20} width="20" height="100" fill={i % 2 ? '#2f9e44' : '#37b24d'} />)}
    <g stroke="#ffffffcc" strokeWidth="1.4" fill="none"><rect x="4" y="6" width="152" height="88" /><path d="M80 6v88" /><circle cx="80" cy="50" r="13" /><rect x="128" y="28" width="28" height="44" /></g>
    <rect x="156" y="40" width="4" height="20" fill="#ffffff55" stroke="#fff" strokeWidth="1" />
    <polyline points={passes.map(p => p.join(',')).join(' ')} fill="none" stroke="#fde047" strokeWidth="2" strokeDasharray="4 3" />
    {passes.slice(0, 4).map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.2" /><text x={x} y={y + 2.4} textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#0f172a" fontFamily="Nunito, sans-serif">{[5, 8, 10, 9][i]}</text></g>)}
    {[[46, 60], [74, 50], [100, 46], [130, 58]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" fill="#f8fafc" stroke="#475569" strokeWidth="1.2" />)}
    <circle cx="150" cy="50" r="3.2" fill="#fff" stroke="#111827" strokeWidth="1" />
  </svg>;
}

// Dibujo de la tarjeta de Trepaluna: edificios a los costados, balcones, escalera, caño de fuego y la Luna con su banderín.
function TrepalunaArt() {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs><linearGradient id="trepa-cielo" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#a8d8ff" /><stop offset=".5" stopColor="#4b8fe0" /><stop offset="1" stopColor="#0b1026" /></linearGradient></defs>
    <rect width="160" height="100" fill="url(#trepa-cielo)" />
    {[[60, 8], [84, 14], [100, 6], [48, 18], [118, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r=".9" fill="#fff" />)}
    <circle cx="80" cy="-6" r="20" fill="#e7e5d8" /><circle cx="73" cy="4" r="3" fill="#c9c6b4" /><path d="M86 14V3" stroke="#e2e8f0" strokeWidth="1.2" /><path d="M86.6 3l8 2.5-8 2.5z" fill="#ef4444" />
    <rect x="0" y="22" width="30" height="78" fill="#b4532a" /><rect x="130" y="34" width="30" height="66" fill="#6d8fb5" />
    {[30, 44, 58, 72, 86].map(y => <g key={y}><rect x="5" y={y} width="7" height="8" fill="#fde68a" /><rect x="17" y={y} width="7" height="8" fill="#1e3a5f" /></g>)}
    {[42, 56, 70, 84].map(y => <g key={y}><rect x="136" y={y} width="7" height="8" fill="#1e3a5f" /><rect x="148" y={y} width="7" height="8" fill="#fde68a" /></g>)}
    <rect x="30" y="66" width="18" height="3" fill="#a8693a" /><path d="M30 61h18M33 61v5M38 61v5M43 61v5M48 61v5" stroke="#111827" strokeWidth=".9" />
    <rect x="112" y="50" width="18" height="3" fill="#a8693a" /><path d="M112 45h18M115 45v5M120 45v5M125 45v5M130 45v5" stroke="#111827" strokeWidth=".9" />
    <path d="M64 92V40M72 92V40" stroke="#dc2626" strokeWidth="1.5" />{[44, 50, 56, 62, 68, 74, 80, 86].map(y => <path key={y} d={`M64 ${y}h8`} stroke="#fca5a5" strokeWidth="1.2" />)}
    <rect x="58" y="38" width="24" height="3" fill="#ea580c" />
    <rect x="88" y="78" width="26" height="3" fill="#ea580c" /><rect x="98" y="73" width="6" height="5" fill="#4b5563" /><path d="M101 73c-4-6 3-9 0-17 5 6 4 11 0 17z" fill="#f97316" /><path d="M101 73c-2-4 2-6 0-10 3 4 2 7 0 10z" fill="#fde047" />
    <rect x="88" y="58" width="14" height="5" fill="#f59e0b" /><text x="95" y="62.3" fontSize="4.5" fontWeight="900" textAnchor="middle" fill="#92400e">?</text>
    <rect x="0" y="94" width="160" height="6" fill="#3f4249" />
    <g transform="translate(64 26)">
      <path d="M2 10 0 16M6 10 8 16" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="0" y="4" width="8" height="7" rx="1.5" fill="#ef4444" />
      <circle cx="4" cy="2" r="3.2" fill="#fcd9b6" /><path d="M0.6 1.4a3.4 3.4 0 0 1 6.8 0z" fill="#2563eb" />
      <path d="M1 5-1.5 1M7 5l2.5-4" stroke="#fcd9b6" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  </svg>;
}

// Dibujo de la tarjeta de ¡Huye de la serpiente!: jardín a cuadros, la serpiente violeta persiguiendo y la manzana escapando.
function ReverseSnakeArt() {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    {Array.from({ length: 80 }, (_, i) => <rect key={i} x={(i % 10) * 16} y={Math.floor(i / 10) * 12.5} width="16" height="12.5" fill={(i % 10 + Math.floor(i / 10)) % 2 ? '#4ade80' : '#22c55e'} />)}
    <path d="M20 88H56V62H88V38H112" fill="none" stroke="#00000030" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" transform="translate(2 2)" />
    <path d="M20 88H56V62H88V38H112" fill="none" stroke="#15803d" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 88H56V62H88V38H112" fill="none" stroke="#bef264" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    {[[30, 88], [56, 75], [72, 62], [88, 50]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2" fill="#14532d" opacity=".6" />)}
    {[[8, 6], [40, 6], [72, 18], [104, 6], [136, 66], [104, 82], [136, 92], [8, 44], [24, 56], [40, 30], [120, 18], [152, 56]].map(([x, y], i) => <circle key={`p${i}`} cx={x} cy={y} r="3" fill="#fff" />)}
    <ellipse cx="115" cy="38" rx="10" ry="8" fill="#16a34a" stroke="#14532d" strokeWidth="1.5" /><circle cx="117" cy="34" r="2.6" fill="#fde047" /><circle cx="117" cy="42" r="2.6" fill="#fde047" /><ellipse cx="117.6" cy="34" rx=".7" ry="1.9" fill="#111" /><ellipse cx="117.6" cy="42" rx=".7" ry="1.9" fill="#111" />
    <path d="M123 38h6l3-2M129 38l3 2" stroke="#e11d48" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    <g transform="translate(140 30)">
      <path d="M-4 9-5 14M4 9 5 14" stroke="#7c2d12" strokeWidth="1.8" strokeLinecap="round" />
      <ellipse cx="-3" cy="2" rx="6.5" ry="8" fill="#ef4444" /><ellipse cx="3" cy="2" rx="6.5" ry="8" fill="#ef4444" />
      <path d="M0-6Q1-9 2-11" stroke="#78350f" strokeWidth="1.6" fill="none" /><ellipse cx="4.5" cy="-9" rx="4" ry="1.8" fill="#16a34a" transform="rotate(-25 4.5 -9)" />
      <circle cx="-2.5" cy="0" r="2.2" fill="#fff" /><circle cx="3" cy="0" r="2.2" fill="#fff" /><circle cx="-2" cy="0.3" r="1" fill="#111" /><circle cx="3.5" cy="0.3" r="1" fill="#111" /><ellipse cx="0.5" cy="5" rx="1.6" ry="1.4" fill="#450a0a" />
    </g>
    <g transform="translate(124 76)"><ellipse cx="-2.2" cy="0" rx="4.4" ry="5.4" fill="#84cc16" /><ellipse cx="2.2" cy="0" rx="4.4" ry="5.4" fill="#84cc16" /><path d="M0-4.5 1-8" stroke="#78350f" strokeWidth="1.2" /><ellipse cx="3" cy="-7" rx="2.6" ry="1.2" fill="#15803d" /></g>
  </svg>;
}

// Dibujo de la tarjeta de ¡El piso es de lava!: edificios cortados con habitaciones, la lava subiendo,
// el personaje saltando entre dos edificios y el helicóptero arriba de la torre.
function LavaArt() {
  const rooms = (x: number, w: number, floors: number, fh: number, hue: number) => Array.from({ length: floors }, (_, k) => {
    const y = 100 - (k + 1) * fh;
    return <g key={k}>
      <rect x={x} y={y} width={w} height={fh} fill={`hsl(${(hue + k * 40) % 360} 35% 72%)`} />
      <rect x={x} y={y + fh - 1.5} width={w} height="1.5" fill="#9ca3af" />
      {k % 2 ? <rect x={x + w * 0.2} y={y + fh * 0.25} width={w * 0.22} height={fh * 0.35} fill="#7c2d12" stroke="#6b4423" strokeWidth=".8" /> : <rect x={x + w * 0.55} y={y + fh * 0.55} width={w * 0.32} height={fh * 0.3} rx="1.5" fill={`hsl(${(hue + 180) % 360} 45% 45%)`} />}
    </g>;
  });
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs>
      <linearGradient id="lava-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1c1020" /><stop offset=".6" stopColor="#4a1d1a" /><stop offset="1" stopColor="#b4461c" /></linearGradient>
      <linearGradient id="lava-hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fde047" /><stop offset=".15" stopColor="#f97316" /><stop offset="1" stopColor="#7f1d1d" /></linearGradient>
    </defs>
    <rect width="160" height="100" fill="url(#lava-sky)" />
    {rooms(6, 34, 4, 15, 20)}
    {rooms(48, 30, 3, 17, 200)}
    {rooms(88, 42, 6, 14, 120)}
    <rect x="130" y="16" width="3" height="84" fill="#57534e" />
    <path d="M60 52 l-6 -10 M64 50 l4 -9" stroke="#1c1917" strokeWidth=".8" fill="none" />
    <g>
      <path d="M100 56 q3 -9 6 0 q3 -7 6 0z" fill="#f97316" /><path d="M103 56 q2 -5 4 0z" fill="#fde047" />
    </g>
    <g transform="translate(104 6)">
      <ellipse cx="10" cy="6" rx="10" ry="5" fill="#dc2626" /><ellipse cx="5" cy="5" rx="4" ry="3" fill="#bae6fd" />
      <path d="M17 5 h12 v3 h-12z" fill="#b91c1c" /><rect x="-4" y="0" width="28" height="1.5" fill="#1f2937" />
      <path d="M2 11 h14 M5 9 v2 M13 9 v2" stroke="#1f2937" strokeWidth="1.2" />
    </g>
    <g transform="translate(40 30)">
      <rect x="-2" y="2" width="5" height="5" rx="1" fill="#1d4ed8" /><rect x="-2" y="4" width="5" height="1.6" fill="#facc15" />
      <circle cx=".5" cy="0" r="2" fill="#fcd9b6" /><path d="M-1.5 -.6 a2 2 0 0 1 4 0z" fill="#2563eb" />
      <path d="M-1 7 l-2 3 M2 7 l2 3" stroke="#f8fafc" strokeWidth="1.3" />
    </g>
    <path d="M0 84 Q20 79 40 84 T80 84 T120 84 T160 84 V100 H0z" fill="url(#lava-hot)" />
    {[[18, 80], [70, 81], [125, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#fde047" />)}
  </svg>;
}

// Dibujo de la tarjeta de Ciudad Tiburón: la calle inundada entre edificios bajo la tormenta, un rayo, y un
// tiburón que salta del agua con la boca abierta y el bombero entre los dientes; aletas y un perrito en una goma.
const TIB_BODY = 'M22 .9C22.7-2.2 20.2-6.2 14.1-7.5C8.8-8.6 2.2-8.8-2.6-8.4C-9.7-7.5-15.4-3.3-18.9-1.3L-19.6 0L-18.9 1.3C-14.1 3.3-7.9 6.2-.9 6.8C4.4 7.3 6.6 6.8 8.8 4.2L21.1 2.2C22 2 22.2 1.5 22 .9Z';
const TIB_UPPER_TEETH = 'M8.9 4.1L9.4 5.7L10.1 4.1M10.3 3.9L10.8 5.8L11.5 3.9M11.6 3.6L12.1 5.8L12.8 3.6M13.0 3.4L13.5 5.8L14.2 3.4M14.4 3.2L14.9 5.6L15.6 3.2M15.7 3.0L16.2 5.3L16.9 3.0M17.1 2.8L17.6 4.9L18.3 2.8M18.5 2.5L19.0 4.4L19.7 2.5M19.8 2.3L20.3 3.9L21.0 2.3';
const TIB_LOWER_TEETH = 'M8.9 4.3L10.4 3.9L9.6 5.3M9.9 5.5L11.6 4.9L10.6 6.5M10.8 6.8L12.8 6.0L11.6 7.7M11.8 8.0L13.9 7.1L12.5 8.9M12.7 9.2L14.8 8.3L13.5 10.1M13.7 10.4L15.7 9.6L14.4 11.3M14.6 11.6L16.4 10.9L15.4 12.5M15.6 12.8L17.1 12.4L16.3 13.7';
function SharkArt() {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs>
      <linearGradient id="tib-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070b16" /><stop offset="1" stopColor="#2c3b50" /></linearGradient>
      <linearGradient id="tib-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e5866" /><stop offset="1" stopColor="#061820" /></linearGradient>
      <linearGradient id="tib-skin" x1="0" y1="-9" x2="0" y2="7" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#2c4f56" /><stop offset=".35" stopColor="#3f6c74" /><stop offset=".55" stopColor="#7fb0b4" /><stop offset=".7" stopColor="#3f6c74" /></linearGradient>
      <clipPath id="tib-clip"><path d={TIB_BODY} /></clipPath>
    </defs>
    <rect width="160" height="100" fill="url(#tib-sky)" />
    {[[0, 30, 8], [10, 18, 6], [20, 40, 7], [118, 22, 9], [130, 36, 7], [142, 14, 10], [60, 46, 8], [86, 40, 7]].map(([x, y, w], i) => <rect key={i} x={x} y={y} width={w} height={100 - y} fill="#141d2c" />)}
    <path d="M70 0 l-5 14 l6 -2 l-7 18 M66 12 l-6 9" stroke="#e0e7ff" strokeWidth="1.6" fill="none" />
    <rect x="4" y="24" width="38" height="76" fill="#3f4a5c" />
    {[0, 1, 2, 3, 4].map(r => [0, 1, 2].map(c => <rect key={`${r}-${c}`} x={8 + c * 11} y={30 + r * 11} width="6" height="7" fill={(r + c) % 3 ? '#1e3a5f' : '#fcd34d'} />))}
    <g stroke="#475569" strokeWidth="1"><path d="M42 50 h9 M42 66 h9 M47 50 v32" /><path d="M45 54 h4 M45 58 h4 M45 62 h4 M45 70 h4 M45 74 h4 M45 78 h4" /></g>
    <rect x="112" y="40" width="44" height="60" fill="#b45309" />
    <path d="M104 62 l8 -4 v6z" fill="#dc2626" /><path d="M104 62 h8 v2 h-8z" fill="#fef2f2" />
    <rect x="114" y="52" width="40" height="6" fill="#7c2d12" /><text x="134" y="56.8" fontSize="4.6" fontWeight="900" fill="#fef3c7" textAnchor="middle">FARMACIA</text>
    <path d="M42 46 Q77 50 112 46" stroke="#0f172a" strokeWidth="1" fill="none" />
    {/* El tiburón saltando: cola, aletas, cuerpo con panza clara, boca abierta y ojo. */}
    <g transform="translate(80 63) rotate(-50)" stroke="#0f172a" strokeWidth=".35" strokeLinejoin="round">
      <path d="M-18.5-1 C-21-4-23-8-25.5-12 C-24.5-7-24-3-23.2 0 C-24.3 2.5-25.5 5-27 7.5 C-23.5 5-21 3-18.5 1Z" fill="#2c4f56" />
      <path d="M4-8 C2-11-1-14.5-4.6-17.2 C-3.6-13-3.8-10-5.8-7.2Z" fill="#2c4f56" />
      <path d={TIB_BODY} fill="url(#tib-skin)" />
      <g clipPath="url(#tib-clip)" stroke="none"><path d="M23 1.5 L18 2.4 L15 1.4 L11 2.6 L7 1.6 L3 2.8 L-1 1.8 L-5 2.8 L-9 1.6 L-13 2.4 L-20 .6 V10 H23Z" fill="#e9efe9" /></g>
      <path d="M5 5 C3 8 0 11.5-3.5 14.5 C-2 10.5-.5 8 .8 5.6Z" fill="#2c4f56" />
      <path d="M7-4.5 Q6.2 0 7 3.6 M5.6-4.6 Q4.8 0 5.6 3.8 M4.2-4.7 Q3.4 0 4.2 4" fill="none" strokeWidth=".4" />
      <path d="M8.8 4.2 L21.1 2.2 L16.4 13.9Z" fill="#3b0707" />
      <path d="M8.8 4.2 L16.4 13.9 L14.6 15.2 C11.5 13 9.5 9 8.8 4.2Z" fill="#e9efe9" />
      <circle cx="15.6" cy="-3" r="1.4" fill="#111" stroke="none" /><circle cx="15.6" cy="-3" r="1.05" fill="#f2c94c" stroke="none" /><ellipse cx="15.8" cy="-3" rx=".35" ry=".85" fill="#050505" stroke="none" />
      <path d="M12.5-5.6 L17.6-3.6 L17.3-4.9Z" fill="#2c4f56" stroke="none" />
      <path d={TIB_UPPER_TEETH} fill="#fffdf7" stroke="#78716c" strokeWidth=".15" />
    </g>
    {/* El bombero entre los dientes, pataleando (los de arriba quedan atrás y los de abajo adelante). */}
    <g transform="translate(95 54) rotate(22) scale(.9)">
      <path d="M-1 3 l-2 4 M1.5 3 l2.5 3.5" stroke="#1f2937" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="-2.5" y="-3" width="5" height="6.5" rx="1" fill="#1f2937" /><rect x="-2.5" y="0.6" width="5" height="1" fill="#d9f99d" />
      <path d="M-2.2 -2 l-3 -3.5 M2.2 -2 l2.8 -3.8" stroke="#1f2937" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="-5.3" cy="-5.6" r=".9" fill="#facc15" /><circle cx="5.1" cy="-6" r=".9" fill="#facc15" />
      <circle cx=".3" cy="-5.2" r="2" fill="#fcd9b6" /><circle cx="1.4" cy="-5.1" r=".35" fill="#111" />
      <path d="M-1.9 -5.9 a2.3 2.3 0 0 1 4.4 -.3z" fill="#dc2626" /><path d="M-1.6 -6 h5.2" stroke="#dc2626" strokeWidth=".9" strokeLinecap="round" />
    </g>
    <g transform="translate(80 63) rotate(-50)"><path d={TIB_LOWER_TEETH} fill="#fffdf7" stroke="#78716c" strokeWidth=".15" /></g>
    <path d="M0 84 Q20 81 40 84 T80 84 T120 84 T160 84 V100 H0z" fill="url(#tib-water)" />
    <path d="M0 84 Q20 81 40 84 T80 84 T120 84 T160 84" stroke="#bae6fd" strokeWidth=".7" fill="none" />
    {/* La salpicadura del salto. */}
    {[[56, 80, 1.6], [60, 76, 1.2], [64, 73, 1.4], [70, 75, 1.1], [74, 79, 1.5], [52, 83, 1.2], [78, 83, 1.3], [66, 78, 1], [58, 70, 0.8], [72, 70, 0.9]].map(([x, y, r], i) => <circle key={`s${i}`} cx={x} cy={y} r={r} fill="#f1f5f9" opacity=".9" />)}
    <ellipse cx="66" cy="84" rx="14" ry="1.6" fill="#f1f5f9" opacity=".8" />
    <path d="M30 84 l6 -9 l3 9z M126 85 l3 -5 l2 5z" fill="#64748b" />
    <path d="M22 84 h-8" stroke="#e2e8f0" strokeWidth=".7" />
    <g transform="translate(144 84)"><ellipse cx="0" cy="1" rx="5" ry="1.8" fill="#ea580c" /><ellipse cx="0" cy="-2" rx="2.6" ry="1.6" fill="#92400e" /><circle cx="2.6" cy="-4" r="1.5" fill="#92400e" /><circle cx="3.2" cy="-4.2" r=".35" fill="#111" /></g>
    {[[20, 10], [50, 20], [100, 8], [140, 30], [10, 60], [120, 70]].map(([x, y], i) => <path key={i} d={`M${x} ${y} l2 5`} stroke="#cbd5e1" strokeWidth=".5" opacity=".7" />)}
  </svg>;
}

export function Games() {
  const record = readRecord();
  const solitaire = readSolitaireRecord();
  const tiki = readTikiRecord();
  const trepa = readTrepaRecord();
  const snake = readSnakeRecord();
  const lava = readLavaRecord();
  const shark = readSharkRecord();
  return <section>
    <div className="section-title games-title">
      <div className="games-heading"><p className="eyebrow">Para cortar un rato</p><h1>Juegos</h1></div>
      <div className="games-art" aria-hidden="true"><img src={memeJigsaw} alt="" width={1200} height={666} draggable={false} /></div>
      <SectionObjects large><DeskLink /><NotebookLink /><CalculatorLink /><CalendarLink /></SectionObjects>
    </div>
    <ul className="games-list">
      <li>
        <Link className="game-card" to="/juegos/bloques">
          <BlockRunnerArt />
          <span className="game-card-text">
            <strong>¡Cuidado, bloques!</strong>
            <span>Caen piezas de Tetris y bombas: corré y saltá para que no te aplasten. Llegá al nivel 10 para ganar.</span>
          </span>
          {/* El récord va siempre en el mismo lugar: abajo, a la izquierda de Jugar. */}
          <span className="game-card-foot">
            {record > 0 && <small><b>Récord</b>{record} puntos</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--fut" to="/juegos/solitario">
          <SolitaireArt />
          <span className="game-card-text">
            <strong>Solitario 3.000</strong>
            <span>Jugá al solitario del futuro: ¡mientras más rápido lo completes, más puntos tenés!</span>
          </span>
          <span className="game-card-foot">
            {solitaire && <small><b>Récord</b>{solitaire.score !== undefined ? `${solitaire.score} puntos` : `${Math.floor(solitaire.seconds / 60)}:${String(solitaire.seconds % 60).padStart(2, '0')}`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--tt" to="/juegos/futbol">
          <TikiTakaArt />
          <span className="game-card-text">
            <strong>Tiki-Taka</strong>
            <span>Elegí tu equipo, formación y tu nombre de DT. Seleccioná al jugador al que le querés dar el pase y después, ¡tocá y tocá hasta llegar al área del rival!</span>
          </span>
          <span className="game-card-foot">
            {tiki.played > 0 && <small><b>Campaña</b>{tiki.won}G {tiki.drawn}E {tiki.lost}P{tiki.cups ? ` · 🏆 ${tiki.cups}` : ''}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--trepa" to="/juegos/trepaluna">
          <TrepalunaArt />
          <span className="game-card-text">
            <strong>Trepaluna</strong>
            <span>Escalá edificios, escaleras, sogas y muchos desafíos más por un solo objetivo: ¡llegar a la Luna!</span>
          </span>
          <span className="game-card-foot">
            {trepa.height > 0 && <small><b>Récord</b>{trepa.time !== null ? `Luna en ${formatTime(trepa.time)}` : `${trepa.height.toLocaleString('es-AR')} metros`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--snk" to="/juegos/serpiente">
          <ReverseSnakeArt />
          <span className="game-card-text">
            <strong>¡Huye de la serpiente!</strong>
            <span>El viborita de siempre, pero vos sos la manzana: sumá puntos agarrando las bolitas blancas y escapá de la serpiente, que crece cada vez que se come una manzana verde.</span>
          </span>
          <span className="game-card-foot">
            {snake > 0 && <small><b>Récord</b>{snake} puntos</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--lava" to="/juegos/lava">
          <LavaArt />
          <span className="game-card-text">
            <strong>¡El piso es de lava!</strong>
            <span>¡La lava sube y no para! Subí lo más rápido que puedas para sobrevivir: saltá de edificio en edificio, esquivá el fuego y los cortocircuitos y tomá buenas decisiones para llegar al helicóptero antes de que la lava te alcance.</span>
          </span>
          <span className="game-card-foot">
            {lava.height > 0 && <small><b>Récord</b>{lava.time !== null ? `🚁 en ${formatLavaTime(lava.time)}` : `${lava.height} metros`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--tib" to="/juegos/tiburon">
          <SharkArt />
          <span className="game-card-text">
            <strong>Ciudad Tiburón</strong>
            <span>La ciudad se inundó y el agua está llena de tiburones. Sos bombero: saltá por techos, balcones, cables y autos tapados por el agua y rescatá 20 perritos, gatos y personas antes de que se termine el tiempo… ¡y antes de que salten los tiburones!</span>
          </span>
          <span className="game-card-foot">
            {shark.saved > 0 && <small><b>Récord</b>{shark.time !== null ? `🏆 en ${formatSharkTime(shark.time)}` : `${shark.saved} rescatados`}</small>}
            <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
          </span>
        </Link>
      </li>
    </ul>
  </section>;
}
