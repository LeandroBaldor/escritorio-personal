import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Accesos a otras secciones dibujados como objetos del escritorio.
export function SectionObjects({ children, large = false }: { children: ReactNode; large?: boolean }) {
  return <nav className={large ? 'section-objects section-objects--large' : 'section-objects'} aria-label="Ir a otras secciones">{children}</nav>;
}

export function DeskLink() {
  return <Link className="desk-object" to="/" aria-label="Mi Escritorio" title="Mi Escritorio"><svg viewBox="0 0 120 84" aria-hidden="true"><path d="M30 14h4l9 20h-4z" fill="#3a2a20"/><path d="M22 10h18l-3 7H25z" fill="#f4bd58"/><rect x="58" y="18" width="34" height="16" rx="2" fill="#fff4dc" transform="rotate(-6 75 26)"/><rect x="4" y="34" width="112" height="10" rx="3" fill="#8c5738"/><rect x="4" y="34" width="112" height="3" rx="1.5" fill="#b07a52"/><rect x="10" y="44" width="7" height="38" fill="#603c29"/><rect x="103" y="44" width="7" height="38" fill="#603c29"/><rect x="66" y="44" width="40" height="26" fill="#75452d"/><rect x="70" y="48" width="32" height="8" rx="1.5" fill="#8c5738"/><rect x="70" y="59" width="32" height="8" rx="1.5" fill="#8c5738"/><circle cx="86" cy="52" r="1.6" fill="#f4bd58"/><circle cx="86" cy="63" r="1.6" fill="#f4bd58"/></svg><strong>Escritorio</strong></Link>;
}

export function CalculatorLink() {
  return <Link className="calc-object" to="/gastos" aria-label="Gastos" title="Gastos"><span aria-hidden="true">7 8 9<br />4 5 6<br />1 2 3</span><strong>Gastos</strong></Link>;
}

const SHORT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// Almanaque de mesa que siempre muestra el día de hoy.
export function CalendarLink() {
  const today = new Date();
  return <Link className="calendar-object" to="/calendario" aria-label="Calendario" title="Calendario">
    <span className="calendar-object-rings" aria-hidden="true"><i /><i /></span>
    <span className="calendar-object-month" aria-hidden="true">{SHORT_MONTHS[today.getMonth()]}</span>
    <span className="calendar-object-day" aria-hidden="true">{today.getDate()}</span>
    <strong>Calendario</strong>
  </Link>;
}

export function NotebookLink() {
  return <Link className="notebook" to="/diario" aria-label="Mi diario" title="Mi diario"><span className="notebook-binding" aria-hidden="true" /><span>Mi diario</span></Link>;
}

// Joystick de videojuego: lleva a la sección de juegos.
export function GamesLink() {
  return <Link className="games-object" to="/juegos" aria-label="Juegos" title="Juegos"><svg viewBox="0 0 120 76" aria-hidden="true"><path d="M30 10h60c16 0 26 12 28 30l2 18c1 10-5 16-12 16-6 0-10-4-14-10l-6-8H32l-6 8c-4 6-8 10-14 10C5 74-1 68 0 58l2-18C4 22 14 10 30 10z" fill="#e5e7eb"/><path d="M30 10h60c16 0 26 12 28 30l1 6C114 30 104 22 90 22H30C16 22 6 30 1 46l1-6C4 22 14 10 30 10z" fill="#fff"/><rect x="21" y="34" width="24" height="8" rx="2" fill="#334155"/><rect x="29" y="26" width="8" height="24" rx="2" fill="#334155"/><circle cx="84" cy="32" r="5" fill="#ef4444"/><circle cx="96" cy="40" r="5" fill="#3b82f6"/><circle cx="72" cy="40" r="5" fill="#22c55e"/><circle cx="84" cy="48" r="5" fill="#facc15"/><rect x="52" y="30" width="7" height="3" rx="1.5" fill="#94a3b8"/><rect x="61" y="30" width="7" height="3" rx="1.5" fill="#94a3b8"/></svg><strong>Juegos</strong></Link>;
}
