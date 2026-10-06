import { Link } from 'react-router-dom';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunner';
import { cardImage } from './futureCards';
import { readSolitaireRecord } from './PixelSolitaire';
import { readTikiRecord } from './TikiTaka';
import { formatTime, readTrepaRecord } from './Trepaluna';
import { readSnakeRecord } from './ReverseSnake';
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

export function Games() {
  const record = readRecord();
  const solitaire = readSolitaireRecord();
  const tiki = readTikiRecord();
  const trepa = readTrepaRecord();
  const snake = readSnakeRecord();
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
            {record > 0 && <small>Récord: {record} puntos</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--fut" to="/juegos/solitario">
          <SolitaireArt />
          <span className="game-card-text">
            <strong>Solitario 3.000</strong>
            <span>Jugá al solitario del futuro: ¡mientras más rápido lo completes, más puntos tenés!</span>
            {solitaire && <small>Récord: {solitaire.score !== undefined ? `${solitaire.score} puntos` : `${Math.floor(solitaire.seconds / 60)}:${String(solitaire.seconds % 60).padStart(2, '0')}`}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--tt" to="/juegos/futbol">
          <TikiTakaArt />
          <span className="game-card-text">
            <strong>Tiki-Taka</strong>
            <span>Elegí tu equipo, formación y tu nombre de DT. Seleccioná al jugador al que le querés dar el pase y después, ¡tocá y tocá hasta llegar al área del rival!</span>
            {tiki.played > 0 && <small>Campaña: {tiki.won}G {tiki.drawn}E {tiki.lost}P{tiki.cups ? ` · 🏆 ${tiki.cups}` : ''}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--trepa" to="/juegos/trepaluna">
          <TrepalunaArt />
          <span className="game-card-text">
            <strong>Trepaluna</strong>
            <span>Escalá edificios, escaleras, sogas y muchos desafíos más por un solo objetivo: ¡llegar a la Luna!</span>
            {trepa.height > 0 && <small>Récord: {trepa.time !== null ? `Luna en ${formatTime(trepa.time)}` : `${trepa.height.toLocaleString('es-AR')} metros`}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
      <li>
        <Link className="game-card game-card--snk" to="/juegos/serpiente">
          <ReverseSnakeArt />
          <span className="game-card-text">
            <strong>¡Huye de la serpiente!</strong>
            <span>El viborita de siempre, pero vos sos la manzana: sumá puntos agarrando las bolitas blancas y escapá de la serpiente, que crece cada vez que se come una manzana verde.</span>
            {snake > 0 && <small>Récord: {snake} puntos</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
    </ul>
  </section>;
}
