import { useEffect, useState } from 'react';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// La fecha de hoy al lado del reloj: una píldora de neón rosa, violeta y azul con un almanaque, el día de la
// semana, el número grande en violeta y el mes con el año. Se actualiza sola al pasar la medianoche.
export function HeaderDate() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => { setToday(new Date()); schedule(); }, next.getTime() - now.getTime() + 50);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return <time className="neon-date" dateTime={iso}>
    <svg className="neon-date-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      {[7.5, 10.5, 13.5, 16.5].map(x => [12.6, 16].map(y => <rect key={`${x}-${y}`} className="neon-date-dot" x={x - 0.9} y={y - 0.9} width="1.8" height="1.8" rx=".3" />))}
    </svg>
    <span className="neon-date-text">{DAYS[today.getDay()]} <b className="neon-date-day">{today.getDate()}</b> de {MONTHS[today.getMonth()]} {today.getFullYear()}</span>
  </time>;
}
