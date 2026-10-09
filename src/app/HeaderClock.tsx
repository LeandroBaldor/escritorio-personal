import { useEffect, useState } from 'react';

const two = (n: number) => String(n).padStart(2, '0');

// Reloj digital del encabezado, estilo pantalla futurista: horas y minutos grandes, segundos más chicos.
export function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Se sincroniza con el cambio de segundo para que no se atrase.
    let timer = 0;
    const tick = () => { setNow(new Date()); timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5); };
    timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    return () => clearTimeout(timer);
  }, []);
  const hh = two(now.getHours()), mm = two(now.getMinutes()), ss = two(now.getSeconds());
  // Cada dígito va en una cajita del mismo ancho, así el reloj no cambia de tamaño cuando cambian los números.
  const digits = (text: string) => [...text].map((d, i) => <span key={i} className="hud-clock-digit">{d}</span>);
  return <time className="hud-clock" dateTime={`${hh}:${mm}:${ss}`} aria-label={`Hora actual ${hh}:${mm}`}>
    <span className="hud-clock-bars hud-clock-bars--top" aria-hidden="true" />
    <span className="hud-clock-main" aria-hidden="true">{digits(hh)}<span className="hud-clock-colon">:</span>{digits(mm)}</span>
    <span className="hud-clock-sec" aria-hidden="true">:{digits(ss)}</span>
    <span className="hud-clock-bars hud-clock-bars--bottom" aria-hidden="true" />
  </time>;
}
