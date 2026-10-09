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
  return <time className="hud-clock" dateTime={`${hh}:${mm}:${ss}`} aria-label={`Hora actual ${hh}:${mm}`}>
    <span className="hud-clock-bars hud-clock-bars--top" aria-hidden="true" />
    <span className="hud-clock-main" aria-hidden="true">{hh}<span className="hud-clock-colon">:</span>{mm}</span>
    <span className="hud-clock-sec" aria-hidden="true">:{ss}</span>
    <span className="hud-clock-bars hud-clock-bars--bottom" aria-hidden="true" />
  </time>;
}
