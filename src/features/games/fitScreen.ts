// Celulares y tablets en horizontal: el juego se arma como en una computadora de 1280 px de ancho (la misma
// barra, los mismos paneles, las mismas proporciones) y después se achica entero para que entre en la pantalla.
// Así se ve igual que en la computadora, solo que más chico. En la computadora (pantalla grande) no hace nada.
import { useEffect, useState, type CSSProperties } from 'react';

export const DESKTOP_W = 1280;

// Cuánto se achica (1 = sin achicar). Solo en horizontal y cuando la pantalla es más chica que una computadora.
// (se guarda y solo se recalcula al cambiar el tamaño de la pantalla: los juegos lo piden miles de veces por cuadro)
let cached: number | null = null;
function compute() {
  const w = window.innerWidth, h = window.innerHeight;
  return w <= h || (w >= 1200 && h >= 650) ? 1 : Math.min(1, w / DESKTOP_W);
}
if (typeof window !== 'undefined') { const reset = () => { cached = null; }; window.addEventListener('resize', reset); window.addEventListener('orientationchange', reset); }
export function fitScale(): number {
  if (typeof window === 'undefined') return 1;
  return cached ??= compute();
}
let dprCache = 1;
if (typeof window !== 'undefined') dprCache = window.devicePixelRatio || 1;
// El tamaño "de computadora" donde se arma el juego.
export function fitViewport() { const k = fitScale(); return { w: window.innerWidth / k, h: window.innerHeight / k }; }
// Píxeles reales por píxel del juego (para dibujar nítido sin gastar de más).
export function pixelRatio(max = Infinity) { if (cached === null && typeof window !== 'undefined') dprCache = window.devicePixelRatio || 1; return Math.min(max, dprCache) * fitScale(); }

// El estilo para la sección del juego (position: fixed, arriba a la izquierda).
export function useFitScreen(): CSSProperties {
  const [k, setK] = useState(fitScale);
  useEffect(() => {
    const on = () => { cached = null; setK(fitScale()); };
    window.addEventListener('resize', on); window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  if (k >= 1) return {};
  return {
    right: 'auto', bottom: 'auto', width: DESKTOP_W, height: window.innerHeight / k,
    transform: `scale(${k})`, transformOrigin: '0 0', ['--fit' as string]: k,
  };
}
