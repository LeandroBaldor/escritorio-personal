import { Link } from 'react-router-dom';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunner';
import { cardImage } from './pixelCards';
import { readSolitaireRecord } from './PixelSolitaire';
import { readTikiRecord } from './TikiTaka';
import { formatTime, readTrepaRecord } from './Trepaluna';
import type { Suit } from './solitaire';

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

// Dibujo de la tarjeta del solitario: mesa verde pixelada y cuatro cartas 8 bits en abanico.
function SolitaireArt() {
  const card = (x: number, angle: number, suit: Suit, rank: number) =>
    <image key={`${suit}${rank}`} href={cardImage(suit, rank)} x={x} y="20" width="36" height="49" transform={`rotate(${angle} ${x + 18} 100)`} style={{ imageRendering: 'pixelated' }} />;
  return <svg viewBox="0 0 160 100" aria-hidden="true" shapeRendering="crispEdges">
    <defs><pattern id="pasto" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#166534" /><rect width="2" height="2" fill="#15803d" /><rect x="2" y="2" width="2" height="2" fill="#15803d" /></pattern></defs>
    <rect width="160" height="100" fill="url(#pasto)" />
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

// Dibujo de la tarjeta de Trepaluna: cielo que pasa de día al espacio, estructuras y la Luna arriba.
function TrepalunaArt() {
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs><linearGradient id="trepa-cielo" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#9fd4fb" /><stop offset=".55" stopColor="#3563c9" /><stop offset="1" stopColor="#070a1f" /></linearGradient></defs>
    <rect width="160" height="100" fill="url(#trepa-cielo)" />
    {[[18, 14], [44, 8], [96, 18], [140, 10], [70, 22], [122, 26]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" fill="#fff" />)}
    <circle cx="128" cy="16" r="11" fill="#e7e5d8" /><circle cx="124" cy="13" r="2.4" fill="#c9c6b4" /><circle cx="132" cy="20" r="1.8" fill="#c9c6b4" />
    <g fill="#fff" opacity=".9"><ellipse cx="34" cy="50" rx="16" ry="5" /><ellipse cx="30" cy="46" rx="7" ry="5" /><ellipse cx="38" cy="45" rx="8" ry="6" /></g>
    <rect x="0" y="94" width="160" height="6" fill="#4ade80" />
    <rect x="18" y="80" width="30" height="4" fill="#ea580c" />
    <path d="M66 70q16 5 32 0" stroke="#b7792f" strokeWidth="3" fill="none" />
    <rect x="104" y="58" width="14" height="3" fill="#2563eb" /><path d="M106 61l-2 5M116 61l2 5" stroke="#334155" strokeWidth="1.5" />
    <path d="M86 28v26" stroke="#a16207" strokeWidth="1.6" />
    <g transform="translate(78 54)">
      <path d="M2 10 0 16M6 10 8 16" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="0" y="4" width="8" height="7" rx="1.5" fill="#ef4444" />
      <circle cx="4" cy="2" r="3.2" fill="#fcd9b6" /><path d="M0.6 1.4a3.4 3.4 0 0 1 6.8 0z" fill="#2563eb" />
    </g>
  </svg>;
}

export function Games() {
  const record = readRecord();
  const solitaire = readSolitaireRecord();
  const tiki = readTikiRecord();
  const trepa = readTrepaRecord();
  return <section>
    <div className="section-title">
      <div><p className="eyebrow">Para cortar un rato</p><h1>Juegos</h1></div>
      <SectionObjects large><DeskLink /><NotebookLink /><CalculatorLink /><CalendarLink /></SectionObjects>
    </div>
    <ul className="games-list">
      <li>
        <Link className="game-card" to="/juegos/bloques">
          <BlockRunnerArt />
          <span className="game-card-text">
            <strong>¡Cuidado, bloques!</strong>
            <span>Caen piezas de tetris y bombas desde arriba: corré y saltá para que no te aplasten.</span>
            {record > 0 && <small>Récord: {record} puntos</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--pix" to="/juegos/solitario">
          <SolitaireArt />
          <span className="game-card-text">
            <strong>Solitario 8 bits</strong>
            <span>El solitario de siempre con cartas pixeladas, como en las consolas viejas.</span>
            {solitaire && <small>Récord: {Math.floor(solitaire.seconds / 60)}:{String(solitaire.seconds % 60).padStart(2, '0')}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--tt" to="/juegos/futbol">
          <TikiTakaArt />
          <span className="game-card-text">
            <strong>Tiki-Taka</strong>
            <span>Armá tu equipo, elegí la formación y tocá, tocá y tocá hasta el gol. Si te la roban, ¡a atajar el contraataque!</span>
            {tiki.played > 0 && <small>Campaña: {tiki.won}G {tiki.drawn}E {tiki.lost}P</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--trepa" to="/juegos/trepaluna">
          <TrepalunaArt />
          <span className="game-card-text">
            <strong>Trepaluna</strong>
            <span>Saltá por vigas, puentes, trampolines y sogas, pasá las nubes y el espacio, y llegá a la Luna lo más rápido que puedas.</span>
            {trepa > 0 && <small>Récord: {formatTime(trepa)}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
    </ul>
  </section>;
}
