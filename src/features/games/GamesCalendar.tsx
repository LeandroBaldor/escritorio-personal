import { useEffect, useId, useState } from 'react';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// Lo que muestra la hoja del día: nombre del día, número, mes y año.
export function calendarParts(date: Date) {
  return { weekday: DAYS[date.getDay()], day: String(date.getDate()), month: MONTHS[date.getMonth()], year: String(date.getFullYear()) };
}

// Calendario de escritorio viejo, con anillos arriba y el papel gastado. Mide 840 × 666: el mismo alto
// que el meme y el reloj.
export function GamesCalendar() {
  const [today, setToday] = useState(() => new Date());
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const { weekday, day, month, year } = calendarParts(today);
  const paper = `paper-${id}`;
  const metal = `metal-${id}`;
  return <div className="games-calendar" role="img" aria-label={`${weekday} ${day} de ${month.toLowerCase()} de ${year}`}>
    <svg viewBox="0 0 840 666" aria-hidden="true">
      <defs>
        <radialGradient id={paper} cx=".5" cy=".55" r=".75">
          <stop offset="0" stopColor="#f4e4c1" /><stop offset=".65" stopColor="#ead3a4" /><stop offset="1" stopColor="#c99a5b" />
        </radialGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4b4b4b" /><stop offset=".45" stopColor="#d6d6d6" /><stop offset="1" stopColor="#5a5a5a" />
        </linearGradient>
      </defs>
      {/* Hojas de abajo y la hoja del día. */}
      <rect x="44" y="78" width="780" height="580" rx="22" fill="#a77c45" />
      <rect x="37" y="70" width="780" height="580" rx="22" fill="#c9a46b" />
      <rect x="30" y="60" width="780" height="580" rx="22" fill={`url(#${paper})`} />
      {/* Manchas de papel viejo y la punta doblada. */}
      <g fill="#a8692c">
        <ellipse cx="700" cy="200" rx="90" ry="55" opacity=".13" /><ellipse cx="130" cy="560" rx="80" ry="45" opacity=".12" />
        <ellipse cx="560" cy="600" rx="120" ry="25" opacity=".1" /><circle cx="760" cy="420" r="30" opacity=".12" />
      </g>
      <path d="M810 580V618Q810 640 788 640H750Z" fill="#dcc08e" stroke="#b08850" strokeWidth="2" />
      {/* Anillos. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const x = 90 + i * 110;
        return <g key={i}>
          <circle cx={x} cy="100" r="17" fill="#1b120b" />
          <rect x={x - 13} y="18" width="26" height="88" rx="13" fill="none" stroke={`url(#${metal})`} strokeWidth="9" />
        </g>;
      })}
      {/* Día de la semana y las rayas. */}
      <text x="420" y="240" textAnchor="middle" fill="#0b0808" className="games-calendar-weekday">{weekday}</text>
      <path d="M80 285H232M608 285H760" stroke="#141010" strokeWidth="5" />
      <rect x="244" y="277" width="352" height="16" rx="3" fill="#dc2626" />
      {/* Número del día, una raya y el mes con el año. */}
      <text x="250" y="575" textAnchor="middle" fill="#0b0808" className="games-calendar-day">{day}</text>
      <path d="M462 330V590" stroke="#141010" strokeWidth="5" />
      <text x="632" y="440" textAnchor="middle" fill="#0b0808" className="games-calendar-month"
        textLength={Math.min(300, month.length * 44)} lengthAdjust="spacingAndGlyphs">{month}</text>
      <text x="632" y="560" textAnchor="middle" fill="#0b0808" className="games-calendar-year"
        textLength="230" lengthAdjust="spacingAndGlyphs">{year}</text>
    </svg>
  </div>;
}
