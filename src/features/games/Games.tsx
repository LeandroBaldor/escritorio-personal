import { Link } from 'react-router-dom';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunner';
import { readSolitaireRecord, SuitIcon } from './CinemaSolitaire';

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

// Dibujo de la tarjeta del solitario: telón rojo, cartas en abanico y un balde de palomitas.
function SolitaireArt() {
  const card = (x: number, angle: number, rank: string, suit: 'estrella' | 'claqueta' | 'rollo', red: boolean) =>
    <g transform={`rotate(${angle} ${x + 16} 92)`}>
      <rect x={x} y="30" width="32" height="46" rx="3" fill="#fffaf0" stroke="#d6c7a1" />
      <text x={x + 4} y="41" fontSize="9" fontWeight="900" fill={red ? '#dc2626' : '#111827'} fontFamily="Nunito, sans-serif">{rank}</text>
      <SuitIcon suit={suit} x={x + 7} y={47} size={18} />
    </g>;
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs><linearGradient id="telon" x1="0" x2="1"><stop offset="0" stopColor="#7f1d1d" /><stop offset=".5" stopColor="#b91c1c" /><stop offset="1" stopColor="#7f1d1d" /></linearGradient></defs>
    <rect width="160" height="100" fill="#1c0a0a" />
    <path d="M0 0h40c-6 30-4 70 6 100H0z" fill="url(#telon)" /><path d="M160 0h-40c6 30 4 70-6 100h46z" fill="url(#telon)" />
    <rect width="160" height="10" fill="#991b1b" /><path d="M0 10h160" stroke="#facc15" strokeWidth="1.5" />
    <ellipse cx="80" cy="96" rx="58" ry="7" fill="#facc1522" />
    {card(48, -16, 'K', 'claqueta', false)}{card(64, 0, 'A', 'estrella', true)}{card(80, 16, '7', 'rollo', false)}
    <SuitIcon suit="palomitas" x={112} y={60} size={32} />
  </svg>;
}

export function Games() {
  const record = readRecord();
  const solitaire = readSolitaireRecord();
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
        <Link className="game-card game-card--cine" to="/juegos/solitario">
          <SolitaireArt />
          <span className="game-card-text">
            <strong>Solitario de cine</strong>
            <span>El solitario de siempre con cartas de cine: palomitas, estrellas, claquetas y rollos de película.</span>
            {solitaire && <small>Récord: {Math.floor(solitaire.seconds / 60)}:{String(solitaire.seconds % 60).padStart(2, '0')}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
    </ul>
  </section>;
}
