// Celulares y tablets en horizontal: el juego se arma como en una computadora de 1280 px de ancho (la misma
// barra, los mismos paneles, las mismas proporciones) y después se achica entero para que entre en la pantalla.
// Así se ve igual que en la computadora, solo que más chico. En la computadora (pantalla grande) no hace nada.
import { useEffect, useState, type CSSProperties } from 'react';

export const DESKTOP_W = 1280;

// Cuánto se achica (1 = sin achicar). Solo en horizontal y cuando la pantalla es más chica que una computadora.
// (se guarda y solo se recalcula al cambiar el tamaño de la pantalla: los juegos lo piden miles de veces por cuadro)
let cached: number | null = null;
// Pantalla táctil en horizontal: el juego va en el medio y a los costados las agarraderas del control.
export function hasGrips() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > window.innerHeight && !!window.matchMedia?.('(pointer: coarse)').matches;
}
// El ancho de cada agarradera (0 si no hay).
export function gripWidth() { return hasGrips() ? Math.round(Math.max(96, Math.min(190, window.innerWidth * 0.15))) : 0; }
const areaWidth = () => window.innerWidth - 2 * gripWidth();
function compute() {
  const w = areaWidth(), h = window.innerHeight;
  if (gripWidth()) return Math.min(1, w / DESKTOP_W);
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
export function fitViewport() { const k = fitScale(); return { w: areaWidth() / k, h: window.innerHeight / k }; }
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
  const g = gripWidth();
  if (k >= 1 && !g) return {};
  return {
    left: g, top: 0, right: 'auto', bottom: 'auto', width: areaWidth() / k, height: window.innerHeight / k,
    transform: `scale(${k})`, transformOrigin: '0 0', ['--fit' as string]: k,
  };
}
