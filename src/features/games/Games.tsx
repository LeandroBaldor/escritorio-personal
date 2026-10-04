import { Link } from 'react-router-dom';
import { CalculatorLink, CalendarLink, DeskLink, NotebookLink, SectionObjects } from '../../app/SectionObjects';
import { readRecord } from './BlockRunner';
import { HeroHead } from './HeroHead';
import { heroOf } from './heroes';
import { readSolitaireRecord, SUIT_COLORS } from './HeroSolitaire';
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

// Dibujo de la tarjeta del solitario: fondo de cómic y cuatro cartas en abanico, una de cada palo.
function SolitaireArt() {
  const card = (x: number, angle: number, rank: string, suit: Suit, who: number) =>
    <g transform={`rotate(${angle} ${x + 16} 96)`}>
      <rect x={x} y="24" width="32" height="46" rx="3" fill="#fff" stroke={SUIT_COLORS[suit]} strokeWidth="1.5" />
      <text x={x + 3.5} y="33" fontSize="8" fontWeight="900" fill={SUIT_COLORS[suit]} fontFamily="Nunito, sans-serif">{rank}</text>
      <svg x={x + 5} y="35" width="22" height="22" viewBox="0 0 48 48"><HeroHead look={heroOf(suit, who).look} /></svg>
      <rect x={x + 3} y="60" width="26" height="6" rx="1.5" fill={SUIT_COLORS[suit]} />
    </g>;
  return <svg viewBox="0 0 160 100" aria-hidden="true">
    <defs><pattern id="puntos" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="#ffffff14" /></pattern></defs>
    <rect width="160" height="100" fill="#172554" /><rect width="160" height="100" fill="url(#puntos)" />
    <path d="M80 50L0 0h40zM80 50L160 0v40zM80 50L160 100h-40zM80 50L0 100V60z" fill="#ffffff0a" />
    {card(30, -18, 'A', 'corazon', 1)}{card(52, -6, 'A', 'diamante', 1)}{card(76, 6, 'K', 'pica', 13)}{card(98, 18, 'A', 'trebol', 1)}
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
        <Link className="game-card game-card--heroes" to="/juegos/solitario">
          <SolitaireArt />
          <span className="game-card-text">
            <strong>Solitario de Superhéroes</strong>
            <span>El solitario de siempre con héroes y villanos de Marvel y DC: cada carta es un personaje.</span>
            {solitaire && <small>Récord: {Math.floor(solitaire.seconds / 60)}:{String(solitaire.seconds % 60).padStart(2, '0')}</small>}
          </span>
          <span className="game-card-play" aria-hidden="true">Jugar ▶</span>
        </Link>
      </li>
    </ul>
  </section>;
}
