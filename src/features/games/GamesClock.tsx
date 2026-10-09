import { useEffect, useId, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

// Hora en 24 h separada como se dibuja: horas y minutos grandes, segundos aparte.
export function clockParts(date: Date) {
  return { hm: `${pad(date.getHours())}:${pad(date.getMinutes())}`, s: pad(date.getSeconds()) };
}

// Reloj digital con marco neón (cian, azul y un toque violeta). Tiene la misma proporción que el meme
// (1200 × 666) para que los dos se vean del mismo tamaño.
export function GamesClock() {
  const [now, setNow] = useState(() => new Date());
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { hm, s } = clockParts(now);
  const glow = `glow-${id}`;
  const soft = `soft-${id}`;
  const fade = `fade-${id}`;
  return <div className="games-clock" role="timer" aria-label={`Son las ${hm}`}>
    <svg viewBox="0 0 1200 666" aria-hidden="true">
      <defs>
        <filter id={glow} x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={soft} x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={fade} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" /><stop offset=".7" stopColor="#3b82f6" /><stop offset="1" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      {/* Fondo y marco exterior con las esquinas cortadas. */}
      <path d="M70 0H1130L1200 70V596L1130 666H70L0 596V70Z" fill="#03071a" />
      <g fill="none" filter={`url(#${soft})`}>
        <path d="M70 14H1126L1186 74V592L1126 652H74L14 592V74Z" stroke={`url(#${fade})`} strokeWidth="7" />
        <path d="M140 150H1060L1110 200V470L1060 520H140L90 470V200Z" stroke="#38bdf8" strokeWidth="4" />
        <path d="M640 52H1000" stroke="#c4b5fd" strokeWidth="10" strokeLinecap="round" />
        <path d="M760 612H1140L1170 582" stroke="#c084fc" strokeWidth="6" />
        <path d="M440 120H700M720 120H900M60 220V420M1140 230V440" stroke="#2563eb" strokeWidth="4" />
      </g>
      {/* Grilla tenue de fondo. */}
      <g stroke="#1e3a8a" strokeWidth="1.5" opacity=".5">
        <path d="M120 255H1080M120 335H1080M120 415H1080M300 160V510M500 160V510M700 160V510M900 160V510" />
      </g>
      {/* Rayas diagonales arriba a la izquierda y abajo. */}
      <g fill="#a5f3fc" filter={`url(#${soft})`}>
        <path d="M110 110L150 50H230L190 110Z" /><path d="M210 110L250 50H330L290 110Z" /><path d="M310 110L350 50H430L390 110Z" />
      </g>
      <g fill="#22d3ee" filter={`url(#${soft})`}>
        <path d="M60 545L100 545L140 600H100Z" /><path d="M130 600L170 545H210L170 600Z" /><path d="M200 600L240 545H280L240 600Z" /><path d="M270 600L310 545H350L310 600Z" /><path d="M340 600L380 545H420L380 600Z" />
        <path d="M900 575L915 555H935L920 575Z" /><path d="M945 575L960 555H980L965 575Z" /><path d="M990 575L1005 555H1025L1010 575Z" /><path d="M1035 575L1050 555H1070L1055 575Z" />
      </g>
      {/* La hora. */}
      <text x="600" y="415" textAnchor="middle" fill="#f0f9ff" filter={`url(#${glow})`} className="games-clock-time">
        {hm}<tspan dx="14" fill="#22d3ee" fontSize="120">:{s}</tspan>
      </text>
    </svg>
  </div>;
}
